/**
 * Insight panel CSS: view-all, recurring, hot files, scope, performance hero, errors, environment.
 */

/** Return CSS for Insight panel section content (view-all, lists, hero, env). */
export function getInsightSectionsStyles(): string {
    return /* css */ `

.insight-view-all {
    margin: 4px 0;
    font-size: 12px;
}

.insight-view-all span {
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
}

.insight-view-all span:hover {
    text-decoration: underline;
}

.insight-recurring-inner,
.insight-section-body .recurring-list-inner {
    min-height: 0;
}

.insight-recurring-footer {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--vscode-panel-border);
    font-size: 12px;
}

.insight-recurring-footer .recurring-footer-action {
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
}

.insight-recurring-footer .recurring-footer-action:hover {
    text-decoration: underline;
}

/* Hot files list */
.insight-hotfiles-list {
    font-size: 12px;
}

.insight-hotfile-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid var(--vscode-panel-border);
    gap: 6px;
}

.insight-hotfile-add {
    flex-shrink: 0;
}

.insight-hotfile-item:last-child {
    border-bottom: none;
}

.insight-hotfile-name {
    font-family: var(--vscode-editor-font-family);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.insight-hotfile-meta {
    color: var(--vscode-descriptionForeground);
    flex-shrink: 0;
    margin-left: 8px;
}

.insight-hotfiles-empty {
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    margin: 0;
}

/* Scope label (Current log: filename) */
.insight-scope-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 6px;
}

/* Compact Performance hero (sparkline + Errors · Warnings · Snapshot) */
.insight-performance-hero {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 8px;
}

.insight-hero-sparkline-wrap {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.insight-hero-sparkline-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}

.insight-hero-sparkline {
    display: block;
    stroke: var(--vscode-charts-blue, #3794ff);
}

.insight-hero-metrics {
    min-width: 0;
}

.insight-hero-hint {
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.9;
}

/* Errors in this log: cap height and scroll */
.insight-errors-in-log-list {
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
.insight-this-log-empty {
    margin-bottom: 8px;
}

.insight-this-log-content {
    /* wrapper for errors + recurring blocks */
}

/* Narrative blocks (grouped content within one section) */
.insight-narrative-block {
    margin-bottom: 12px;
}

.insight-narrative-block:last-child {
    margin-bottom: 0;
}

.insight-narrative-subtitle {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
}

/* Recurring in this log (inside This log section) */
.insight-section-this-log .recurring-list-inner {
    min-height: 0;
}

/* Environment section */
.insight-environment-list {
    font-size: 12px;
}

.insight-env-group {
    margin-bottom: 8px;
}

.insight-env-title {
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--vscode-foreground);
}

.insight-env-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 0;
}

.insight-env-row span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
`;
}
