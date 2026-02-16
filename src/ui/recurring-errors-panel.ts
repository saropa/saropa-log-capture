/** Recurring errors editor-tab panel — shows top error patterns across sessions. */

import * as vscode from 'vscode';
import { escapeHtml, formatElapsedLabel } from '../modules/ansi';
import { getNonce } from './viewer-content';
import { aggregateInsights, type RecurringError } from '../modules/cross-session-aggregator';
import { getErrorStatusBatch, setErrorStatus, type ErrorStatus } from '../modules/error-status-store';

let panel: vscode.WebviewPanel | undefined;

/** Show (or reveal) the Recurring Errors editor-tab panel. */
export async function showRecurringErrorsPanel(): Promise<void> {
    ensurePanel();
    await refresh();
}

/** Refresh if the panel is open; no-op otherwise. */
export async function refreshRecurringErrorsPanel(): Promise<void> {
    if (!panel) { return; }
    await refresh();
}

/** Dispose the singleton panel. */
export function disposeRecurringErrorsPanel(): void {
    panel?.dispose();
    panel = undefined;
}

function ensurePanel(): void {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.recurringErrors', 'Saropa Recurring Errors',
        vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; });
}

async function refresh(): Promise<void> {
    if (!panel) { return; }
    panel.webview.html = buildLoadingHtml();
    const insights = await aggregateInsights('all').catch(() => undefined);
    const errors = insights?.recurringErrors ?? [];
    const statuses = await getErrorStatusBatch(errors.map(e => e.hash));
    if (panel) {
        panel.webview.html = buildPanelHtml(errors, statuses, insights?.queriedAt);
    }
}

async function handleMessage(msg: Record<string, unknown>): Promise<void> {
    if (msg.type === 'refresh') { await refresh(); }
    else if (msg.type === 'setErrorStatus') {
        await setErrorStatus(String(msg.hash ?? ''), String(msg.status ?? 'open') as ErrorStatus);
        await refresh();
    } else if (msg.type === 'openInsights') {
        vscode.commands.executeCommand('saropaLogCapture.showInsights');
    }
}

function buildLoadingHtml(): string {
    return `<!DOCTYPE html><html><body style="padding:8px;font-family:var(--vscode-font-family)"><p>Loading error data\u2026</p></body></html>`;
}

function buildPanelHtml(errors: readonly RecurringError[], statuses: Record<string, ErrorStatus>, queriedAt?: number): string {
    const nonce = getNonce();
    const visible = errors.filter(e => statuses[e.hash] !== 'muted');
    const refreshNote = queriedAt ? `(${formatElapsedLabel(queriedAt)})` : '';
    const cards = visible.length === 0
        ? '<p class="re-empty">No recurring errors found.</p>'
        : visible.map(e => renderCard(e, statuses[e.hash] ?? 'open')).join('');
    return `<!DOCTYPE html><html><head><style nonce="${nonce}">${getStyles()}</style></head><body>
<div class="re-toolbar"><span class="re-title">Recurring Errors ${refreshNote}</span><button class="re-refresh" onclick="postMsg('refresh')">Refresh</button></div>
${cards}
<div class="re-footer" onclick="postMsg('openInsights')">Open Full Insights</div>
<script nonce="${nonce}">const vscodeApi=acquireVsCodeApi();function postMsg(t){vscodeApi.postMessage({type:t})}
document.addEventListener('click',e=>{const act=e.target.closest('.re-action');if(act){e.stopPropagation();vscodeApi.postMessage({type:'setErrorStatus',hash:act.dataset.hash,status:act.dataset.status})}});</script></body></html>`;
}

function renderCard(e: RecurringError, status: ErrorStatus): string {
    const dimCls = status === 'closed' ? ' re-closed' : '';
    const sessions = e.sessionCount === 1 ? '1 session' : `${e.sessionCount} sessions`;
    const total = `${e.totalOccurrences} total`;
    const actions = status === 'open'
        ? `<span class="re-action" data-hash="${escapeHtml(e.hash)}" data-status="closed">Close</span><span class="re-action" data-hash="${escapeHtml(e.hash)}" data-status="muted">Mute</span>`
        : `<span class="re-action" data-hash="${escapeHtml(e.hash)}" data-status="open">Re-open</span>`;
    const catBadge = e.category ? `<span class="cat-badge cat-${e.category}">${e.category.toUpperCase()}</span> ` : '';
    return `<div class="re-card${dimCls}">
<div class="re-text" title="${escapeHtml(e.exampleLine)}">${catBadge}${escapeHtml(e.normalizedText)}</div>
<div class="re-meta">${sessions} &middot; ${total}</div>
<div class="re-actions">${actions}</div></div>`;
}

function getStyles(): string {
    return `body{padding:4px 8px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground)}
.re-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.re-title{font-weight:600;font-size:1.1em}
.re-refresh{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:2px 8px;cursor:pointer;border-radius:2px}
.re-card{border:1px solid var(--vscode-panel-border);border-radius:4px;padding:6px 8px;margin-bottom:6px}
.re-card:hover{background:var(--vscode-list-hoverBackground)}
.re-closed{opacity:0.5}
.re-text{font-family:var(--vscode-editor-font-family,monospace);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--vscode-errorForeground)}
.re-meta{font-size:0.9em;opacity:0.8;margin-top:2px}
.re-actions{display:flex;gap:4px;margin-top:3px}
.re-action{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;padding:1px 8px;cursor:pointer;border-radius:2px;font-size:11px}
.re-action:hover{background:var(--vscode-button-secondaryHoverBackground)}
.re-empty{opacity:0.7;font-style:italic}
.re-footer{margin-top:8px;text-align:center;cursor:pointer;color:var(--vscode-textLink-foreground);font-size:12px}
.cat-badge{font-size:0.7em;padding:1px 4px;border-radius:2px;font-weight:700;vertical-align:middle;margin-right:4px}
.cat-fatal{background:#d32f2f;color:#fff}.cat-anr{background:#f57c00;color:#fff}.cat-oom{background:#7b1fa2;color:#fff}.cat-native{background:#757575;color:#fff}`;
}
