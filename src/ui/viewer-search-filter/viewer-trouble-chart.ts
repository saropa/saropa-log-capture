/**
 * Trouble Mode — live severity chart (plan Trouble Mode dashboard, Stage 3).
 *
 * A zero-dependency SVG bar chart that sits above the zero-context feed while
 * Trouble Mode is active. It buckets the same `item.level` the feed filters on
 * (the level-badge fence: chart totals can never disagree with the feed) into
 * tumbling time windows and draws one stacked bar per window — error / warning /
 * performance. Clicking a bar scrolls the feed to that window's first row.
 *
 * WHY aggregate in the webview: the page already holds every line with its
 * `item.level` and `item.timestamp`, so bucketing here needs no new host→webview
 * channel and adds NO buffer between capture and the webview. The extension-host
 * OOM fence (bug 001) applies to any such buffer; the cheapest way to honor it is
 * to add none. The bucket window is capped (TROUBLE_CHART_MAX_BUCKETS) so an
 * hours-long session cannot grow it unbounded — only the most recent windows show.
 *
 * WHY colors come from CSS classes (viewer-styles-trouble-chart.ts) rather than
 * inline fills: the design tokens (--accent-critical / --accent-warning /
 * --accent-info) resolve against the host theme, so the bars stay theme-aware in
 * light, dark, and high-contrast. TROUBLE_LEVELS is reused from
 * viewer-trouble-mode.ts (which loads first) so the charted set is defined once.
 *
 * Rendering is debounced and only runs while `troubleModeActive` — the pane is
 * shown/hidden purely by CSS keyed on `body.slc-trouble-active`, so this script
 * only ever fills content, never toggles visibility.
 */

