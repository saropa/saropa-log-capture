/**
 * Compute the cached metadata stored alongside a manually-loaded file in the
 * loaded-files history. Runs once at load time so the Logs list never has to
 * re-read the (possibly external, possibly large) file to show its line/severity
 * badges.
 *
 * Deliberately reuses the AUTHORITATIVE helpers rather than re-implementing
 * parsing/classification:
 *  - `parseHeader()` — header fields, line count, duration, timestamp detection
 *    (with its own large-file quick-scan path).
 *  - `countSeveritiesChunked()` via `classifyLevel()` — the SAME classifier the
 *    viewer's E/W/I/D counts and the deferred list scan use, so the cached counts
 *    agree with what the user sees when the file is open.
 */

import * as vscode from 'vscode';
import { parseHeader } from '../../ui/session/session-history-helpers';
import { countSeveritiesChunked, extractBody } from '../../ui/session/session-severity-counts';
import type { SessionMetadata } from '../../ui/session/session-history-grouping';
import type { LoadedFileHistoryEntry } from './loaded-files-history';

/** Body reads above this size are skipped — counting severities would pull the
 *  whole file into memory just to classify it. Mirrors the deferred severity
 *  scan's guard (session-severity-scan.ts); counts stay undefined for such files. */
const maxSeverityScanBytes = 25 * 1024 * 1024;

/** Last path segment, handling both `/` and `\` separators (external files may use either). */
function basename(uri: vscode.Uri): string {
    const p = uri.path;
    const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
    return idx >= 0 ? p.slice(idx + 1) : p;
}

/**
 * Build the history entry's metadata for a loaded file. `loadedAt` is left to the
 * caller (it stamps the load moment). Returns undefined only when the file cannot
 * be stat-ed (deleted/inaccessible) — the caller then skips recording.
 */
export async function computeLoadedFileMetadata(
    uri: vscode.Uri,
    strict: boolean,
): Promise<Omit<LoadedFileHistoryEntry, 'loadedAt'> | undefined> {
    let size: number;
    let mtime: number;
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        size = stat.size;
        mtime = stat.mtime;
    } catch {
        return undefined;
    }

    const base: SessionMetadata = { uri, filename: basename(uri), size, mtime };
    const header = await parseHeader(uri, base);

    const entry: Omit<LoadedFileHistoryEntry, 'loadedAt'> = {
        uri: uri.toString(),
        filename: header.filename,
        size,
        mtime,
        lineCount: header.lineCount,
        date: header.date,
        project: header.project,
        adapter: header.adapter,
        hasTimestamps: header.hasTimestamps,
        durationMs: header.durationMs,
    };

    // Severity counts only for in-budget files; oversized files keep undefined counts
    // (no badge) rather than risking an OOM read.
    if (size <= maxSeverityScanBytes) {
        try {
            const raw = await vscode.workspace.fs.readFile(uri);
            const counts = await countSeveritiesChunked(extractBody(Buffer.from(raw).toString('utf-8')), strict);
            entry.errorCount = counts.errors;
            entry.warningCount = counts.warnings;
            entry.perfCount = counts.perfs;
            entry.anrCount = counts.anrs > 0 ? counts.anrs : undefined;
            entry.infoCount = counts.infos;
            entry.debugCount = counts.debugs;
            entry.databaseCount = counts.databases;
            entry.todoCount = counts.todos;
            entry.noticeCount = counts.notices;
        } catch {
            // Body read/classify failed — keep header-only metadata; counts stay undefined.
        }
    }

    return entry;
}
