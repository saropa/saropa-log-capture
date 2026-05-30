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

/** Options for loadBatch beyond the required parameters. */
export interface LoadBatchOptions {
    readonly centralMeta: ReadonlyMap<string, SessionMeta>;
    readonly onItemLoaded?: OnItemLoaded;
}

/** Load metadata for all files with bounded concurrency (max 8 parallel). */
export async function loadBatch(
    target: LoadMetadataTarget,
    logDir: vscode.Uri,
    files: readonly string[],
    opts: LoadBatchOptions,
): Promise<SessionMetadata[]> {
    const { centralMeta, onItemLoaded } = opts;
    const results: SessionMetadata[] = new Array(files.length);
    const limit = 8;
    let index = 0;
    const run = async (): Promise<void> => {
        while (index < files.length) {
            const i = index++;
            results[i] = await loadMetadata(target, logDir, files[i], centralMeta);
            /* Await the callback so each item reaches the webview before the
             * worker moves on to the next file — gives progressive UI updates. */
            await onItemLoaded?.(results[i], i);
        }
    };
    const count = Math.min(limit, files.length);
    await Promise.all(Array.from({ length: count }, () => run()));
    return results;
}

/** Load and cache metadata for a single session file.
 *  Never scans the body — severities arrive later from the deferred worker. */
async function loadMetadata(
    target: LoadMetadataTarget,
    logDir: vscode.Uri,
    filename: string,
    centralMeta: ReadonlyMap<string, SessionMeta>,
): Promise<SessionMetadata> {
    const uri = vscode.Uri.joinPath(logDir, filename);
    const stat = await vscode.workspace.fs.stat(uri);
    const cacheKey = `${uri.toString()}|${stat.mtime}|${stat.size}`;
    const cached = target.metaCache.get(cacheKey);
    if (cached) { return cached; }
    const relKey = vscode.workspace.asRelativePath(uri).replace(/\\/g, '/');
    const sidecar = centralMeta.get(relKey) ?? {};
    // V2 schema gate: require `debugCount` (new bucket added when classifyLevel
    // replaced the V1 quick-scanner). V1 sidecars have errorCount but not
    // debugCount, so they re-scan via the deferred worker to backfill the new
    // buckets — otherwise debug/database/todo/notice would stay permanently 0.
    const hasCachedSev = sidecar.errorCount !== undefined && sidecar.debugCount !== undefined;
    let meta: SessionMetadata = { uri, filename, size: stat.size, mtime: stat.mtime };
    meta = await parseHeader(uri, meta);
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
    if (hasPerformanceData(sidecar)) { result = { ...result, hasPerformanceData: true }; }
    // Session-group propagation: groupId (shared across the group's members) and debugAdapterType
    // (set only on the DAP main log) drive tree coalescing and primary-member selection.
    if (sidecar.groupId) { result = { ...result, groupId: sidecar.groupId }; }
    if (sidecar.debugAdapterType) { result = { ...result, debugAdapterType: sidecar.debugAdapterType }; }
    // Explicit kind override is opt-in metadata — propagate untouched so the classifier
    // can see it before applying its rules. Absent kind means "let the classifier decide".
    if (sidecar.kind === 'project' || sidecar.kind === 'report') { result = { ...result, kind: sidecar.kind }; }
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