/** Embedded webview JavaScript for the Trouble Mode severity chart. */
export function getTroubleChartScript(): string {
    return /* javascript */ `
/* Seconds per tumbling window; overwritten by the host 'setTroubleChartInterval'
   message (saropaLogCapture.troubleMode.chartInterval). Clamped 1..60. */
var troubleChartIntervalSec = 5;
/* Rolling-window cap: only the most recent N windows render, so the SVG and the
   scan cost stay bounded regardless of session length. 180 windows = 3 min at 1s,
   15 min at 5s — a recent-activity view, which is the point of triage. */
var TROUBLE_CHART_MAX_BUCKETS = 180;
/* SVG coordinate system. CSS scales width to 100% and pins the pixel height. */
var TROUBLE_CHART_VW = 1000;
var TROUBLE_CHART_VH = 60;
var TROUBLE_CHART_TOP_PAD = 6;
var troubleChartTimer = null;

/* Two-digit clock for a window's start time (webview runs in the browser, so
   Date is available here). Labels the bar tooltip. */
function troubleChartClock(ms) {
    var d = new Date(ms);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

/* One O(n) pass over allLines → a map of windowKey → per-level counts plus the
   first row index in that window (for click-to-scroll). Only 'line' items with a
   charted level and a real timestamp count; markers carry no level and are skipped
   (same fence as the feed filter). Returns the contiguous most-recent window slice. */
function buildTroubleChartBuckets() {
    var intervalMs = troubleChartIntervalSec * 1000;
    var byKey = {};
    var minKey = null;
    var maxKey = null;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (!item || item.type !== 'line') { continue; }
        if (!TROUBLE_LEVELS[item.level]) { continue; }
        var ts = item.timestamp;
        if (typeof ts !== 'number' || !(ts > 0)) { continue; }
        var key = Math.floor(ts / intervalMs);
        var b = byKey[key];
        if (!b) { b = byKey[key] = { key: key, error: 0, warning: 0, performance: 0, firstLine: item.viewerLineIndex }; }
        b[item.level]++;
        if (typeof item.viewerLineIndex === 'number' && (b.firstLine == null || item.viewerLineIndex < b.firstLine)) {
            b.firstLine = item.viewerLineIndex;
        }
        if (maxKey == null || key > maxKey) { maxKey = key; }
        if (minKey == null || key < minKey) { minKey = key; }
    }
    if (maxKey == null) { return { bins: [], maxTotal: 0, intervalMs: intervalMs }; }
    /* Materialize a CONTIGUOUS window (empty windows included as zero-height gaps)
       so the bars read as a rate over time, not a collapsed list. Start at the
       earliest event, but never earlier than TROUBLE_CHART_MAX_BUCKETS windows back
       from the latest — so a short session shows just its own span, and an
       hours-long one is bounded to a recent slice (bug 001 OOM fence: no unbounded array). */
    var start = Math.max(minKey, maxKey - TROUBLE_CHART_MAX_BUCKETS + 1);
    var bins = [];
    var maxTotal = 0;
    for (var k = start; k <= maxKey; k++) {
        var hit = byKey[k];
        var total = hit ? (hit.error + hit.warning + hit.performance) : 0;
        if (total > maxTotal) { maxTotal = total; }
        bins.push(hit || { key: k, error: 0, warning: 0, performance: 0, firstLine: null });
    }
    return { bins: bins, maxTotal: maxTotal, intervalMs: intervalMs };
}

/* Draw one stacked bar. Error sits on the baseline, warning above it, performance
   on top. A non-zero count clamps to at least 1px so a single event is visible. */
function troubleChartBar(bin, x, barW, scale, intervalMs) {
    var segs = [
        { cls: 'tc-bar-error', n: bin.error },
        { cls: 'tc-bar-warning', n: bin.warning },
        { cls: 'tc-bar-performance', n: bin.performance },
    ];
    var y = TROUBLE_CHART_VH;
    var rects = '';
    for (var s = 0; s < segs.length; s++) {
        if (segs[s].n <= 0) { continue; }
        var h = Math.max(1, segs[s].n * scale);
        y -= h;
        rects += '<rect class="' + segs[s].cls + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1)
            + '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1"></rect>';
    }
    if (!rects) { return ''; }
    var tip = vt('viewer.troubleChart.barTip', troubleChartClock(bin.key * intervalMs), bin.error, bin.warning, bin.performance);
    var lineAttr = (bin.firstLine != null) ? ' data-line="' + (bin.firstLine + 1) + '"' : '';
    return '<g class="tc-bar"' + lineAttr + '><title>' + tip + '</title>' + rects + '</g>';
}

/* Fill #trouble-chart-body: empty state when there is nothing wrong yet, else the
   SVG. No-op while Trouble Mode is off so the work never runs when the pane is
   hidden. */
function renderTroubleChart() {
    if (typeof document === 'undefined') { return; }
    var body = document.getElementById('trouble-chart-body');
    if (!body) { return; }
    if (typeof troubleModeActive === 'undefined' || !troubleModeActive) { return; }
    var data = buildTroubleChartBuckets();
    if (data.bins.length === 0 || data.maxTotal === 0) {
        body.innerHTML = '<div class="tc-empty">' + vt('viewer.troubleChart.empty') + '</div>';
        return;
    }
    var n = data.bins.length;
    var cellW = TROUBLE_CHART_VW / n;
    var barW = Math.min(cellW * 0.7, 14);
    var scale = (TROUBLE_CHART_VH - TROUBLE_CHART_TOP_PAD) / data.maxTotal;
    var bars = '';
    for (var i = 0; i < n; i++) {
        bars += troubleChartBar(data.bins[i], i * cellW + (cellW - barW) / 2, barW, scale, data.intervalMs);
    }
    body.innerHTML = '<svg class="tc-svg" viewBox="0 0 ' + TROUBLE_CHART_VW + ' ' + TROUBLE_CHART_VH
        + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' + bars + '</svg>';
}

/* Coalesce bursts (a streaming batch fires this once per batch, not per line).
   Skips scheduling entirely while Trouble Mode is off. */
function scheduleTroubleChartUpdate() {
    if (typeof troubleModeActive === 'undefined' || !troubleModeActive) { return; }
    if (troubleChartTimer) { return; }
    troubleChartTimer = setTimeout(function() {
        troubleChartTimer = null;
        renderTroubleChart();
    }, 200);
}

/* Host setting change. Validate defensively so a malformed message cannot corrupt
   state, then re-render if the mode is active. */
function setTroubleChartInterval(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) { return; }
    troubleChartIntervalSec = Math.min(60, Math.max(1, Math.round(seconds)));
    renderTroubleChart();
}

(function() {
    if (typeof document === 'undefined') { return; }
    var body = document.getElementById('trouble-chart-body');
    if (!body) { return; }
    /* Delegated click: a bar carries the 1-based line number of its window's first
       row; scrollToLineNumber jumps the feed there. Guarded — the goto-line script
       owns the scroller. */
    body.addEventListener('click', function(e) {
        var g = e.target && e.target.closest ? e.target.closest('.tc-bar') : null;
        if (!g) { return; }
        var line = parseInt(g.getAttribute('data-line') || '', 10);
        if (!isNaN(line) && line > 0 && typeof scrollToLineNumber === 'function') { scrollToLineNumber(line); }
    });
})();
`;
}
