/**
 * Git integration: adds git describe, uncommitted files summary, and stash count
 * to session header and meta; at session end optionally captures blame for file:line
 * references and resolves commit URLs (GitHub, GitLab, Bitbucket).
 */

import * as fs from 'fs';
import { execSync, execFile } from 'child_process';
import * as vscode from 'vscode';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveSourceUri } from '../../source/source-resolver';
import { parsePorcelainBlame } from '../../git/git-blame';

const GIT_TIMEOUT_MS = 3000;
const MAX_UNCOMMITTED_PATHS = 10;
const LINE_HISTORY_CAP = 20;
const BLAME_TIMEOUT_MS = 2000;

function isEnabled(context: IntegrationContext): boolean {
    const adapters = context.config.integrationsAdapters ?? [];
    return adapters.includes('git');
}

function runGitSync(cwd: string, args: string[]): string | undefined {
    try {
        const out = execSync(`git ${args.join(' ')}`, {
            encoding: 'utf-8',
            cwd,
            timeout: GIT_TIMEOUT_MS,
            maxBuffer: 64 * 1024,
        });
        return typeof out === 'string' ? out.trim() : undefined;
    } catch {
        return undefined;
    }
}

function getDescribe(cwd: string): string | undefined {
    return runGitSync(cwd, ['describe', '--tags', '--always']);
}

function getUncommittedPaths(cwd: string): string[] {
    const out = runGitSync(cwd, ['status', '--porcelain']);
    if (!out) { return []; }
    return out.split('\n')
        .map(line => line.slice(3).trim())
        .filter(Boolean)
        .slice(0, MAX_UNCOMMITTED_PATHS);
}

function getStashCount(cwd: string): number {
    const out = runGitSync(cwd, ['stash', 'list']);
    if (!out) { return 0; }
    return out.split('\n').filter(Boolean).length;
}

/** Run git blame for one line with a timeout. Returns raw --porcelain output or undefined. */
function runGitBlameWithTimeout(cwd: string, relPath: string, line: number): Promise<string | undefined> {
    return new Promise((resolve) => {
        execFile(
            'git',
            ['blame', '-L', `${line},${line}`, '--porcelain', '--', relPath],
            { cwd, timeout: BLAME_TIMEOUT_MS, maxBuffer: 16 * 1024 },
            (err, stdout) => {
                resolve(err ? undefined : (stdout ?? '').trim());
            },
        );
    });
}

/** Parse remote URL (SSH or HTTPS) to base URL for commits. Handles GitHub, GitLab, Bitbucket. */
function parseRemoteBaseUrl(remote: string): string | undefined {
    const trimmed = remote.trim();
    // git@host:owner/repo.git or git@host:group/subgroup/repo.git
    const sshMatch = /^git@([^:]+):(.+?)(?:\.git)?$/i.exec(trimmed);
    if (sshMatch) {
        const host = sshMatch[1];
        const path = sshMatch[2].replace(/\.git$/i, '');
        return `https://${host}/${path}`;
    }
    // https://github.com/owner/repo.git or https://gitlab.com/group/subgroup/repo
    const httpsMatch = /^https?:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/i.exec(trimmed);
    if (httpsMatch) {
        const host = httpsMatch[1];
        const path = httpsMatch[2].replace(/\.git$/i, '');
        return `https://${host}/${path}`;
    }
    return undefined;
}

/** Get the remote repository base URL (e.g. https://github.com/owner/repo). Used to build commit URLs without re-running git. */
export function getRemoteBaseUrl(cwd: string): Promise<string | undefined> {
    return new Promise((resolve) => {
        execFile('git', ['remote', 'get-url', 'origin'], { cwd, timeout: 3000 }, (err, stdout) => {
            if (err || !stdout) { resolve(undefined); return; }
            resolve(parseRemoteBaseUrl(stdout.trim()));
        });
    });
}

/** Resolve a commit hash to a web URL (GitHub/GitLab/Bitbucket). Uses one git call per invocation; for many commits, call getRemoteBaseUrl once and append `/commit/{hash}`. */
export async function getCommitUrl(cwd: string, hash: string): Promise<string | undefined> {
    if (!hash || hash === '0000000') { return undefined; }
    const base = await getRemoteBaseUrl(cwd);
    return base ? `${base}/commit/${hash}` : undefined;
}

