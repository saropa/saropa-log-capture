/**
 * CSS styles for the Performance slide-out panel.
 * Follows the same fixed-position pattern as other icon-bar panels.
 */

/** Return CSS for the performance panel, groups, chart, and table. */
export function getPerformancePanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Performance Panel — slide-out
   =================================================================== */
.performance-panel {
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

.performance-panel.visible {
    display: flex;
}

.performance-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.performance-panel-actions { display: flex; align-items: center; gap: 4px; }

.pp-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.pp-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.pp-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.pp-close:hover { color: var(--vscode-errorForeground, #f44); }

/* --- Tabs --- */
.pp-tabs {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.pp-tab {
    flex: 1;
    padding: 6px 8px;
    text-align: center;
    font-size: 11px;
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
}

.pp-tab.active {
    color: var(--vscode-foreground);
    border-bottom-color: var(--vscode-debugConsole-infoForeground, #b695f8);
}

.pp-tab:hover { color: var(--vscode-foreground); }

.performance-panel-content { flex: 1; overflow-y: auto; padding: 4px 0; }

/* --- Current session groups --- */
.pp-group { border-bottom: 1px solid var(--vscode-panel-border); }

.pp-group-header {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    gap: 6px;
}

.pp-group-header:hover { background: var(--vscode-list-hoverBackground); }
.pp-group-arrow { font-size: 10px; width: 12px; }
.pp-group.pp-collapsed .pp-group-body { display: none; }
.pp-group.pp-collapsed .pp-group-arrow::after { content: '\\25B6'; }
.pp-group:not(.pp-collapsed) .pp-group-arrow::after { content: '\\25BC'; }

.pp-group-count {
    font-size: 0.8em;
    opacity: 0.7;
    margin-left: auto;
    color: var(--vscode-debugConsole-infoForeground, #b695f8);
}

.pp-group-stats {
    padding: 2px 12px 4px 30px;
    font-size: 11px;
    opacity: 0.7;
}

.pp-event-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 12px 3px 30px;
    font-size: 11px;
    cursor: pointer;
    font-family: var(--vscode-editor-font-family, monospace);
}

.pp-event-row:hover { background: var(--vscode-list-hoverBackground); }
.pp-event-metric { color: var(--vscode-debugConsole-infoForeground, #b695f8); }
.pp-event-time { opacity: 0.5; font-size: 10px; }

/* --- Trends table --- */
.pp-trend-table { width: 100%; font-size: 11px; border-collapse: collapse; }
.pp-trend-table th {
    text-align: left;
    padding: 4px 8px;
    font-weight: 600;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 10px;
    opacity: 0.7;
}

.pp-trend-table td { padding: 4px 8px; cursor: pointer; }
.pp-trend-table tr:hover td { background: var(--vscode-list-hoverBackground); }
.pp-trend-table tr.pp-selected td { background: var(--vscode-list-activeSelectionBackground); }
.pp-trend-up { color: var(--vscode-debugConsole-errorForeground, #f48771); }
.pp-trend-down { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
.pp-trend-stable { opacity: 0.5; }

/* --- SVG chart --- */
.pp-chart-container {
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.pp-chart-title { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.pp-chart { width: 100%; height: 120px; }
.pp-chart-line { fill: none; stroke: var(--vscode-debugConsole-infoForeground, #b695f8); stroke-width: 2; }
.pp-chart-dot { fill: var(--vscode-debugConsole-infoForeground, #b695f8); }
.pp-chart-axis { stroke: var(--vscode-panel-border); stroke-width: 1; }
.pp-chart-label { fill: var(--vscode-descriptionForeground); font-size: 9px; }

/* --- Session tab (snapshot, samples, profiler) --- */
.pp-session-view { padding: 8px 12px; }
.pp-session-intro {
    margin-bottom: 14px;
    padding: 10px 12px;
    background: var(--vscode-textBlockQuote-background, rgba(128, 128, 128, 0.15));
    border-left: 3px solid var(--vscode-focusBorder, rgba(128, 128, 128, 0.5));
    font-size: 12px;
    color: var(--vscode-foreground);
    line-height: 1.45;
}
.pp-session-intro-line { margin: 0 0 6px 0; }
.pp-session-intro-line:last-child { margin-bottom: 0; }
.pp-session-intro-note { font-size: 11px; opacity: 0.85; }
.pp-session-block {
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.pp-session-block:last-child { border-bottom: none; margin-bottom: 0; }
.pp-session-title {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--vscode-foreground);
}
.pp-session-value {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.4;
    white-space: pre-line;
}

/* --- Database tab (Drift rollup + timeline) --- */
.pp-db-view { padding: 8px 12px; font-size: 11px; }
.pp-db-empty, .pp-db-note {
    color: var(--vscode-descriptionForeground);
    margin: 8px 0;
    line-height: 1.45;
}
.pp-db-summary {
    margin-bottom: 12px;
    line-height: 1.45;
    color: var(--vscode-foreground);
}
.pp-db-timeline { margin-bottom: 14px; }
.pp-db-timeline-label {
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 6px;
    opacity: 0.85;
}
.pp-db-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 56px;
    padding: 4px 0;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.pp-db-bar-wrap {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.pp-db-bar {
    width: 100%;
    max-width: 10px;
    margin: 0 auto;
    min-height: 2px;
    background: var(--vscode-debugConsole-infoForeground, #b695f8);
    border-radius: 2px 2px 0 0;
    opacity: 0.85;
}
.pp-db-table-title {
    font-size: 10px;
    font-weight: 600;
    margin: 10px 0 6px 0;
    opacity: 0.85;
}
.pp-db-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    font-family: var(--vscode-editor-font-family, monospace);
}
.pp-db-table th {
    text-align: left;
    padding: 4px 6px;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-weight: 600;
    opacity: 0.75;
}
.pp-db-table td {
    padding: 4px 6px;
    border-bottom: 1px solid var(--vscode-panel-border, transparent);
    vertical-align: top;
    word-break: break-all;
}
.pp-db-fp { color: var(--vscode-descriptionForeground); }

/* --- Empty / loading --- */
.pp-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.pp-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    animation: pp-pulse 1.5s ease-in-out infinite;
}

@keyframes pp-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }
`;
}
