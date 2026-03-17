/**
 * Performance panel HTML and script for the webview.
 *
 * Two-tab panel: "Current" scans allLines for perf events (client-side),
 * "Trends" requests cross-session aggregated data from the extension.
 */
import { getPerformanceCurrentScript } from './viewer-performance-current';
import { getPerformanceTrendsScript } from './viewer-performance-trends';
import { getPerformanceSessionTabScript } from './viewer-performance-session-tab';

/** Generate the performance panel HTML. */
export function getPerformancePanelHtml(): string {
    return /* html */ `
<div id="performance-panel" class="performance-panel">
    <div class="performance-panel-header">
        <span>Performance</span>
        <div class="performance-panel-actions">
            <button id="pp-refresh" class="pp-action" title="Refresh">
                <span class="codicon codicon-refresh"></span>
            </button>
            <button id="pp-panel-close" class="pp-close" title="Close">&times;</button>
        </div>
    </div>
    <div class="pp-tabs">
        <button id="pp-tab-current" class="pp-tab active">Current</button>
        <button id="pp-tab-trends" class="pp-tab">Trends</button>
        <button id="pp-tab-session" class="pp-tab">Log</button>
    </div>
    <div class="performance-panel-content">
        <div id="pp-current-view"></div>
        <div id="pp-trends-view" style="display:none">
            <div id="pp-chart-area" class="pp-chart-container" style="display:none">
                <div class="pp-chart-title" id="pp-chart-title">Select an operation</div>
                <svg id="pp-chart" class="pp-chart" viewBox="0 0 380 120"></svg>
            </div>
            <table class="pp-trend-table">
                <thead><tr><th>Operation</th><th>Avg</th><th>Logs</th><th></th></tr></thead>
                <tbody id="pp-trend-body"></tbody>
            </table>
        </div>
        <div id="pp-session-view" style="display:none" class="pp-session-view">
            <div id="pp-session-intro" class="pp-session-intro">
                <p class="pp-session-intro-line">This log was saved without performance data. You can't add it to this file.</p>
                <p class="pp-session-intro-line">For your next run: enable <strong>Performance</strong> in Options → Integrations…, then press F5. The new log will include it. (For memory samples, also turn on "Sample during session" in Settings.)</p>
                <p class="pp-session-intro-line pp-session-intro-note">Overhead: snapshot at session start is minimal; optional sampling uses a little CPU and I/O.</p>
            </div>
            <div class="pp-session-block">
                <div class="pp-session-title">System snapshot</div>
                <div id="pp-snapshot" class="pp-session-value">Not recorded for this log.</div>
            </div>
            <div class="pp-session-block">
                <div class="pp-session-title">Log samples</div>
                <div id="pp-samples" class="pp-session-value">Not recorded for this log.</div>
            </div>
            <div class="pp-session-block">
                <div class="pp-session-title">Profiler output</div>
                <div id="pp-profiler" class="pp-session-value">None.</div>
            </div>
        </div>
        <div id="pp-empty" class="pp-empty">No performance events found</div>
        <div id="pp-loading" class="pp-loading" style="display:none">Loading\u2026</div>
    </div>
</div>`;
}

/** Generate the performance panel script. */
export function getPerformancePanelScript(): string {
    return /* javascript */ `
(function() {
    var ppPanel = document.getElementById('performance-panel');
    var ppCurrentView = document.getElementById('pp-current-view');
    var ppTrendsView = document.getElementById('pp-trends-view');
    var ppEmpty = document.getElementById('pp-empty');
    var ppLoading = document.getElementById('pp-loading');
    var ppTrendBody = document.getElementById('pp-trend-body');
    var ppChartArea = document.getElementById('pp-chart-area');
    var ppChartSvg = document.getElementById('pp-chart');
    var ppChartTitle = document.getElementById('pp-chart-title');
    var ppTabCurrent = document.getElementById('pp-tab-current');
    var ppTabTrends = document.getElementById('pp-tab-trends');
    var ppTabSession = document.getElementById('pp-tab-session');
    var ppSessionView = document.getElementById('pp-session-view');
    var ppOpen = false;
    var ppActiveTab = 'current';
    var ppTrendsData = null;

    window.openPerformancePanel = function() {
        if (!ppPanel) return;
        ppOpen = true;
        ppPanel.classList.add('visible');
        if (ppActiveTab === 'current') { buildCurrentView(); }
        else if (ppActiveTab === 'trends') { requestTrends(); }
    };

    window.closePerformancePanel = function() {
        if (!ppPanel) return;
        ppPanel.classList.remove('visible');
        ppOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('performance');
    };

    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function fmtTs(ts) { if (!ts) return ''; var d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function fmtNum(n) { return n.toLocaleString(); }
    function fmtKB(kb) { if (kb >= 1024 * 1024) return (kb / (1024 * 1024)).toFixed(1) + ' GB'; if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB'; return kb + ' KB'; }

    ${getPerformanceSessionTabScript()}
    ${getPerformanceTrendsScript()}

    function switchTab(tab) {
        ppActiveTab = tab;
        ppTabCurrent.classList.toggle('active', tab === 'current');
        ppTabTrends.classList.toggle('active', tab === 'trends');
        if (ppTabSession) ppTabSession.classList.toggle('active', tab === 'session');
        if (ppCurrentView) ppCurrentView.style.display = tab === 'current' ? '' : 'none';
        if (ppTrendsView) ppTrendsView.style.display = tab === 'trends' ? '' : 'none';
        if (ppSessionView) ppSessionView.style.display = tab === 'session' ? '' : 'none';
        if (ppEmpty) ppEmpty.style.display = 'none';
        if (tab === 'current') { buildCurrentView(); }
        else if (tab === 'trends') { requestTrends(); }
        else if (tab === 'session') {
            setSessionTabLoading(true);
            vscodeApi.postMessage({ type: 'requestPerformanceData' });
        }
    }

    if (ppTabCurrent) ppTabCurrent.addEventListener('click', function() { switchTab('current'); });
    if (ppTabTrends) ppTabTrends.addEventListener('click', function() { switchTab('trends'); });
    if (ppTabSession) ppTabSession.addEventListener('click', function() { switchTab('session'); });

    ${getPerformanceCurrentScript()}

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

    var ppRefresh = document.getElementById('pp-refresh');
    if (ppRefresh) ppRefresh.addEventListener('click', function() {
        if (ppActiveTab === 'current') buildCurrentView();
        else if (ppActiveTab === 'trends') requestTrends();
    });

    var ppCloseBtn = document.getElementById('pp-panel-close');
    if (ppCloseBtn) ppCloseBtn.addEventListener('click', closePerformancePanel);

    var sessionPerfChip = document.getElementById('session-perf-chip');
    if (sessionPerfChip) sessionPerfChip.addEventListener('click', function() {
        if (typeof window.setActivePanel === 'function') window.setActivePanel('performance');
        if (typeof openPerformancePanel === 'function') openPerformancePanel();
    });

    document.addEventListener('click', function(e) {
        if (!ppOpen) return;
        if (ppPanel && ppPanel.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-performance');
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
})();
`;
}
