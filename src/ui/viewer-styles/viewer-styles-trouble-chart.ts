/**
 * Styles for the Trouble Mode severity chart (plan Trouble Mode dashboard, Stage 3).
 *
 * The chart pane sits above the feed and is shown ONLY while Trouble Mode is
 * active — visibility is driven entirely by the `body.slc-trouble-active` class
 * that viewer-trouble-mode.ts already toggles, so the chart script never manages
 * display, only content.
 *
 * The legend swatches and the bar fills share the SAME literal palette as the toolbar's
 * level dots and letters (viewer-styles-level.ts). It is declared once, as three custom
 * properties on .trouble-chart, and read by both — a chip and the bar it counts cannot
 * drift apart. The palette deliberately does NOT use the theme tokens (--accent-critical
 * etc.), which resolve to the host's editor squiggle colors and rendered performance as
 * blue — disagreeing with the purple "P" the toolbar shows two rows above for the same
 * lines. One severity, one color, across the whole viewer: the values still live in two
 * FILES, so when any of the three changes, change it here and in viewer-styles-level.ts.
 * The pane chrome still uses --surface-2 / --border so it reads as a dashboard band
 * separated from the feed by a hairline.
 *
 * Head-row TEXT is pinned to 10px to match .level-letter / .dot-count in the
 * toolbar, not the 11px --text-eyebrow the other pane heads use: this strip sits
 * directly under the toolbar and any size step between them reads as a misalignment.
 * The collapse caret is the sole exception — it is a control, not a label, and is
 * sized from the type scale; the reason lives on its own rule below.
 */
export function getTroubleChartStyles(): string {
    return /* css */ `
/* ===================================================================
   Trouble Mode — live severity chart
   Hidden unless Trouble Mode is active (body.slc-trouble-active).
   =================================================================== */
/* The three severity colors are declared ONCE here, scoped to the chart, and read by both
   the legend swatches and the bar fills below. They are not promoted to the global token
   sheet: the toolbar's own copies (viewer-styles-level.ts) are what they must agree with,
   and a global token would invite call sites that have no business picking a severity color.
   Scoped custom properties, not the --accent-* tokens, for the reason in the header. */
.trouble-chart {
    --tc-error: #f44336;
    --tc-warning: #ff9800;
    --tc-performance: #9c27b0;
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
/* The chips are interactive level filters, not just labels: each toggles its level the way
   the toolbar dots do (single-click toggle, double-click focus), so it takes the dots'
   cursor, hover wash, and inactive dim, and the two controls read as one affordance. */
.trouble-chart .tc-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    padding: 1px 4px;
    border-radius: 4px;
    user-select: none;
    transition: opacity 0.2s ease, background 0.15s ease;
}
.trouble-chart .tc-chip:hover { background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31)); }
.trouble-chart .tc-chip:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }
/* A level removed from enabledLevels — via this chip or its toolbar dot — dims exactly like
   an inactive .level-dot, so both views agree at a glance that the level is hidden. */
.trouble-chart .tc-chip-off { opacity: 0.3; }
.trouble-chart .tc-chip i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.trouble-chart .tc-chip-error i { background: var(--tc-error); }
.trouble-chart .tc-chip-warning i { background: var(--tc-warning); }
.trouble-chart .tc-chip-performance i { background: var(--tc-performance); }
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
    font-size: var(--text-h2);
    letter-spacing: normal;
    transition: transform 0.15s ease;
}
.trouble-chart .tc-toggle:hover { color: var(--fg); }
.trouble-chart.tc-collapsed .tc-toggle { transform: rotate(-90deg); }
/* The title doubles as a collapse target (larger hit area than the caret alone), so it takes
   the caret's pointer + hover. Its own click handler toggles the chart; the legend chips beside
   it keep their separate level-filter handlers, so only the title text — not the whole head —
   is wired. */
.trouble-chart .trouble-chart-title { cursor: pointer; user-select: none; }
.trouble-chart .trouble-chart-title:hover { color: var(--fg); }
/* Collapsed keeps the head — the legend totals are the whole point of a collapsed chart,
   and a chart that vanishes entirely gives the user nothing to click to bring it back. */
.trouble-chart.tc-collapsed .trouble-chart-body { display: none; }
.trouble-chart.tc-collapsed .trouble-chart-head { margin-bottom: 0; }

.trouble-chart-body { position: relative; }

/* Three sides only, and open at the top: the frame reads as a pair of axes plus a baseline,
   whereas closing the top would make it a box and imply a ceiling the bars are measured
   against — they are not, the scale is the running peak and it moves. The baseline belongs
   HERE and not on .trouble-chart-body: .tc-plot wraps the <svg> alone, so the rule lands
   directly under the bars, while the clock labels (.tc-axis, a sibling) stay outside the
   frame where an axis label belongs. */
.trouble-chart .tc-plot {
    position: relative;
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

/* Bars: same three severity colors as the legend swatches above, so a bar and the chip
   counting it can never disagree. A subtle hover lift signals the bar is clickable (it
   scrolls the feed to that window's first row).
   BUG FIX (2026-07-10): this comment used to read "fill from theme tokens so severity
   reads identically to the feed dots / editor squiggles". That was left behind when the
   fills moved off --accent-* — the tokens are exactly what these rules must not use. */
.trouble-chart .tc-bar { cursor: pointer; }
.trouble-chart .tc-bar:hover rect { opacity: 0.75; }
/* Pre-app windows (the device's logcat backlog + build output) are no longer drawn at all —
   the chart starts at the first real event (buildTroubleChartBuckets) so the burst never
   reaches the plot. Excluding those lines from the FEED is the opt-in "warm-up" filter's job,
   not a muted bar here. */
.trouble-chart .tc-bar-error { fill: var(--tc-error); }
.trouble-chart .tc-bar-warning { fill: var(--tc-warning); }
.trouble-chart .tc-bar-performance { fill: var(--tc-performance); }
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
