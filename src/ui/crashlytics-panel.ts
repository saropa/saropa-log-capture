/** Persistent Crashlytics sidebar panel — shows top crash issues from Firebase. */

import * as vscode from 'vscode';
import { escapeHtml, formatElapsedLabel } from '../modules/ansi';
import { getNonce } from './viewer-content';
import { getFirebaseContext, getCrashEvents, updateIssueState, clearIssueListCache, type CrashlyticsIssue, type FirebaseContext } from '../modules/firebase-crashlytics';
import { renderCrashDetail } from './analysis-crash-detail';

let lastContext: FirebaseContext | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

/** WebviewViewProvider for the Crashlytics sidebar panel. */
export class CrashlyticsPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private view: vscode.WebviewView | undefined;
    static readonly viewType = 'saropaLogCapture.crashlyticsPanel';

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
        this.refresh();
        this.startAutoRefresh();
    }

    /** Force a refresh of the Crashlytics data. */
    async refresh(): Promise<void> {
        if (!this.view) { return; }
        this.view.webview.html = buildLoadingHtml();
        clearIssueListCache();
        const ctx = await getFirebaseContext([]).catch(() => undefined);
        lastContext = ctx ?? { available: false, setupHint: 'Query failed', issues: [] };
        if (this.view) { this.view.webview.html = buildPanelHtml(lastContext); }
    }

    dispose(): void {
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = undefined; }
    }

    private startAutoRefresh(): void {
        if (refreshTimer) { return; }
        const interval = vscode.workspace.getConfiguration('saropaLogCapture.firebase').get<number>('refreshInterval', 300);
        if (interval > 0) { refreshTimer = setInterval(() => this.refresh(), interval * 1000); }
    }

    private async handleMessage(msg: Record<string, unknown>): Promise<void> {
        if (msg.type === 'refresh') { await this.refresh(); }
        else if (msg.type === 'fetchCrashDetail') { await this.fetchDetail(String(msg.issueId ?? '')); }
        else if (msg.type === 'closeIssue' || msg.type === 'muteIssue') {
            const state = msg.type === 'closeIssue' ? 'CLOSED' as const : 'MUTED' as const;
            const ok = await updateIssueState(String(msg.issueId ?? ''), state);
            if (ok) { await this.refresh(); }
            else { this.view?.webview.postMessage({ type: 'issueActionFailed', action: state }); }
        }
        else if (msg.type === 'openFirebaseUrl') {
            vscode.env.openExternal(vscode.Uri.parse(String(msg.url))).then(undefined, () => {});
        }
    }

    private async fetchDetail(issueId: string): Promise<void> {
        const multi = await getCrashEvents(issueId).catch(() => undefined);
        const detail = multi?.events[0];
        const html = detail ? renderCrashDetail(detail) : '<div class="no-matches">Crash details not available</div>';
        this.view?.webview.postMessage({ type: 'crashDetailReady', issueId, html });
    }
}

function buildLoadingHtml(): string {
    return `<!DOCTYPE html><html><body style="padding:8px;font-family:var(--vscode-font-family)"><p>Loading Crashlytics data...</p></body></html>`;
}

function buildPanelHtml(ctx: FirebaseContext): string {
    const nonce = getNonce();
    if (!ctx.available) {
        const hint = ctx.setupHint ? escapeHtml(ctx.setupHint) : 'Firebase not configured';
        return `<!DOCTYPE html><html><body style="padding:8px;font-family:var(--vscode-font-family)"><p>${hint}</p></body></html>`;
    }
    const refreshNote = ctx.queriedAt ? `(${formatElapsedLabel(ctx.queriedAt)})` : '';
    let issueHtml = '';
    if (ctx.issues.length === 0) {
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
.fb-action-btn:hover{background:var(--vscode-button-secondaryHoverBackground)}`;
}
