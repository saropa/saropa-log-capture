/**
 * Cross-session insights panel.
 *
 * WebviewPanel showing aggregated data across all sessions:
 * hot files (most-referenced source files) and recurring errors
 * (fingerprinted error groups with session/occurrence counts).
 */

import * as vscode from 'vscode';
import { escapeHtml, formatElapsedLabel } from '../modules/ansi';
import { getNonce } from './viewer-content';
import { aggregateInsights, type CrossSessionInsights, type HotFile, type RecurringError, type TimeRange } from '../modules/cross-session-aggregator';
import { findInWorkspace } from '../modules/workspace-analyzer';
import { searchLogFiles, openLogAtLine } from '../modules/log-search';
import { getInsightsStyles } from './insights-panel-styles';
import { buildFuzzyPattern, groupMatchesBySession, renderDrillDownHtml } from './insights-drill-down';
import { getDrillDownStyles } from './insights-drill-down-styles';

let panel: vscode.WebviewPanel | undefined;
let currentTimeRange: TimeRange = 'all';

/** Show the cross-session insights panel. */
export async function showInsightsPanel(timeRange?: TimeRange): Promise<void> {
    if (timeRange) { currentTimeRange = timeRange; }
    ensurePanel();
    panel!.webview.html = buildLoadingHtml();
    const insights = await aggregateInsights(currentTimeRange);
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
    } else if (msg.type === 'drillDownError') {
        await handleDrillDown(String(msg.hash ?? ''), String(msg.normalized ?? ''));
    } else if (msg.type === 'openMatch') {
        const match = { uri: vscode.Uri.parse(String(msg.uri)), filename: String(msg.filename), lineNumber: Number(msg.line), lineText: '', matchStart: 0, matchEnd: 0 };
        openLogAtLine(match).catch(() => {});
    } else if (msg.type === 'setTimeRange') {
        showInsightsPanel(String(msg.range) as TimeRange).catch(() => {});
    } else if (msg.type === 'refresh') {
        showInsightsPanel().catch(() => {});
    }
}

async function handleDrillDown(hash: string, normalized: string): Promise<void> {
    if (!panel || !normalized) { return; }
    const pattern = buildFuzzyPattern(normalized);
    const results = await searchLogFiles(pattern, { useRegex: true, maxResults: 200, maxResultsPerFile: 50 });
    const groups = groupMatchesBySession(results.matches);
    const html = renderDrillDownHtml(groups);
    panel.webview.postMessage({ type: 'drillDownResults', hash, html });
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
<style nonce="${nonce}">${getInsightsStyles()}${getDrillDownStyles()}</style>
</head><body>
${renderHeader(insights)}
<div class="content">
${renderHotFiles(insights.hotFiles)}
${renderRecurringErrors(insights.recurringErrors)}
</div>
<script nonce="${nonce}">${getScript()}</script>
</body></html>`;
}

function renderTimeRangeOption(value: string, label: string): string {
    return `<option value="${value}"${currentTimeRange === value ? ' selected' : ''}>${label}</option>`;
}

function renderHeader(insights: CrossSessionInsights): string {
    const fileCount = insights.hotFiles.length;
    const errorCount = insights.recurringErrors.length;
    const opts = renderTimeRangeOption('all', 'All time') + renderTimeRangeOption('30d', 'Last 30 days')
        + renderTimeRangeOption('7d', 'Last 7 days') + renderTimeRangeOption('24h', 'Last 24 hours');
    return `<div class="header">
<div class="header-left">
<div class="title">Cross-Session Insights</div>
<div class="summary">Analyzed ${insights.sessionCount} session${insights.sessionCount !== 1 ? 's' : ''} &middot; ${fileCount} hot file${fileCount !== 1 ? 's' : ''} &middot; ${errorCount} error pattern${errorCount !== 1 ? 's' : ''} &middot; ${formatElapsedLabel(insights.queriedAt)}</div>
</div>
<div class="header-right"><select id="time-range" class="time-range-select">${opts}</select>
<button class="refresh-btn" id="refresh-btn">Refresh</button></div>
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
    const normalized = escapeHtml(e.normalizedText);
    return `<div class="error-group" data-action="drillDown" data-hash="${escapeHtml(e.hash)}" data-normalized="${normalized}">
<div class="error-text" title="${example}"><span class="expand-icon">&#9654;</span>${normalized}</div>
<div class="error-meta">${sessions} &middot; ${total} &middot; first: ${escapeHtml(e.firstSeen)} &middot; last: ${escapeHtml(e.lastSeen)}</div>
</div>`;
}

function getScript(): string {
    return `(function() {
    const vscode = acquireVsCodeApi();
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
    });
    document.getElementById('time-range')?.addEventListener('change', (e) => {
        vscode.postMessage({ type: 'setTimeRange', range: e.target.value });
    });
    document.addEventListener('click', (e) => {
        var match = e.target.closest('.drill-down-match');
        if (match) { vscode.postMessage({ type: 'openMatch', uri: match.dataset.uri, filename: match.dataset.filename, line: parseInt(match.dataset.line) }); return; }
        var el = e.target.closest('[data-action]');
        if (!el) return;
        if (el.dataset.action === 'openFile') {
            vscode.postMessage({ type: 'openFile', filename: el.dataset.filename });
        } else if (el.dataset.action === 'drillDown') {
            toggleDrillDown(el);
        }
    });
    function toggleDrillDown(el) {
        var existing = el.nextElementSibling;
        if (existing && existing.classList.contains('drill-down-panel')) {
            existing.remove(); el.classList.remove('expanded'); return;
        }
        var panel = document.createElement('div');
        panel.className = 'drill-down-panel';
        panel.dataset.hash = el.dataset.hash;
        panel.innerHTML = '<div class="drill-down-loading">Searching across sessions...</div>';
        el.after(panel); el.classList.add('expanded');
        vscode.postMessage({ type: 'drillDownError', hash: el.dataset.hash, normalized: el.dataset.normalized });
    }
    window.addEventListener('message', (event) => {
        var msg = event.data;
        if (msg.type === 'drillDownResults') {
            var panel = document.querySelector('.drill-down-panel[data-hash="' + msg.hash + '"]');
            if (panel) panel.innerHTML = msg.html;
        }
    });
})();`;
}
