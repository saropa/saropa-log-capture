/**
 * Incremental trigram search index for cross-session log search (plan 029).
 *
 * Lives at `.saropa/index/search/manifest.json`. The index is a pure PRUNING accelerator for literal
 * searches: it can only remove files that provably cannot contain the query (they lack a query
 * trigram). Every surviving candidate is still scanned for real, so a stale, partial, or missing
 * index degrades to a slower scan — never to a wrong or missing result. Regex queries are never
 * pruned (we cannot derive mandatory trigrams safely) and fall back to the full scan.
 *
 * Distinct from SearchIndexManager in search-index.ts, which is a metadata-only (line-count/size)
 * cache and does not accelerate content matching.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri, getSearchIndexDirUri, readTrackedFiles } from '../config/config';
import {
    containsAllTrigrams, decodeTrigrams, encodeTrigrams, extractTrigrams,
} from './search-index-trigram';
import type { SearchIndexFileEntry, SearchIndexManifest } from './search-index-types';

export { getGlobalSearchIndex, setGlobalSearchIndex } from './search-index-global';

const INDEX_VERSION = 1;
/** Skip indexing a log larger than this — buffering a multi-MB capture just to trigram it is wasteful;
 *  oversized files are simply not pruned (they always get scanned), so correctness is unaffected. */
const MAX_INDEX_FILE_BYTES = 8 * 1024 * 1024;
const INDEX_BATCH_SIZE = 8;

export class TrigramSearchIndex {
    private entries = new Map<string, SearchIndexFileEntry>();
    private decodedCache = new Map<string, Uint32Array>();
    private loaded = false;
    /** Serializes writes so a session-end update and a manual rebuild cannot interleave saves. */
    private writeChain: Promise<void> = Promise.resolve();

    constructor(private readonly workspaceFolder: vscode.WorkspaceFolder) {}

    private manifestUri(): vscode.Uri {
        return vscode.Uri.joinPath(getSearchIndexDirUri(this.workspaceFolder), 'manifest.json');
    }

    /** Workspace-relative key used to match index entries to live files. */
    private keyFor(uri: vscode.Uri): string {
        return vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
    }

    /** Load the manifest from disk once. A missing/invalid/old-version manifest yields an empty index. */
    async load(): Promise<void> {
        if (this.loaded) { return; }
        this.loaded = true;
        try {
            const raw = await vscode.workspace.fs.readFile(this.manifestUri());
            const parsed = JSON.parse(Buffer.from(raw).toString('utf-8')) as SearchIndexManifest;
            if (parsed.version === INDEX_VERSION && Array.isArray(parsed.files)) {
                for (const f of parsed.files) { this.entries.set(f.relativePath, f); }
            }
        } catch { /* no index yet — first search just scans everything */ }
    }

    /**
     * Narrow `logFiles` to those a literal query could match. Returns null when pruning does not
     * apply (index disabled, query too short to yield a trigram, or the index is empty) so the
     * caller scans everything. Stale entries (mtime/size changed) stay candidates and are queued
     * for re-index in the background.
     */
    async narrowLiteral(logFiles: readonly vscode.Uri[], query: string): Promise<vscode.Uri[] | null> {
        if (!getConfig().searchIndex.enabled) { return null; }
        const required = extractTrigrams(query);
        if (required.length === 0) { return null; }
        await this.load();
        if (this.entries.size === 0) { return null; }

        const candidates: vscode.Uri[] = [];
        const staleUris: vscode.Uri[] = [];
        const stats = await Promise.all(logFiles.map((u) => this.statOrNull(u)));
        for (let i = 0; i < logFiles.length; i++) {
            const uri = logFiles[i];
            const stat = stats[i];
            const entry = this.entries.get(this.keyFor(uri));
            // Unindexed or gone-from-disk → must scan; changed-since-index → scan and queue re-index.
            if (!entry || !stat) {
                candidates.push(uri);
            } else if (entry.mtime !== stat.mtime || entry.sizeBytes !== stat.size) {
                candidates.push(uri);
                staleUris.push(uri);
            } else if (containsAllTrigrams(this.decode(entry), required)) {
                candidates.push(uri);
            }
        }
        if (staleUris.length > 0) { void this.reindexInBackground(staleUris); }
        return candidates;
    }

