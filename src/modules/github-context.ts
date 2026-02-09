/** GitHub CLI integration — PRs, issues, and blame-to-PR mapping via `gh`. */

import { execFile } from 'child_process';
import { runGitCommand } from './workspace-analyzer';

export interface GitHubPR { readonly number: number; readonly title: string; readonly author: string; readonly state: string; readonly url: string; }
export interface GitHubIssue { readonly number: number; readonly title: string; readonly url: string; readonly labels: readonly string[]; }
export interface GitHubContext {
    readonly available: boolean;
    readonly setupHint?: string;
    readonly blamePr?: GitHubPR;
    readonly filePrs: readonly GitHubPR[];
    readonly issues: readonly GitHubIssue[];
}

let ghAvailable: boolean | undefined;
const ghTimeout = 10_000;

async function isGhAvailable(): Promise<boolean> {
    if (ghAvailable !== undefined) { return ghAvailable; }
    try {
        await runGh(['--version']);
        ghAvailable = true;
    } catch { ghAvailable = false; }
    return ghAvailable;
}

/** Parse a GitHub remote URL into owner/repo slug. */
export async function getRepoSlug(cwd: string): Promise<string | undefined> {
    const url = await runGitCommand(['remote', 'get-url', 'origin'], cwd);
    if (!url) { return undefined; }
    const m = url.match(/github\.com[/:]([^/]+\/[^/.]+)/);
    return m?.[1]?.replace(/\.git$/, '');
}

/** Get GitHub context: blame PR, file PRs, and issues. */
export async function getGitHubContext(opts: { files: readonly string[]; errorTokens: readonly string[]; blameHash?: string; cwd: string }): Promise<GitHubContext> {
    if (!await isGhAvailable()) { return { available: false, setupHint: 'Install from https://cli.github.com', filePrs: [], issues: [] }; }
    const slug = await getRepoSlug(opts.cwd);
    if (!slug) { return { available: true, setupHint: 'Remote is not on GitHub', filePrs: [], issues: [] }; }
    const [blamePr, filePrs, issues] = await Promise.all([
        opts.blameHash ? findBlamePr(slug, opts.blameHash) : Promise.resolve(undefined),
        findFilePrs(opts.files),
        findIssues(slug, opts.errorTokens),
    ]);
    return { available: true, blamePr, filePrs, issues };
}

async function findBlamePr(slug: string, hash: string): Promise<GitHubPR | undefined> {
    try {
        const out = await runGh(['api', `repos/${slug}/commits/${hash}/pulls`, '--jq', '.[0]']);
        if (!out || out === 'null') { return undefined; }
        const pr = JSON.parse(out);
        return { number: pr.number, title: pr.title ?? '', author: pr.user?.login ?? '', state: pr.state?.toUpperCase() ?? '', url: pr.html_url ?? '' };
    } catch { return undefined; }
}

async function findFilePrs(files: readonly string[]): Promise<GitHubPR[]> {
    if (files.length === 0) { return []; }
    const search = files.slice(0, 3).map(f => `"${f}"`).join(' ');
    try {
        const out = await runGh(['pr', 'list', '--search', search, '--state', 'all', '--json', 'number,title,url,author,state', '--limit', '5']);
        return parseGhPrList(out);
    } catch { return []; }
}

function parseGhPrList(out: string): GitHubPR[] {
    try {
        const arr = JSON.parse(out);
        if (!Array.isArray(arr)) { return []; }
        return arr.map((p: Record<string, unknown>) => ({
            number: Number(p.number ?? 0),
            title: String(p.title ?? ''),
            author: String((p.author as Record<string, unknown>)?.login ?? ''),
            state: String(p.state ?? '').toUpperCase(),
            url: String(p.url ?? ''),
        }));
    } catch { return []; }
}

async function findIssues(slug: string, tokens: readonly string[]): Promise<GitHubIssue[]> {
    if (tokens.length === 0) { return []; }
    const query = tokens.slice(0, 3).join(' ');
    try {
        const out = await runGh(['search', 'issues', query, '--repo', slug, '--json', 'number,title,url,labels', '--limit', '5']);
        return parseGhIssueList(out);
    } catch { return []; }
}

function parseGhIssueList(out: string): GitHubIssue[] {
    try {
        const arr = JSON.parse(out);
        if (!Array.isArray(arr)) { return []; }
        return arr.map((i: Record<string, unknown>) => ({
            number: Number(i.number ?? 0),
            title: String(i.title ?? ''),
            url: String(i.url ?? ''),
            labels: Array.isArray(i.labels) ? (i.labels as Record<string, unknown>[]).map(l => String(l.name ?? '')) : [],
        }));
    } catch { return []; }
}

function runGh(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile('gh', args, { timeout: ghTimeout }, (err, stdout) => {
            if (err) { reject(err); return; }
            resolve((stdout ?? '').trim());
        });
    });
}
