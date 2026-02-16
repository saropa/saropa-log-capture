/** Crashlytics editor-tab panel — shows top crash issues from Firebase. */

import * as vscode from 'vscode';
import { escapeHtml, formatElapsedLabel } from '../modules/ansi';
import { getNonce } from './viewer-content';
import {
    getFirebaseContext, getCrashEvents, updateIssueState, clearIssueListCache,
    gcloudInstallUrl,
    type CrashlyticsIssue, type FirebaseContext,
} from '../modules/firebase-crashlytics';
import { renderCrashDetail } from './analysis-crash-detail';

let panel: vscode.WebviewPanel | undefined;
let lastContext: FirebaseContext | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let terminalListener: vscode.Disposable | undefined;

/** Show (or reveal) the Crashlytics editor-tab panel. */
export async function showCrashlyticsPanel(): Promise<void> {
    ensurePanel();
    await refresh();
}

/** Refresh if the panel is open; no-op otherwise. */
export async function refreshCrashlyticsPanel(): Promise<void> {
    if (!panel) { return; }
    await refresh();
}

/** Dispose the singleton panel. */
export function disposeCrashlyticsPanel(): void {
    panel?.dispose();
    panel = undefined;
}

function ensurePanel(): void {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.crashlytics', 'Saropa Crashlytics',
        vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => {
        panel = undefined;
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = undefined; }
        terminalListener?.dispose();
        terminalListener = undefined;
    });
    startAutoRefresh();
}

async function refresh(): Promise<void> {
    if (!panel) { return; }
    panel.webview.html = buildLoadingHtml();
    clearIssueListCache();
    const ctx = await getFirebaseContext([]).catch(() => undefined);
    lastContext = ctx ?? { available: false, setupHint: 'Query failed', issues: [] };
    if (panel) { panel.webview.html = buildPanelHtml(lastContext); }
}

function startAutoRefresh(): void {
    if (refreshTimer) { return; }
    const interval = vscode.workspace
        .getConfiguration('saropaLogCapture.firebase')
        .get<number>('refreshInterval', 300);
    if (interval > 0) { refreshTimer = setInterval(() => { refresh(); }, interval * 1000); }
}

async function handleMessage(msg: Record<string, unknown>): Promise<void> {
    if (msg.type === 'refresh' || msg.type === 'checkAgain') { await refresh(); }
    else if (msg.type === 'runGcloudAuth') { runGcloudAuth(); }
    else if (msg.type === 'browseGoogleServices') { await browseGoogleServices(); }
    else if (msg.type === 'openSettings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'saropaLogCapture.firebase');
    }
    else if (msg.type === 'fetchCrashDetail') { await fetchDetail(String(msg.issueId ?? '')); }
    else if (msg.type === 'closeIssue' || msg.type === 'muteIssue') {
        const state = msg.type === 'closeIssue' ? 'CLOSED' as const : 'MUTED' as const;
        const ok = await updateIssueState(String(msg.issueId ?? ''), state);
        if (ok) { await refresh(); }
        else { panel?.webview.postMessage({ type: 'issueActionFailed', action: state }); }
    }
    else if (msg.type === 'openFirebaseUrl') {
        vscode.env.openExternal(vscode.Uri.parse(String(msg.url))).then(undefined, () => {});
    }
}

/** Open a terminal and run the gcloud auth command; auto-refresh on close. */
function runGcloudAuth(): void {
    const terminal = vscode.window.createTerminal({ name: 'Google Cloud Auth' });
    terminal.show();
    terminal.sendText('gcloud auth application-default login');
    terminalListener?.dispose();
    terminalListener = vscode.window.onDidCloseTerminal(closed => {
        if (closed !== terminal) { return; }
        terminalListener?.dispose();
        terminalListener = undefined;
        refresh();
    });
}

/** Open a file picker for google-services.json and copy it to workspace root. */
async function browseGoogleServices(): Promise<void> {
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
    await refresh();
}

