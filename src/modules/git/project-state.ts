/**
 * Current working-tree state for the session "Project state" panel (plan 055 Stage 3): which branch,
 * which commit, and whether the tree is dirty — so a reader knows exactly which code a captured log
 * corresponds to. All git calls are best-effort (`runGitCommand` returns '' on error); a non-repo or
 * missing git degrades to `{ hasGit: false }`, never throws.
 */

import * as vscode from 'vscode';
import { runGitCommand } from '../misc/workspace-analyzer';

/** The last commit on HEAD (short hash, author, ISO date, subject line). */
export interface LastCommit {
    readonly hash: string;
    readonly author: string;
    readonly date: string;
    readonly subject: string;
}

/** Snapshot of the workspace git state shown beside a captured session. */
export interface ProjectState {
    readonly hasGit: boolean;
    readonly branch?: string;
    readonly lastCommit?: LastCommit;
    /** True when `git status --porcelain` reports any uncommitted change. */
    readonly dirty?: boolean;
}

/** Parse the single `%h|%an|%ad|%s` line from `git log -1`. The subject may contain '|', so re-join. */
function parseLastCommit(raw: string): LastCommit | undefined {
    if (!raw) { return undefined; }
    const [hash, author, date, ...rest] = raw.split('|');
    if (!hash) { return undefined; }
    return { hash: hash.trim(), author: (author ?? '').trim(), date: (date ?? '').trim(), subject: rest.join('|').trim() };
}

/**
 * Read branch, last commit, and dirty flag from the first workspace folder. `branch` resolving to ''
 * (git error / not a repo) is the single signal that there is no usable git here.
 */
export async function getProjectState(): Promise<ProjectState> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { return { hasGit: false }; }
    const branch = await runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], root);
    if (!branch) { return { hasGit: false }; }
    // Independent reads; run together to keep the panel snappy.
    const [commitRaw, status] = await Promise.all([
        runGitCommand(['log', '-1', '--format=%h|%an|%ad|%s', '--date=short'], root),
        runGitCommand(['status', '--porcelain'], root),
    ]);
    return { hasGit: true, branch, lastCommit: parseLastCommit(commitRaw), dirty: status.length > 0 };
}