    /** Re-index one file after a session ends or after a stale hit. Best-effort; persists on success. */
    async updateForFile(uri: vscode.Uri): Promise<void> {
        await this.load();
        const entry = await this.buildEntry(uri);
        if (!entry) { return; }
        this.entries.set(entry.relativePath, entry);
        this.decodedCache.delete(entry.relativePath);
        this.evictToCap();
        await this.persist();
    }

    /** Full rebuild: scan every tracked log file under the configured log directory. */
    async rebuild(): Promise<number> {
        const logDir = getLogDirectoryUri(this.workspaceFolder);
        const { fileTypes, includeSubfolders } = getConfig();
        const tracked = await readTrackedFiles(logDir, fileTypes, includeSubfolders);
        const uris = tracked.map((rel) => vscode.Uri.joinPath(logDir, rel));
        this.entries.clear();
        this.decodedCache.clear();
        this.loaded = true;
        for (let i = 0; i < uris.length; i += INDEX_BATCH_SIZE) {
            const batch = uris.slice(i, i + INDEX_BATCH_SIZE);
            const built = await Promise.all(batch.map((u) => this.buildEntry(u)));
            for (const e of built) { if (e) { this.entries.set(e.relativePath, e); } }
        }
        this.evictToCap();
        await this.persist();
        return this.entries.size;
    }

    /** Drop the entry for a file (called from retention/trash flows when a log is deleted). */
    async removeFile(uri: vscode.Uri): Promise<void> {
        await this.load();
        const key = this.keyFor(uri);
        if (!this.entries.delete(key)) { return; }
        this.decodedCache.delete(key);
        await this.persist();
    }

    private decode(entry: SearchIndexFileEntry): Uint32Array {
        const cached = this.decodedCache.get(entry.relativePath);
        if (cached) { return cached; }
        const decoded = decodeTrigrams(entry.trigrams);
        this.decodedCache.set(entry.relativePath, decoded);
        return decoded;
    }

    private async statOrNull(uri: vscode.Uri): Promise<vscode.FileStat | null> {
        try { return await vscode.workspace.fs.stat(uri); } catch { return null; }
    }

    /** Read + trigram one file into an entry. Returns null when unreadable or over the size cap. */
    private async buildEntry(uri: vscode.Uri): Promise<SearchIndexFileEntry | null> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.size > MAX_INDEX_FILE_BYTES) { return null; }
            const raw = await vscode.workspace.fs.readFile(uri);
            const trigrams = extractTrigrams(Buffer.from(raw).toString('utf-8'));
            return {
                relativePath: this.keyFor(uri),
                mtime: stat.mtime,
                sizeBytes: stat.size,
                trigrams: encodeTrigrams(trigrams),
            };
        } catch { return null; }
    }

    /** Evict oldest-mtime entries until the serialized blob fits the configured cap. */
    private evictToCap(): void {
        const capBytes = getConfig().searchIndex.maxSizeMB * 1024 * 1024;
        let total = 0;
        for (const e of this.entries.values()) { total += e.trigrams.length; }
        if (total <= capBytes) { return; }
        const oldestFirst = [...this.entries.values()].sort((a, b) => a.mtime - b.mtime);
        for (const e of oldestFirst) {
            if (total <= capBytes || this.entries.size <= 1) { break; }
            total -= e.trigrams.length;
            this.entries.delete(e.relativePath);
            this.decodedCache.delete(e.relativePath);
        }
    }

    private reindexInBackground(uris: readonly vscode.Uri[]): Promise<void> {
        return uris.reduce(
            (chain, uri) => chain.then(() => this.updateForFile(uri).catch(() => {})),
            Promise.resolve(),
        );
    }

    /** Queue an atomic save behind any in-flight write so saves never interleave. */
    private persist(): Promise<void> {
        this.writeChain = this.writeChain.then(() => this.save()).catch(() => {});
        return this.writeChain;
    }

    /** Write the manifest via temp file + rename so a crash mid-write can't corrupt the index. */
    private async save(): Promise<void> {
        const dir = getSearchIndexDirUri(this.workspaceFolder);
        await vscode.workspace.fs.createDirectory(dir);
        const manifest: SearchIndexManifest = {
            version: INDEX_VERSION,
            updatedAt: Date.now(),
            files: [...this.entries.values()],
        };
        const tmp = vscode.Uri.joinPath(dir, 'manifest.json.tmp');
        const body = Buffer.from(JSON.stringify(manifest), 'utf-8');
        await vscode.workspace.fs.writeFile(tmp, body);
        await vscode.workspace.fs.rename(tmp, this.manifestUri(), { overwrite: true });
    }
}