async function fetchDetail(issueId: string): Promise<void> {
    const multi = await getCrashEvents(issueId).catch(() => undefined);
    const detail = multi?.events[0];
    const html = detail ? renderCrashDetail(detail) : '<div class="no-matches">Crash details not available</div>';
    panel?.webview.postMessage({ type: 'crashDetailReady', issueId, html });
}

function buildLoadingHtml(): string {
    return `<!DOCTYPE html><html><body style="padding:8px;font-family:var(--vscode-font-family)"><p>Loading Crashlytics data...</p></body></html>`;
}

function buildPanelHtml(ctx: FirebaseContext): string {
    const nonce = getNonce();
    if (!ctx.available) { return buildSetupHtml(ctx, nonce); }
    const refreshNote = ctx.queriedAt ? `(${formatElapsedLabel(ctx.queriedAt)})` : '';
    let issueHtml = '';
    if (ctx.issues.length === 0 && ctx.diagnostics) {
        issueHtml = `<div class="fb-error">Query failed: ${escapeHtml(ctx.diagnostics.message)}</div>${renderDiagnosticBox(ctx)}`;
    } else if (ctx.issues.length === 0) {
        issueHtml = '<p class="fb-empty">No open Crashlytics issues</p>';
    }
    for (const issue of ctx.issues) { issueHtml += renderIssueCard(issue); }
    const consoleLink = ctx.consoleUrl
        ? `<div class="fb-console" data-url="${escapeHtml(ctx.consoleUrl)}">Open Firebase Console</div>` : '';
    return `<!DOCTYPE html><html><head><style nonce="${nonce}">${getPanelStyles()}</style></head><body>
<div class="toolbar"><span class="title">Crashlytics ${refreshNote}</span><button class="refresh-btn" onclick="postMsg('refresh')">Refresh</button></div>
${issueHtml}${consoleLink}
<script nonce="${nonce}">const vscodeApi=acquireVsCodeApi();function postMsg(t,v,id){vscodeApi.postMessage({type:t,url:v,issueId:id})}
document.addEventListener('click',e=>{const btn=e.target.closest('.fb-action-btn');if(btn){e.stopPropagation();vscodeApi.postMessage({type:btn.dataset.action,issueId:btn.dataset.issue});return}const con=e.target.closest('.fb-console');if(con&&con.dataset.url){postMsg('openFirebaseUrl',con.dataset.url);return}const item=e.target.closest('.fb-item');if(item){const id=item.dataset.issueId;const det=item.querySelector('.crash-detail');if(det&&!det.innerHTML){det.innerHTML='<p class="fb-loading">Loading crash details\u2026</p>';vscodeApi.postMessage({type:'fetchCrashDetail',issueId:id})}}});
window.addEventListener('message',e=>{const m=e.data;if(m.type==='crashDetailReady'){const el=document.getElementById('crash-detail-'+m.issueId);if(el)el.innerHTML=m.html}});</script></body></html>`;
}

function buildSetupHtml(ctx: FirebaseContext, nonce: string): string {
    const step = ctx.setupStep ?? 'gcloud';
    const stepNum = step === 'gcloud' ? 1 : step === 'token' ? 2 : 3;
    const content = step === 'gcloud' ? getGcloudStep()
        : step === 'token' ? getTokenStep() : getConfigStep();
    const diagnosticHtml = renderDiagnosticBox(ctx);
    const tip = '<p class="setup-tip">Tip: Google Cloud may prompt you to enable billing, but Crashlytics API access is free.</p>';
    return `<!DOCTYPE html><html><head><style nonce="${nonce}">${getSetupStyles()}</style></head>
<body><div class="setup-header">Step ${stepNum} of 3</div>${content}${diagnosticHtml}${tip}
<button class="check-btn" onclick="postMsg('checkAgain')">Check Again</button>
<script nonce="${nonce}">const vscodeApi=acquireVsCodeApi();function postMsg(t,v){vscodeApi.postMessage({type:t,url:v})}
document.addEventListener('click',function(e){var a=e.target.closest('[data-url]');if(a&&a.dataset.url){postMsg('openFirebaseUrl',a.dataset.url)}});</script></body></html>`;
}

