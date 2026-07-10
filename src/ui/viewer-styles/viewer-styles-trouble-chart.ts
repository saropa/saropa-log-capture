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

.trouble-chart-head {
    font-size: var(--text-eyebrow);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin-bottom: var(--space-1);
}

.trouble-chart-body { position: relative; }

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

.trouble-chart .tc-empty {
    font-size: var(--text-caption);
    color: var(--muted);
    padding: var(--space-3) 0;
    text-align: center;
}
`;
}
