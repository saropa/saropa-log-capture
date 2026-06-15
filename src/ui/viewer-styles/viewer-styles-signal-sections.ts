/**
 * Signal panel CSS: view-all, recurring, hot files, scope, performance hero, errors, environment.
 */

/** Return CSS for Signal panel section content (view-all, lists, hero, env). */
export function getSignalSectionsStyles(): string {
    return /* css */ `

.signal-view-all {
    margin: var(--space-1) 0;
    font-size: 12px;
}

.signal-view-all span {
    color: var(--vscode-textLink-foreground, var(--link));
    cursor: pointer;
}

.signal-view-all span:hover {
    text-decoration: underline;
}

.signal-recurring-inner,
.signal-section-body .recurring-list-inner {
    min-height: 0;
}

.signal-recurring-footer {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--vscode-panel-border);
    font-size: 12px;
}

.signal-recurring-footer .recurring-footer-action {
    color: var(--vscode-textLink-foreground, var(--link));
    cursor: pointer;
}

.signal-recurring-footer .recurring-footer-action:hover {
    text-decoration: underline;
}

/* Hot files list */
.signal-hotfiles-list {
    font-size: 12px;
}

.signal-hotfile-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--vscode-panel-border);
    gap: 6px;
}

.signal-hotfile-add {
    flex-shrink: 0;
}

.signal-hotfile-item:last-child {
    border-bottom: none;
}

.signal-hotfile-name {
    font-family: var(--vscode-editor-font-family);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.signal-hotfile-meta {
    color: var(--vscode-descriptionForeground);
    flex-shrink: 0;
    margin-left: var(--space-2);
}

.signal-hotfiles-empty {
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    margin: 0;
}

/* Scope label (Current log: filename) */
.signal-scope-label {
    font-size: var(--text-caption);
    color: var(--vscode-descriptionForeground);
    margin-bottom: 6px;
}

/* Compact Performance hero (Errors / Warnings / Snapshot counts, then the trend sparkline).
   flex-wrap lets the count block and the sparkline drop to separate lines on a narrow panel as
   whole blocks, instead of the old single non-wrapping row that forced the metrics to break mid-item
   (emoji stranded above its count, "512 MB free" on its own line). */
.signal-performance-hero {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) 14px;
    font-size: var(--text-caption);
    color: var(--vscode-descriptionForeground);
    margin-bottom: var(--space-2);
}

.signal-hero-sparkline-wrap {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.signal-hero-sparkline-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}

.signal-hero-sparkline {
    display: block;
    /* Trend line uses the host chart-blue; --accent-info is the closest token
       (the info/blue role) for the fallback when the chart color is absent. */
    stroke: var(--vscode-charts-blue, var(--accent-info));
}

.signal-hero-metrics {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 12px;
    min-width: 0;
}

/* Each count (🔴 Errors: 7 / 🟡 Warnings: 3 / Snapshot: 512 MB free) is one nowrap unit so it never
   breaks internally; the metrics container wraps between units instead. */
.signal-hero-metric {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    white-space: nowrap;
}

.signal-hero-hint {
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.9;
}

/* Errors in this log: cap height and scroll */
.signal-errors-in-log-list {
    max-height: 180px;
    overflow-y: auto;
}

/* Session details one-line hint */
.signal-session-details-hint {
    font-size: var(--text-caption);
    color: var(--vscode-descriptionForeground);
    margin: 0 0 var(--space-2) 0;
}

/* This log: single empty state when no errors and no recurring */
.signal-this-log-empty {
    margin-bottom: var(--space-2);
}

.signal-this-log-content {
    /* wrapper for errors + recurring blocks */
}

/* Narrative blocks (grouped content within one section) */
.signal-narrative-block {
    margin-bottom: var(--space-3);
}

.signal-narrative-block:last-child {
    margin-bottom: 0;
}

.signal-narrative-subtitle {
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    margin-bottom: var(--space-1);
}

/* Recurring in this log (inside This log section) */
.signal-section-this-log .recurring-list-inner {
    min-height: 0;
}

/* Environment section */
.signal-environment-list {
    font-size: 12px;
}

.signal-env-group {
    margin-bottom: var(--space-2);
}

.signal-env-title {
    font-weight: 600;
    margin-bottom: var(--space-1);
    color: var(--vscode-foreground);
}

.signal-env-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 0;
}

.signal-env-row span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* The label cell takes the slack and truncates so the meta + action cluster hold a stable right
   column. Scoped to signal rows so the shared env / hot-file / co-occurrence rows keep their layout. */
.signal-trend-row > span:first-child,
.signal-in-log-row > span:first-child { flex: 1 1 auto; min-width: 0; }

/* On a tight panel the verbose meta ("6 sessions, 23 total [fatal]") must NOT swallow the row and
   collapse the label to nothing — the label is what the signal IS, the meta is secondary. Cap the
   meta at half the row and let it truncate so the label always keeps the other half. The shared base
   .signal-hotfile-meta is flex-shrink:0; this higher-specificity rule overrides it for signal rows. */
.signal-trend-row > .signal-hotfile-meta,
.signal-in-log-row > .signal-hotfile-meta {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Row action buttons (Copy / Close / Mute / DA / Rule) are grouped into one cluster and hidden until
   the row is hovered or keyboard-focused. Before this they were loose inline siblings — always
   visible, ragged at different widths per row, and crowding/overlapping the meta text on a narrow
   panel. Hover-reveal (same idiom as the Crashlytics archive button) keeps the resting row clean
   (icon · label · meta) and gives one aligned action cluster; focus-within keeps them keyboard
   reachable. Width stays reserved so revealing causes no layout shift. */
.signal-row-actions {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    flex: 0 0 auto;
    margin-left: var(--space-1);
    opacity: 0;
    transition: opacity 0.12s ease;
}
.signal-trend-row:hover .signal-row-actions,
.signal-in-log-row:hover .signal-row-actions,
.signal-row-actions:focus-within { opacity: 1; }
/* Transient highlight when a deep-link (saropaLogCapture.openSignal) scrolls to a signal,
   so the user sees which row the jump landed on. Removed by script after ~2s. */
.signal-focus-flash {
    background: var(--vscode-list-hoverBackground);
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
}

/* Workspace pulse strip (idea #20): a compact one-line trend summary at the top of the panel.
   The left border accent is tinted by tone so the verdict reads before the numbers. Theme tokens
   only, so it tracks light/dark/high-contrast. */
.signal-pulse-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin: var(--space-1) 0 var(--space-2);
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-caption);
    border-left: 2px solid var(--vscode-descriptionForeground);
    background: var(--vscode-editorWidget-background);
    border-radius: var(--radius-sm);
}
.signal-pulse-strip.pulse-tone-improving { border-left-color: var(--vscode-charts-green); }
.signal-pulse-strip.pulse-tone-worsening { border-left-color: var(--vscode-charts-red); }
.signal-pulse-strip .pulse-improving { color: var(--vscode-charts-green); }
.signal-pulse-strip .pulse-worsening { color: var(--vscode-charts-red); }
.signal-pulse-strip .pulse-stable,
.signal-pulse-strip .pulse-velocity { color: var(--vscode-descriptionForeground); }
.signal-pulse-strip .pulse-sep { color: var(--vscode-descriptionForeground); opacity: 0.6; }
`;
}
