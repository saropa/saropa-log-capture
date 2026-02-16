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
import { renderEnvironmentSection } from './insights-panel-environment';
import { buildFuzzyPattern, groupMatchesBySession, renderDrillDownHtml } from './insights-drill-down';
import { getDrillDownStyles } from './insights-drill-down-styles';
import { getErrorStatusBatch, setErrorStatus, type ErrorStatus } from '../modules/error-status-store';
import { startCrashlyticsBridge } from './insights-crashlytics-bridge';

let panel: vscode.WebviewPanel | undefined;
let currentTimeRange: TimeRange = 'all';

/** Show the cross-session insights panel. */
export async function showInsightsPanel(timeRange?: TimeRange): Promise<void> {
    if (timeRange) { currentTimeRange = timeRange; }
    ensurePanel();
    panel!.webview.html = buildLoadingHtml();
    const insights = await aggregateInsights(currentTimeRange);
    const statuses = await getErrorStatusBatch(insights.recurringErrors.map(e => e.hash));
    if (panel) {
        panel.webview.html = buildResultsHtml(insights, statuses);
        startCrashlyticsBridge(panel, insights.recurringErrors);
    }
}

/** Dispose the singleton panel. */
export function disposeInsightsPanel(): void { panel?.dispose(); panel = undefined; }

