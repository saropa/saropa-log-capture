/**
 * Cross-session insights panel.
 *
 * WebviewPanel showing aggregated data across all sessions:
 * hot files (most-referenced source files) and recurring errors
 * (fingerprinted error groups with session/occurrence counts).
 */

import * as vscode from 'vscode';
import { escapeHtml } from '../modules/ansi';
import { getNonce } from './viewer-content';
import { aggregateInsights, type CrossSessionInsights, type HotFile, type RecurringError } from '../modules/cross-session-aggregator';
import { findInWorkspace } from '../modules/workspace-analyzer';
import { searchLogFiles, openLogAtLine } from '../modules/log-search';
import { getInsightsStyles } from './insights-panel-styles';

let panel: vscode.WebviewPanel | undefined;

/** Show the cross-session insights panel. */
export async function showInsightsPanel(): Promise<void> {
    ensurePanel();
    panel!.webview.html = buildLoadingHtml();
    const insights = await aggregateInsights();
    if (panel) { panel.webview.html = buildResultsHtml(insights); }
}

/** Dispose the singleton panel. */
export function disposeInsightsPanel(): void { panel?.dispose(); panel = undefined; }

function ensurePanel(): void {
    if (panel) { panel.reveal(vscode.ViewColumn.Beside); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.insights', 'Cross-Session Insights',
        vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; });
}

async function handleMessage(msg: Record<string, unknown>): Promise<void> {
    if (msg.type === 'openFile') {
        const uri = await findInWorkspace(String(msg.filename));
        if (uri) { await vscode.window.showTextDocument(uri); }
        else { vscode.window.showWarningMessage(`Source file "${msg.filename}" not found in workspace.`); }
    } else if (msg.type === 'searchError') {
        const results = await searchLogFiles(String(msg.example), { maxResults: 20, maxResultsPerFile: 5 });
        if (results.matches.length > 0) { await openLogAtLine(results.matches[0]); }
        else { vscode.window.showInformationMessage('No matches found for this error pattern.'); }
    } else if (msg.type === 'refresh') {
        showInsightsPanel().catch(() => {});
    }
}

function buildLoadingHtml(): string {
    const nonce = getNonce();
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getInsightsStyles()}</style>
</head><body><div class="loading">Analyzing sessions...</div></body></html>`;
}

function buildResultsHtml(insights: CrossSessionInsights): string {
    const nonce = getNonce();
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getInsightsStyles()}</style>
</head><body>
${renderHeader(insights)}
<div class="content">
${renderHotFiles(insights.hotFiles)}
${renderRecurringErrors(insights.recurringErrors)}
</div>
<script nonce="${nonce}">${getScript()}</script>
</body></html>`;
}

function renderHeader(insights: CrossSessionInsights): string {
    const fileCount = insights.hotFiles.length;
    const errorCount = insights.recurringErrors.length;
    return `<div class="header">
<div class="header-left">
<div class="title">Cross-Session Insights</div>
<div class="summary">Analyzed ${insights.sessionCount} session${insights.sessionCount !== 1 ? 's' : ''} &middot; ${fileCount} hot file${fileCount !== 1 ? 's' : ''} &middot; ${errorCount} error pattern${errorCount !== 1 ? 's' : ''}</div>
</div>
<button class="refresh-btn" id="refresh-btn">Refresh</button>
</div>`;
}

function renderHotFiles(files: readonly HotFile[]): string {
    const items = files.length === 0
        ? '<div class="empty-state">No hot files found across sessions.</div>'
        : files.map(renderHotFileItem).join('\n');
    return `<details class="section" open>
<summary class="section-header">Hot Files<span class="count">${files.length} files</span></summary>
${items}
</details>`;
}

function renderHotFileItem(f: HotFile): string {
    const sessions = f.sessionCount === 1 ? '1 session' : `${f.sessionCount} sessions`;
    return `<div class="hot-file" data-action="openFile" data-filename="${escapeHtml(f.filename)}">
<div class="file-row"><span class="file-name">${escapeHtml(f.filename)}</span>
<span class="session-count">${sessions}</span></div></div>`;
}

function renderRecurringErrors(errors: readonly RecurringError[]): string {
    const items = errors.length === 0
        ? '<div class="empty-state">No recurring error patterns found.</div>'
        : errors.map(renderErrorItem).join('\n');
    return `<details class="section" open>
<summary class="section-header">Recurring Errors<span class="count">${errors.length} patterns</span></summary>
${items}
</details>`;
}

function renderErrorItem(e: RecurringError): string {
    const sessions = e.sessionCount === 1 ? '1 session' : `${e.sessionCount} sessions`;
    const total = e.totalOccurrences === 1 ? '1 occurrence' : `${e.totalOccurrences} occurrences`;
    const example = escapeHtml(e.exampleLine);
    return `<div class="error-group" data-action="searchError" data-example="${example}">
<div class="error-text" title="${example}">${escapeHtml(e.normalizedText)}</div>
<div class="error-meta">${sessions} &middot; ${total} &middot; first: ${escapeHtml(e.firstSeen)} &middot; last: ${escapeHtml(e.lastSeen)}</div>
</div>`;
}

function getScript(): string {
    return `(function() {
    const vscode = acquireVsCodeApi();
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
    });
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.dataset.action;
        if (action === 'openFile') {
            vscode.postMessage({ type: 'openFile', filename: el.dataset.filename });
        } else if (action === 'searchError') {
            vscode.postMessage({ type: 'searchError', example: el.dataset.example });
        }
    });
})();`;
}
