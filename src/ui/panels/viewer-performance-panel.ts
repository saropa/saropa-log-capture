/**
 * Performance panel HTML and script for the webview.
 *
 * Two-tab panel: "Current" scans allLines for perf events (client-side),
 * "Trends" requests cross-session aggregated data from the extension.
 */
import { getPerformanceCurrentScript } from './viewer-performance-current';

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
        <button id="pp-tab-session" class="pp-tab">Session</button>
    </div>
    <div class="performance-panel-content">
        <div id="pp-current-view"></div>
        <div id="pp-trends-view" style="display:none">
            <div id="pp-chart-area" class="pp-chart-container" style="display:none">
                <div class="pp-chart-title" id="pp-chart-title">Select an operation</div>
                <svg id="pp-chart" class="pp-chart" viewBox="0 0 380 120"></svg>
            </div>
            <table class="pp-trend-table">
                <thead><tr><th>Operation</th><th>Avg</th><th>Sessions</th><th></th></tr></thead>
                <tbody id="pp-trend-body"></tbody>
            </table>
        </div>
        <div id="pp-session-view" style="display:none" class="pp-session-view">
            <div class="pp-session-block">
                <div class="pp-session-title">System snapshot</div>
                <div id="pp-snapshot" class="pp-session-value">Not recorded. Enable the Performance integration to record CPUs, RAM, and process stats at session start.</div>
            </div>
            <div class="pp-session-block">
                <div class="pp-session-title">Session samples</div>
                <div id="pp-samples" class="pp-session-value">Not recorded. Enable the Performance integration to record periodic memory/load samples during the session.</div>
            </div>
            <div class="pp-session-block">
                <div class="pp-session-title">Profiler output</div>
                <div id="pp-profiler" class="pp-session-value">None attached. Enable the Performance integration and set a profiler output path to attach a trace or flame graph file.</div>
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

    /* ---- Tab switching ---- */

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

    function setSessionTabLoading(loading) {
        var ppSnapshot = document.getElementById('pp-snapshot');
        var ppSamples = document.getElementById('pp-samples');
        var ppProfiler = document.getElementById('pp-profiler');
        var msg = loading ? 'Loading\u2026' : '';
        if (ppSnapshot && loading) ppSnapshot.textContent = msg;
        if (ppSamples && loading) ppSamples.textContent = msg;
        if (ppProfiler && loading) ppProfiler.textContent = msg;
    }

    if (ppTabCurrent) ppTabCurrent.addEventListener('click', function() { switchTab('current'); });
    if (ppTabTrends) ppTabTrends.addEventListener('click', function() { switchTab('trends'); });
    if (ppTabSession) ppTabSession.addEventListener('click', function() { switchTab('session'); });

    ${getPerformanceCurrentScript()}

    /* ---- Trends view ---- */

    function requestTrends() {
        if (ppEmpty) ppEmpty.style.display = 'none';
        if (ppLoading) ppLoading.style.display = '';
        vscodeApi.postMessage({ type: 'requestPerformanceData' });
    }

    function renderTrends(trends) {
        if (ppLoading) ppLoading.style.display = 'none';
        if (!trends || trends.length === 0) {
            if (ppTrendBody) ppTrendBody.innerHTML = '';
            if (ppChartArea) ppChartArea.style.display = 'none';
            if (ppEmpty && ppActiveTab === 'trends') ppEmpty.style.display = '';
            return;
        }
        if (ppEmpty) ppEmpty.style.display = 'none';
        ppTrendsData = trends;
        renderTrendTable(trends);
        renderChart(trends[0]);
    }

    function renderTrendTable(trends) {
        if (!ppTrendBody) return;
        ppTrendBody.innerHTML = trends.map(function(t, i) {
            var arrow = t.trend === 'degrading' ? '<span class="pp-trend-up">\\u2191</span>'
                : t.trend === 'improving' ? '<span class="pp-trend-down">\\u2193</span>'
                : '<span class="pp-trend-stable">\\u2192</span>';
            var cls = i === 0 ? ' class="pp-selected"' : '';
            return '<tr' + cls + ' data-pp-trend="' + i + '"><td>' + esc(t.name) + '</td><td>' + t.overallAvgMs + 'ms</td><td>' + t.sessionCount + '</td><td>' + arrow + '</td></tr>';
        }).join('');
    }

    function renderChart(trend) {
        if (!ppChartSvg || !ppChartArea || !trend || !trend.timeline || trend.timeline.length < 2) {
            if (ppChartArea) ppChartArea.style.display = 'none';
            return;
        }
        ppChartArea.style.display = '';
        if (ppChartTitle) ppChartTitle.textContent = trend.name;
        var tl = trend.timeline;
        var maxMs = Math.max.apply(null, tl.map(function(p) { return p.avgMs; }));
        var minMs = Math.min.apply(null, tl.map(function(p) { return p.avgMs; }));
        var range = maxMs - minMs || 1;
        var w = 380, h = 120, pad = 30, plotW = w - pad * 2, plotH = h - pad;
        var points = tl.map(function(p, i) {
            var x = pad + (tl.length === 1 ? plotW / 2 : (i / (tl.length - 1)) * plotW);
            var y = pad + plotH - ((p.avgMs - minMs) / range) * (plotH - 10);
            return { x: x, y: y, ms: p.avgMs, session: p.session };
        });
        var polyline = points.map(function(p) { return p.x + ',' + p.y; }).join(' ');
        var dots = points.map(function(p) {
            return '<circle class="pp-chart-dot" cx="' + p.x + '" cy="' + p.y + '" r="3"><title>' + p.ms + 'ms</title></circle>';
        }).join('');
        var yTop = Math.round(maxMs) + 'ms';
        var yBot = Math.round(minMs) + 'ms';
        ppChartSvg.innerHTML =
            '<line class="pp-chart-axis" x1="' + pad + '" y1="' + pad + '" x2="' + pad + '" y2="' + (h - 5) + '"/>' +
            '<line class="pp-chart-axis" x1="' + pad + '" y1="' + (h - 5) + '" x2="' + (w - 5) + '" y2="' + (h - 5) + '"/>' +
            '<text class="pp-chart-label" x="2" y="' + (pad + 4) + '">' + yTop + '</text>' +
            '<text class="pp-chart-label" x="2" y="' + (h - 8) + '">' + yBot + '</text>' +
            '<polyline class="pp-chart-line" points="' + polyline + '"/>' + dots;
    }

    /* ---- Click handlers ---- */

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

    /* ---- Outside click ---- */

    document.addEventListener('click', function(e) {
        if (!ppOpen) return;
        if (ppPanel && ppPanel.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-performance');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closePerformancePanel();
    });

    /* ---- Message listener ---- */

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

    function renderSessionData(sessionData) {
        var ppSnapshot = document.getElementById('pp-snapshot');
        var ppSamples = document.getElementById('pp-samples');
        var ppProfiler = document.getElementById('pp-profiler');
        var snap = sessionData && sessionData.snapshot;
        if (ppSnapshot) {
            if (snap && typeof snap === 'object') {
                var s = snap;
                var txt = s.cpus + ' CPUs, ' + (s.totalMemMb || 0) + ' MB RAM (' + (s.freeMemMb || 0) + ' MB free)';
                if (s.processMemMb != null) txt += '; process: ' + s.processMemMb + ' MB';
                ppSnapshot.textContent = txt;
            } else {
                ppSnapshot.textContent = 'Not recorded. Enable the Performance integration to record CPUs, RAM at session start.';
            }
        }
        if (ppSamples) {
            if (sessionData && sessionData.samplesFile && sessionData.sampleCount != null) {
                ppSamples.textContent = sessionData.sampleCount + ' samples in ' + sessionData.samplesFile + '. Use "Open log folder" to view.';
            } else {
                ppSamples.textContent = 'Not recorded. Enable the Performance integration and "Sample during session" to record periodic memory/load.';
            }
        }
        if (ppProfiler) {
            ppProfiler.textContent = 'None attached. Use a future "Attach profiler output" command to link a trace file.';
        }
    }

    /* ---- Helpers ---- */

    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function fmtTs(ts) {
        if (!ts) return '';
        var d = new Date(ts);
        return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function fmtNum(n) { return n.toLocaleString(); }

    function fmtKB(kb) {
        if (kb >= 1024 * 1024) return (kb / (1024 * 1024)).toFixed(1) + ' GB';
        if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
        return kb + ' KB';
    }
})();
`;
}
