/**
 * Performance panel HTML and script for the webview.
 *
 * Two-tab panel: "Current" scans allLines for perf events (client-side),
 * "Trends" requests cross-session aggregated data from the extension.
 */

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
    var ppOpen = false;
    var ppActiveTab = 'current';
    var ppTrendsData = null;

    var ppPerfTraceRe = /\\bPERF\\s+([\\w.]+):\\s*(\\d+)\\s*ms/i;
    var ppChoreographerRe = /Skipped\\s+(\\d[\\d,]*)\\s+frames/i;
    var ppGcFreedRe = /GC\\s+freed\\s+([\\d,]+)\\s*KB/i;
    var ppGcTotalMsRe = /total\\s+([\\d.]+)\\s*ms/i;
    var ppTimeoutRe = /timed\\s+out\\s+after\\s+(\\d+)\\s*s/i;

    window.openPerformancePanel = function() {
        if (!ppPanel) return;
        ppOpen = true;
        ppPanel.classList.add('visible');
        if (ppActiveTab === 'current') { buildCurrentView(); }
        else { requestTrends(); }
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
        ppCurrentView.style.display = tab === 'current' ? '' : 'none';
        ppTrendsView.style.display = tab === 'trends' ? '' : 'none';
        if (tab === 'current') { buildCurrentView(); }
        else { requestTrends(); }
    }

    if (ppTabCurrent) ppTabCurrent.addEventListener('click', function() { switchTab('current'); });
    if (ppTabTrends) ppTabTrends.addEventListener('click', function() { switchTab('trends'); });

    /* ---- Current session view ---- */

    function buildCurrentView() {
        if (!ppCurrentView) return;
        var summary = scanCurrentSession();
        if (summary.total === 0) {
            ppCurrentView.innerHTML = '';
            if (ppEmpty) ppEmpty.style.display = '';
            return;
        }
        if (ppEmpty) ppEmpty.style.display = 'none';
        ppCurrentView.innerHTML = renderGroups(summary);
    }

    function scanCurrentSession() {
        var perf = [], jank = [], gc = [], timeouts = [], other = [];
        if (typeof allLines === 'undefined') return { perf: perf, jank: jank, gc: gc, timeouts: timeouts, other: other, total: 0 };
        for (var i = 0; i < allLines.length; i++) {
            var item = allLines[i];
            if (!item || item.level !== 'performance') continue;
            var plain = typeof stripTags === 'function' ? stripTags(item.html) : item.html;
            classifyPerfLine(plain, i, item.timestamp, perf, jank, gc, timeouts, other);
        }
        jank.sort(function(a, b) { return b.value - a.value; });
        gc.sort(function(a, b) { return b.value - a.value; });
        return { perf: perf, jank: jank, gc: gc, timeouts: timeouts, other: other, total: perf.length + jank.length + gc.length + timeouts.length + other.length };
    }

    function classifyPerfLine(plain, idx, ts, perf, jank, gc, timeouts, other) {
        var m;
        if ((m = ppPerfTraceRe.exec(plain))) { perf.push({ idx: idx, name: m[1], value: parseInt(m[2], 10), ts: ts }); }
        else if ((m = ppChoreographerRe.exec(plain))) { jank.push({ idx: idx, value: parseInt(m[1].replace(/,/g, ''), 10), ts: ts }); }
        else if ((m = ppGcFreedRe.exec(plain))) {
            var totalM = ppGcTotalMsRe.exec(plain);
            gc.push({ idx: idx, freed: parseInt(m[1].replace(/,/g, ''), 10), value: totalM ? parseFloat(totalM[1]) : 0, ts: ts });
        }
        else if ((m = ppTimeoutRe.exec(plain))) { timeouts.push({ idx: idx, value: parseInt(m[1], 10), ts: ts }); }
        else { other.push({ idx: idx, ts: ts }); }
    }

    function renderGroups(s) {
        var html = '';
        if (s.perf.length) html += renderPerfTraceGroup(s.perf);
        if (s.jank.length) html += renderJankGroup(s.jank);
        if (s.gc.length) html += renderGcGroup(s.gc);
        if (s.timeouts.length) html += renderTimeoutGroup(s.timeouts);
        if (s.other.length) html += renderOtherGroup(s.other);
        return html;
    }

    function renderPerfTraceGroup(items) {
        var rows = items.map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">' + esc(it.name) + ': ' + it.value + 'ms</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('PERF Traces', items.length, '', rows);
    }

    function renderJankGroup(items) {
        var worst = items[0].value;
        var total = items.reduce(function(s, it) { return s + it.value; }, 0);
        var stats = 'Worst: ' + fmtNum(worst) + ' frames \\u00b7 Total: ' + fmtNum(total) + ' frames';
        var rows = items.map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">' + fmtNum(it.value) + ' frames</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('Choreographer', items.length, stats, rows);
    }

    function renderGcGroup(items) {
        var avgMs = Math.round(items.reduce(function(s, it) { return s + it.value; }, 0) / items.length);
        var totalFreed = items.reduce(function(s, it) { return s + (it.freed || 0); }, 0);
        var stats = 'Avg: ' + avgMs + 'ms \\u00b7 Freed: ' + fmtKB(totalFreed);
        var rows = items.map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">freed ' + fmtNum(it.freed || 0) + 'KB \\u00b7 ' + Math.round(it.value) + 'ms</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('GC', items.length, stats, rows);
    }

    function renderTimeoutGroup(items) {
        var rows = items.map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">' + it.value + 's timeout</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('Timeouts', items.length, '', rows);
    }

    function renderOtherGroup(items) {
        var rows = items.slice(0, 50).map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">line ' + (it.idx + 1) + '</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('Other', items.length, '', rows);
    }

    function groupHtml(label, count, stats, rows) {
        var statsHtml = stats ? '<div class="pp-group-stats">' + stats + '</div>' : '';
        return '<div class="pp-group"><div class="pp-group-header"><span class="pp-group-arrow"></span><span>' + esc(label) + '</span><span class="pp-group-count">' + count + '</span></div><div class="pp-group-body">' + statsHtml + rows + '</div></div>';
    }

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
        else requestTrends();
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
        }
    });

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
