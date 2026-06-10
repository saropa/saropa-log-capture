/**
 * Durable history of files opened via the "Open Log File" picker
 * (`saropaLogCapture.openLogFile`).
 *
 * Those loads reach files OUTSIDE the configured reports directory, which the
 * directory-scan session list (`fetchItemsCore`) never sees — so without this
 * record a manually-loaded file leaves no trace once the viewer moves on. We
 * persist one entry per loaded file URI, with its metadata cached at load time,
 * so the Logs list can show it grouped by the day it was loaded WITHOUT
 * re-reading the file on every refresh.
 *
 * Stored in <logDir>/.loaded-files-history.json (alongside .session-metadata.json),
 * keyed by URI string so re-loading a file upserts its single row rather than
 * appending — "one row per file, dated to its last load".
 */

import * as vscode from 'vscode';
import { parseJSONOrDefault } from '../misc/safe-json';

/** A single manually-loaded file's record. Severity counts mirror `SessionMeta`'s
 *  classifyLevel() buckets so the Logs row badges agree with the viewer. */
export interface LoadedFileHistoryEntry {
    /** file:// URI of the loaded file — the dedup/upsert key. */
    uri: string;
    /** Epoch ms of the LAST load. Drives the day-group the row falls under. */
    loadedAt: number;
    /** Basename for display in the Logs list. */
    filename: string;
    size: number;
    /** The file's own mtime at load time (distinct from `loadedAt`). */
    mtime: number;
    lineCount?: number;
    date?: string;
    project?: string;
    adapter?: string;
    hasTimestamps?: boolean;
    durationMs?: number;
    errorCount?: number;
    warningCount?: number;
    perfCount?: number;
    anrCount?: number;
    infoCount?: number;
    debugCount?: number;
    databaseCount?: number;
    todoCount?: number;
    noticeCount?: number;
}

/** On-disk shape: uriString → entry. A map (not array) makes upsert-by-URI O(1)
 *  and structurally enforces "one row per file". */
export type HistoryMap = Record<string, LoadedFileHistoryEntry>;

const HISTORY_FILENAME = '.loaded-files-history.json';

/**
 * Cap on retained entries. A user who opens hundreds of one-off files over months
 * would otherwise grow this file unbounded and slow every list refresh. When the
 * cap is exceeded we drop the oldest `loadedAt` entries — the least likely to be
 * revisited — so the file stays bounded without losing recent history.
 */
export const MAX_ENTRIES = 300;

/** Resolve <logDir>/.loaded-files-history.json. The caller passes the ACTIVE panel log dir
 *  (override-aware) so reads and writes always target the same directory the Logs list shows. */
function getHistoryUri(logDir: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(logDir, HISTORY_FILENAME);
}

/** Read the history map, returning an empty map on any error (missing/corrupt file). */
async function readHistory(uri: vscode.Uri): Promise<HistoryMap> {
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const parsed = parseJSONOrDefault<HistoryMap>(Buffer.from(data), {});
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}

/** Write the full history map, creating the directory if needed (mirrors writeCentral). */
async function writeHistory(uri: vscode.Uri, data: HistoryMap): Promise<void> {
    const dir = vscode.Uri.joinPath(uri, '..');
    try { await vscode.workspace.fs.createDirectory(dir); } catch { /* may exist */ }
    const json = JSON.stringify(data, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
}

/** Drop the oldest-by-loadedAt entries until at most MAX_ENTRIES remain. Exported for tests. */
export function pruneToCap(data: HistoryMap): HistoryMap {
    const keys = Object.keys(data);
    if (keys.length <= MAX_ENTRIES) { return data; }
    // Keep the MAX_ENTRIES most-recently-loaded; the rest are the least likely revisits.
    const kept = keys
        .sort((a, b) => (data[b].loadedAt ?? 0) - (data[a].loadedAt ?? 0))
        .slice(0, MAX_ENTRIES);
    const pruned: HistoryMap = {};
    for (const k of kept) { pruned[k] = data[k]; }
    return pruned;
}

/**
 * Record (upsert) a manually-loaded file into `<logDir>/.loaded-files-history.json`.
 * Re-loading an existing file overwrites its row with the fresh `loadedAt` + metadata, so the
 * list shows one row dated to the most recent load. Best-effort; never throws (fire-and-forget).
 */
export async function recordLoadedFile(logDir: vscode.Uri, entry: LoadedFileHistoryEntry): Promise<void> {
    const uri = getHistoryUri(logDir);
    const data = await readHistory(uri);
    data[entry.uri] = entry;
    await writeHistory(uri, pruneToCap(data));
}

/** Load all recorded entries for the given log directory. Empty array on any error. */
export async function loadLoadedFileHistory(logDir: vscode.Uri): Promise<LoadedFileHistoryEntry[]> {
    const uri = getHistoryUri(logDir);
    if (!uri) { return []; }
    const data = await readHistory(uri);
    return Object.values(data);
}