function renderDiagnosticBox(ctx: FirebaseContext): string {
    const d = ctx.diagnostics;
    if (!d) { return ''; }
    const tech = d.technicalDetails
        ? `<details class="diag-tech"><summary>Technical details</summary><pre>${escapeHtml(d.technicalDetails)}</pre></details>` : '';
    const status = d.httpStatus ? `<div class="diag-status">HTTP ${d.httpStatus}</div>` : '';
    const time = `<div class="diag-time">Last checked: ${formatElapsedLabel(d.checkedAt)}</div>`;
    return `<div class="diag-box"><div class="diag-msg">${escapeHtml(d.message)}</div>${status}${tech}${time}</div>`;
}

function getGcloudStep(): string {
    return `<div class="setup-step"><div class="setup-title">Install Google Cloud CLI</div>
<p>The <code>gcloud</code> CLI is needed to authenticate with Firebase Crashlytics.</p>
<a class="setup-link" data-url="${gcloudInstallUrl}">Download Google Cloud CLI</a></div>`;
}

function getTokenStep(): string {
    return `<div class="setup-step"><div class="setup-title">Sign in to Google Cloud</div>
<p>Authenticate with your Google account to access Crashlytics data.</p>
<button class="setup-btn" onclick="postMsg('runGcloudAuth')">Sign in to Google Cloud</button></div>`;
}

function getConfigStep(): string {
    return `<div class="setup-step"><div class="setup-title">Add Firebase Config</div>
<p>Provide your <code>google-services.json</code> file or configure the project manually.</p>
<button class="setup-btn" onclick="postMsg('browseGoogleServices')">Browse for google-services.json</button>
<a class="setup-settings" onclick="postMsg('openSettings')">Or configure in settings</a></div>`;
}

function getSetupStyles(): string {
    return `body{padding:8px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground)}
.setup-header{font-size:0.85em;opacity:0.6;margin-bottom:8px}
.setup-title{font-weight:600;font-size:1.1em;margin-bottom:4px}
.setup-step{margin:8px 0}
.setup-step p{margin:4px 0 8px;opacity:0.85;line-height:1.4}
.setup-step code{background:var(--vscode-textCodeBlock-background);padding:1px 4px;border-radius:2px;font-family:var(--vscode-editor-font-family)}
.setup-btn{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:6px 14px;cursor:pointer;border-radius:3px;font-size:13px;display:block;margin:8px 0}
.setup-btn:hover{background:var(--vscode-button-hoverBackground)}
.setup-link{color:var(--vscode-textLink-foreground);cursor:pointer;text-decoration:underline;display:inline-block;margin:4px 0}
.setup-settings{display:block;margin-top:6px;font-size:12px;color:var(--vscode-textLink-foreground);cursor:pointer;opacity:0.8}
.setup-tip{margin-top:16px;font-size:0.9em;opacity:0.6;font-style:italic}
.check-btn{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;padding:4px 12px;cursor:pointer;border-radius:2px;font-size:12px;margin-top:8px}
.check-btn:hover{background:var(--vscode-button-secondaryHoverBackground)}
${getDiagnosticStyles()}`;
}

