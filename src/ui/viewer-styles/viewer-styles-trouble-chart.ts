/**
 * Styles for the Trouble Mode severity chart (plan Trouble Mode dashboard, Stage 3).
 *
 * The chart pane sits above the feed and is shown ONLY while Trouble Mode is
 * active — visibility is driven entirely by the `body.slc-trouble-active` class
 * that viewer-trouble-mode.ts already toggles, so the chart script never manages
 * display, only content.
 *
 * Bar fills are the SAME literal palette as the toolbar's level dots and letters
 * (viewer-styles-level.ts): error #f44336, warning #ff9800, performance #9c27b0.
 * They deliberately do NOT use the theme tokens (--accent-critical etc.), which
 * resolve to the host's editor squiggle colors and rendered performance as blue —
 * disagreeing with the purple "P" the toolbar shows two rows above for the same
 * lines. One severity, one color, across the whole viewer: when any of the three
 * changes, change it in BOTH files. The pane chrome still uses --surface-2 /
 * --border so it reads as a dashboard band separated from the feed by a hairline.
 *
 * Head-row text is pinned to 10px to match .level-letter / .dot-count in the
 * toolbar, not the 11px --text-eyebrow the other pane heads use: this strip sits
 * directly under the toolbar and any size step between them reads as a misalignment.
 */
export function getTroubleChartStyles(): string {
    return /* css */ `
/* ===================================================================
   Trouble Mode — live severity chart
   Hidden unless Trouble Mode is active (body.slc-trouble-active).
   =================================================================== */
.trouble-chart {
    display: none;
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
}
body.slc-trouble-active .trouble-chart { display: block; }

/* Chevron + title + peak on the left, legend chips pushed right. Putting the legend and
   the peak count in the head rather than under/over the strip is what keeps the
   readability additions from costing the feed vertical space — the mode exists to give
   the log MORE room, not less. */
.trouble-chart-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin-bottom: var(--space-1);
}
.trouble-chart .tc-legend { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-left: auto; }
.trouble-chart .tc-chip { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
.trouble-chart .tc-chip i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.trouble-chart .tc-chip-error i { background: #f44336; }
.trouble-chart .tc-chip-warning i { background: #ff9800; }
.trouble-chart .tc-chip-performance i { background: #9c27b0; }
/* Peak sits beside the title, never over the plot: the leading device-startup warning
   spike is the tallest bar in most logs and drew straight through the old overlay label. */
.trouble-chart .tc-peak { font-variant-numeric: tabular-nums; }
.trouble-chart .tc-peak:empty { display: none; }

/* Collapse control. The glyph is a single caret rotated by CSS rather than swapped in
   script, so the button carries no text a translator would have to own.
   It is the ONE thing in this head row that does not take the row's 10px: a caret drawn at
   label size reads as a stray pixel rather than a control, and it is the only affordance
   telling the user the chart can be put away. The row's uppercase letter-spacing is also
   cancelled here — it would push the glyph off the center of its own hit area. */
.trouble-chart .tc-toggle {
    background: none;
    border: none;
    padding: 0 2px;
    margin: 0;
    color: var(--muted);
    cursor: pointer;
    line-height: 1;
    font-size: 15px;
    letter-spacing: normal;
    transition: transform 0.15s ease;
}
.trouble-chart .tc-toggle:hover { color: var(--fg); }
.trouble-chart.tc-collapsed .tc-toggle { transform: rotate(-90deg); }
/* Collapsed keeps the head — the legend totals are the whole point of a collapsed chart,
   and a chart that vanishes entirely gives the user nothing to click to bring it back. */
.trouble-chart.tc-collapsed .trouble-chart-body { display: none; }
.trouble-chart.tc-collapsed .trouble-chart-head { margin-bottom: 0; }

.trouble-chart-body { position: relative; }

/* Three sides only, and open at the top: the frame is read as a pair of axes plus a
   baseline, so closing the top would turn it into a box and imply a ceiling the bars are
   measured against — they are not, the scale is the peak. border-box keeps the two side
   rules inside the strip's width so the bars still span it edge to edge. */
.trouble-chart .tc-plot {
    position: relative;
    box-sizing: border-box;
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
}
/* The strip is a rate over time, so the span it covers must be stated. Only the two
   ends are labeled — interior ticks cannot be placed honestly under
   preserveAspectRatio="none", which stretches the SVG horizontally. */
.trouble-chart .tc-axis {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
}

.trouble-chart .tc-svg {
    display: block;
    width: 100%;
    height: 60px;
}

/* Bars: fill from theme tokens so severity reads identically to the feed dots /
   editor squiggles. A subtle hover lift signals the bar is clickable (scrolls the
   feed to that window's first row). */
.trouble-chart .tc-bar { cursor: pointer; }
.trouble-chart .tc-bar:hover rect { opacity: 0.75; }
/* A window that ended before the app launched: the device's own logcat backlog. It is drawn
   (hiding data is never the answer) but muted and saturated at full height, because it is
   excluded from the peak scale. Muted is the signal that the bar's height is not to scale. */
.trouble-chart .tc-bar-pre rect { opacity: 0.35; }
.trouble-chart .tc-bar-error { fill: #f44336; }
.trouble-chart .tc-bar-warning { fill: #ff9800; }
.trouble-chart .tc-bar-performance { fill: #9c27b0; }
/* The window holding the row currently open in the side rail. A full-height band BEHIND
   the bar, not a stroke on it: preserveAspectRatio="none" stretches the SVG horizontally,
   so any stroke width would render as a thick smear on the vertical edges. */
.trouble-chart .tc-selected-band { fill: var(--brand-glow); }

.trouble-chart .tc-empty {
    font-size: var(--text-caption);
    color: var(--muted);
    padding: var(--space-3) 0;
    text-align: center;
}
`;
}
