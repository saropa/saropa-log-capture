/**
 * Metadata loading and sidecar merging for SessionHistoryProvider.
 * Extracted to keep session-history-provider.ts under the line limit.
 */

import * as vscode from 'vscode';
import { hasMeaningfulPerformanceData, SessionMetadataStore, type SessionMeta } from '../../modules/session/session-metadata';
import { SessionMetadata } from './session-history-grouping';
import { parseHeader } from './session-history-helpers';

/** Target interface exposing metadata cache and store for loading operations. */
export interface LoadMetadataTarget {
    readonly metaStore: SessionMetadataStore;
    readonly metaCache: Map<string, SessionMetadata>;
}

/** Callback fired after each item finishes loading (index is the original file order).
 * Returning a promise is supported — the worker awaits it before loading the next
 * file so each item can be sent to the webview before the next one starts. */
export type OnItemLoaded = (item: SessionMetadata, index: number) => void | Promise<void>;

/** A file's stat result paired with its identity — the cheap groupable skeleton
 *  emitted before any file body is read. mtime is all the webview needs to day-group. */
export interface SessionPreviewRecord {
    readonly uri: vscode.Uri;
    readonly filename: string;
    readonly size: number;
    readonly mtime: number;
}

/** Options for loadBatch beyond the required parameters. */
export interface LoadBatchOptions {
    readonly centralMeta: ReadonlyMap<string, SessionMeta>;
    readonly onItemLoaded?: OnItemLoaded;
    /** Fired once after the cheap stat pass with mtime/size for every file. Lets the
     *  webview paint a day-grouped skeleton (grouping needs only mtime) before the
     *  expensive parseHeader pass — parseHeader reads the whole file, so emitting the
     *  grouped structure up-front is what makes the panel feel instant. */
    readonly onItemPreview?: (previews: readonly SessionPreviewRecord[]) => void;
}

/** Run an async worker over indices [0, count) with bounded concurrency (max 8). */
async function mapBounded(count: number, work: (i: number) => Promise<void>): Promise<void> {
    let index = 0;
    const run = async (): Promise<void> => {
        while (index < count) { await work(index++); }
    };
    await Promise.all(Array.from({ length: Math.min(8, count) }, () => run()));
}

/** Cheap stat for every file → groupable skeleton records (mtime/size only).
 *  Files that fail to stat (deleted between listing and load) yield undefined and
 *  are skipped downstream rather than aborting the whole batch. */
async function statAll(logDir: vscode.Uri, files: readonly string[]): Promise<(SessionPreviewRecord | undefined)[]> {
    const out: (SessionPreviewRecord | undefined)[] = new Array(files.length);
    await mapBounded(files.length, async (i) => {
        const uri = vscode.Uri.joinPath(logDir, files[i]);
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            out[i] = { uri, filename: files[i], size: stat.size, mtime: stat.mtime };
        } catch { out[i] = undefined; }
    });
    return out;
}

/** Load metadata for all files: a fast stat pass (emits the grouped preview) followed
 *  by the slow parseHeader pass (emits per-item hydration). Bounded concurrency on both. */
export async function loadBatch(
    target: LoadMetadataTarget,
    logDir: vscode.Uri,
    files: readonly string[],
    opts: LoadBatchOptions,
): Promise<SessionMetadata[]> {
    const { centralMeta, onItemLoaded, onItemPreview } = opts;
    const stats = await statAll(logDir, files);
    /* Emit the skeleton before any file body is read so the panel paints immediately. */
    if (onItemPreview) {
        onItemPreview(stats.filter((s): s is SessionPreviewRecord => s !== undefined));
    }
    const results: SessionMetadata[] = new Array(files.length);
    /* Header-cache misses accumulate here and are written back in ONE central write below —
     * persisting per file would be O(files) writes and defeat the cache's purpose. */
    const headerWriteback = new Map<string, ParsedHeaderCache>();
    await mapBounded(files.length, async (i) => {
        const base = stats[i];
        if (!base) { return; }
        results[i] = await loadMetadata(target, centralMeta, base, headerWriteback);
        /* Await the callback so each item reaches the webview before the
         * worker moves on to the next file — gives progressive UI updates. */
        await onItemLoaded?.(results[i], i);
    });
    /* Single write-back for every freshly-parsed header (best-effort: a failed write just
     * means the next load re-parses those files). */
    if (headerWriteback.size > 0) {
        await target.metaStore.saveParsedHeaderBatch(logDir, headerWriteback).catch(() => { /* non-critical */ });
    }
    /* Drop holes left by failed stats so callers never see undefined rows. */
    return results.filter((r): r is SessionMetadata => r !== undefined);
}

/** Persisted header-cache shape (see SessionMeta.parsedHeader). */
type ParsedHeaderCache = NonNullable<SessionMeta['parsedHeader']>;

/** True when the sidecar's cached header was computed for this exact file revision. */
function headerCacheValid(sidecar: SessionMeta, base: SessionPreviewRecord): boolean {
    const ph = sidecar.parsedHeader;
    return !!ph && ph.mtime === base.mtime && ph.size === base.size;
}

/** Populate the tree item's header fields from the cached header (no file read). */
function applyCachedHeader(meta: SessionMetadata, ph: ParsedHeaderCache): SessionMetadata {
    return {
        ...meta,
        date: ph.date, project: ph.project, adapter: ph.adapter,
        lineCount: ph.lineCount, hasTimestamps: ph.hasTimestamps, durationMs: ph.durationMs,
    };
}

