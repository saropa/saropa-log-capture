"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPerformancePanelHtml = getPerformancePanelHtml;
exports.getPerformancePanelScript = getPerformancePanelScript;
/**
 * Performance panel HTML and script for the webview (standalone + Insight-embedded via `prefix`).
 *
 * Tabs: **Current** (scan `allLines` for perf events), **Trends** (host `requestPerformanceData`),
 * **Log** (session snapshot / intro when no perf payload), **Database** (`buildDbStatsView` in
 * `viewer-performance-db-tab.ts`: Drift rollup `dbInsightSessionRollup`, client-side timeline buckets).
 * Opening the panel replays the active tab’s refresh path so **Log** reloads snapshot data after dismiss.
 * Log intro: right-click copies full text via the small context menu.
 */
const viewer_performance_current_1 = require("./viewer-performance-current");
const viewer_performance_trends_1 = require("./viewer-performance-trends");
const viewer_performance_session_tab_1 = require("./viewer-performance-session-tab");
const viewer_performance_db_tab_1 = require("./viewer-performance-db-tab");
const viewer_error_rate_tab_1 = require("./viewer-error-rate-tab");
/**
 * When prefix is 'insight-', IDs become insight-pp-panel, insight-pp-current-view, etc.
 * Used when embedding the performance panel inside the Insight panel.
 */
