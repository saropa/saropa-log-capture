/**
 * Lightweight, delta-aware project indexer for docs/bugs/root and reports.
 * Index files live in .saropa/index/; reports use .session-metadata.json.
 */

import * as vscode from 'vscode';
import { getConfig, getSaropaIndexDirUri } from '../config/config';
import type { ProjectIndexSourceConfig } from '../config/config';
import { buildRootPatternsForDocFileTypes, DEFAULT_DOC_FILE_TYPES, extractDocTokensByType, FIND_FILES_EXCLUDE_GLOB, isBlockedRelativePath, matchesDocFileType, normalizeDocFileTypes } from './project-indexer-file-types';
import { buildReportIndex } from './build-report-index';
import type {
    DocIndexEntry,
    ReportIndexEntry,
    IndexEntry,
    SourceIndexFile,
    ManifestSourceMeta,
    IndexManifest,
} from './project-indexer-types';
import { tokenCountOfEntry } from './project-indexer-types';
import type { RankedDocDebugEntry, RankedDocEntry } from './project-indexer-ranking';
import { queryDocEntriesByTokensWithDebugFromIndexes, queryDocEntriesByTokensWithScoresFromIndexes } from './project-indexer-query';
export { getGlobalProjectIndexer, setGlobalProjectIndexer } from './project-indexer-global';

export type { DocIndexEntry, ReportIndexEntry, IndexEntry, SourceIndexFile, ManifestSourceMeta, IndexManifest } from './project-indexer-types';

const INDEX_VERSION = 1;
const BATCH_SIZE = 10;

export class ProjectIndexer {
    private manifest: IndexManifest | undefined;
    private sourceIndexes = new Map<string, SourceIndexFile>();
    private dirtySources = new Set<string>();
    private buildPromise: Promise<void> | undefined;
    private watchers: vscode.Disposable[] = [];

    constructor(private readonly workspaceFolder: vscode.WorkspaceFolder) {}

    private get indexDir(): vscode.Uri {
        return getSaropaIndexDirUri(this.workspaceFolder);
    }