function renderIssueCard(issue: CrashlyticsIssue): string {
    const eid = escapeHtml(issue.id);
    const badge = issue.isFatal ? '<span class="fb-badge fb-badge-fatal">FATAL</span>' : '<span class="fb-badge fb-badge-nonfatal">NON-FATAL</span>';
    const stateBadge = issue.state !== 'UNKNOWN' ? ` <span class="fb-badge fb-badge-${issue.state.toLowerCase()}">${issue.state}</span>` : '';
    const users = issue.userCount > 0 ? ` · ${issue.userCount} user${issue.userCount !== 1 ? 's' : ''}` : '';
    const versions = formatVersionRange(issue);
    const actions = `<div class="fb-actions"><button class="fb-action-btn" data-action="closeIssue" data-issue="${eid}">Close</button><button class="fb-action-btn" data-action="muteIssue" data-issue="${eid}">Mute</button></div>`;
    return `<div class="fb-item" data-issue-id="${eid}"><div class="fb-title">${badge}${stateBadge} ${escapeHtml(issue.title)}</div><div class="fb-meta">${escapeHtml(issue.subtitle)} · ${issue.eventCount} events${users}${versions}</div>${actions}<div class="crash-detail" id="crash-detail-${eid}"></div></div>`;
}

function formatVersionRange(issue: CrashlyticsIssue): string {
    if (!issue.firstVersion && !issue.lastVersion) { return ''; }
    const range = issue.firstVersion && issue.lastVersion && issue.firstVersion !== issue.lastVersion
        ? `${escapeHtml(issue.firstVersion)} → ${escapeHtml(issue.lastVersion)}`
        : escapeHtml(issue.firstVersion ?? issue.lastVersion ?? '');
    return ` · ${range}`;
}

function getPanelStyles(): string {
    return `body{padding:4px 8px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground)}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.title{font-weight:600;font-size:1.1em}.refresh-btn{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:2px 8px;cursor:pointer;border-radius:2px}
.fb-item{border:1px solid var(--vscode-panel-border);border-radius:4px;padding:6px 8px;margin-bottom:6px;cursor:pointer}
.fb-item:hover{background:var(--vscode-list-hoverBackground)}
.fb-title{font-weight:600;margin-bottom:2px}.fb-meta{font-size:0.9em;opacity:0.8}
.fb-badge{font-size:0.7em;padding:1px 4px;border-radius:2px;font-weight:700;vertical-align:middle}
.fb-badge-fatal{background:#d32f2f;color:#fff}.fb-badge-nonfatal{background:#f9a825;color:#000}
.fb-badge-regression,.fb-badge-regressed{background:#d32f2f;color:#fff}.fb-badge-closed{background:#388e3c;color:#fff}.fb-badge-open{background:#757575;color:#fff}
.fb-console{margin-top:8px;text-align:center;cursor:pointer;color:var(--vscode-textLink-foreground)}
.fb-empty{opacity:0.7;font-style:italic}
.crash-detail{margin-top:4px}
.no-matches{opacity:0.6;font-style:italic;padding:4px 0}
.fb-loading{opacity:0.6;font-style:italic;padding:4px 0;animation:fbpulse 1.5s ease-in-out infinite}
@keyframes fbpulse{0%,100%{opacity:0.6}50%{opacity:0.2}}
.fb-actions{display:flex;gap:4px;margin-top:4px}
.fb-action-btn{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;padding:2px 8px;cursor:pointer;border-radius:2px;font-size:11px}
.fb-action-btn:hover{background:var(--vscode-button-secondaryHoverBackground)}
.fb-error{color:var(--vscode-errorForeground);font-size:0.9em;margin:6px 0}
${getDiagnosticStyles()}`;
}

function getDiagnosticStyles(): string {
    return `.diag-box{margin:10px 0;padding:8px;background:var(--vscode-inputValidation-warningBackground);border-left:3px solid var(--vscode-inputValidation-warningBorder);border-radius:3px;font-size:0.9em}
.diag-msg{margin-bottom:4px}
.diag-status{font-size:0.85em;opacity:0.8;margin-top:2px}
.diag-tech{margin-top:6px;font-size:0.85em}
.diag-tech summary{cursor:pointer;opacity:0.8}
.diag-tech pre{margin:4px 0;padding:4px;background:var(--vscode-textCodeBlock-background);overflow-x:auto;font-family:var(--vscode-editor-font-family);font-size:0.9em;white-space:pre-wrap;word-break:break-all}
.diag-time{font-size:0.8em;margin-top:6px;opacity:0.6;font-style:italic}`;
}
