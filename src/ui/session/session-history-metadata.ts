/**
 * Metadata loading and sidecar merging for SessionHistoryProvider.
 * Extracted to keep session-history-provider.ts under the line limit.
 */

import * as vscode from 'vscode';
import { SessionMetadataStore, type SessionMeta } from '../../modules/session/session-metadata';
import { SessionMetadata } from './session-history-grouping';
import { parseHeader } from './session-history-helpers';

/** Target interface exposing metadata cache and store for loading operations. */
export interface LoadMetadataTarget {
    readonly metaStore: SessionMetadataStore;
    readonly metaCache: Map<string, SessionMetadata>;
}

/** Load metadata for all files with bounded concurrency (max 8 parallel). */
export async function loadBatch(
    target: LoadMetadataTarget,
    logDir: vscode.Uri,
    files: readonly string[],
    centralMeta: ReadonlyMap<string, SessionMeta>,
): Promise<SessionMetadata[]> {
    const results: SessionMetadata[] = new Array(files.length);
    const limit = 8;
    let index = 0;
    const run = async (): Promise<void> => {
        while (index < files.length) {
            const i = index++;
            results[i] = await loadMetadata(target, logDir, files[i], centralMeta);
        }
    };
    const count = Math.min(limit, files.length);
    await Promise.all(Array.from({ length: count }, () => run()));
    return results;
}

/** Load and cache metadata for a single session file. */
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
    const hasCachedSev = sidecar.errorCount !== undefined && sidecar.fwCount !== undefined;
    let meta: SessionMetadata = { uri, filename, size: stat.size, mtime: stat.mtime };
    meta = await parseHeader(uri, meta, hasCachedSev);
    meta = applySidecar(target, meta, sidecar, { uri, hasCachedSev });
    target.metaCache.set(cacheKey, meta);
    return meta;
}

/** Merge sidecar metadata into the parsed session metadata. */
function applySidecar(
    target: LoadMetadataTarget,
    meta: SessionMetadata, sidecar: SessionMeta,
    ctx: { uri: vscode.Uri; hasCachedSev: boolean },
): SessionMetadata {
    let result = meta;
    if (sidecar.displayName) { result = { ...result, displayName: sidecar.displayName }; }
    if (sidecar.tags?.length) { result = { ...result, tags: sidecar.tags }; }
    if (sidecar.autoTags?.length) { result = { ...result, autoTags: sidecar.autoTags }; }
    if (sidecar.correlationTags?.length) { result = { ...result, correlationTags: sidecar.correlationTags }; }
    if (sidecar.trashed) { result = { ...result, trashed: true }; }
    if (ctx.hasCachedSev) {
        return { ...result, errorCount: sidecar.errorCount, warningCount: sidecar.warningCount, perfCount: sidecar.perfCount, anrCount: sidecar.anrCount, fwCount: sidecar.fwCount, infoCount: sidecar.infoCount };
    }
    if (result.errorCount !== undefined) {
        const toSave = { ...sidecar, errorCount: result.errorCount, warningCount: result.warningCount, perfCount: result.perfCount, anrCount: result.anrCount, fwCount: result.fwCount, infoCount: result.infoCount };
        target.metaStore.saveMetadata(ctx.uri, toSave).catch(() => {});
    }
    return result;
}
