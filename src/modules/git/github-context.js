"use strict";
/** GitHub CLI integration — PRs, issues, and blame-to-PR mapping via `gh`. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepoSlug = getRepoSlug;
exports.getGitHubContext = getGitHubContext;
const child_process_1 = require("child_process");
const workspace_analyzer_1 = require("../misc/workspace-analyzer");
let ghAvailable;
const ghTimeout = 10_000;
async function isGhAvailable() {
    if (ghAvailable !== undefined) {
        return ghAvailable;
    }
    try {
        await runGh(['--version']);
        ghAvailable = true;
    }
    catch {
        ghAvailable = false;
    }
    return ghAvailable;
}
/** Parse a GitHub remote URL into owner/repo slug. */
async function getRepoSlug(cwd) {
    const url = await (0, workspace_analyzer_1.runGitCommand)(['remote', 'get-url', 'origin'], cwd);
    if (!url) {
        return undefined;
    }
    const m = url.match(/github\.com[/:]([^/]+\/[^/.]+)/);
    return m?.[1]?.replace(/\.git$/, '');
}
/** Get GitHub context: blame PR, file PRs, and issues. */
async function getGitHubContext(opts) {
    if (!await isGhAvailable()) {
        return { available: false, setupHint: 'Install from https://cli.github.com', filePrs: [], issues: [] };
    }
    const slug = await getRepoSlug(opts.cwd);
    if (!slug) {
        return { available: true, setupHint: 'Remote is not on GitHub', filePrs: [], issues: [] };
    }
    const [blamePr, filePrs, issues] = await Promise.all([
        opts.blameHash ? findBlamePr(slug, opts.blameHash) : Promise.resolve(undefined),
        findFilePrs(opts.files),
        findIssues(slug, opts.errorTokens),
    ]);
    return { available: true, blamePr, filePrs, issues };
}
async function findBlamePr(slug, hash) {
    try {
        const out = await runGh(['api', `repos/${slug}/commits/${hash}/pulls`, '--jq', '.[0]']);
        if (!out || out === 'null') {
            return undefined;
        }
        const pr = JSON.parse(out);
        return { number: pr.number, title: pr.title ?? '', author: pr.user?.login ?? '', state: pr.state?.toUpperCase() ?? '', url: pr.html_url ?? '' };
    }
    catch {
        return undefined;
    }
}
async function findFilePrs(files) {
    if (files.length === 0) {
        return [];
    }
    const search = files.slice(0, 3).map(f => `"${f}"`).join(' ');
    try {
        const out = await runGh(['pr', 'list', '--search', search, '--state', 'all', '--json', 'number,title,url,author,state', '--limit', '5']);
        return parseGhPrList(out);
    }
    catch {
        return [];
    }
}
function parseGhPrList(out) {
    try {
        const arr = JSON.parse(out);
        if (!Array.isArray(arr)) {
            return [];
        }
        return arr.map((p) => ({
            number: Number(p.number ?? 0),
            title: String(p.title ?? ''),
            author: String(p.author?.login ?? ''),
            state: String(p.state ?? '').toUpperCase(),
            url: String(p.url ?? ''),
        }));
    }
    catch {
        return [];
    }
}
async function findIssues(slug, tokens) {
    if (tokens.length === 0) {
        return [];
    }
    const query = tokens.slice(0, 3).join(' ');
    try {
        const out = await runGh(['search', 'issues', query, '--repo', slug, '--json', 'number,title,url,labels', '--limit', '5']);
        return parseGhIssueList(out);
    }
    catch {
        return [];
    }
}
function parseGhIssueList(out) {
    try {
        const arr = JSON.parse(out);
        if (!Array.isArray(arr)) {
            return [];
        }
        return arr.map((i) => ({
            number: Number(i.number ?? 0),
            title: String(i.title ?? ''),
            url: String(i.url ?? ''),
            labels: Array.isArray(i.labels) ? i.labels.map(l => String(l.name ?? '')) : [],
        }));
    }
    catch {
        return [];
    }
}
function runGh(args) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.execFile)('gh', args, { timeout: ghTimeout }, (err, stdout) => {
            if (err) {
                reject(err);
                return;
            }
            resolve((stdout ?? '').trim());
        });
    });
}
//# sourceMappingURL=github-context.js.map