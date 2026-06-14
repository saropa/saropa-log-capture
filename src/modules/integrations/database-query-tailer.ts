/**
 * Live tail of one external database query log during a session. Watches the
 * file with fs.watch, reads only newly-appended bytes, parses each new line
 * (JSON or plain-text DB log), and emits a formatted one-line summary so queries
 * appear live in the viewer interleaved with app output.
 *
 * Module-level singleton (one tail per session) mirroring external-log-tailer
 * and adb-logcat-capture. Disposed by stopDatabaseQueryTail() at session end.
 * Tailing starts at the current end-of-file, so only queries appended DURING the
 * session are streamed — the full history still lands in the end-of-session
 * sidecar via the provider's file-mode read.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectQueryLogFormat } from './providers/database-query-parsing';
import { parseNewQueryLines, formatQueryEntry } from './providers/database-query-format';

interface TailState {
    readonly filePath: string;
    readonly requestIdPattern: string;
    readonly onLine: (text: string, timestamp?: Date) => void;
    readonly outputChannel: { appendLine(line: string): void };
    position: number;
    format?: 'json' | 'text';
}

let watcher: { close: () => void } | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/** Read newly-appended bytes since `state.position`, returning complete lines only. */
function readNewLines(state: TailState): string[] {
    const stat = fs.statSync(state.filePath);
    if (stat.size <= state.position) {
        // Truncated/rotated: reset to new size so we don't replay or read garbage.
        state.position = stat.size;
        return [];
    }
    const toRead = stat.size - state.position;
    const fd = fs.openSync(state.filePath, 'r');
    try {
        const buf = Buffer.alloc(toRead);
        fs.readSync(fd, buf, 0, toRead, state.position);
        const chunk = buf.toString('utf-8').replace(/\r\n/g, '\n');
        const lines = chunk.split('\n');
        // Drop the last split element either way: it is the empty string after a
        // trailing newline, or an incomplete final line we leave buffered for the next read.
        const complete = lines.slice(0, -1);
        const consumed = complete.length === 0 ? 0 : Buffer.byteLength(complete.join('\n') + '\n', 'utf-8');
        state.position += Math.min(consumed, toRead);
        return complete.filter((l) => l.trim().length > 0);
    } finally {
        fs.closeSync(fd);
    }
}

/** Parse new lines into queries and emit each as a formatted live viewer line. */
function emitNewQueries(state: TailState, lines: string[]): void {
    if (lines.length === 0) { return; }
    if (!state.format) { state.format = detectQueryLogFormat(lines); }
    for (const entry of parseNewQueryLines(lines, state.format, state.requestIdPattern)) {
        const ts = entry.timestamp ? new Date(entry.timestamp) : new Date();
        state.onLine(formatQueryEntry(entry), ts);
    }
}

export interface DatabaseTailOptions {
    readonly filePath: string;
    readonly requestIdPattern: string;
    readonly onLine: (text: string, timestamp?: Date) => void;
    readonly outputChannel: { appendLine(line: string): void };
}

/** Begin tailing the query log. No-op if the file is missing (logged, not fatal). */
export function startDatabaseQueryTail(opts: DatabaseTailOptions): void {
    stopDatabaseQueryTail();
    let size = 0;
    try { size = fs.statSync(opts.filePath).size; } catch {
        opts.outputChannel.appendLine(`[database] Live tail skipped — file not found: ${opts.filePath}`);
        return;
    }
    const state: TailState = { ...opts, position: size };
    const base = path.basename(opts.filePath);
    // Debounce fs.watch bursts: one read after the burst settles, reducing host stalls under churn.
    const onChange = (): void => {
        try { emitNewQueries(state, readNewLines(state)); } catch { /* file deleted/unreadable mid-read */ }
    };
    try {
        const w = fs.watch(opts.filePath, { persistent: false }, (_, name) => {
            if (name === null || name === undefined || name === base) {
                if (debounceTimer) { return; }
                debounceTimer = setTimeout(() => { debounceTimer = undefined; onChange(); }, 50);
            }
        });
        watcher = { close: () => { try { w.close(); } catch { /* ignore */ } } };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        opts.outputChannel.appendLine(`[database] Live tail watch failed: ${msg}`);
    }
}

/** Stop the tail and clear all watcher/timer state. Call at session end. */
export function stopDatabaseQueryTail(): void {
    if (watcher) { watcher.close(); watcher = undefined; }
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = undefined; }
}
