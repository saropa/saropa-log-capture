/**
 * Local-log correlation for a crash (plan 054 Stage 5c-4): search the user's CAPTURED log sessions for
 * a line matching the crash's signature, so the detail can say "you already logged this" and deep-link
 * to that line. The extension's core competency — it has the saved sessions; Android Studio and the
 * Play Console do not. Best-effort; never throws.
 */

import * as vscode from 'vscode';
import { searchLogFiles, openLogAtLine } from '../search/log-search';

/** One captured-log line that matches the crash, with what's needed to open it at that line. */
export interface LogCorrelation {
    readonly uri: string;
    readonly fileName: string;
    readonly line: number;
    readonly col: number;
    readonly lineText: string;
}

/** Distinct sessions (one representative line each, most-recent first) whose log contains the token. */
export async function findCorrelatedLogLines(token: string): Promise<LogCorrelation[]> {
    if (!token) { return []; }
    // One match per file keeps it to "which sessions saw this", not every occurrence; recent-first
    // because searchLogFiles sorts file paths descending (dated folders → newest first).
    const results = await searchLogFiles(token, { caseSensitive: false, maxResults: 30, maxResultsPerFile: 1 });
    const out: LogCorrelation[] = [];
    for (const m of results.matches) {
        out.push({ uri: m.uri.toString(), fileName: m.filename, line: m.lineNumber, col: m.matchStart, lineText: m.lineText });
        if (out.length >= 5) { break; }
    }
    return out;
}

/** Open a correlated log line in the editor at its position. Never throws (stale path just no-ops). */
export async function openLogLine(uriStr: string, line: number, col: number): Promise<void> {
    if (!uriStr) { return; }
    try {
        const uri = vscode.Uri.parse(uriStr);
        await openLogAtLine({ uri, filename: '', lineNumber: line, lineText: '', matchStart: Math.max(0, col), matchEnd: Math.max(0, col) });
    } catch {
        // Best-effort: a deleted/rotated session just doesn't open.
    }
}
