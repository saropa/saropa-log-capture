/**
 * Deferred severity-scan worker.
 *
 * Runs AFTER the session-history list paints (per the explicit user requirement
 * "load AFTER the list is displayed; both are needed for performance reasons").
 * The streaming pipeline ships rows with severity counts at zero; this worker
 * then scans each body using the authoritative `classifyLevel()` from
 * level-classifier.ts, persists the result to the central session-metadata
 * store (so the next launch is instant), and invokes a callback per file so
 * the wiring layer can re-post the row to the webview with real counts.
 *
 * Skips files whose sidecar already has V2 counts (`debugCount !== undefined`).
 * Bounded concurrency: 4 parallel readers — twice the typical fast-path
 * concurrency would saturate disk on large `reports/` directories without
 * meaningfully shortening total scan time.
 */

import * as vscode from 'vscode';
import type { SessionMeta, SessionMetadataStore } from '../../modules/session/session-metadata';
import { TreeItem, isSplitGroup, isSessionGroup } from './session-history-grouping';
import { SessionMetadata } from './session-history-grouping';
import { countSeveritiesChunked, extractBody } from './session-severity-counts';
import { logExtensionError } from '../../modules/misc/extension-logger';

/** Callback fired when a file's severity scan completes and was persisted. */
export type OnSeverityScanned = (updated: SessionMetadata) => void | Promise<void>;

/** Options for deferred scan. */
export interface DeferredScanOptions {
    readonly metaStore: SessionMetadataStore;
    /** In-memory cache used by SessionHistoryProvider — entries replaced with updated meta so
     *  subsequent reads see counts without re-loading the central JSON. */
    readonly metaCache: Map<string, SessionMetadata>;
    /** True for strict-mode classifyLevel; passes the user's `levelDetection` config setting. */
    readonly strict: boolean;
    /** Per-file completion callback (post webview update from here). */
    readonly onScanned?: OnSeverityScanned;
}

/** Run severity scan for every passed item that lacks cached V2 counts.
 *  SplitGroups and SessionGroups are flattened to their member files. */
export async function runDeferredSeverityScan(
    items: readonly TreeItem[],
    opts: DeferredScanOptions,
): Promise<void> {
    const files = collectScannableFiles(items);
    if (files.length === 0) { return; }
    const limit = 4;
    let index = 0;
    const run = async (): Promise<void> => {
        while (index < files.length) {
            const i = index++;
            await scanOne(files[i], opts);
        }
    };
    const workers = Math.min(limit, files.length);
    await Promise.all(Array.from({ length: workers }, () => run()));
}

/** Walk groups + splits down to leaves; skip items already V2-cached (have debugCount). */
function collectScannableFiles(items: readonly TreeItem[]): SessionMetadata[] {
    const out: SessionMetadata[] = [];
    const visit = (item: TreeItem): void => {
        if (isSessionGroup(item)) { item.members.forEach(visit); return; }
        if (isSplitGroup(item)) { item.parts.forEach(visit); return; }
        // debugCount is the V2 schema marker. Presence => already cached, skip.
        if (item.debugCount !== undefined) { return; }
        out.push(item);
    };
    items.forEach(visit);
    return out;
}

/* Above this size the deferred scan would read the whole body into memory just to tally
   severities — for a multi-hundred-MB JSON/CSV report (which is not line-oriented log
   output anyway) that risks an out-of-memory spike across the 4 parallel readers. Persist
   a zeroed V2 marker instead so the row stops re-scanning every refresh; the gate
   (`debugCount !== undefined`) then treats it as cached. Mirrors the quick-scan threshold
   in session-history-helpers.ts but larger — async body reads tolerate more than the
   blocking list pass. */
const maxSeverityScanBytes = 25 * 1024 * 1024;

/** All-zero V2 counts (debugCount set, so the cache gate marks the row scanned). anrCount
 *  stays undefined because 0 ANRs means "no badge", not "scanned and found none". */
function zeroSeverityCounts(): Partial<SessionMetadata> {
    return {
        errorCount: 0, warningCount: 0, perfCount: 0, anrCount: undefined,
        infoCount: 0, debugCount: 0, databaseCount: 0, todoCount: 0, noticeCount: 0,
    };
}

async function scanOne(meta: SessionMetadata, opts: DeferredScanOptions): Promise<void> {
    try {
        // Skip the body read for oversized reports; cache a zeroed marker so it isn't rescanned.
        if (meta.size > maxSeverityScanBytes) {
            await persistAndPublish(meta, { ...meta, ...zeroSeverityCounts() }, opts);
            return;
        }
        const raw = await vscode.workspace.fs.readFile(meta.uri);
        const text = Buffer.from(raw).toString('utf-8');
        // Chunked + yielding: a single large reports file must not block the host thread
        // mid-scan (issue #30). Bounded concurrency above still caps parallel readers.
        const counts = await countSeveritiesChunked(extractBody(text), opts.strict);
        const updated: SessionMetadata = {
            ...meta,
            errorCount: counts.errors,
            warningCount: counts.warnings,
            perfCount: counts.perfs,
            anrCount: counts.anrs > 0 ? counts.anrs : undefined,
            infoCount: counts.infos,
            debugCount: counts.debugs,
            databaseCount: counts.databases,
            todoCount: counts.todos,
            noticeCount: counts.notices,
        };
        await persistAndPublish(meta, updated, opts);
    } catch (err) {
        // Non-critical: skip this row. Counts stay 0; user can refresh to retry.
        logExtensionError('severity-scan', err instanceof Error ? err : new Error(String(err)));
    }
}

/** Save V2 counts to central meta, refresh in-memory cache entries, invoke callback. */
async function persistAndPublish(
    original: SessionMetadata, updated: SessionMetadata, opts: DeferredScanOptions,
): Promise<void> {
    const sidecar = await opts.metaStore.loadMetadata(original.uri);
    const toSave: SessionMeta = {
        ...sidecar,
        errorCount: updated.errorCount,
        warningCount: updated.warningCount,
        perfCount: updated.perfCount,
        anrCount: updated.anrCount,
        infoCount: updated.infoCount,
        debugCount: updated.debugCount,
        databaseCount: updated.databaseCount,
        todoCount: updated.todoCount,
        noticeCount: updated.noticeCount,
    };
    // Drop V1 fwCount if a stale value lingers — the V2 producer never writes it.
    delete toSave.fwCount;
    await opts.metaStore.saveMetadata(original.uri, toSave);
    // Refresh every metaCache entry pointing at this uri (keys embed mtime|size,
    // so multiple keys can exist if the file was rewritten during the session).
    const uriStr = original.uri.toString();
    for (const [key, val] of opts.metaCache) {
        if (val.uri.toString() === uriStr) { opts.metaCache.set(key, updated); }
    }
    await opts.onScanned?.(updated);
}
