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
 * inline fills: severity has exactly one palette across the viewer, and it is the
 * toolbar's (red / orange / purple). Keeping the fills in CSS lets that one
 * declaration site stay paired with the toolbar's. TROUBLE_LEVELS is reused from
 * viewer-trouble-mode.ts (which loads first) so the charted set is defined once.
 *
 * Rendering is debounced and only runs while `troubleModeActive` — the pane is
 * shown/hidden purely by CSS keyed on `body.slc-trouble-active`, so this script
 * only ever fills content, never toggles visibility.
 */
import { getTroubleChartLaunchScript } from './viewer-trouble-chart-launch';

/** Embedded webview JavaScript for the Trouble Mode severity chart. */
export function getTroubleChartScript(): string {
    // The launch-line scan is prepended, not imported at runtime: every viewer script is
    // concatenated into one page scope, so troubleChartLaunchTs() is simply in scope below.
    return getTroubleChartLaunchScript() + /* javascript */ `
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
/* A single event used to render as a 1px dash — visible only if you knew to look. Three
   viewBox units is ~3px at the pinned 60px strip height: unmistakably a bar. */
var TROUBLE_CHART_MIN_BAR = 3;
var troubleChartTimer = null;
/* Timestamp of the row currently open in the side rail, or 0. The chart marks the window
   containing it, so the strip answers "where in the session is the report I am reading".
   Stored as a timestamp, not a bucket key: the bucket size changes with the interval
   setting, so a key computed at selection time would point at the wrong window later. */
var troubleChartSelectedTs = 0;
/* Collapsed hides the plot but KEEPS the head — the legend totals are the reason to
   collapse (keep the counts, give the feed back the 60px strip), and a head-less chart
   would leave nothing to click to bring it back. */
var troubleChartCollapsed = false;

/* Called by the side rail on open (with the row's timestamp) and on close (with 0). */
function setTroubleChartSelection(timestamp) {
    troubleChartSelectedTs = (typeof timestamp === 'number' && timestamp > 0) ? timestamp : 0;
    renderTroubleChart();
}

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
    var totals = { error: 0, warning: 0, performance: 0 };
    if (maxKey == null) { return { bins: [], maxTotal: 0, intervalMs: intervalMs, totals: totals }; }
    /* Materialize a CONTIGUOUS window (empty windows included as zero-height gaps)
       so the bars read as a rate over time, not a collapsed list. minKey is the FIRST
       window that actually holds an event, so leading empty span is already trimmed;
       the cap only bounds how far back a long session reaches (bug 001 OOM fence:
       no unbounded array). A short session therefore shows exactly its own span. */
    var start = Math.max(minKey, maxKey - TROUBLE_CHART_MAX_BUCKETS + 1);
    var launchTs = troubleChartLaunchTs();
    var bins = [];
    var maxTotal = 0;
    var anyTotal = 0;
    /* Legend totals are summed over the RENDERED bins, not over allLines. Counting every
       matching line would let the legend claim errors the capped window never draws — a
       chart and a legend that disagree is worse than no legend. */
    for (var k = start; k <= maxKey; k++) {
        var hit = byKey[k];
        var total = hit ? (hit.error + hit.warning + hit.performance) : 0;
        /* A window that ENDS at or before the launch line holds only the device's
           pre-launch logcat backlog. It still draws — nothing is hidden — but it is kept
           out of the peak, because that one startup burst is routinely an order of
           magnitude larger than anything the app itself does and flattens every real
           spike after it into an unreadable sliver. The window that CONTAINS the launch
           line is mixed, so it counts. */
        var pre = launchTs > 0 && ((k + 1) * intervalMs) <= launchTs;
        if (total > anyTotal) { anyTotal = total; }
        if (!pre && total > maxTotal) { maxTotal = total; }
        if (hit) { totals.error += hit.error; totals.warning += hit.warning; totals.performance += hit.performance; }
        var bin = hit || { key: k, error: 0, warning: 0, performance: 0, firstLine: null };
        bin.preLaunch = pre;
        bins.push(bin);
    }
    /* Nothing after launch yet: scale to the burst rather than divide by zero. */
    if (maxTotal === 0) { maxTotal = anyTotal; }
    return { bins: bins, maxTotal: maxTotal, intervalMs: intervalMs, totals: totals };
}

/* Draw one stacked bar. Error sits on the baseline, warning above it, performance on
   top. A non-zero count clamps to TROUBLE_CHART_MIN_BAR so a single event is legible.
   A pre-launch bar is scaled off the chart (its window is excluded from the peak), so
   every segment is clamped to the plot: it saturates at full height instead of drawing
   above the viewBox, where the SVG would simply cut it off. */
function troubleChartStackRects(bin, geom, scale) {
    var segs = [
        { cls: 'tc-bar-error', n: bin.error },
        { cls: 'tc-bar-warning', n: bin.warning },
        { cls: 'tc-bar-performance', n: bin.performance },
    ];
    var y = TROUBLE_CHART_VH;
    var rects = '';
    for (var s = 0; s < segs.length; s++) {
        if (segs[s].n <= 0 || y <= 0) { continue; }
        var h = Math.min(y, Math.max(TROUBLE_CHART_MIN_BAR, segs[s].n * scale));
        y -= h;
        rects += '<rect class="' + segs[s].cls + '" x="' + geom.barX.toFixed(1) + '" y="' + y.toFixed(1)
            + '" width="' + geom.barW.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1"></rect>';
    }
    return rects;
}

/* The selected flag paints a full-height band behind the bar (the row open in the rail). */
function troubleChartBar(bin, geom, scale, intervalMs, selected) {
    var rects = troubleChartStackRects(bin, geom, scale);
    if (!rects && !selected) { return ''; }
    var band = selected
        ? '<rect class="tc-selected-band" x="' + geom.cellX.toFixed(1) + '" y="0" width="' + geom.cellW.toFixed(1) + '" height="' + TROUBLE_CHART_VH + '"></rect>'
        : '';
    var tip = vt('viewer.troubleChart.barTip', troubleChartClock(bin.key * intervalMs), bin.error, bin.warning, bin.performance);
    /* Say why the bar is muted and off-scale, or the user reads it as a rendering bug. */
    if (bin.preLaunch) { tip = vt('viewer.troubleChart.preLaunch') + ' — ' + tip; }
    var lineAttr = (bin.firstLine != null) ? ' data-line="' + (bin.firstLine + 1) + '"' : '';
    var cls = bin.preLaunch ? 'tc-bar tc-bar-pre' : 'tc-bar';
    return '<g class="' + cls + '"' + lineAttr + '><title>' + tip + '</title>' + band + rects + '</g>';
}

/* Per-level totals for the whole charted span, as colored chips in the pane head.
   Without them a stacked bar's colors are unlabeled and the chart is decoration. */
function renderTroubleChartLegend(totals) {
    var el = document.getElementById('trouble-chart-legend');
    if (!el) { return; }
    var levels = ['error', 'warning', 'performance'];
    var html = '';
    for (var i = 0; i < levels.length; i++) {
        html += '<span class="tc-chip tc-chip-' + levels[i] + '"><i></i>'
            + vt('viewer.troubleChart.legend.' + levels[i], totals[levels[i]]) + '</span>';
    }
    el.innerHTML = html;
}

/* Peak count, in the head row beside the title. It lived pinned inside the plot's
   top-left corner until the tallest bar — the device-startup warning rush, which
   always lands in the leading window — drew straight over it. An overlapped number is
   worse than none, and the head costs the feed no extra height. */
function renderTroubleChartPeak(maxTotal) {
    var el = document.getElementById('trouble-chart-peak');
    if (!el) { return; }
    el.textContent = maxTotal > 0 ? vt('viewer.troubleChart.peak', maxTotal) : '';
}

/* The strip's SVG plus the x-axis labels: the first and last window clock times. Labels
   are HTML, never SVG <text>: the viewBox is drawn with preserveAspectRatio="none",
   which would stretch glyphs. */
function troubleChartPlotHtml(bars, data) {
    var first = troubleChartClock(data.bins[0].key * data.intervalMs);
    var last = troubleChartClock(data.bins[data.bins.length - 1].key * data.intervalMs);
    return '<div class="tc-plot">'
        + '<svg class="tc-svg" viewBox="0 0 ' + TROUBLE_CHART_VW + ' ' + TROUBLE_CHART_VH
        + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' + bars + '</svg></div>'
        + '<div class="tc-axis"><span>' + first + '</span><span>' + last + '</span></div>';
}

/* Lay the bins across the fixed viewBox width and stack each one. Split out of
   renderTroubleChart purely to keep both under the 30-line function limit. */
function troubleChartBarsHtml(data) {
    var n = data.bins.length;
    var cellW = TROUBLE_CHART_VW / n;
    var barW = Math.min(cellW * 0.7, 14);
    var scale = (TROUBLE_CHART_VH - TROUBLE_CHART_TOP_PAD) / data.maxTotal;
    var selectedKey = troubleChartSelectedTs > 0 ? Math.floor(troubleChartSelectedTs / data.intervalMs) : null;
    var bars = '';
    for (var i = 0; i < n; i++) {
        var cellX = i * cellW;
        var geom = { cellX: cellX, cellW: cellW, barX: cellX + (cellW - barW) / 2, barW: barW };
        bars += troubleChartBar(data.bins[i], geom, scale, data.intervalMs, data.bins[i].key === selectedKey);
    }
    return bars;
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
    var legend = document.getElementById('trouble-chart-legend');
    if (data.bins.length === 0 || data.maxTotal === 0) {
        if (legend) { legend.innerHTML = ''; }
        renderTroubleChartPeak(0);
        body.innerHTML = '<div class="tc-empty">' + vt('viewer.troubleChart.empty') + '</div>';
        return;
    }
    /* Head first: the totals and the peak stay live while collapsed, which is the whole
       reason collapsing beats hiding. Only the plot's string building is skipped. */
    renderTroubleChartLegend(data.totals);
    renderTroubleChartPeak(data.maxTotal);
    if (troubleChartCollapsed) { return; }
    body.innerHTML = troubleChartPlotHtml(troubleChartBarsHtml(data), data);
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

/* Chevron. Collapsing re-renders nothing (CSS hides the plot); expanding must rebuild,
   because every render while collapsed skipped the plot and left it stale. */
function toggleTroubleChartCollapsed() {
    var pane = document.getElementById('trouble-chart');
    var btn = document.getElementById('trouble-chart-toggle');
    if (!pane) { return; }
    troubleChartCollapsed = !troubleChartCollapsed;
    pane.classList.toggle('tc-collapsed', troubleChartCollapsed);
    if (btn) { btn.setAttribute('aria-expanded', troubleChartCollapsed ? 'false' : 'true'); }
    if (!troubleChartCollapsed) { renderTroubleChart(); }
}

(function() {
    if (typeof document === 'undefined') { return; }
    var toggle = document.getElementById('trouble-chart-toggle');
    if (toggle) { toggle.addEventListener('click', toggleTroubleChartCollapsed); }
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