function ensurePanel(): void {
    if (panel) { return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.insights', 'Saropa Cross-Session Insights',
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
    } else if (msg.type === 'setErrorStatus') {
        await setErrorStatus(String(msg.hash ?? ''), String(msg.status ?? 'open') as ErrorStatus);
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

function buildResultsHtml(insights: CrossSessionInsights, statuses: Record<string, ErrorStatus>): string {
    const nonce = getNonce();
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getInsightsStyles()}${getDrillDownStyles()}</style>
</head><body>
${renderHeader(insights)}
<div class="content">
${renderHotFiles(insights.hotFiles)}
${renderRecurringErrors(insights.recurringErrors, statuses)}
${renderEnvironmentSection(insights)}
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
<div class="title">Saropa Cross-Session Insights</div>
<div class="summary">Analyzed ${insights.sessionCount} session${insights.sessionCount !== 1 ? 's' : ''} &middot; ${fileCount} hot file${fileCount !== 1 ? 's' : ''} &middot; ${errorCount} error pattern${errorCount !== 1 ? 's' : ''} &middot; ${formatElapsedLabel(insights.queriedAt)}</div>
</div>
<div class="header-right"><input id="insights-search" class="insights-search" type="text" placeholder="Filter..." />
<select id="time-range" class="time-range-select">${opts}</select>
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
    return `<div class="hot-file" data-action="openFile" data-filename="${escapeHtml(f.filename)}" data-search-text="${escapeHtml(f.filename.toLowerCase())}">
<div class="file-row"><span class="file-name">${escapeHtml(f.filename)}</span>
<span class="session-count">${sessions}</span></div></div>`;
}

function renderRecurringErrors(errors: readonly RecurringError[], statuses: Record<string, ErrorStatus>): string {
    const visible = errors.filter(e => statuses[e.hash] !== 'muted');
    const items = visible.length === 0
        ? '<div class="empty-state">No recurring error patterns found.</div>'
        : visible.map(e => renderErrorItem(e, statuses[e.hash] ?? 'open')).join('\n');
    const chips = renderCategoryChips(visible);
    return `<details class="section" open>
<summary class="section-header">Recurring Errors<span class="count">${errors.length} patterns</span></summary>
${chips}<div id="production-loading" class="production-loading" style="display:none">Checking production data&hellip;</div>
${items}
</details>`;
}

function renderCategoryChips(errors: readonly RecurringError[]): string {
    const cats = new Set(errors.map(e => e.category).filter(Boolean) as string[]);
    if (cats.size === 0) { return ''; }
    const sorted = [...cats].sort();
    const chips = sorted.map(c =>
        `<button class="cat-chip active" data-cat-chip="${c}"><span class="cat-badge cat-${c}">${c.toUpperCase()}</span></button>`,
    ).join('');
    return `<div class="cat-chip-bar"><span class="cat-chip-label">Categories:</span>${chips}
<button class="cat-chip-action" data-cat-action="all">All</button>
<button class="cat-chip-action" data-cat-action="none">None</button></div>`;
}

function renderErrorItem(e: RecurringError, status: ErrorStatus): string {
    const sessions = e.sessionCount === 1 ? '1 session' : `${e.sessionCount} sessions`;
    const total = e.totalOccurrences === 1 ? '1 occurrence' : `${e.totalOccurrences} occurrences`;
    const example = escapeHtml(e.exampleLine);
    const normalized = escapeHtml(e.normalizedText);
    const ver = formatVersionRange(e);
    const dimCls = status === 'closed' ? ' error-closed' : '';
    const actions = status === 'open'
        ? `<span class="err-action" data-hash="${escapeHtml(e.hash)}" data-status="closed">Close</span><span class="err-action" data-hash="${escapeHtml(e.hash)}" data-status="muted">Mute</span>`
        : `<span class="err-action" data-hash="${escapeHtml(e.hash)}" data-status="open">Re-open</span>`;
    const catBadge = e.category ? `<span class="cat-badge cat-${e.category}">${e.category.toUpperCase()}</span> ` : '';
    const catAttr = e.category ? ` data-cat="${e.category}"` : '';
    const searchText = escapeHtml((e.normalizedText + ' ' + e.exampleLine).toLowerCase());
    return `<div class="error-group${dimCls}" data-action="drillDown" data-hash="${escapeHtml(e.hash)}" data-normalized="${normalized}"${catAttr} data-search-text="${searchText}">
<div class="error-text" title="${example}"><span class="expand-icon">&#9654;</span>${catBadge}${normalized}</div>
<div class="error-meta">${sessions} &middot; ${total}${ver} &middot; first: ${escapeHtml(e.firstSeen)} &middot; last: ${escapeHtml(e.lastSeen)}<span class="production-badge" data-badge-hash="${escapeHtml(e.hash)}"></span></div>
<div class="error-actions">${actions}</div>
</div>`;
}

function formatVersionRange(e: RecurringError): string {
    if (!e.firstSeenVersion && !e.lastSeenVersion) { return ''; }
    const v1 = e.firstSeenVersion ?? '?';
    const v2 = e.lastSeenVersion ?? '?';
    return v1 === v2
        ? ` &middot; v${escapeHtml(v1)}`
        : ` &middot; v${escapeHtml(v1)} &rarr; v${escapeHtml(v2)}`;
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
        var act = e.target.closest('.err-action');
        if (act) { e.stopPropagation(); vscode.postMessage({ type: 'setErrorStatus', hash: act.dataset.hash, status: act.dataset.status }); return; }
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
    // --- Category chip filtering ---
    var excludedCats = {};
    var chipBar = document.querySelector('.cat-chip-bar');
    if (chipBar) chipBar.addEventListener('click', function(ev) {
        var chip = ev.target.closest('[data-cat-chip]');
        if (chip) {
            var cat = chip.dataset.catChip;
            excludedCats[cat] = !excludedCats[cat];
            chip.classList.toggle('active', !excludedCats[cat]);
            applyFilters(); return;
        }
        var action = ev.target.closest('[data-cat-action]');
        if (!action) return;
        var allChips = chipBar.querySelectorAll('[data-cat-chip]');
        var isNone = action.dataset.catAction === 'none';
        for (var i = 0; i < allChips.length; i++) {
            excludedCats[allChips[i].dataset.catChip] = isNone;
            allChips[i].classList.toggle('active', !isNone);
        }
        applyFilters();
    });

    // --- Search input filtering ---
    var searchInput = document.getElementById('insights-search');
    var searchTimer = null;
    if (searchInput) searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, 150);
    });

    function applyFilters() {
        var query = (searchInput ? searchInput.value : '').toLowerCase().trim();
        var anyExcluded = Object.keys(excludedCats).some(function(k) { return excludedCats[k]; });
        // Filter hot files by search only
        var hotFiles = document.querySelectorAll('.hot-file');
        for (var i = 0; i < hotFiles.length; i++) {
            var show = !query || (hotFiles[i].dataset.searchText || '').indexOf(query) !== -1;
            hotFiles[i].style.display = show ? '' : 'none';
        }
        // Filter error groups by search + category
        var errors = document.querySelectorAll('.error-group');
        for (var j = 0; j < errors.length; j++) {
            var el = errors[j];
            var matchSearch = !query || (el.dataset.searchText || '').indexOf(query) !== -1;
            var matchCat = !anyExcluded || !el.dataset.cat || !excludedCats[el.dataset.cat];
            el.style.display = (matchSearch && matchCat) ? '' : 'none';
        }
    }

    window.addEventListener('message', (event) => {
        var msg = event.data;
        if (msg.type === 'drillDownResults') {
            var panel = document.querySelector('.drill-down-panel[data-hash="' + msg.hash + '"]');
            if (panel) panel.innerHTML = msg.html;
        } else if (msg.type === 'productionBridgeLoading') {
            var loadEl = document.getElementById('production-loading');
            if (loadEl) loadEl.style.display = '';
        } else if (msg.type === 'productionBridgeResults') {
            var loadEl2 = document.getElementById('production-loading');
            if (loadEl2) loadEl2.style.display = 'none';
            var bridges = msg.bridges || {};
            Object.keys(bridges).forEach(function(hash) {
                var badge = document.querySelector('.production-badge[data-badge-hash="' + hash + '"]');
                if (badge) badge.textContent = ' · Production: ' + bridges[hash];
            });
        }
    });
})();`;
}

