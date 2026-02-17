/**
 * Extension-side handlers for Crashlytics and Recurring Errors panels.
 *
 * These functions perform async operations (API calls, terminal creation,
 * file browsing) on behalf of the webview panels. Each accepts a `post`
 * callback to send results back to the webview.
 */

import * as vscode from 'vscode';
import { escapeHtml, formatElapsedLabel } from '../modules/ansi';
import {
    getFirebaseContext, getCrashEvents, updateIssueState,
    clearIssueListCache, gcloudInstallUrl,
    type FirebaseContext,
} from '../modules/firebase-crashlytics';
import { renderCrashDetail } from './analysis-crash-detail';
import { aggregateInsights } from '../modules/cross-session-aggregator';
import { getErrorStatusBatch, setErrorStatus, type ErrorStatus } from '../modules/error-status-store';

type PostFn = (msg: unknown) => void;

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let terminalListener: vscode.Disposable | undefined;

/* ---- Crashlytics handlers ---- */

/** Fetch Crashlytics context and send to webview. */
export async function handleCrashlyticsRequest(post: PostFn): Promise<void> {
    clearIssueListCache();
    const raw = await getFirebaseContext([]).catch(() => undefined);
    const ctx: FirebaseContext = raw ?? { available: false, setupHint: 'Query failed', issues: [] };
    post({ type: 'crashlyticsData', context: serializeContext(ctx) });
}

/** Fetch crash detail for a specific issue and send HTML to webview. */
export async function handleCrashDetail(issueId: string, post: PostFn): Promise<void> {
    const multi = await getCrashEvents(issueId).catch(() => undefined);
    const detail = multi?.events[0];
    const html = detail ? renderCrashDetail(detail) : '<div class="no-matches">Crash details not available</div>';
    post({ type: 'crashDetailReady', issueId, html });
}

/** Close or mute a Crashlytics issue, then refresh. */
export async function handleCrashlyticsAction(
    issueId: string, state: 'CLOSED' | 'MUTED', post: PostFn,
): Promise<void> {
    const ok = await updateIssueState(issueId, state);
    if (ok) { await handleCrashlyticsRequest(post); }
    else { post({ type: 'issueActionFailed', action: state }); }
}

/** Open a terminal and run gcloud auth; auto-refresh on terminal close. */
export function handleGcloudAuth(post: PostFn): void {
    const terminal = vscode.window.createTerminal({ name: 'Google Cloud Auth' });
    terminal.show();
    terminal.sendText('gcloud auth application-default login');
    terminalListener?.dispose();
    terminalListener = vscode.window.onDidCloseTerminal(closed => {
        if (closed !== terminal) { return; }
        terminalListener?.dispose();
        terminalListener = undefined;
        handleCrashlyticsRequest(post);
    });
}

/** Show file picker for google-services.json and copy to workspace root. */
export async function handleBrowseGoogleServices(post: PostFn): Promise<void> {
    const files = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'JSON': ['json'] },
        openLabel: 'Select google-services.json',
    });
    if (!files || files.length === 0) { return; }
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return; }
    const dest = vscode.Uri.joinPath(ws.uri, 'google-services.json');
    await vscode.workspace.fs.copy(files[0], dest, { overwrite: true });
    await handleCrashlyticsRequest(post);
}

/** Open the gcloud install URL. */
export function handleOpenGcloudInstall(): void {
    vscode.env.openExternal(vscode.Uri.parse(gcloudInstallUrl)).then(undefined, () => {});
}

/** Start periodic Crashlytics auto-refresh. */
export function startCrashlyticsAutoRefresh(post: PostFn): void {
    stopCrashlyticsAutoRefresh();
    const interval = vscode.workspace
        .getConfiguration('saropaLogCapture.firebase')
        .get<number>('refreshInterval', 300);
    if (interval > 0) {
        refreshTimer = setInterval(() => { handleCrashlyticsRequest(post); }, interval * 1000);
    }
}

/** Stop periodic Crashlytics auto-refresh. */
export function stopCrashlyticsAutoRefresh(): void {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = undefined; }
}

/** Dispose terminal listener and stop auto-refresh. */
export function disposeHandlers(): void {
    stopCrashlyticsAutoRefresh();
    terminalListener?.dispose();
    terminalListener = undefined;
}

/* ---- Recurring Errors handlers ---- */

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

/* ---- Serialization helpers ---- */

function serializeContext(ctx: FirebaseContext): Record<string, unknown> {
    const diagnosticHtml = buildDiagnosticHtml(ctx);
    const refreshNote = ctx.queriedAt ? formatElapsedLabel(ctx.queriedAt) : '';
    return {
        available: ctx.available,
        setupStep: ctx.setupStep,
        issues: ctx.issues.map(i => ({
            id: i.id, title: i.title, subtitle: i.subtitle,
            isFatal: i.isFatal, state: i.state,
            eventCount: i.eventCount, userCount: i.userCount,
            firstVersion: i.firstVersion, lastVersion: i.lastVersion,
        })),
        consoleUrl: ctx.consoleUrl,
        diagnosticHtml,
        refreshNote,
    };
}

function buildDiagnosticHtml(ctx: FirebaseContext): string {
    const d = ctx.diagnostics;
    if (!d) { return ''; }
    const tech = d.technicalDetails
        ? `<details class="cp-diag-tech"><summary>Technical details</summary><pre>${escapeHtml(d.technicalDetails)}</pre></details>` : '';
    const status = d.httpStatus ? `<div class="cp-diag-status">HTTP ${d.httpStatus}</div>` : '';
    const time = `<div class="cp-diag-time">Last checked: ${formatElapsedLabel(d.checkedAt)}</div>`;
    return `<div class="cp-diag-box"><div class="cp-diag-msg">${escapeHtml(d.message)}</div>${status}${tech}${time}</div>`;
}
