/**
 * Pin/unpin a session to the top of the Logs panel.
 *
 * Pinning is more than a boolean flag: the explicit requirement is that a pinned
 * row lists and loads as fast as possible, never re-reading the file. So at pin
 * time we read the file ONCE and persist its full metadata into the central
 * store — the `parsedHeader` cache (stamped with the current mtime+size) plus the
 * severity counts. On every later panel load `loadMetadata()` finds the header
 * cache valid and the counts present, so the pinned row hydrates entirely from
 * the central JSON with zero per-file reads.
 *
 * Unpinning only clears the flags; the cached metadata is harmless and left in
 * place so the row stays fast if re-pinned or shown in the normal list.
 */

import * as vscode from 'vscode';
import type { SessionMeta, SessionMetadataStore } from '../../modules/session/session-metadata';
import { parseHeader } from './session-history-helpers';
import { countSeveritiesChunked, extractBody } from './session-severity-counts';
import { SessionMetadata } from './session-history-grouping';
import { logExtensionError } from '../../modules/misc/extension-logger';

/* Mirrors the deferred-scan ceiling in session-severity-scan.ts: above this the
   body read would spike memory just to tally severities (a multi-hundred-MB JSON
   report is not line-oriented log output anyway). Pinning such a file still
   captures the header + a zeroed count marker so the row never re-scans. */
const maxSeverityScanBytes = 25 * 1024 * 1024;

/** Capture full metadata and mark the file pinned, in a single central write. */
export async function pinSession(
    uri: vscode.Uri,
    filename: string,
    store: SessionMetadataStore,
    strict: boolean,
): Promise<void> {
    const existing = await store.loadMetadata(uri);
    const stat = await vscode.workspace.fs.stat(uri);
    /* Header pass (cheap for small files, head+tail quick-scan for large ones). */
    const base: SessionMetadata = { uri, filename, size: stat.size, mtime: stat.mtime };
    const header = await parseHeader(uri, base);
    const counts = await scanCounts(uri, stat.size, strict);
    const toSave: SessionMeta = {
        ...existing,
        pinned: true,
        // Date.now() is fine in extension code (banned only in workflow scripts); newest pin sorts first.
        pinnedAt: Date.now(),
        // Stamp the header cache with the exact revision it was read for, so headerCacheValid()
        // accepts it on the next load and skips the per-file read entirely.
        parsedHeader: {
            mtime: stat.mtime, size: stat.size,
            date: header.date, project: header.project, adapter: header.adapter,
            lineCount: header.lineCount, hasTimestamps: header.hasTimestamps, durationMs: header.durationMs,
        },
        ...counts,
    };
    await store.saveMetadata(uri, toSave);
}

/** Clear the pin flags. Cached header/counts are intentionally left in place. */
export async function unpinSession(uri: vscode.Uri, store: SessionMetadataStore): Promise<void> {
    const meta = await store.loadMetadata(uri);
    delete meta.pinned;
    delete meta.pinnedAt;
    await store.saveMetadata(uri, meta);
}

/** Severity counts for the pin snapshot. Oversized files get a zeroed V2 marker
 *  (debugCount set) so they are treated as cached and never re-scanned. */
async function scanCounts(uri: vscode.Uri, size: number, strict: boolean): Promise<Partial<SessionMeta>> {
    if (size > maxSeverityScanBytes) {
        return { errorCount: 0, warningCount: 0, perfCount: 0, infoCount: 0, debugCount: 0, databaseCount: 0, todoCount: 0, noticeCount: 0 };
    }
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const counts = await countSeveritiesChunked(extractBody(Buffer.from(raw).toString('utf-8')), strict);
        return {
            errorCount: counts.errors, warningCount: counts.warnings, perfCount: counts.perfs,
            anrCount: counts.anrs > 0 ? counts.anrs : undefined,
            infoCount: counts.infos, debugCount: counts.debugs, databaseCount: counts.databases,
            todoCount: counts.todos, noticeCount: counts.notices,
        };
    } catch (err) {
        // Non-critical: pin still succeeds with header-only metadata; counts backfill on next scan.
        logExtensionError('pin-session-scan', err instanceof Error ? err : new Error(String(err)));
        return {};
    }
}
