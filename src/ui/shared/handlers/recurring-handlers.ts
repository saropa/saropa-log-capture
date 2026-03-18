/**
 * Recurring Errors Handlers
 *
 * Handlers for recurring errors panel operations.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { getLogDirectoryUri } from '../../../modules/config/config';
import type { RecurringError } from '../../../modules/misc/cross-session-aggregator';
import { aggregateInsights } from '../../../modules/misc/cross-session-aggregator';
import { getErrorStatusBatch, setErrorStatus, type ErrorStatus } from '../../../modules/misc/error-status-store';
import { SessionMetadataStore } from '../../../modules/session/session-metadata';
import type { PostFn } from './crashlytics-handlers';

/** Top errors in one session (from fingerprints). */
export interface ErrorInThisLogItem {
    readonly normalizedText: string;
    readonly exampleLine: string;
    readonly count: number;
}

/** Normalize path segment for comparison with timeline session (forward slashes). */
function normSession(s: string): string {
    return s.replace(/\\/g, '/');
}

/** Recurring errors that appear in the given session (timeline contains session path). */
function filterRecurringInSession(errors: readonly RecurringError[], sessionRelPath: string): RecurringError[] {
    const norm = normSession(sessionRelPath);
    return errors.filter(e => e.timeline.some(t => normSession(t.session) === norm || normSession(t.session).endsWith(norm)));
}

/** Aggregate recurring errors and send to webview. */
export async function handleRecurringRequest(post: PostFn): Promise<void> {
    const insights = await aggregateInsights('all').catch(() => undefined);
    const errors = insights?.recurringErrors ?? [];
    const statuses = await getErrorStatusBatch(errors.map(e => e.hash));
    post({ type: 'recurringErrorsData', errors, statuses });
}

/** Update error status and refresh. */
export async function handleSetErrorStatus(hash: string, status: string, post: PostFn): Promise<void> {
    await setErrorStatus(hash, status as ErrorStatus);
    await handleRecurringRequest(post);
}

/** Full insight payload (recurring + hot files + environment + optional recurringInThisLog). */
export async function handleInsightDataRequest(post: PostFn, currentFileUri?: vscode.Uri): Promise<void> {
    const insights = await aggregateInsights('all').catch(() => undefined);
    const errors = insights?.recurringErrors ?? [];
    const hotFiles = insights?.hotFiles ?? [];
    const platforms = insights?.platforms ?? [];
    const sdkVersions = insights?.sdkVersions ?? [];
    const debugAdapters = insights?.debugAdapters ?? [];
    const statuses = await getErrorStatusBatch(errors.map(e => e.hash));

    let recurringInThisLog: RecurringError[] | undefined;
    let errorsInThisLog: ErrorInThisLogItem[] | undefined;
    let errorsInThisLogTotal: number | undefined;
    if (currentFileUri) {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (folder) {
            const logDir = getLogDirectoryUri(folder);
            const rel = path.relative(logDir.fsPath, currentFileUri.fsPath);
            const sessionRel = normSession(rel);
            if (!rel.startsWith('..') && sessionRel.length > 0) {
                recurringInThisLog = filterRecurringInSession(errors, sessionRel);
            }
        }
        try {
            const store = new SessionMetadataStore();
            const meta = await store.loadMetadata(currentFileUri);
            const fps = meta?.fingerprints ?? [];
            const top3 = [...fps]
                .sort((a, b) => (b.c ?? 0) - (a.c ?? 0))
                .slice(0, 3)
                .map(f => ({
                    normalizedText: f.n ?? '',
                    exampleLine: f.e ?? '',
                    count: f.c ?? 0,
                }));
            if (top3.length > 0) {
                errorsInThisLog = top3;
            }
            errorsInThisLogTotal = fps.length;
        } catch {
            // ignore
        }
    }

    post({
        type: 'insightData',
        errors,
        statuses,
        hotFiles,
        platforms,
        sdkVersions,
        debugAdapters,
        recurringInThisLog,
        errorsInThisLog,
        errorsInThisLogTotal,
    });
}
