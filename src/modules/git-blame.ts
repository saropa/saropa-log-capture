/**
 * Git blame for a single line.
 *
 * Used by the analysis panel to show who last changed a crash line.
 */

import * as vscode from 'vscode';
import { runGitCommand } from './workspace-analyzer';

/** Blame result for a single source line. */
export interface BlameLine {
    readonly hash: string;
    readonly author: string;
    readonly date: string;
    readonly message: string;
}

/** Get git blame for a specific line. Returns undefined on error or uncommitted lines. */
export async function getGitBlame(uri: vscode.Uri, line: number): Promise<BlameLine | undefined> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root || line < 1) { return undefined; }
    const relPath = vscode.workspace.asRelativePath(uri, false);
    const raw = await runGitCommand(
        ['blame', '-L', `${line},${line}`, '--porcelain', '--', relPath], root,
    );
    if (!raw) { return undefined; }
    return parsePorcelainBlame(raw);
}

function parsePorcelainBlame(raw: string): BlameLine | undefined {
    const lines = raw.split('\n');
    if (lines.length === 0) { return undefined; }
    const hashMatch = /^([0-9a-f]{40})/.exec(lines[0]);
    if (!hashMatch) { return undefined; }
    const hash = hashMatch[1].slice(0, 7);
    if (hash === '0000000') { return undefined; }
    let author = '';
    let date = '';
    let message = '';
    for (const l of lines) {
        if (l.startsWith('author ')) { author = l.slice(7); }
        else if (l.startsWith('author-time ')) {
            const epoch = parseInt(l.slice(12), 10);
            if (!isNaN(epoch)) { date = new Date(epoch * 1000).toISOString().slice(0, 10); }
        } else if (l.startsWith('summary ')) { message = l.slice(8); }
    }
    return { hash, author, date, message };
}
