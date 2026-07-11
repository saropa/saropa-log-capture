/**
 * Trouble Mode — live severity chart (plan Trouble Mode dashboard, Stage 3).
 *
 * A zero-dependency SVG bar chart that sits above the zero-context feed while
 * Trouble Mode is active. It buckets the same `item.level` the feed filters on
 * (the level-badge fence: chart totals can never disagree with the feed) into
 * tumbling time windows and draws one stacked bar per window — error / warning /
 * performance. Clicking a bar scrolls the feed to that window's first row.
 *
 * The head-row legend chips (error / warning / performance, each with its running total)
 * double as level filters: they route to the SAME toggleLevel / soloLevel the toolbar level
 * dots call, so single-click toggles the level, double-click focuses only it, and the chip
 * dim and the dot dim stay in lockstep through the one enabledLevels set (syncTroubleChartChips).
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
import { getTroubleChartRenderScript } from './viewer-trouble-chart-render';

/** Embedded webview JavaScript for the Trouble Mode severity chart. */
export function getTroubleChartScript(): string {
    // The launch-line scan and the bar/legend/axis builders are prepended, not imported at
    // runtime: every viewer script is concatenated into one page scope, so troubleChartLaunchTs()
    // and troubleChartPlotHtml() are simply in scope below (all render calls happen post-load).
    return getTroubleChartLaunchScript() + getTroubleChartRenderScript() + /* javascript */ `
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
/* Error's larger floor (see troubleChartStackRects): a lone error must stay visible under a
   tall performance stack rather than collapse to the 3px others get. */
var TROUBLE_CHART_MIN_ERROR = 5;
/* Evenly spaced time labels under the strip. The windows are contiguous keys, so bin index
   maps linearly to x and a label at fraction f can name the window at that fraction honestly. */
var TROUBLE_CHART_AXIS_TICKS = 5;
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
   Date is available here). Labels the bar tooltip, where per-second precision matters. */
function troubleChartClock(ms) {
    var d = new Date(ms);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

/* Hours:minutes only, for the x-axis tick labels. The strip spans minutes, so the seconds a
   window happens to start on are noise on the axis and just crowd the labels. */
function troubleChartClockHM(ms) {
    var d = new Date(ms);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes());
}

/* One O(n) pass over allLines → windowKey → per-level counts + the first row index in that
   window (for click-to-scroll). Only 'line' items with a charted level and a real timestamp
   count; markers carry no level and are skipped (same fence as the feed filter). */
function troubleChartScanLines(intervalMs) {
    var byKey = {};
    var maxKey = null;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (!item || item.type !== 'line') { continue; }
        if (!TROUBLE_LEVELS[item.level]) { continue; }
        /* Honor the SAME enabledLevels set the legend chips (and the toolbar level dots) gate —
           otherwise a chip reads dimmed while its bar keeps counting the level the user just
           turned off, contradicting this file's "chart can never disagree with the feed" fence.
           Guarded: enabledLevels is owned by the level-filter script, absent in the VM tests. */
        if (typeof enabledLevels !== 'undefined' && !enabledLevels.has(item.level)) { continue; }
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
    }
    return { byKey: byKey, maxKey: maxKey };
}

/* Bucket allLines into the contiguous most-recent window slice, starting at the first real
   (post-app-ready) event. See troubleChartScanLines for the per-line scan. */
function buildTroubleChartBuckets() {
    var intervalMs = troubleChartIntervalSec * 1000;
    var scan = troubleChartScanLines(intervalMs);
    var byKey = scan.byKey;
    var maxKey = scan.maxKey;
    var totals = { error: 0, warning: 0, performance: 0 };
    if (maxKey == null) { return { bins: [], maxTotal: 0, intervalMs: intervalMs, totals: totals, atAppStart: false }; }
    /* The chart shows EVERYTHING until the app-start boundary is known — the device's pre-app
       logcat backlog charts normally rather than being held behind a "waiting" state (a blank
       chart hid real pre-startup issues). The moment the launch/build marker resolves the
       boundary (troubleChartLaunchTs: the build-complete line, or the launch-start line when
       there is no build), the start point resets to the app era: firstRealWindowKey DROPS every
       pre-app window (device backlog + build output — a burst an order of magnitude larger than
       the app's own trouble), which also removes the long empty gap before app start, and the
       green app-start divider is drawn at the left edge (atAppStart) so the burst falling away is
       explained rather than an unexplained change. */
    var launchTs = troubleChartLaunchTs();
    var realMinKey = firstRealWindowKey(byKey, launchTs, intervalMs);
    /* Every event so far is pre-app (boundary not yet passed, or nothing charted after it):
       show the empty state rather than the burst — "no app-era trouble yet". */
    if (realMinKey == null) { return { bins: [], maxTotal: 0, intervalMs: intervalMs, totals: totals, atAppStart: false }; }
    /* Materialize a CONTIGUOUS window from the first real event (empty windows kept as
       zero-height gaps so bars read as a rate, not a collapsed list); the cap only bounds how
       far back a long session reaches (bug 001 OOM fence: no unbounded array). */
    var start = Math.max(realMinKey, maxKey - TROUBLE_CHART_MAX_BUCKETS + 1);
    var bins = [];
    var maxTotal = 0;
    /* Legend totals are summed over the RENDERED bins, not over allLines. Counting every
       matching line would let the legend claim errors the capped window never draws — a
       chart and a legend that disagree is worse than no legend. Pre-app windows are trimmed
       above, so the totals no longer count the device burst either. */
    for (var k = start; k <= maxKey; k++) {
        var hit = byKey[k];
        var total = hit ? (hit.error + hit.warning + hit.performance) : 0;
        if (total > maxTotal) { maxTotal = total; }
        if (hit) { totals.error += hit.error; totals.warning += hit.warning; totals.performance += hit.performance; }
        bins.push(hit || { key: k, error: 0, warning: 0, performance: 0, firstLine: null });
    }
    /* atAppStart: draw the green divider only when the left edge genuinely IS the app-start
       window. That needs BOTH a resolved boundary (launchTs > 0) AND the cap not having pushed
       the start past it: on a long app-era session (> TROUBLE_CHART_MAX_BUCKETS windows) the cap
       makes start > realMinKey, so bins[0] is a mid-session window — marking it "app started"
       would be a lie. No boundary (0: attach, pure logcat, not yet streamed) also means no
       app-start to mark. */
    return { bins: bins, maxTotal: maxTotal, intervalMs: intervalMs, totals: totals, atAppStart: launchTs > 0 && start === realMinKey };
}

/* Smallest window key holding an event whose window ENDS after the app-ready boundary — the
   first window the app itself could have produced. null when every event is pre-app. With no
   boundary (launchTs 0: attach, pure logcat, or a boundary not yet streamed) nothing is pre,
   so this is simply the earliest event window and the chart shows the whole span. */
function firstRealWindowKey(byKey, launchTs, intervalMs) {
    var best = null;
    for (var kk in byKey) {
        if (!Object.prototype.hasOwnProperty.call(byKey, kk)) { continue; }
        var kn = +kk;
        var isPre = launchTs > 0 && ((kn + 1) * intervalMs) <= launchTs;
        if (!isPre && (best === null || kn < best)) { best = kn; }
    }
    return best;
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

/* Resolve the chip a legend event landed on and run the level action. Split so click,
   dblclick, and keydown share one lookup. 'solo' focuses the level (double-click); every
   other path toggles it. Guarded — toggleLevel/soloLevel live in the level-filter script. */
function troubleChartChipAction(e, mode) {
    var chip = e.target && e.target.closest ? e.target.closest('.tc-chip') : null;
    if (!chip) { return; }
    var lvl = chip.getAttribute('data-level');
    if (!lvl) { return; }
    if (mode === 'solo' && typeof soloLevel === 'function') { soloLevel(lvl); }
    else if (typeof toggleLevel === 'function') { toggleLevel(lvl); }
}

/* Chips are rebuilt on every legend update, so the listeners are delegated on the stable
   #trouble-chart-legend container. Single-click (or Enter/Space) toggles the level;
   double-click focuses only it — the exact gestures the toolbar dots use, because they call
   the same functions. State stays in sync both ways through enabledLevels/syncLevelDots. */
function wireTroubleChartChips() {
    var legend = document.getElementById('trouble-chart-legend');
    if (!legend) { return; }
    legend.addEventListener('click', function(e) { troubleChartChipAction(e, 'toggle'); });
    legend.addEventListener('dblclick', function(e) { troubleChartChipAction(e, 'solo'); });
    legend.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); troubleChartChipAction(e, 'toggle'); }
    });
}

(function() {
    if (typeof document === 'undefined') { return; }
    var toggle = document.getElementById('trouble-chart-toggle');
    if (toggle) { toggle.addEventListener('click', toggleTroubleChartCollapsed); }
    /* The title toggles too — a larger target than the caret. Only the title span, not the
       whole head: the legend chips beside it own their level-filter click handlers. */
    var chartTitle = document.getElementById('trouble-chart-title');
    if (chartTitle) { chartTitle.addEventListener('click', toggleTroubleChartCollapsed); }
    wireTroubleChartChips();
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