function getPerformancePanelHtml(prefix) {
    const id = prefix ? prefix + 'pp-panel' : 'performance-panel';
    const pid = (p) => (prefix ? prefix + 'pp-' + p : 'pp-' + p);
    return /* html */ `
<div id="${id}" class="performance-panel">
    <div class="performance-panel-header">
        <span>Performance</span>
        <div class="performance-panel-actions">
            <button id="${pid('refresh')}" class="pp-action" title="Refresh">
                <span class="codicon codicon-refresh"></span>
            </button>
            <button id="${pid('panel-close')}" class="pp-close" title="Close">&times;</button>
        </div>
    </div>
    <div class="pp-tabs">
        <button id="${pid('tab-current')}" class="pp-tab active">Current</button>
        <button id="${pid('tab-trends')}" class="pp-tab">Trends</button>
        <button id="${pid('tab-session')}" class="pp-tab">Log</button>
        <button id="${pid('tab-db')}" class="pp-tab">Database</button>
        <button id="${pid('tab-error-rate')}" class="pp-tab">Errors</button>
    </div>
    <div class="performance-panel-content">
        <div id="${pid('current-view')}"></div>
        <div id="${pid('trends-view')}" style="display:none">
            <div id="${pid('chart-area')}" class="pp-chart-container" style="display:none">
                <div class="pp-chart-title" id="${pid('chart-title')}">Select an operation</div>
                <svg id="${pid('chart')}" class="pp-chart" viewBox="0 0 380 120"></svg>
            </div>
            <table class="pp-trend-table">
                <thead><tr><th>Operation</th><th>Avg</th><th>Logs</th><th></th></tr></thead>
                <tbody id="${pid('trend-body')}"></tbody>
            </table>
        </div>
        <div id="${pid('db-view')}" style="display:none" class="pp-db-view"></div>
        <div id="${pid('session-view')}" style="display:none" class="pp-session-view">
            <div id="${pid('session-intro')}" class="pp-session-intro pp-copyable-message" title="Right-click to copy">
                <p class="pp-session-intro-line">This log file was saved without performance data. You can't add it to this file.</p>
                <p class="pp-session-intro-line">For your next run: if <strong>Performance</strong> is enabled in Options → Integrations…, press F5 and the new log will include it. (For memory samples, also turn on "Sample during session" in Settings.)</p>
                <p class="pp-session-intro-line pp-session-intro-note">Overhead: snapshot at session start is minimal; optional sampling uses a little CPU and I/O.</p>
            </div>
            <div class="pp-session-block">
                <div class="pp-session-title">System snapshot</div>
                <div id="${pid('snapshot')}" class="pp-session-value">Not recorded for this log.</div>
            </div>
            <div class="pp-session-block">
                <div class="pp-session-title">Log samples</div>
                <div id="${pid('samples')}" class="pp-session-value">Not recorded for this log.</div>
            </div>
            <div class="pp-session-block">
                <div class="pp-session-title">Profiler output</div>
                <div id="${pid('profiler')}" class="pp-session-value">None.</div>
            </div>
        </div>
        <div id="${pid('error-rate-view')}" style="display:none"></div>
        <div id="${pid('empty')}" class="pp-empty">No performance events found</div>
        <div id="${pid('loading')}" class="pp-loading" style="display:none">Loading\u2026</div>
    </div>
    <div id="${pid('copy-message-menu')}" class="context-menu pp-copy-message-menu">
        <div class="context-menu-item" data-action="copy-message"><span class="codicon codicon-copy"></span> Copy message</div>
    </div>
</div>`;
}
/** Generate the performance panel script. When prefix is 'insight-', binds to insight-pp-* elements (set window.__insightPerfIdPrefix before this script runs). */
function getPerformancePanelScript(prefix) {
    // Positive condition (Sonar S7735): use prefix when it is a string; otherwise emit runtime fallback.
    const ppIdPrefix = typeof prefix === 'string'
        ? `'${prefix}'`
        : `(typeof window.__insightPerfIdPrefix === 'undefined' ? '' : window.__insightPerfIdPrefix)`;
    const pid = (s) => `document.getElementById(${ppIdPrefix} + 'pp-${s}')`;
    return /* javascript */ `
(function() {
    var ppIdPrefix = ${ppIdPrefix};
    var ppPanel = document.getElementById(ppIdPrefix ? ppIdPrefix + 'pp-panel' : 'performance-panel');
    var ppCurrentView = ${pid('current-view')};
    var ppTrendsView = ${pid('trends-view')};
    var ppEmpty = ${pid('empty')};
    var ppLoading = ${pid('loading')};
    var ppTrendBody = ${pid('trend-body')};
    var ppChartArea = ${pid('chart-area')};
    var ppChartSvg = ${pid('chart')};
    var ppChartTitle = ${pid('chart-title')};
    var ppTabCurrent = ${pid('tab-current')};
    var ppTabTrends = ${pid('tab-trends')};
    var ppTabSession = ${pid('tab-session')};
    var ppTabDb = ${pid('tab-db')};
    var ppDbView = ${pid('db-view')};
    var ppErrorRateView = ${pid('error-rate-view')};
    var ppTabErrorRate = ${pid('tab-error-rate')};
    var ppSessionView = ${pid('session-view')};
    var ppSessionIntro = ${pid('session-intro')};
    var ppCopyMessageMenu = ${pid('copy-message-menu')};
    var ppCopyMessagePendingText = '';
    var ppOpen = false;
    var ppActiveTab = 'current';
    var ppTrendsData = null;

    window.openPerformancePanel = function() {
        if (!ppPanel) return;
        ppOpen = true;
        if (!ppIdPrefix) ppPanel.classList.add('visible');
        if (ppActiveTab === 'current') { buildCurrentView(); }
        else if (ppActiveTab === 'trends') { requestTrends(); }
        else if (ppActiveTab === 'db') { buildDbStatsView(); }
        else if (ppActiveTab === 'errorRate') { buildErrorRateView(); }
        else if (ppActiveTab === 'session') {
            setSessionTabLoading(true);
            vscodeApi.postMessage({ type: 'requestPerformanceData' });
        }
    };

    window.closePerformancePanel = function() {
        if (!ppPanel) return;
        hideCopyMessageMenu();
        if (!ppIdPrefix) ppPanel.classList.remove('visible');
        ppOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('performance');
    };

    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function fmtTs(ts) { if (!ts) return ''; var d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function fmtNum(n) { return n.toLocaleString(); }
    function fmtKB(kb) { if (kb >= 1024 * 1024) return (kb / (1024 * 1024)).toFixed(1) + ' GB'; if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB'; return kb + ' KB'; }

    ${(0, viewer_performance_session_tab_1.getPerformanceSessionTabScript)()}
    ${(0, viewer_performance_trends_1.getPerformanceTrendsScript)()}
    ${(0, viewer_performance_db_tab_1.getPerformanceDbTabScript)()}
    ${(0, viewer_error_rate_tab_1.getErrorRateTabScript)()}

    function switchTab(tab) {
        ppActiveTab = tab;
        ppTabCurrent.classList.toggle('active', tab === 'current');
        ppTabTrends.classList.toggle('active', tab === 'trends');
        if (ppTabSession) ppTabSession.classList.toggle('active', tab === 'session');
        if (ppTabDb) ppTabDb.classList.toggle('active', tab === 'db');
        if (ppTabErrorRate) ppTabErrorRate.classList.toggle('active', tab === 'errorRate');
        if (ppCurrentView) ppCurrentView.style.display = tab === 'current' ? '' : 'none';
        if (ppTrendsView) ppTrendsView.style.display = tab === 'trends' ? '' : 'none';
        if (ppSessionView) ppSessionView.style.display = tab === 'session' ? '' : 'none';
        if (ppDbView) ppDbView.style.display = tab === 'db' ? '' : 'none';
        if (ppErrorRateView) ppErrorRateView.style.display = tab === 'errorRate' ? '' : 'none';
        if (ppEmpty) ppEmpty.style.display = 'none';
        if (tab === 'current') { buildCurrentView(); }
        else if (tab === 'trends') { requestTrends(); }
        else if (tab === 'session') {
            setSessionTabLoading(true);
            vscodeApi.postMessage({ type: 'requestPerformanceData' });
        }
        else if (tab === 'db') { buildDbStatsView(); }
        else if (tab === 'errorRate') { buildErrorRateView(); }
    }

    if (ppTabCurrent) ppTabCurrent.addEventListener('click', function() { switchTab('current'); });
    if (ppTabTrends) ppTabTrends.addEventListener('click', function() { switchTab('trends'); });
    if (ppTabSession) ppTabSession.addEventListener('click', function() { switchTab('session'); });
    if (ppTabDb) ppTabDb.addEventListener('click', function() { switchTab('db'); });
    if (ppTabErrorRate) ppTabErrorRate.addEventListener('click', function() { switchTab('errorRate'); });

    ${(0, viewer_performance_current_1.getPerformanceCurrentScript)()}

    if (ppCurrentView) ppCurrentView.addEventListener('click', function(e) {
        var row = e.target.closest('.pp-event-row');
        if (row && row.dataset.idx) {
            var idx = parseInt(row.dataset.idx, 10);
            if (typeof scrollToLineNumber === 'function') scrollToLineNumber(idx + 1);
        }
        var header = e.target.closest('.pp-group-header');
        if (header) {
            var grp = header.closest('.pp-group');
            if (grp) grp.classList.toggle('pp-collapsed');
        }
    });

    if (ppTrendBody) ppTrendBody.addEventListener('click', function(e) {
        var row = e.target.closest('tr[data-pp-trend]');
        if (!row || !ppTrendsData) return;
        var idx = parseInt(row.dataset.ppTrend, 10);
        var rows = ppTrendBody.querySelectorAll('tr');
        for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('pp-selected', i === idx);
        renderChart(ppTrendsData[idx]);
    });

    function hideCopyMessageMenu() {
        if (ppCopyMessageMenu) ppCopyMessageMenu.classList.remove('visible');
    }
    /** Right-click on session intro (no-perf-data message) shows this menu; Copy message sends text via copyToClipboard. */
    function showCopyMessageMenu(x, y, text) {
        if (!ppCopyMessageMenu) return;
        ppCopyMessagePendingText = text || '';
        ppCopyMessageMenu.style.left = x + 'px';
        ppCopyMessageMenu.style.top = y + 'px';
        ppCopyMessageMenu.classList.add('visible');
    }
    if (ppSessionIntro) {
        ppSessionIntro.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var text = (ppSessionIntro && ppSessionIntro.innerText) ? ppSessionIntro.innerText.trim() : '';
            if (text) showCopyMessageMenu(e.clientX, e.clientY, text);
        });
    }
    if (ppCopyMessageMenu) {
        ppCopyMessageMenu.addEventListener('click', function(e) {
            var item = e.target.closest('.context-menu-item[data-action="copy-message"]');
            if (item && ppCopyMessagePendingText) {
                vscodeApi.postMessage({ type: 'copyToClipboard', text: ppCopyMessagePendingText });
                hideCopyMessageMenu();
            }
        });
        document.addEventListener('click', function(e) {
            if (ppCopyMessageMenu && ppCopyMessageMenu.classList.contains('visible') && !ppCopyMessageMenu.contains(e.target) && !(ppSessionIntro && ppSessionIntro.contains(e.target))) hideCopyMessageMenu();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') hideCopyMessageMenu();
        });
    }

    var ppRefresh = document.getElementById(ppIdPrefix + 'pp-refresh');
    if (ppRefresh) ppRefresh.addEventListener('click', function() {
        if (ppActiveTab === 'current') buildCurrentView();
        else if (ppActiveTab === 'trends') requestTrends();
        else if (ppActiveTab === 'db') buildDbStatsView();
        else if (ppActiveTab === 'errorRate') buildErrorRateView();
    });

    var ppCloseBtn = document.getElementById(ppIdPrefix + 'pp-panel-close');
    if (ppCloseBtn) ppCloseBtn.addEventListener('click', closePerformancePanel);

    var sessionPerfChip = document.getElementById('session-perf-chip');
    if (sessionPerfChip) sessionPerfChip.addEventListener('click', function() {
        if (typeof window.setActivePanel === 'function') window.setActivePanel('insight');
        if (typeof openInsightPanel === 'function') openInsightPanel();
        if (typeof window.setInsightTab === 'function') window.setInsightTab('performance');
        if (typeof openPerformancePanel === 'function') openPerformancePanel();
    });

    document.addEventListener('click', function(e) {
        if (!ppOpen) return;
        if (ppPanel && ppPanel.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-insight');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        var perfChip = document.getElementById('session-perf-chip');
        if (perfChip && (perfChip === e.target || perfChip.contains(e.target))) return;
        closePerformancePanel();
    });

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'performanceData') {
            renderTrends(e.data.trends);
            if (ppActiveTab === 'session') {
                setSessionTabLoading(false);
                renderSessionData(e.data.sessionData);
            }
        }
    });

    /** DB_13: let global time-filter helpers refresh the Database tab chrome (filter bar, timeline bands). */
    window._refreshDbPerfTabAfterTimeFilter = function() {
        if (ppOpen && ppActiveTab === 'db' && typeof buildDbStatsView === 'function') buildDbStatsView();
    };
})();
`;
}
//# sourceMappingURL=viewer-performance-panel.js.map