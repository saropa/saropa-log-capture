/**
 * App Quality Insights dashboard — editor-tab controller.
 *
 * Opens a 3-pane webview (issues | detail | breakdown) over the Crashlytics/Play Reporting data layer
 * (bug_008). Issues load from getFirebaseContext; selecting one fetches its sampled reports and reuses
 * the existing renderCrashDetail / renderDeviceDistribution renderers so the stack and breakdown match
 * the sidebar exactly. A standalone tab (new files) so it does not touch the curated sidebar code.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { getNonce } from '../provider/viewer-content';
import { formatElapsedLabel } from '../../modules/capture/ansi';
import { getFirebaseContext, getCrashEvents, getIssueBreakdown, getIssueFilterIndex, clearIssueListCache } from '../../modules/crashlytics/firebase-crashlytics';
import { detectPackageName } from '../../modules/misc/app-identity';
import { renderCrashDetail, renderDeviceDistribution } from '../analysis/analysis-crash-detail';
import { buildDashboardHtml, renderAggregateBreakdown, type DashboardModel } from './app-quality-insights-render';
import type { IssueBreakdown } from '../../modules/crashlytics/play-reporting-metrics';
import type { CrashlyticsIssueEvents } from '../../modules/crashlytics/crashlytics-types';

let panel: vscode.WebviewPanel | undefined;
let lastConsoleUrl: string | undefined;

/** Open (or focus) the dashboard and load its data. `initialIssueId` is auto-selected when given. */
export async function showAppQualityInsights(initialIssueId?: string): Promise<void> {
    ensurePanel();
    await render(initialIssueId);
}

/** Dispose the dashboard panel (called on extension deactivate). */
export function disposeAppQualityInsights(): void { panel?.dispose(); panel = undefined; }

function ensurePanel(): void {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.appQualityInsights', 'App Quality Insights',
        vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [], retainContextWhenHidden: true },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; });
}

function loadingHtml(): string {
    const nonce = getNonce();
    return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';"><style nonce="${nonce}">body{font-family:var(--vscode-font-family);padding:16px;color:var(--vscode-foreground)}</style></head><body>Loading App Quality Insights…</body></html>`;
}

async function buildModel(): Promise<DashboardModel> {
    clearIssueListCache();
    const ctx = await getFirebaseContext([]);
    const packageName = (await detectPackageName()) ?? '';
    const timeRange = vscode.workspace.getConfiguration('saropaLogCapture.firebase').get<string>('timeRange', 'LAST_7_DAYS');
    lastConsoleUrl = ctx.consoleUrl;
    // Download per-issue device/OS values for the local filters (sequential so the token cache from
    // getFirebaseContext is reused; only when connected). undefined index just hides those filters.
    const filterIndex = ctx.available ? await getIssueFilterIndex() : undefined;
    return {
        available: ctx.available,
        issues: ctx.issues,
        packageName,
        timeRange,
        filterIndex,
        refreshNote: ctx.queriedAt ? formatElapsedLabel(ctx.queriedAt) : '',
        consoleUrl: ctx.consoleUrl,
        setupHint: ctx.setupHint ?? ctx.diagnostics?.message,
        // When available with a diagnostic, the list came from the offline cache (stale).
        staleNote: ctx.available && ctx.diagnostics ? ctx.diagnostics.message : undefined,
    };
}

async function render(initialIssueId?: string): Promise<void> {
    if (!panel) { return; }
    panel.webview.html = loadingHtml();
    try {
        // Backstop so a wedged call never leaves an indefinite spinner (no silent hang). The data
        // layer has internal timeouts; this guards anything outside them.
        const model = await withTimeout(buildModel(), 35_000);
        if (panel) { panel.webview.html = buildDashboardHtml(model, getNonce(), initialIssueId); }
    } catch {
        if (panel) { panel.webview.html = errorHtml(); }
    }
}

