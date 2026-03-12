/**
 * Extension-side handlers for Crashlytics and Recurring Errors panels.
 *
 * These functions perform async operations (API calls, terminal creation,
 * file browsing) on behalf of the webview panels. Each accepts a `post`
 * callback to send results back to the webview.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { escapeHtml, formatElapsedLabel } from '../../modules/capture/ansi';
import {
    getFirebaseContext, getCrashEvents, updateIssueState,
    clearIssueListCache, gcloudInstallUrl, findBestGoogleServicesJson,
    type FirebaseContext,
} from '../../modules/crashlytics/firebase-crashlytics';
import { renderCrashDetail } from '../analysis/analysis-crash-detail';
import { aggregateInsights } from '../../modules/misc/cross-session-aggregator';
import { aggregatePerformance } from '../../modules/misc/perf-aggregator';
import { getErrorStatusBatch, setErrorStatus, type ErrorStatus } from '../../modules/misc/error-status-store';
import { SessionMetadataStore } from '../../modules/session/session-metadata';

type PostFn = (msg: unknown) => void;

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let terminalListener: vscode.Disposable | undefined;

/* ---- Crashlytics handlers ---- */

/** Fetch Crashlytics context and send to webview. Never throws. */
export async function handleCrashlyticsRequest(post: PostFn): Promise<void> {
    try {
        clearIssueListCache();
        const raw = await getFirebaseContext([]);
        const ctx: FirebaseContext = raw ?? { available: false, setupHint: 'Query failed', issues: [] };
        post({ type: 'crashlyticsData', context: serializeContext(ctx) });
    } catch {
        post({ type: 'crashlyticsData', context: serializeContext({ available: false, setupHint: 'Unexpected error', issues: [] }) });
    }
}

/** Fetch crash detail for a specific issue and send HTML to webview. Never throws. */
export async function handleCrashDetail(issueId: string, post: PostFn): Promise<void> {
    try {
        const multi = await getCrashEvents(issueId);
        const detail = multi?.events[multi.currentIndex ?? 0];
        const html = detail ? renderCrashDetail(detail) : '<div class="no-matches">Crash details not available</div>';
        post({ type: 'crashDetailReady', issueId, html });
    } catch {
        post({ type: 'crashDetailReady', issueId, html: '<div class="no-matches">Crash details not available</div>' });
    }
}

/** Close or mute a Crashlytics issue, then refresh. Never throws. */
export async function handleCrashlyticsAction(
    issueId: string, state: 'CLOSED' | 'MUTED', post: PostFn,
): Promise<void> {
    try {
        const ok = await updateIssueState(issueId, state);
        if (ok) { await handleCrashlyticsRequest(post); }
        else { post({ type: 'issueActionFailed', action: state }); }
    } catch {
        post({ type: 'issueActionFailed', action: state });
    }
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

/** Show file picker for google-services.json and copy to workspace root. Never throws. */
export async function handleBrowseGoogleServices(post: PostFn): Promise<void> {
    try {
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
    } catch {
        // Silently ignore so we never crash the app
    }
}

/** Open google-services.json in the workspace (prefers android/app/). Shows progress while resolving. Never throws. */
export async function handleOpenGoogleServicesJson(): Promise<void> {
    try {
        const uri = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Opening google-services.json…' },
            () => findBestGoogleServicesJson(),
        );
        if (uri) {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
        } else {
            await vscode.window.showInformationMessage(t('msg.noGoogleServicesJson'));
        }
    } catch {
        await vscode.window.showInformationMessage(t('msg.noGoogleServicesJson'));
    }
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

/* ---- Performance handlers ---- */

/** Aggregate performance fingerprints and optional session data for current log. */
export async function handlePerformanceRequest(post: PostFn, logUri?: vscode.Uri): Promise<void> {
    const [insights, sessionData] = await Promise.all([
        aggregatePerformance('all').catch(() => undefined),
        logUri ? (async () => {
            try {
                const store = new SessionMetadataStore();
                const meta = await store.loadMetadata(logUri);
                return meta.integrations?.performance as Record<string, unknown> | undefined;
            } catch {
                return undefined;
            }
        })() : Promise.resolve(undefined),
    ]);
    post({
        type: 'performanceData',
        trends: insights?.trends ?? [],
        sessionCount: insights?.sessionCount ?? 0,
        sessionData: sessionData ?? undefined,
    });
}

/* ---- Integration Context handlers ---- */

/** Format a single integration entry into display lines. */
function formatIntegrationEntry(key: string, value: unknown): string[] {
    const lines: string[] = [];
    const data = value as Record<string, unknown>;
    const capturedAt = data.capturedAt as number | undefined;
    const sessionWindow = data.sessionWindow as { start: number; end: number } | undefined;
    const header = capturedAt
        ? `${key} (captured at ${new Date(capturedAt).toLocaleTimeString()})`
        : key;
    lines.push(`── ${header} ──`);
    if (sessionWindow) {
        lines.push(`  Session: ${new Date(sessionWindow.start).toLocaleTimeString()} - ${new Date(sessionWindow.end).toLocaleTimeString()}`);
    }
    for (const [k, v] of Object.entries(data)) {
        if (k === 'capturedAt' || k === 'sessionWindow') { continue; }
        const formatted = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
        if (formatted.includes('\n')) {
            lines.push(`  ${k}:`);
            formatted.split('\n').forEach(line => lines.push(`    ${line}`));
        } else {
            lines.push(`  ${k}: ${formatted}`);
        }
    }
    lines.push('');
    return lines;
}

/**
 * Show integration context data for a log line. Displays data from integrations captured during the session.
 * @param _timestamp Reserved for future enhancement: filter integration data to ±5s of this timestamp.
 */
export async function handleIntegrationContextRequest(
    logUri: vscode.Uri | undefined,
    lineIndex: number,
    _timestamp: number | undefined,
    post: PostFn,
): Promise<void> {
    if (!logUri) {
        vscode.window.showInformationMessage(t('msg.noIntegrationContext'));
        return;
    }
    try {
        const store = new SessionMetadataStore();
        const meta = await store.loadMetadata(logUri);
        const integrations = meta.integrations;
        if (!integrations || Object.keys(integrations).length === 0) {
            vscode.window.showInformationMessage(t('msg.noIntegrationData'));
            return;
        }
        const contextLines: string[] = [`Integration context for line ${lineIndex + 1}:`, ''];
        for (const [key, value] of Object.entries(integrations)) {
            contextLines.push(...formatIntegrationEntry(key, value));
        }
        post({ type: 'integrationContextData', context: contextLines.join('\n') });
        const doc = await vscode.workspace.openTextDocument({ content: contextLines.join('\n'), language: 'markdown' });
        await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    } catch {
        vscode.window.showInformationMessage(t('msg.noIntegrationContext'));
    }
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
