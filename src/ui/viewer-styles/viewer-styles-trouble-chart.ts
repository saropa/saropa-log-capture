/**
 * Styles for the Trouble Mode severity chart (plan Trouble Mode dashboard, Stage 3).
 *
 * The chart pane sits above the feed and is shown ONLY while Trouble Mode is
 * active — visibility is driven entirely by the `body.slc-trouble-active` class
 * that viewer-trouble-mode.ts already toggles, so the chart script never manages
 * display, only content.
 *
 * Bar fills come from the design tokens (viewer-styles-tokens.ts) so they resolve
 * against the host theme: errors --accent-critical, warnings --accent-warning,
 * performance --accent-info. The pane chrome uses --surface-2 / --border so it
 * reads as a distinct dashboard band separated from the feed by the hairline.
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

/* Title left, legend chips right (plan 110, Stage 4). Putting the legend in the head
   rather than under the strip is what keeps the readability additions from costing the
   feed vertical space — the mode exists to give the log MORE room, not less. */
.trouble-chart-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: var(--text-eyebrow);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin-bottom: var(--space-1);
}
.trouble-chart .tc-legend { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.trouble-chart .tc-chip { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
.trouble-chart .tc-chip i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.trouble-chart .tc-chip-error i { background: var(--accent-critical); }
.trouble-chart .tc-chip-warning i { background: var(--accent-warning); }
.trouble-chart .tc-chip-performance i { background: var(--accent-info); }

.trouble-chart-body { position: relative; }

.trouble-chart .tc-plot { position: relative; }
/* Peak count pinned inside the plot's top-left corner: it labels the y axis without
   reserving a gutter that would shrink the strip on a narrow sidebar. */
.trouble-chart .tc-ymax {
    position: absolute;
    top: 0;
    left: 0;
    font-size: var(--text-eyebrow);
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
}
/* The strip is a rate over time, so the span it covers must be stated. Only the two
   ends are labeled — interior ticks cannot be placed honestly under
   preserveAspectRatio="none", which stretches the SVG horizontally. */
.trouble-chart .tc-axis {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-eyebrow);
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
.trouble-chart .tc-bar-error { fill: var(--accent-critical); }
.trouble-chart .tc-bar-warning { fill: var(--accent-warning); }
.trouble-chart .tc-bar-performance { fill: var(--accent-info); }
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