/** Reject after `ms` so render() can fall back to an error + Retry instead of spinning forever. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
    return Promise.race([work, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

/** Error page with a Retry button (posts 'refresh') for when loading fails or times out. */
function errorHtml(): string {
    const nonce = getNonce();
    const csp = `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
    return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><style nonce="${nonce}">body{font-family:var(--vscode-font-family);padding:16px;color:var(--vscode-foreground)}button{margin-top:12px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:6px 14px;border-radius:3px;cursor:pointer}.aqi-err{color:var(--vscode-errorForeground);font-weight:600}</style></head><body>
<p class="aqi-err">Couldn't load App Quality Insights in time.</p>
<p>Check the <b>Saropa Log Capture</b> output channel for the reason (gcloud, sign-in, or the Play Reporting API), then retry.</p>
<button id="aqi-retry">Retry</button>
<script nonce="${nonce}">var v=acquireVsCodeApi();document.getElementById('aqi-retry').addEventListener('click',function(){v.postMessage({type:'refresh'});});</script>
</body></html>`;
}

function handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
        case 'selectIssue': void sendDetail(String(msg.issueId ?? '')); return;
        case 'refresh': void render(); return;
        case 'setTimeRange': void applyTimeRange(String(msg.range ?? 'LAST_7_DAYS')); return;
        case 'openConsole': if (lastConsoleUrl) { void vscode.env.openExternal(vscode.Uri.parse(lastConsoleUrl)); } return;
        case 'openFrame': void openFrame(String(msg.file ?? ''), Number(msg.line ?? 0)); return;
        default: return;
    }
}

async function applyTimeRange(range: string): Promise<void> {
    await vscode.workspace.getConfiguration('saropaLogCapture.firebase').update('timeRange', range, vscode.ConfigurationTarget.Workspace);
    await render();
}

/** Fetch one issue's sampled reports and push its stack + breakdown into the webview. Never throws. */
async function sendDetail(issueId: string): Promise<void> {
    if (!panel || !issueId) { return; }
    try {
        // Stack (sampled events) and true device/OS aggregates (metric set) load in parallel.
        const [multi, breakdown] = await Promise.all([getCrashEvents(issueId), getIssueBreakdown(issueId)]);
        const detailHtml = multi && multi.events.length > 0
            ? renderCrashDetail(multi.events[multi.currentIndex])
            : '<div class="no-matches">No stack trace available for this issue.</div>';
        panel.webview.postMessage({ type: 'detail', issueId, detailHtml, breakdownHtml: breakdownHtmlFor(breakdown, multi) });
    } catch {
        panel.webview.postMessage({ type: 'detail', issueId, detailHtml: '<div class="no-matches">Could not load this issue.</div>' });
    }
}

/** Prefer true metric-set aggregates; fall back to the sampled-event estimate when unavailable. */
function breakdownHtmlFor(breakdown: IssueBreakdown | undefined, multi: CrashlyticsIssueEvents | undefined): string {
    if (breakdown && (breakdown.devices.length > 0 || breakdown.os.length > 0)) {
        return renderAggregateBreakdown(breakdown);
    }
    return multi ? renderDeviceDistribution(multi) : '<div class="aqi-empty">No breakdown for this issue.</div>';
}

/** Best-effort open of a source frame at a line (absolute, workspace-relative, then basename search). */
async function openFrame(file: string, line: number): Promise<void> {
    if (!file) { return; }
    const ws = vscode.workspace.workspaceFolders?.[0];
    const candidate = path.isAbsolute(file) ? vscode.Uri.file(file) : ws ? vscode.Uri.joinPath(ws.uri, file) : undefined;
    const uri = (candidate && await exists(candidate)) ? candidate : await findByBasename(file);
    if (!uri) { return; }
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const pos = new vscode.Position(Math.max(0, line - 1), 0);
        await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos), viewColumn: vscode.ViewColumn.One });
    } catch { /* opening is best-effort */ }
}

async function exists(uri: vscode.Uri): Promise<boolean> {
    try { await vscode.workspace.fs.stat(uri); return true; } catch { return false; }
}

async function findByBasename(file: string): Promise<vscode.Uri | undefined> {
    const base = file.split(/[\\/]/).pop();
    if (!base) { return undefined; }
    const found = await vscode.workspace.findFiles(`**/${base}`, '**/node_modules/**', 1);
    return found[0];
}
