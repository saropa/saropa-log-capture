/**
 * CSS styles for the Performance slide-out panel.
 * Follows the same fixed-position pattern as other icon-bar panels.
 */
import { getPerformanceDbTabStyles } from './viewer-styles-performance-db';
import { getErrorRateTabStyles } from './viewer-styles-error-rate';

/** Return CSS for the performance panel, groups, chart, and table. */
export function getPerformancePanelStyles(): string {
    return getPerformanceDbTabStyles() + getErrorRateTabStyles() + /* css */ `

/* ===================================================================
   Performance Panel — slide-out
   =================================================================== */
.performance-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--surface-1));
    border-right: 1px solid var(--vscode-sideBar-border, var(--border));
    /* Slide-out drop shadow: use the overlay elevation token (this panel floats
       over the log console), keeping the directional 2px,0 offset structural. */
    box-shadow: var(--shadow-lg);
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
    padding: var(--space-2) var(--space-3);
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--border);
}

.performance-panel-actions { display: flex; align-items: center; gap: var(--space-1); }

.pp-action {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    font-size: 14px;
}

.pp-action:hover {
    color: var(--text);
    /* Hover wash fallback: derive a neutral tint from the foreground when the
       host theme omits a toolbar hover color. */
    background: var(--vscode-toolbar-hoverBackground, color-mix(in srgb, var(--text) 12%, transparent));
}

.pp-close {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 16px;
    cursor: pointer;
    padding: 0 var(--space-1);
}

.pp-close:hover {
    color: var(--vscode-errorForeground, var(--status-bad));
    background: var(--vscode-toolbar-hoverBackground, color-mix(in srgb, var(--text) 12%, transparent));
}

/* --- Tabs --- */
.pp-tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
}

.pp-tab {
    flex: 1;
    padding: 6px 8px;
    text-align: center;
    font-size: var(--text-caption);
    cursor: pointer;
    color: var(--muted);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
}

.pp-tab.active {
    color: var(--text);
    border-bottom-color: var(--vscode-debugConsole-infoForeground, var(--accent-info));
}

.pp-tab:hover { color: var(--text); }

.performance-panel-content { flex: 1; overflow-y: auto; padding: var(--space-1) 0; }

/* --- Current session groups --- */
.pp-group { border-bottom: 1px solid var(--border); }

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
    font-size: 10px;
    opacity: 0.7;
    margin-left: auto;
    color: var(--vscode-debugConsole-infoForeground, var(--accent-info));
}

.pp-group-stats {
    padding: 2px 12px 4px 30px;
    font-size: var(--text-caption);
    opacity: 0.7;
}

.pp-event-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 12px 3px 30px;
    font-size: var(--text-caption);
    cursor: pointer;
    font-family: var(--vscode-editor-font-family, monospace);
}

.pp-event-row:hover { background: var(--vscode-list-hoverBackground); }
.pp-event-metric { color: var(--vscode-debugConsole-infoForeground, var(--accent-info)); }
.pp-event-time { opacity: 0.5; font-size: 10px; }

/* --- Trends table --- */
.pp-trend-table { width: 100%; font-size: var(--text-caption); border-collapse: collapse; }
.pp-trend-table th {
    text-align: left;
    padding: var(--space-1) var(--space-2);
    font-weight: 600;
    border-bottom: 1px solid var(--border);
    font-size: 10px;
    opacity: 0.7;
}

.pp-trend-table td { padding: var(--space-1) var(--space-2); cursor: pointer; }
.pp-trend-table tr:hover td { background: var(--vscode-list-hoverBackground); }
.pp-trend-table tr.pp-selected td { background: var(--vscode-list-activeSelectionBackground); }
.pp-trend-up { color: var(--vscode-debugConsole-errorForeground, var(--accent-critical)); }
.pp-trend-down { color: var(--vscode-terminal-ansiGreen, var(--status-good)); }
.pp-trend-stable { opacity: 0.5; }

/* --- SVG chart --- */
.pp-chart-container {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border);
}

.pp-chart-title { font-size: var(--text-caption); font-weight: 600; margin-bottom: var(--space-1); }
.pp-chart { width: 100%; height: 120px; }
.pp-chart-line { fill: none; stroke: var(--vscode-debugConsole-infoForeground, var(--accent-info)); stroke-width: 2; }
.pp-chart-dot { fill: var(--vscode-debugConsole-infoForeground, var(--accent-info)); }
.pp-chart-axis { stroke: var(--border); stroke-width: 1; }
.pp-chart-label { fill: var(--muted); font-size: 10px; }

/* --- Session tab (snapshot, samples, profiler) --- */
.pp-session-view { padding: var(--space-2) var(--space-3); }
.pp-session-intro {
    margin-bottom: 14px;
    padding: 10px 12px;
    background: var(--vscode-textBlockQuote-background, var(--surface-3));
    border-left: 3px solid var(--vscode-focusBorder, var(--border-strong));
    font-size: 12px;
    color: var(--text);
    line-height: 1.45;
}
.pp-session-intro-line { margin: 0 0 6px 0; }
.pp-session-intro-line:last-child { margin-bottom: 0; }
.pp-session-intro-note { font-size: var(--text-caption); opacity: 0.85; }
.pp-session-block {
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
}
.pp-session-block:last-child { border-bottom: none; margin-bottom: 0; }
.pp-session-title {
    font-size: var(--text-caption);
    font-weight: 600;
    margin-bottom: var(--space-1);
    color: var(--text);
}
.pp-session-value {
    font-size: var(--text-caption);
    color: var(--muted);
    line-height: 1.4;
    white-space: pre-line;
}

/* --- Empty / loading --- */
.pp-empty {
    padding: var(--space-4) var(--space-3);
    font-size: 12px;
    color: var(--muted);
    text-align: center;
}

.pp-loading {
    padding: var(--space-4) var(--space-3);
    font-size: 12px;
    color: var(--muted);
    text-align: center;
    animation: pp-pulse 1.5s ease-in-out infinite;
}

@keyframes pp-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }
`;
}
