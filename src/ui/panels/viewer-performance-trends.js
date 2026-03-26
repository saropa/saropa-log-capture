"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPerformanceTrendsScript = getPerformanceTrendsScript;
/**
 * Trends view script for the performance panel (requestTrends, renderTrends, renderChart).
 * Inlined into the same IIFE as viewer-performance-panel so ppTrendBody, ppChartArea, etc. are in scope.
 */
function getPerformanceTrendsScript() {
    return `
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
`;
}
//# sourceMappingURL=viewer-performance-trends.js.map