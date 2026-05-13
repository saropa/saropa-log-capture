/**
 * Signal panel CSS: view-all, recurring, hot files, scope, performance hero, errors, environment.
 */

/** Return CSS for Signal panel section content (view-all, lists, hero, env). */
export function getSignalSectionsStyles(): string {
    return /* css */ `

.signal-view-all {
    margin: 4px 0;
    font-size: 12px;
}

.signal-view-all span {
    color: var(--vscode-textLink-foreground, #3794ff);
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
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--vscode-panel-border);
    font-size: 12px;
}

.signal-recurring-footer .recurring-footer-action {
    color: var(--vscode-textLink-foreground, #3794ff);
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
    padding: 4px 0;
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
    margin-left: 8px;
}

.signal-hotfiles-empty {
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    margin: 0;
}

/* Scope label (Current log: filename) */
.signal-scope-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 6px;
}

/* Compact Performance hero (sparkline + Errors · Warnings · Snapshot) */
.signal-performance-hero {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 8px;
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
    stroke: var(--vscode-charts-blue, #3794ff);
}

.signal-hero-metrics {
    min-width: 0;
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
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 8px 0;
}

/* This log: single empty state when no errors and no recurring */
.signal-this-log-empty {
    margin-bottom: 8px;
}

.signal-this-log-content {
    /* wrapper for errors + recurring blocks */
}

/* Narrative blocks (grouped content within one section) */
.signal-narrative-block {
    margin-bottom: 12px;
}

.signal-narrative-block:last-child {
    margin-bottom: 0;
}

.signal-narrative-subtitle {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
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
    margin-bottom: 8px;
}

.signal-env-title {
    font-weight: 600;
    margin-bottom: 4px;
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

/* Signal trend rows — clickable to open the most recent matching session */
.signal-signal-trend-row { cursor: pointer; border-radius: 3px; }
.signal-signal-trend-row:hover { background: var(--vscode-list-hoverBackground); }
/* Severity indicators: critical gets a red left border, high gets orange */
.signal-sev-critical { border-left: 3px solid var(--vscode-errorForeground, #f44); }
.signal-sev-high { border-left: 3px solid var(--vscode-editorWarning-foreground, #fa4); }
/* Recurring badge — small ↻ marker next to the icon */
.signal-recurring-badge { font-size: 10px; opacity: 0.7; margin: 0 1px; }
/* Trend arrows — ↑ increasing (red), ↓ decreasing (green), — stable (muted) */
.signal-trend-up { font-size: 10px; color: var(--vscode-editorError-foreground, #f44); margin: 0 1px; }
.signal-trend-down { font-size: 10px; color: var(--vscode-testing-iconPassed, #4a4); margin: 0 1px; }
.signal-trend-stable { font-size: 10px; opacity: 0.5; margin: 0 1px; }
/* Jumpable signal rows — cursor pointer and hover highlight to indicate clickability */
.signal-jumpable { cursor: pointer; }
.signal-jumpable:hover { background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04)); }

/* Fu7: time-window filter chips. Compact row of buttons above the signals list — the active
   chip gets the editor-foreground border so it reads as pressed without needing a fill change. */
.signal-tw-filter {
    display: flex;
    gap: 4px;
    margin: 4px 0 6px;
    flex-wrap: wrap;
}
.signal-tw-chip {
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 10px;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
    line-height: 1.4;
}
.signal-tw-chip:hover {
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
}
.signal-tw-chip-active {
    border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground, #3794ff));
    background: var(--vscode-list-activeSelectionBackground, transparent);
    color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
}

/* Fu3: inline evidence preview under a signal title. Three compact lines of raw log text so the
   user can verify what the signal is pointing at without clicking through. Width is constrained
   so long lines truncate rather than push the meta column out of the row. */
.signal-evidence-preview {
    width: 100%;
    margin-top: 3px;
    padding-left: 18px;
    font-size: 11px;
    opacity: 0.75;
    line-height: 1.35;
}
.signal-evidence-line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--vscode-descriptionForeground, var(--vscode-foreground));
}
/* Force the row to wrap so the preview drops below the icon/meta cells instead of breaking flex. */
.signal-in-log-row { flex-wrap: wrap; }

/* Fu2: scroll-lock pulse. Brief highlight on lines around the jump target so the eye lands on
   the right place. Keyframes fade in then out so the cue is clearly transient — no leftover
   visual debt. Cleanup is by JS class-remove on animationend (see part-d). */
@keyframes saropaLinePulse {
    0%   { background-color: transparent; }
    25%  { background-color: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 179, 8, 0.3)); }
    100% { background-color: transparent; }
}
.line-pulse {
    animation: saropaLinePulse 900ms ease-in-out 1;
}
`;
}
