/**
 * Regression hints: correlate errors with Git history for "Introduced in commit X".
 *
 * - Blame-based: git blame for file:line → "Last changed in commit X".
 * - First-seen: first session where error appeared → session's Git commit (from integration meta).
 */

import * as vscode from 'vscode';
import { getGitBlame } from '../git/git-blame';
import { getCommitUrl, getRemoteBaseUrl } from '../integrations/providers/git-source-code';
import { aggregateSignals } from '../misc/cross-session-aggregator';
import { getLogDirectoryUri } from '../config/config';
import { loadMeta } from '../session/metadata-loader';
import { SessionMetadataStore } from '../session/session-metadata';

/** Blame-based hint: line last changed in this commit. */
export interface BlameHint {
    readonly type: 'blame';
    readonly hash: string;
    readonly author: string;
    readonly date: string;
    readonly message: string;
    readonly commitUrl?: string;
}

/** First-seen hint: error first appeared in a session that was at this commit. */
export interface FirstSeenHint {
    readonly type: 'first-seen';
    readonly hash: string;
    readonly session: string;
    readonly commitUrl?: string;
}

export type RegressionHint = BlameHint | FirstSeenHint;

export interface RegressionHintsResult {
    readonly blame?: BlameHint;
    readonly firstSeen?: FirstSeenHint;
}

function normSession(s: string): string {
    return s.replace(/\\/g, '/');
}

/**
 * Get blame for a source line and optional commit URL.
 * Runs async; use for analysis panel and error hover when file:line is known.
 */
export async function getBlameHint(
    uri: vscode.Uri,
    line: number,
    options?: { resolveCommitUrl?: boolean },
): Promise<BlameHint | undefined> {
    const blame = await getGitBlame(uri, line).catch(() => undefined);
    if (!blame) { return undefined; }

    let commitUrl: string | undefined;
    if (options?.resolveCommitUrl) {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (cwd) {
            commitUrl = await getCommitUrl(cwd, blame.hash).catch(() => undefined);
        }
    }

    return {
        type: 'blame',
        hash: blame.hash,
        author: blame.author,
        date: blame.date,
        message: blame.message,
        commitUrl,
    };
}

/**
 * Get the commit (if any) for the first session where this error signature appeared.
 * Uses session metadata integrations.git.commit from the Git provider.
 */
export async function getFirstSeenCommitForError(
    errorHash: string,
    options?: { resolveCommitUrl?: boolean },
): Promise<FirstSeenHint | undefined> {
    const aggregated = await aggregateSignals('all').catch(() => undefined);
    // Find matching error signal by fingerprint (raw hash for error-kind signals)
    const error = aggregated?.allSignals.find(s => s.kind === 'error' && s.fingerprint === errorHash);
    if (!error?.firstSeen) { return undefined; }

    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }

    const logDir = getLogDirectoryUri(folder);
    const firstSeenNorm = normSession(error.firstSeen);
    const loaded = await loadMeta(logDir, firstSeenNorm).catch(() => undefined);
    if (!loaded) { return undefined; }

    const gitPayload = loaded.meta.integrations?.git as Record<string, unknown> | undefined;
    const commit = typeof gitPayload?.commit === 'string' ? gitPayload.commit : undefined;
    if (!commit) { return undefined; }

    let commitUrl: string | undefined;
    if (options?.resolveCommitUrl) {
        commitUrl = await getCommitUrl(folder.uri.fsPath, commit).catch(() => undefined);
    }

    return {
        type: 'first-seen',
        hash: commit,
        session: error.firstSeen,
        commitUrl,
    };
}

/**
 * Get regression hints for an error: blame (if file:line given) and/or first-seen commit.
 */
export async function getRegressionHintsForError(
    errorHash: string,
    options?: {
        fileUri?: vscode.Uri;
        line?: number;
        resolveCommitUrls?: boolean;
    },
): Promise<RegressionHintsResult> {
    const resolve = options?.resolveCommitUrls ?? true;
    const [blame, firstSeen] = await Promise.all([
        options?.fileUri !== undefined && options?.fileUri !== null && options?.line !== undefined && options?.line !== null
            ? getBlameHint(options.fileUri, options.line, { resolveCommitUrl: resolve })
            : Promise.resolve(undefined),
        getFirstSeenCommitForError(errorHash, { resolveCommitUrl: resolve }),
    ]);

    return { blame, firstSeen };
}

/**
 * Batch first-seen commit hints for recurring errors (e.g. for Signal panel).
 * Loads session meta for first-seen sessions in parallel; caps count for performance.
 */
export async function getFirstSeenHintsForErrors(
    errorHashes: readonly string[],
    options?: { resolveCommitUrls?: boolean; cap?: number },
): Promise<Record<string, FirstSeenHint>> {
    const cap = options?.cap ?? 15;
    const resolve = options?.resolveCommitUrls ?? true;
    const aggregated = await aggregateSignals('all').catch(() => undefined);
    if (!aggregated) { return {}; }

    const toFetch = errorHashes.slice(0, cap).filter(h => {
        const err = aggregated.allSignals.find(s => s.kind === 'error' && s.fingerprint === h);
        return err?.firstSeen !== undefined && err?.firstSeen !== null;
    });

    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return {}; }

    const logDir = getLogDirectoryUri(folder);
    const store = new SessionMetadataStore();
    const remoteBase = resolve ? await getRemoteBaseUrl(folder.uri.fsPath).catch(() => undefined) : undefined;

    const entries = await Promise.all(
        toFetch.map(async (hash): Promise<[string, FirstSeenHint] | undefined> => {
            const error = aggregated.allSignals.find(s => s.kind === 'error' && s.fingerprint === hash);
            if (!error?.firstSeen) { return undefined; }
            const firstSeenNorm = normSession(error.firstSeen);
            try {
                const uri = vscode.Uri.joinPath(logDir, firstSeenNorm);
                const meta = await store.loadMetadata(uri);
                const gitPayload = meta.integrations?.git as Record<string, unknown> | undefined;
                const commit = typeof gitPayload?.commit === 'string' ? gitPayload.commit : undefined;
                if (!commit) { return undefined; }
                return [
                    hash,
                    {
                        type: 'first-seen',
                        hash: commit,
                        session: error.firstSeen,
                        commitUrl: remoteBase ? `${remoteBase}/commit/${commit}` : undefined,
                    },
                ];
            } catch {
                return undefined;
            }
        }),
    );

    const result: Record<string, FirstSeenHint> = {};
    for (const entry of entries) {
        if (entry) { result[entry[0]] = entry[1]; }
    }
    return result;
}
