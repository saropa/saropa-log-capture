"use strict";
/**
 * Cross-session insights panel.
 *
 * WebviewPanel showing aggregated data across all sessions:
 * hot files (most-referenced source files) and recurring errors
 * (fingerprinted error groups with session/occurrence counts).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.showInsightsPanel = showInsightsPanel;
exports.disposeInsightsPanel = disposeInsightsPanel;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const ansi_1 = require("../../modules/capture/ansi");
const viewer_content_1 = require("../provider/viewer-content");
const workspace_analyzer_1 = require("../../modules/misc/workspace-analyzer");
const log_search_1 = require("../../modules/search/log-search");
const insights_panel_styles_1 = require("./insights-panel-styles");
const insights_panel_environment_1 = require("./insights-panel-environment");
const insights_drill_down_1 = require("./insights-drill-down");
const insights_panel_script_1 = require("./insights-panel-script");
const insights_drill_down_styles_1 = require("./insights-drill-down-styles");
const error_status_store_1 = require("../../modules/misc/error-status-store");
let panel;
const _currentTimeRange = 'all';
/**
 * Show the cross-session insights panel.
 * Retired: the separate WebviewPanel is no longer used. This now opens the unified Insight panel in the viewer.
 */
async function showInsightsPanel(_timeRange) {
    await vscode.commands.executeCommand('saropaLogCapture.showInsights');
}
/** Dispose the singleton panel. */
function disposeInsightsPanel() { panel?.dispose(); panel = undefined; }
function _ensurePanel() {
    if (panel) {
        return;
    }
    panel = vscode.window.createWebviewPanel('saropaLogCapture.insights', 'Saropa Cross-Session Insights', vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] });
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; });
}
async function handleMessage(msg) {
    if (msg.type === 'openFile') {
        const uri = await (0, workspace_analyzer_1.findInWorkspace)(String(msg.filename));
        if (uri) {
            await vscode.window.showTextDocument(uri);
        }
        else {
            vscode.window.showWarningMessage((0, l10n_1.t)('msg.sourceFileNotFound', String(msg.filename ?? '')));
        }
    }
    else if (msg.type === 'drillDownError') {
        await handleDrillDown(String(msg.hash ?? ''), String(msg.normalized ?? ''));
    }
    else if (msg.type === 'openMatch') {
        const match = { uri: vscode.Uri.parse(String(msg.uri)), filename: String(msg.filename), lineNumber: Number(msg.line), lineText: '', matchStart: 0, matchEnd: 0 };
        (0, log_search_1.openLogAtLine)(match).catch(() => { });
    }
    else if (msg.type === 'setTimeRange') {
        showInsightsPanel(String(msg.range)).catch(() => { });
    }
    else if (msg.type === 'refresh') {
        showInsightsPanel().catch(() => { });
    }
    else if (msg.type === 'setErrorStatus') {
        await (0, error_status_store_1.setErrorStatus)(String(msg.hash ?? ''), String(msg.status ?? 'open'));
        showInsightsPanel().catch(() => { });
    }
    else if (msg.type === 'exportInsightsSummary') {
        void vscode.commands.executeCommand('saropaLogCapture.exportInsightsSummary');
    }
}
async function handleDrillDown(hash, normalized) {
    if (!panel || !normalized) {
        return;
    }
    const pattern = (0, insights_drill_down_1.buildFuzzyPattern)(normalized);
    const results = await (0, log_search_1.searchLogFiles)(pattern, { useRegex: true, maxResults: 200, maxResultsPerFile: 50 });
    const groups = (0, insights_drill_down_1.groupMatchesBySession)(results.matches);
    const html = (0, insights_drill_down_1.renderDrillDownHtml)(groups);
    panel.webview.postMessage({ type: 'drillDownResults', hash, html });
}
function _buildLoadingHtml() {
    const nonce = (0, viewer_content_1.getNonce)();
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${(0, insights_panel_styles_1.getInsightsStyles)()}</style>
</head><body><div class="loading">Analyzing sessions...</div></body></html>`;
}
function _buildResultsHtml(insights, statuses) {
    const nonce = (0, viewer_content_1.getNonce)();
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${(0, insights_panel_styles_1.getInsightsStyles)()}${(0, insights_drill_down_styles_1.getDrillDownStyles)()}</style>
</head><body>
${renderHeader(insights)}
<div class="content">
${renderHotFiles(insights.hotFiles)}
${renderRecurringErrors(insights.recurringErrors, statuses)}
${(0, insights_panel_environment_1.renderEnvironmentSection)(insights)}
</div>
<script nonce="${nonce}">${(0, insights_panel_script_1.getInsightsPanelScript)()}</script>
</body></html>`;
}
function _renderTimeRangeOption(value, label) {
    return `<option value="${value}"${_currentTimeRange === value ? ' selected' : ''}>${label}</option>`;
}
function renderHeader(insights) {
    const fileCount = insights.hotFiles.length;
    const errorCount = insights.recurringErrors.length;
    const opts = _renderTimeRangeOption('1h', 'Last hour') + _renderTimeRangeOption('4h', 'Last 4 hours')
        + _renderTimeRangeOption('8h', 'Last 8 hours') + _renderTimeRangeOption('24h', 'Last 24 hours')
        + _renderTimeRangeOption('7d', 'Last 7 days')
        + _renderTimeRangeOption('30d', 'Last 30 days') + _renderTimeRangeOption('3m', 'Last 3 months')
        + _renderTimeRangeOption('6m', 'Last 6 months') + _renderTimeRangeOption('1y', 'Last year')
        + _renderTimeRangeOption('all', 'All time');
    return `<div class="header">
<div class="header-left">
<div class="title">Saropa Cross-Session Insights</div>
<div class="summary">Analyzed ${insights.sessionCount} session${insights.sessionCount !== 1 ? 's' : ''} &middot; ${fileCount} hot file${fileCount !== 1 ? 's' : ''} &middot; ${errorCount} error pattern${errorCount !== 1 ? 's' : ''} &middot; ${(0, ansi_1.formatElapsedLabel)(insights.queriedAt)}</div>
</div>
<div class="header-right"><input id="insights-search" class="insights-search" type="text" placeholder="Filter..." />
<select id="time-range" class="time-range-select">${opts}</select>
<button class="refresh-btn" id="refresh-btn">Refresh</button>
<button class="export-summary-btn" id="export-summary-btn" title="Export recurring errors and hot files as CSV or JSON">Export summary</button></div>
</div>`;
}
function renderHotFiles(files) {
    const items = files.length === 0
        ? '<div class="empty-state">No hot files found across sessions.</div>'
        : files.map(renderHotFileItem).join('\n');
    return `<details class="section" open>
<summary class="section-header">Hot Files<span class="count">${files.length} files</span></summary>
${items}
</details>`;
}
function renderHotFileItem(f) {
    const sessions = f.sessionCount === 1 ? '1 session' : `${f.sessionCount} sessions`;
    return `<div class="hot-file" data-action="openFile" data-filename="${(0, ansi_1.escapeHtml)(f.filename)}" data-search-text="${(0, ansi_1.escapeHtml)(f.filename.toLowerCase())}">
<div class="file-row"><span class="file-name">${(0, ansi_1.escapeHtml)(f.filename)}</span>
<span class="session-count">${sessions}</span></div></div>`;
}
function renderRecurringErrors(errors, statuses) {
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
function renderCategoryChips(errors) {
    const cats = new Set(errors.map(e => e.category).filter(Boolean));
    if (cats.size === 0) {
        return '';
    }
    const sorted = [...cats].sort();
    const chips = sorted.map(c => `<button class="cat-chip active" data-cat-chip="${c}"><span class="cat-badge cat-${c}">${c.toUpperCase()}</span></button>`).join('');
    return `<div class="cat-chip-bar"><span class="cat-chip-label">Categories:</span>${chips}
<button class="cat-chip-action" data-cat-action="all">All</button>
<button class="cat-chip-action" data-cat-action="none">None</button></div>`;
}
function renderErrorItem(e, status) {
    const sessions = e.sessionCount === 1 ? '1 session' : `${e.sessionCount} sessions`;
    const total = e.totalOccurrences === 1 ? '1 occurrence' : `${e.totalOccurrences} occurrences`;
    const example = (0, ansi_1.escapeHtml)(e.exampleLine);
    const normalized = (0, ansi_1.escapeHtml)(e.normalizedText);
    const ver = formatVersionRange(e);
    const dimCls = status === 'closed' ? ' error-closed' : '';
    const actions = status === 'open'
        ? `<span class="err-action" data-hash="${(0, ansi_1.escapeHtml)(e.hash)}" data-status="closed">Close</span><span class="err-action" data-hash="${(0, ansi_1.escapeHtml)(e.hash)}" data-status="muted">Mute</span>`
        : `<span class="err-action" data-hash="${(0, ansi_1.escapeHtml)(e.hash)}" data-status="open">Re-open</span>`;
    const catBadge = e.category ? `<span class="cat-badge cat-${e.category}">${e.category.toUpperCase()}</span> ` : '';
    const catAttr = e.category ? ` data-cat="${e.category}"` : '';
    const searchText = (0, ansi_1.escapeHtml)((e.normalizedText + ' ' + e.exampleLine).toLowerCase());
    return `<div class="error-group${dimCls}" data-action="drillDown" data-hash="${(0, ansi_1.escapeHtml)(e.hash)}" data-normalized="${normalized}"${catAttr} data-search-text="${searchText}">
<div class="error-text" title="${example}"><span class="expand-icon">&#9654;</span>${catBadge}${normalized}</div>
<div class="error-meta">${sessions} &middot; ${total}${ver} &middot; first: ${(0, ansi_1.escapeHtml)(e.firstSeen)} &middot; last: ${(0, ansi_1.escapeHtml)(e.lastSeen)}<span class="production-badge" data-badge-hash="${(0, ansi_1.escapeHtml)(e.hash)}"></span></div>
<div class="error-actions">${actions}</div>
</div>`;
}
function formatVersionRange(e) {
    if (!e.firstSeenVersion && !e.lastSeenVersion) {
        return '';
    }
    const v1 = e.firstSeenVersion ?? '?';
    const v2 = e.lastSeenVersion ?? '?';
    return v1 === v2
        ? ` &middot; v${(0, ansi_1.escapeHtml)(v1)}`
        : ` &middot; v${(0, ansi_1.escapeHtml)(v1)} &rarr; v${(0, ansi_1.escapeHtml)(v2)}`;
}
//# sourceMappingURL=insights-panel.js.map