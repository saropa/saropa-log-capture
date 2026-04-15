/**
 * Insight panel CSS: view-all, recurring, hot files, scope, performance hero, errors, environment.
 */

/** Return CSS for Insight panel section content (view-all, lists, hero, env). */
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
.insight-session-details-hint {
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
.insight-environment-list {
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
.insight-signal-trend-row { cursor: pointer; border-radius: 3px; }
.insight-signal-trend-row:hover { background: var(--vscode-list-hoverBackground); }
/* Severity indicators: critical gets a red left border, high gets orange */
.signal-sev-critical { border-left: 3px solid var(--vscode-errorForeground, #f44); }
.signal-sev-high { border-left: 3px solid var(--vscode-editorWarning-foreground, #fa4); }
/* Recurring badge — small ↻ marker next to the icon */
.signal-recurring-badge { font-size: 10px; opacity: 0.7; margin: 0 1px; }
`;
}
