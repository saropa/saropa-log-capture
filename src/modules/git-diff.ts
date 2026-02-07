/**
 * Git commit diff summary.
 *
 * Fetches the --stat output for a commit to show which files changed
 * and how many lines were inserted/deleted.
 */

import * as vscode from 'vscode';
import { runGitCommand } from './workspace-analyzer';

/** Aggregate diff summary for a single commit. */
export interface CommitDiff {
    readonly hash: string;
    readonly filesChanged: number;
    readonly insertions: number;
    readonly deletions: number;
}

/** Get the diff stat summary for a commit. Returns undefined on error. */
export async function getCommitDiff(hash: string): Promise<CommitDiff | undefined> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { return undefined; }
    const raw = await runGitCommand(['show', '--stat', '--format=', hash], root);
    if (!raw) { return undefined; }
    return parseStatOutput(hash, raw);
}

function parseStatOutput(hash: string, raw: string): CommitDiff | undefined {
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length === 0) { return undefined; }
    const summaryLine = lines[lines.length - 1];
    const summaryMatch = /(\d+) files? changed/.exec(summaryLine);
    if (!summaryMatch) { return undefined; }
    const filesChanged = parseInt(summaryMatch[1], 10);
    const insMatch = /(\d+) insertions?\(\+\)/.exec(summaryLine);
    const delMatch = /(\d+) deletions?\(-\)/.exec(summaryLine);
    const insertions = insMatch ? parseInt(insMatch[1], 10) : 0;
    const deletions = delMatch ? parseInt(delMatch[1], 10) : 0;
    return { hash, filesChanged, insertions, deletions };
}
