/**
 * Trouble Mode severity chart — the string/DOM builders (bars, legend, axes).
 *
 * Split out of viewer-trouble-chart.ts purely to hold the 300-line file limit; its script text
 * is concatenated between the launch scan and the chart's own body, so all three share the same
 * webview page scope. These functions read the geometry constants, the clock helpers, and
 * troubleChartSelectedTs from that shared scope (defined in viewer-trouble-chart.ts) and are
 * called back from renderTroubleChart there — the concatenation makes them one program.
 */

/** Embedded webview JavaScript: the Trouble Mode chart's bar, legend, and axis builders. */
export function getTroubleChartRenderScript(): string {
    return /* javascript */ `
/* Draw one stacked bar. Error sits on the baseline, warning above it, performance on
   top. A non-zero count clamps to a per-level minimum so a single event is legible; error
   takes a LARGER floor (TROUBLE_CHART_MIN_ERROR) than warning/performance so even one error
   reads clearly under a tall performance stack — in triage a single error must not vanish
   into a 3px sliver at the baseline. Every segment is also clamped to the plot height so a
   spike scaled past the viewBox saturates at the top instead of drawing above it, where the
   SVG would cut it off. */
function troubleChartStackRects(bin, geom, scale) {
    var segs = [
        { cls: 'tc-bar-error', n: bin.error, min: TROUBLE_CHART_MIN_ERROR },
        { cls: 'tc-bar-warning', n: bin.warning, min: TROUBLE_CHART_MIN_BAR },
        { cls: 'tc-bar-performance', n: bin.performance, min: TROUBLE_CHART_MIN_BAR },
    ];
    var y = TROUBLE_CHART_VH;
    var rects = '';
    for (var s = 0; s < segs.length; s++) {
        if (segs[s].n <= 0 || y <= 0) { continue; }
        var h = Math.min(y, Math.max(segs[s].min, segs[s].n * scale));
        y -= h;
        rects += '<rect class="' + segs[s].cls + '" x="' + geom.barX.toFixed(1) + '" y="' + y.toFixed(1)
            + '" width="' + geom.barW.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1"></rect>';
    }
    return rects;
}

/* The selected flag paints a full-height band behind the bar (the row open in the rail). A
   transparent full-CELL hit rect is laid on top when the bar is clickable: the colored bar is
   only ~14px wide inside a wider cell, so clicking the visible bar often landed in the dead
   space beside it and did nothing (the field report: "bars are unclickable"). The hit rect
   makes the whole column jump the feed, while the thin colored bar still reads as the value. */
function troubleChartBar(bin, geom, scale, intervalMs, selected) {
    var rects = troubleChartStackRects(bin, geom, scale);
    if (!rects && !selected) { return ''; }
    var band = selected
        ? '<rect class="tc-selected-band" x="' + geom.cellX.toFixed(1) + '" y="0" width="' + geom.cellW.toFixed(1) + '" height="' + TROUBLE_CHART_VH + '"></rect>'
        : '';
    var lineAttr = (bin.firstLine != null) ? ' data-line="' + (bin.firstLine + 1) + '"' : '';
    var hit = (bin.firstLine != null)
        ? '<rect class="tc-hit" x="' + geom.cellX.toFixed(1) + '" y="0" width="' + geom.cellW.toFixed(1) + '" height="' + TROUBLE_CHART_VH + '"></rect>'
        : '';
    var tip = vt('viewer.troubleChart.barTip', troubleChartClock(bin.key * intervalMs), bin.error, bin.warning, bin.performance);
    return '<g class="tc-bar"' + lineAttr + '><title>' + tip + '</title>' + band + rects + hit + '</g>';
}

/* One legend chip. The chips are not just labels: each is an interactive level filter that
   routes to the SAME toggleLevel/soloLevel the toolbar level pills use, so data-level is
   required for the delegated handler. 'on' (the level is in enabledLevels) drives the inactive
   dim, mirroring .level-dot-group:not(.active). role=button + tabindex + aria-pressed make the control
   keyboard-reachable, which the plain <span> was not. enabledLevels may be undefined in the
   VM test harness (the level-filter script is not loaded there) — default to on. */
function troubleChartChipHtml(level, count) {
    var on = (typeof enabledLevels === 'undefined') || enabledLevels.has(level);
    return '<span class="tc-chip tc-chip-' + level + (on ? '' : ' tc-chip-off')
        + '" data-level="' + level + '" role="button" tabindex="0" aria-pressed="' + (on ? 'true' : 'false')
        + '" title="' + vt('viewer.troubleChart.chip.title') + '"><i></i>'
        + vt('viewer.troubleChart.legend.' + level, count) + '</span>';
}

/* Per-level totals for the whole charted span, as clickable colored chips in the pane head.
   Without them a stacked bar's colors are unlabeled and the chart is decoration; making them
   clickable turns the same colors into a level filter paired with the toolbar dots. */
function renderTroubleChartLegend(totals) {
    var el = document.getElementById('trouble-chart-legend');
    if (!el) { return; }
    var levels = ['error', 'warning', 'performance'];
    var html = '';
    for (var i = 0; i < levels.length; i++) {
        html += troubleChartChipHtml(levels[i], totals[levels[i]]);
    }
    el.innerHTML = html;
}

/* Live-sync each chip's on/off dim from enabledLevels WITHOUT rebuilding the legend, so a
   level toggled from a toolbar dot dims its chip immediately (syncLevelDots calls this), and
   the chip's own click — which routes through toggleLevel → syncLevelDots — comes straight
   back here. The chart and the toolbar are two views of one enabledLevels set, never two. */
function syncTroubleChartChips() {
    if (typeof document === 'undefined') { return; }
    var el = document.getElementById('trouble-chart-legend');
    if (!el) { return; }
    var chips = el.querySelectorAll('.tc-chip');
    for (var i = 0; i < chips.length; i++) {
        var lvl = chips[i].getAttribute('data-level');
        if (!lvl) { continue; }
        var on = (typeof enabledLevels === 'undefined') || enabledLevels.has(lvl);
        chips[i].classList.toggle('tc-chip-off', !on);
        chips[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
}

/* Peak count, in the head row beside the title. It lived pinned inside the plot's
   top-left corner until the tallest bar — the device-startup warning rush, which
   always lands in the leading window — drew straight over it. An overlapped number is
   worse than none, and the head costs the feed no extra height. (The plot now also carries
   the peak as its y-axis top scale mark via tc-ymax — an HTML chip with a background, so a
   tall bar rising under it stays legible; this head copy survives collapse, when there is no
   plot to read it from.) */
function renderTroubleChartPeak(maxTotal) {
    var el = document.getElementById('trouble-chart-peak');
    if (!el) { return; }
    el.textContent = maxTotal > 0 ? vt('viewer.troubleChart.peak', maxTotal) : '';
}

/* Evenly spaced HH:MM labels across the strip. The windows are contiguous keys, so bin index
   maps linearly to x and the label at fraction f names the window sitting at that fraction. The
   spans are laid out by the flex axis rule (first left, last right, the rest spread between). */
function troubleChartAxisTicks(bins, intervalMs) {
    var n = bins.length;
    var count = Math.min(TROUBLE_CHART_AXIS_TICKS, n);
    var labels = '';
    for (var t = 0; t < count; t++) {
        var frac = count <= 1 ? 0 : t / (count - 1);
        var idx = Math.round(frac * (n - 1));
        labels += '<span>' + troubleChartClockHM(bins[idx].key * intervalMs) + '</span>';
    }
    return labels;
}

/* The strip's SVG plus the two axes. Labels are HTML, never SVG <text>: the viewBox is drawn
   with preserveAspectRatio="none", which would stretch glyphs. The y-axis carries the peak
   count as its top scale mark (tc-ymax, an HTML chip over the plot so a tall bar cannot draw
   through it the way an SVG label would); the x-axis carries evenly spaced HH:MM ticks. */
function troubleChartPlotHtml(bars, data) {
    return '<div class="tc-plot">'
        + '<span class="tc-ymax">' + data.maxTotal + '</span>'
        + '<svg class="tc-svg" viewBox="0 0 ' + TROUBLE_CHART_VW + ' ' + TROUBLE_CHART_VH
        + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' + bars + '</svg></div>'
        + '<div class="tc-axis">' + troubleChartAxisTicks(data.bins, data.intervalMs) + '</div>';
}

/* Lay the bins across the fixed viewBox width and stack each one. Split out of
   renderTroubleChart purely to keep both under the 30-line function limit. When the strip has
   been trimmed to the app era (data.atAppStart), a green divider is drawn at the left edge FIRST,
   under the bars, marking where the app session started and the start point was reset — the
   burst before it fell away here on purpose, not by accident. */
function troubleChartBarsHtml(data) {
    var n = data.bins.length;
    var cellW = TROUBLE_CHART_VW / n;
    var barW = Math.min(cellW * 0.7, 14);
    var scale = (TROUBLE_CHART_VH - TROUBLE_CHART_TOP_PAD) / data.maxTotal;
    var selectedKey = troubleChartSelectedTs > 0 ? Math.floor(troubleChartSelectedTs / data.intervalMs) : null;
    var bars = data.atAppStart
        ? '<rect class="tc-app-start" x="0" y="0" width="5" height="' + TROUBLE_CHART_VH + '"></rect>'
        : '';
    for (var i = 0; i < n; i++) {
        var cellX = i * cellW;
        var geom = { cellX: cellX, cellW: cellW, barX: cellX + (cellW - barW) / 2, barW: barW };
        bars += troubleChartBar(data.bins[i], geom, scale, data.intervalMs, data.bins[i].key === selectedKey);
    }
    return bars;
}
`;
}
