/**
 * CSS styles for the Insight panel — single-scroll unified view (Unified Insight Model).
 * Accordion sections; no tabs. Reuses session-investigation and recurring card classes.
 */

/** Return CSS for the Insight panel and accordion sections. */
export function getInsightPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Insight Panel — single scroll (Cases, Recurring, Hot files, Performance)
   =================================================================== */
.insight-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.insight-panel.visible {
    display: flex;
}

.insight-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}

.insight-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 3px;
}

.insight-panel-close:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.insight-panel-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 8px 8px;
}

/* Accordion sections */
.insight-section {
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 4px;
}

.insight-section:last-child {
    border-bottom: none;
}

.insight-section-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: none;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 4px;
    text-align: left;
    transition: background 0.12s ease, color 0.12s ease;
}

.insight-section-header:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.15));
    color: var(--vscode-foreground);
}

.insight-section-emoji {
    margin-right: 6px;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
}

.insight-section-title {
    flex: 1;
}

.insight-section-toggle {
    width: 16px;
    height: 16px;
    opacity: 0.7;
    transition: transform 0.15s ease;
}

.insight-section-toggle::before {
    content: "\\25BC";
    font-size: 10px;
}

.insight-section-header.expanded .insight-section-toggle {
    transform: rotate(0deg);
}

.insight-section-header:not(.expanded) .insight-section-toggle {
    transform: rotate(-90deg);
}

.insight-section-body {
    padding: 4px 0 12px;
    overflow: hidden;
}

.insight-section .session-investigations {
    flex: 0 0 auto;
}

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

/* Inline add-to-case button on recurring cards */
.re-add-to-case {
    margin-right: 4px;
    font-weight: bold;
    cursor: pointer;
}

.re-add-to-case:hover {
    text-decoration: underline;
}

/* Embedded performance panel inside Insight */
.insight-hero-block {
    padding-bottom: 6px;
    padding-left: 8px;
    margin-left: -8px;
    border-left: 3px solid transparent;
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 4px;
}

.insight-hero-block.insight-hero-has-errors {
    border-left-color: var(--vscode-errorForeground, #f14c4c);
}

.insight-hero-block.insight-hero-has-warnings {
    border-left-color: var(--vscode-editorWarning-foreground, #cca700);
}

.insight-hero-block.insight-hero-has-errors.insight-hero-has-warnings {
    border-left-color: var(--vscode-errorForeground, #f14c4c);
}

.insight-section-session-details .performance-panel {
    display: flex !important;
    min-width: 0;
    border: none;
    box-shadow: none;
    background: transparent;
}

.insight-section-session-details .performance-panel-header {
    padding: 4px 0 8px;
}

.insight-section-session-details .pp-close {
    display: none;
}
`;
}