/** Build a cache entry from a freshly-parsed header, stamped with the revision it is valid for. */
function parsedHeaderFrom(meta: SessionMetadata, base: SessionPreviewRecord): ParsedHeaderCache {
    return {
        mtime: base.mtime, size: base.size,
        date: meta.date, project: meta.project, adapter: meta.adapter,
        lineCount: meta.lineCount, hasTimestamps: meta.hasTimestamps, durationMs: meta.durationMs,
    };
}

/** Load and cache metadata for a single session file from its prefetched stat.
 *  Never scans the body — severities arrive later from the deferred worker.
 *  On a header-cache miss, queues a write-back into `writeback` (flushed once by loadBatch). */
async function loadMetadata(
    target: LoadMetadataTarget,
    centralMeta: ReadonlyMap<string, SessionMeta>,
    base: SessionPreviewRecord,
    writeback: Map<string, ParsedHeaderCache>,
): Promise<SessionMetadata> {
    const { uri, filename } = base;
    const cacheKey = `${uri.toString()}|${base.mtime}|${base.size}`;
    const cached = target.metaCache.get(cacheKey);
    if (cached) { return cached; }
    const relKey = vscode.workspace.asRelativePath(uri).replace(/\\/g, '/');
    const sidecar = centralMeta.get(relKey) ?? {};
    // V2 schema gate: require `debugCount` (new bucket added when classifyLevel
    // replaced the V1 quick-scanner). V1 sidecars have errorCount but not
    // debugCount, so they re-scan via the deferred worker to backfill the new
    // buckets — otherwise debug/database/todo/notice would stay permanently 0.
    const hasCachedSev = sidecar.errorCount !== undefined && sidecar.debugCount !== undefined;
    let meta: SessionMetadata = { uri, filename, size: base.size, mtime: base.mtime };
    // Persistent header cache: reuse the stored header while mtime+size still match, so a
    // multi-thousand-file archive doesn't re-open every file on each panel load. Misses re-parse
    // and queue a write-back, which loadBatch flushes as a SINGLE central write.
    if (headerCacheValid(sidecar, base)) {
        meta = applyCachedHeader(meta, sidecar.parsedHeader!);
    } else {
        meta = await parseHeader(uri, meta);
        writeback.set(relKey, parsedHeaderFrom(meta, base));
    }
    meta = applySidecar(meta, sidecar, hasCachedSev);
    target.metaCache.set(cacheKey, meta);
    return meta;
}

/** True when session meta has performance integration data (snapshot or samples). */
function hasPerformanceData(sidecar: SessionMeta): boolean {
    return hasMeaningfulPerformanceData(sidecar.integrations?.performance);
}

/** Merge sidecar metadata into the parsed session metadata.
 *  Severities are applied ONLY when V2-cached. Files without cached counts get
 *  no severity fields here — the deferred worker computes them and posts an
 *  update. No write-back path: parseHeader no longer produces counts. */
function applySidecar(
    meta: SessionMetadata, sidecar: SessionMeta, hasCachedSev: boolean,
): SessionMetadata {
    let result = meta;
    if (sidecar.displayName) { result = { ...result, displayName: sidecar.displayName }; }
    if (sidecar.tags?.length) { result = { ...result, tags: sidecar.tags }; }
    if (sidecar.autoTags?.length) { result = { ...result, autoTags: sidecar.autoTags }; }
    if (sidecar.correlationTags?.length) { result = { ...result, correlationTags: sidecar.correlationTags }; }
    if (sidecar.trashed) { result = { ...result, trashed: true }; }
    // Pin state: propagate the flag and the pin timestamp so the panel can lift pinned rows to the
    // top. The header/counts on a pinned sidecar are already merged via the normal cache path above.
    if (sidecar.pinned) { result = { ...result, pinned: true, pinnedAt: sidecar.pinnedAt }; }
    if (hasPerformanceData(sidecar)) { result = { ...result, hasPerformanceData: true }; }
    // Session-group propagation: groupId (shared across the group's members) and debugAdapterType
    // (set only on the DAP main log) drive tree coalescing and primary-member selection.
    if (sidecar.groupId) { result = { ...result, groupId: sidecar.groupId }; }
    if (sidecar.debugAdapterType) { result = { ...result, debugAdapterType: sidecar.debugAdapterType }; }
    // Explicit kind override is opt-in metadata — propagate untouched so the classifier
    // can see it before applying its rules. Absent kind means "let the classifier decide".
    if (sidecar.kind === 'project' || sidecar.kind === 'report') { result = { ...result, kind: sidecar.kind }; }
    // Explicit Controller/Peripheral override — propagate untouched so `classifySessionRole` sees
    // it before its detection rules. Absent role means "let the classifier decide".
    if (sidecar.role === 'controller' || sidecar.role === 'peripheral') { result = { ...result, role: sidecar.role }; }
    if (hasCachedSev) {
        return {
            ...result,
            errorCount: sidecar.errorCount, warningCount: sidecar.warningCount,
            perfCount: sidecar.perfCount, anrCount: sidecar.anrCount,
            fwCount: sidecar.fwCount, infoCount: sidecar.infoCount,
            debugCount: sidecar.debugCount, databaseCount: sidecar.databaseCount,
            todoCount: sidecar.todoCount, noticeCount: sidecar.noticeCount,
        };
    }
    return result;
}
