/**
 * Project-side insights for a source location (plan 055 Stage 1, promoted from `crash-project-links`).
 * The editor knows the working tree, git history, and the changelog — so it can answer "what changed
 * at this location" and "has this maybe already been fixed in a release after version X?" Neither
 * Android Studio nor the Play Console can do this. All work is best-effort; missing git / changelog /
 * file degrades to empty, never throws.
 *
 * Generic over what produced the location (a crash frame, a captured log line, a whole session), so
 * crashlytics and the log viewer share one implementation. The caller maps its own concept (issue,
 * line, session) into `InsightOptions`.
 */

import * as vscode from 'vscode';
import { analyzeSourceFile, type GitCommit, type SourceAnnotation } from '../misc/workspace-analyzer';
import { getGitHubContext } from './github-context';
import { changelogSinceAffected } from './changelog-locate';
import { type ChangelogVersion } from './changelog';

/** A GitHub PR or issue link surfaced beside the location (number + title + URL). */
export interface ProjectLink {
    readonly number: number;
    readonly title: string;
    readonly url: string;
}

/** Aggregated project links for the "In your project" panel. */
export interface ProjectInsights {
    readonly file?: string;
    readonly recentCommits: readonly GitCommit[];
    readonly annotations: readonly SourceAnnotation[];
    readonly affectedVersion?: string;
    /** Releases listed after the affected version (newer); empty if the version wasn't found. */
    readonly changelogSince: readonly ChangelogVersion[];
    /** True when newer releases exist after the affected version — the "may already be fixed" signal. */
    readonly mayBeFixed: boolean;
    /** PRs touching the file (best-effort via `gh`; empty when gh is absent/unauthed). */
    readonly prs: readonly ProjectLink[];
    /** Issues matching the error tokens (best-effort via `gh`). */
    readonly issues: readonly ProjectLink[];
}

/** Inputs the caller maps from its own concept (crash issue, log line, session). */
export interface InsightOptions {
    readonly file?: string;
    readonly line?: number;
    readonly version?: string;
    readonly packageHint?: string;
    readonly errorTokens?: readonly string[];
}

/** PRs touching the file + issues matching the error tokens, via the existing gh integration. */
async function relatedGitHub(file: string | undefined, tokens: readonly string[]): Promise<{ prs: ProjectLink[]; issues: ProjectLink[] }> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd || (!file && tokens.length === 0)) { return { prs: [], issues: [] }; }
    try {
        const ctx = await getGitHubContext({ files: file ? [file] : [], errorTokens: tokens, cwd });
        const toLink = (x: { number: number; title: string; url: string }): ProjectLink => ({ number: x.number, title: x.title, url: x.url });
        return { prs: ctx.filePrs.map(toLink), issues: ctx.issues.map(toLink) };
    } catch {
        return { prs: [], issues: [] };
    }
}

/**
 * Gather recent commits + annotations for the location and changelog entries since the affected
 * version. Returns undefined only when nothing useful resolved (so the panel is skipped).
 */
export async function getProjectInsights(opts: InsightOptions): Promise<ProjectInsights | undefined> {
    if (!vscode.workspace.workspaceFolders?.[0]) { return undefined; }
    const info = opts.file ? await analyzeSourceFile(opts.file, opts.line, opts.packageHint) : undefined;
    const recentCommits = (info?.gitCommits ?? []).slice(0, 5);
    const annotations = (info?.annotations ?? []).slice(0, 6);
    const since = await changelogSinceAffected(opts.version);
    const gh = await relatedGitHub(opts.file, opts.errorTokens ?? []);
    const empty = recentCommits.length === 0 && annotations.length === 0 && since.length === 0 && gh.prs.length === 0 && gh.issues.length === 0;
    if (empty) { return undefined; }
    return {
        file: info ? opts.file : undefined,
        recentCommits,
        annotations,
        affectedVersion: opts.version,
        changelogSince: since,
        mayBeFixed: since.length > 0,
        prs: gh.prs.slice(0, 5),
        issues: gh.issues.slice(0, 5),
    };
}