    private manifestUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.indexDir, 'manifest.json');
    }

    private sourceIndexUri(sourceId: string): vscode.Uri {
        return vscode.Uri.joinPath(this.indexDir, `${sourceId}.idx.json`);
    }

    /** Load manifest from disk. */
    async loadManifest(): Promise<IndexManifest | undefined> {
        try {
            const raw = await vscode.workspace.fs.readFile(this.manifestUri());
            const parsed = JSON.parse(Buffer.from(raw).toString('utf-8')) as IndexManifest;
            if (parsed.version === INDEX_VERSION) {
                this.manifest = parsed;
                return this.manifest;
            }
        } catch { /* no manifest or invalid */ }
        return undefined;
    }

    /** Load a single source index from disk. */
    async loadSourceIndex(sourceId: string): Promise<SourceIndexFile | undefined> {
        try {
            const raw = await vscode.workspace.fs.readFile(this.sourceIndexUri(sourceId));
            const parsed = JSON.parse(Buffer.from(raw).toString('utf-8')) as SourceIndexFile;
            if (parsed.version === INDEX_VERSION) {
                this.sourceIndexes.set(sourceId, parsed);
                return parsed;
            }
        } catch { /* no file or invalid */ }
        return undefined;
    }

    /** Get or rebuild index; returns current in-memory state; if stale, triggers background rebuild. */
    async getOrRebuild(maxAgeMs: number): Promise<{ manifest: IndexManifest | undefined; getSourceIndex: (id: string) => SourceIndexFile | undefined }> {
        const cfg = getConfig().projectIndex;
        if (!cfg.enabled) {
            return { manifest: undefined, getSourceIndex: () => undefined };
        }
        if (!this.manifest) {
            await this.loadManifest();
            const manifest = this.manifest as IndexManifest | undefined;
            if (manifest) {
                for (const s of manifest.sources) {
                    await this.loadSourceIndex(s.id);
                }
            }
        }
        const now = Date.now();
        const updatedAt = this.manifest?.updatedAt ? new Date(this.manifest.updatedAt).getTime() : 0;
        const stale = !this.manifest || this.dirtySources.size > 0 || (maxAgeMs > 0 && now - updatedAt > maxAgeMs);
        if (stale) {
            if (!this.buildPromise) {
                this.buildPromise = this.build(undefined).finally(() => { this.buildPromise = undefined; });
            }
            this.buildPromise.catch(() => {});
        }
        const getSourceIndex = (id: string): SourceIndexFile | undefined => this.sourceIndexes.get(id);
        return { manifest: this.manifest, getSourceIndex };
    }

    /** Full rebuild. Optional getActiveLogUri: exclude that log from reports index. */
    async build(getActiveLogUri?: () => vscode.Uri | undefined): Promise<void> {
        const cfg = getConfig().projectIndex;
        if (!cfg.enabled) { return; }
        await vscode.workspace.fs.createDirectory(this.indexDir);
        const now = new Date().toISOString();
        const sourcesMeta: ManifestSourceMeta[] = [];
        for (const src of cfg.sources) {
            if (src.enabled === false) { continue; }
            const id = src.path === '.' ? 'root-files' : src.path.replace(/[/\\]/g, '_').replace(/^\./, '') || 'root';
            const idx = await this.buildSourceDocs(id, src);
            sourcesMeta.push({
                id, path: src.path, enabled: true, fileTypes: src.fileTypes,
                lastIndexed: now, fileCount: idx.files.length,
                tokenCount: idx.files.reduce((s, f) => s + tokenCountOfEntry(f), 0),
            });
            this.sourceIndexes.set(id, idx);
            await this.writeSourceIndex(id, idx);
        }
        if (cfg.includeRootFiles) {
            const rootIdx = await this.buildSourceDocs('root-files', { path: '.', fileTypes: [...DEFAULT_DOC_FILE_TYPES], enabled: true });
            sourcesMeta.push({
                id: 'root-files', path: '.', enabled: true, fileTypes: [...DEFAULT_DOC_FILE_TYPES], lastIndexed: now,
                fileCount: rootIdx.files.length, tokenCount: rootIdx.files.reduce((s, f) => s + tokenCountOfEntry(f), 0),
            });
            this.sourceIndexes.set('root-files', rootIdx);
            await this.writeSourceIndex('root-files', rootIdx);
        }
        if (cfg.includeReports) {
            const reportIdx = await buildReportIndex(this.workspaceFolder, getActiveLogUri);
            const tokenCount = reportIdx.files.reduce((s, f) => s + tokenCountOfEntry(f), 0);
            sourcesMeta.push({
                id: 'reports', path: 'reports', enabled: true, strategy: 'sidecar', lastIndexed: now,
                fileCount: reportIdx.files.length, tokenCount,
            } as ManifestSourceMeta & { strategy?: string });
            this.sourceIndexes.set('reports', reportIdx);
            await this.writeSourceIndex('reports', reportIdx);
        }
        this.manifest = { version: INDEX_VERSION, createdAt: this.manifest?.createdAt ?? now, updatedAt: now, sources: sourcesMeta };
        this.dirtySources.clear();
        await this.writeManifest();
    }

    /** Register file watchers for doc sources (not reports). Call from extension; dispose on deactivate. */
    startWatching(): void {
        const cfg = getConfig().projectIndex;
        if (!cfg.enabled) { return; }
        for (const src of cfg.sources) {
            if (src.enabled === false || src.path === '.' || src.path === 'reports') { continue; }
            const sourceId = src.path.replace(/[/\\]/g, '_').replace(/^\./, '') || 'root';
            const pattern = new vscode.RelativePattern(this.workspaceFolder, `${src.path}/**/*`);
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            const mark = () => { this.dirtySources.add(sourceId); };
            watcher.onDidChange(mark);
            watcher.onDidCreate(mark);
            watcher.onDidDelete(mark);
            this.watchers.push(watcher);
        }
    }

    dispose(): void {
        for (const w of this.watchers) { w.dispose(); }
        this.watchers = [];
    }

    private async findRootFileUris(fileTypes: string[], maxFiles: number, rel: (u: vscode.Uri) => string): Promise<vscode.Uri[]> {
        const patterns = buildRootPatternsForDocFileTypes(fileTypes);
        const results = await Promise.all(patterns.map((p) => vscode.workspace.findFiles(new vscode.RelativePattern(this.workspaceFolder, p), null, maxFiles)));
        const seen = new Set<string>();
        const uris: vscode.Uri[] = [];
        for (const batch of results) {
            for (const u of batch) {
                const r = rel(u);
                if (!r.includes('/') && !seen.has(r)) { seen.add(r); uris.push(u); }
            }
        }
        return uris;
    }

    private async buildSourceDocs(sourceId: string, src: ProjectIndexSourceConfig): Promise<SourceIndexFile> {
        const maxFiles = getConfig().projectIndex.maxFilesPerSource;
        const fileTypes = normalizeDocFileTypes(src.fileTypes);
        const existing = this.sourceIndexes.get(sourceId)?.files ?? [];
        const existingByPath = new Map(existing.map((e) => [e.relativePath, e]));
        const rel = (u: vscode.Uri): string => vscode.workspace.asRelativePath(u).replace(/\\/g, '/');
        const uris = src.path === '.'
            ? await this.findRootFileUris(fileTypes, maxFiles, rel)
            : await vscode.workspace.findFiles(
                new vscode.RelativePattern(this.workspaceFolder, `${src.path}/**/*`),
                FIND_FILES_EXCLUDE_GLOB,
                maxFiles,
            );
        const filtered = uris.filter((u) => {
            const r = rel(u);
            if (isBlockedRelativePath(r)) { return false; }
            return matchesDocFileType(r, fileTypes);
        }).slice(0, maxFiles);
        const entries: DocIndexEntry[] = [];
        for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
            const batch = filtered.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map((uri) => this.indexDocFile(uri, existingByPath, rel(uri))));
            for (const e of results) { if (e) { entries.push(e); } }
        }
        return { version: INDEX_VERSION, sourceId, buildTime: Date.now(), files: entries };
    }

    private async indexDocFile(uri: vscode.Uri, existingByPath: Map<string, IndexEntry>, relativePath: string): Promise<DocIndexEntry | null> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            const existing = existingByPath.get(relativePath) as DocIndexEntry | undefined;
            if (existing && existing.mtime === stat.mtime && existing.sizeBytes === stat.size) {
                return existing;
            }
            const raw = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(raw).toString('utf-8');
            const lineCount = content.split(/\r?\n/).length;
            const ext = uri.fsPath.slice(uri.fsPath.lastIndexOf('.'));
            const lowerPath = uri.fsPath.toLowerCase();
            const { tokens, headings } = extractDocTokensByType(content, ext, lowerPath);
            return {
                relativePath, uri: uri.toString(), sizeBytes: stat.size, mtime: stat.mtime,
                lineCount, tokens, headings,
            };
        } catch { return null; }
    }

    private async writeManifest(): Promise<void> {
        if (!this.manifest) { return; }
        await vscode.workspace.fs.writeFile(this.manifestUri(), Buffer.from(JSON.stringify(this.manifest, null, 2), 'utf-8'));
    }

    private async writeSourceIndex(sourceId: string, idx: SourceIndexFile): Promise<void> {
        await vscode.workspace.fs.writeFile(this.sourceIndexUri(sourceId), Buffer.from(JSON.stringify(idx, null, 2), 'utf-8'));
    }

    /** Inline update: add or replace one entry in a source index. */
    async upsertEntry(sourceId: string, entry: IndexEntry): Promise<void> {
        const idx = await this.loadSourceIndex(sourceId) ?? { version: INDEX_VERSION, sourceId, buildTime: Date.now(), files: [] };
        const files = idx.files.filter((f) => f.relativePath !== entry.relativePath);
        files.push(entry);
        const updated: SourceIndexFile = { ...idx, buildTime: Date.now(), files };
        this.sourceIndexes.set(sourceId, updated);
        await this.writeSourceIndex(sourceId, updated);
    }

    /** Build a report index entry from in-memory meta (e.g. from metadata store). */
    async upsertReportEntryFromMeta(
        logUri: vscode.Uri,
        meta: { correlationTags?: string[]; fingerprints?: Array<{ n: string }>; displayName?: string; tags?: string[]; errorCount?: number; warningCount?: number },
    ): Promise<void> {
        const relativePath = vscode.workspace.asRelativePath(logUri).replace(/\\/g, '/');
        try {
            const stat = await vscode.workspace.fs.stat(logUri);
            const fingerprints = (meta.fingerprints ?? []).map((fp) => fp.n);
            const entry: ReportIndexEntry = {
                relativePath, uri: logUri.toString(), sizeBytes: stat.size, mtime: stat.mtime,
                displayName: meta.displayName, tags: meta.tags,
                correlationTokens: meta.correlationTags ?? [], fingerprints,
                errorCount: meta.errorCount, warningCount: meta.warningCount,
            };
            await this.upsertEntry('reports', entry);
        } catch { /* skip if file gone */ }
    }

    /** Inline update: remove one entry. */
    async removeEntry(sourceId: string, relativePath: string): Promise<void> {
        const idx = await this.loadSourceIndex(sourceId);
        if (!idx) { return; }
        const files = idx.files.filter((f) => f.relativePath !== relativePath);
        const updated: SourceIndexFile = { ...idx, buildTime: Date.now(), files };
        this.sourceIndexes.set(sourceId, updated);
        await this.writeSourceIndex(sourceId, updated);
    }

    /** Query: return doc entries whose tokens intersect the given tokens (for docs sources). */
    queryDocEntriesByTokens(tokens: string[]): DocIndexEntry[] {
        return this.queryDocEntriesByTokensWithScores(tokens).map((item) => item.doc);
    }

    /** Query: return ranked doc entries and scores for debugging/tuning relevance. */
    queryDocEntriesByTokensWithScores(tokens: string[]): RankedDocEntry[] {
        return queryDocEntriesByTokensWithScoresFromIndexes(this.sourceIndexes, tokens);
    }

    /** Query: ranked doc entries and token-level score contributions for debugging/tuning relevance. */
    queryDocEntriesByTokensWithDebug(tokens: string[]): RankedDocDebugEntry[] {
        return queryDocEntriesByTokensWithDebugFromIndexes(this.sourceIndexes, tokens);
    }
}
