/**
 * Project-side insights for a crash (plan 054 Stage 5c-1/5c-2): the editor knows the working tree, git
 * history, and the changelog — so it can answer "what changed at the crash site" and "has this maybe
 * already been fixed in a release after the affected version?" Neither Android Studio nor the Play
 * Console can do this. All work is best-effort; missing git / changelog / file degrades to empty, never
 * throws.
 */

import * as vscode from 'vscode';
import { analyzeSourceFile, type GitCommit, type SourceAnnotation } from '../misc/workspace-analyzer';
import { getGitHubContext } from '../git/github-context';
import { parseChangelogVersions, changelogSince, type ChangelogVersion } from './crash-changelog';

/** A GitHub PR or issue link surfaced beside the crash (number + title + URL). */
export interface CrashLink {
    readonly number: number;
    readonly title: string;
    readonly url: string;
}

/** Aggregated crash→project links for the in-viewer detail's "In your project" panel. */
export interface ProjectInsights {
    readonly file?: string;
    readonly recentCommits: readonly GitCommit[];
    readonly annotations: readonly SourceAnnotation[];
    readonly affectedVersion?: string;
    /** Releases listed after the affected version (newer); empty if the version wasn't found. */
    readonly changelogSince: readonly ChangelogVersion[];
    /** True when newer releases exist after the affected version — the "may already be fixed" signal. */
    readonly mayBeFixed: boolean;
    /** PRs touching the crashing file (best-effort via `gh`; empty when gh is absent/unauthed). */
    readonly prs: readonly CrashLink[];
    /** Issues matching the crash's error tokens (best-effort via `gh`). */
    readonly issues: readonly CrashLink[];
}

interface InsightOptions {
    readonly file?: string;
    readonly crashLine?: number;
    readonly affectedVersion?: string;
    readonly packageHint?: string;
    readonly errorTokens?: readonly string[];
}

/** PRs touching the file + issues matching the error tokens, via the existing gh integration. */
async function relatedGitHub(file: string | undefined, tokens: readonly string[]): Promise<{ prs: CrashLink[]; issues: CrashLink[] }> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd || (!file && tokens.length === 0)) { return { prs: [], issues: [] }; }
    try {
        const ctx = await getGitHubContext({ files: file ? [file] : [], errorTokens: tokens, cwd });
        const toLink = (x: { number: number; title: string; url: string }): CrashLink => ({ number: x.number, title: x.title, url: x.url });
        return { prs: ctx.filePrs.map(toLink), issues: ctx.issues.map(toLink) };
    } catch {
        return { prs: [], issues: [] };
    }
}

/** Pick the workspace-root changelog, preferring the plain CHANGELOG over archives (shortest basename). */
async function findRootChangelog(): Promise<vscode.Uri | undefined> {
    const files = await vscode.workspace.findFiles('CHANGELOG*', '**/node_modules/**', 10);
    let best: vscode.Uri | undefined;
    let bestLen = Infinity;
    for (const f of files) {
        const base = f.path.split('/').pop() ?? '';
        if (base.length < bestLen) { best = f; bestLen = base.length; }
    }
    return best;
}

/** Newer releases listed after the affected version in the root changelog; [] if file/version absent. */
async function changelogSinceAffected(affected?: string): Promise<ChangelogVersion[]> {
    if (!affected) { return []; }
    const uri = await findRootChangelog();
    if (!uri) { return []; }
    try {
        const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
        return changelogSince(parseChangelogVersions(text), affected).since.slice(0, 8);
    } catch {
        return [];
    }
}

/**
 * Gather recent commits + annotations for the crash site and changelog entries since the affected
 * version. Returns undefined only when nothing useful resolved (so the panel is skipped).
 */
export async function getProjectInsights(opts: InsightOptions): Promise<ProjectInsights | undefined> {
    if (!vscode.workspace.workspaceFolders?.[0]) { return undefined; }
    const info = opts.file ? await analyzeSourceFile(opts.file, opts.crashLine, opts.packageHint) : undefined;
    const recentCommits = (info?.gitCommits ?? []).slice(0, 5);
    const annotations = (info?.annotations ?? []).slice(0, 6);
    const since = await changelogSinceAffected(opts.affectedVersion);
    const gh = await relatedGitHub(opts.file, opts.errorTokens ?? []);
    const empty = recentCommits.length === 0 && annotations.length === 0 && since.length === 0 && gh.prs.length === 0 && gh.issues.length === 0;
    if (empty) { return undefined; }
    return {
        file: info ? opts.file : undefined,
        recentCommits,
        annotations,
        affectedVersion: opts.affectedVersion,
        changelogSince: since,
        mayBeFixed: since.length > 0,
        prs: gh.prs.slice(0, 5),
        issues: gh.issues.slice(0, 5),
    };
}