/** Extract file:line references from log text (stack traces, etc.). Deduplicated and capped. */
function parseFileLineReferences(logText: string): { file: string; line: number }[] {
    const seen = new Set<string>();
    const out: { file: string; line: number }[] = [];
    const cap = LINE_HISTORY_CAP;

    // Dart: package:foo/bar.dart:42 or package:foo/bar.dart:42:5
    const dartRe = /package:([^:]+)\/([^\s:]+):(\d+)(?::\d+)?/g;
    let m: RegExpExecArray | null;
    while (out.length < cap && (m = dartRe.exec(logText)) !== null) {
        const file = `package:${m[1]}/${m[2]}`;
        const line = parseInt(m[3], 10);
        const key = `${file}:${line}`;
        if (!seen.has(key) && !file.includes('://')) {
            seen.add(key);
            out.push({ file, line });
        }
    }

    // JS/TS/Java: at Foo (path/to/file.ts:10) or (path/to/file.ts:10:5)
    const atRe = /(?:at\s+[^(]+\(|\()([^)]+):(\d+)(?::\d+)?\)/g;
    while (out.length < cap && (m = atRe.exec(logText)) !== null) {
        const file = m[1].trim();
        const line = parseInt(m[2], 10);
        if (file.includes('://')) { continue; }
        const key = `${file}:${line}`;
        if (!seen.has(key)) {
            seen.add(key);
            out.push({ file, line });
        }
    }

    // Generic path with slash/backslash then :line (avoid URLs)
    const pathRe = /\b((?:[a-zA-Z]:)?[^\s:]*[\/\\][^\s:]+):(\d+)(?::\d+)?\b/g;
    while (out.length < cap && (m = pathRe.exec(logText)) !== null) {
        const file = m[1].trim();
        if (file.includes('://')) { continue; }
        const line = parseInt(m[2], 10);
        const key = `${file}:${line}`;
        if (!seen.has(key)) {
            seen.add(key);
            out.push({ file, line });
        }
    }

    return out;
}

export const gitSourceCodeProvider: IntegrationProvider = {
    id: 'git',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!isEnabled(context)) { return undefined; }
        const cwd = context.workspaceFolder.uri.fsPath;
        const { describeInHeader, uncommittedInHeader, stashInHeader } = context.config.integrationsGit;
        const lines: string[] = [];
        const payload: Record<string, unknown> = {};

        if (describeInHeader) {
            const describe = getDescribe(cwd);
            if (describe) {
                lines.push(`Git describe:   ${describe}`);
                payload.describe = describe;
            }
        }

        if (uncommittedInHeader) {
            const paths = getUncommittedPaths(cwd);
            const total = runGitSync(cwd, ['status', '--porcelain']);
            const count = total ? total.split('\n').filter(Boolean).length : 0;
            if (count > 0) {
                const summary = paths.length < count
                    ? `${paths.join(', ')} (+${count - paths.length} more)`
                    : paths.join(', ');
                lines.push(`Uncommitted:    ${count} file(s) — ${summary}`);
                payload.uncommittedCount = count;
                payload.uncommittedPaths = paths;
            }
        }

        if (stashInHeader) {
            const stashCount = getStashCount(cwd);
            if (stashCount > 0) {
                lines.push(`Stash:          ${stashCount} entries`);
                payload.stashCount = stashCount;
            }
        }

        if (lines.length === 0) { return undefined; }
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'git', payload },
        ];
    },

    /** At session end: if includeLineHistoryInMeta is true, parse log for file:line refs, run blame (capped), store lineHistory in meta. Commit URLs resolved once per session when commitLinks is true. */
    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const { includeLineHistoryInMeta, commitLinks } = context.config.integrationsGit;
        if (!includeLineHistoryInMeta) { return undefined; }

        const cwd = context.workspaceFolder.uri.fsPath;
        let logText: string;
        try {
            logText = fs.readFileSync(context.logUri.fsPath, 'utf-8');
        } catch {
            context.outputChannel.appendLine('[git] Could not read log file for line history.');
            return undefined;
        }

        const refs = parseFileLineReferences(logText);
        if (refs.length === 0) { return undefined; }

        // Resolve remote base URL once so we can build commit URLs without N git calls.
        const remoteBase = commitLinks ? await getRemoteBaseUrl(cwd) : undefined;

        const lineHistory: Array<{
            file: string;
            line: number;
            commit: string;
            author: string;
            date: string;
            summary: string;
            commitUrl?: string;
        }> = [];

        for (const { file, line } of refs) {
            const uri = resolveSourceUri(file);
            if (!uri) { continue; }
            const relPath = vscode.workspace.asRelativePath(uri, false);
            const raw = await runGitBlameWithTimeout(cwd, relPath, line);
            const blame = raw ? parsePorcelainBlame(raw) : undefined;
            if (!blame) { continue; }
            const entry: typeof lineHistory[0] = {
                file,
                line,
                commit: blame.hash,
                author: blame.author,
                date: blame.date,
                summary: blame.message,
            };
            if (remoteBase) {
                entry.commitUrl = `${remoteBase}/commit/${blame.hash}`;
            }
            lineHistory.push(entry);
        }

        if (lineHistory.length === 0) { return undefined; }
        return [
            { kind: 'meta', key: 'git', payload: { lineHistory } },
        ];
    },
};
