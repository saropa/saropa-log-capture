/** CSS for the session timeline panel. */
export function getTimelineStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family, sans-serif); font-size: 13px; }
.header { padding: 12px 16px; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-panel-border); }
.title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.subtitle { font-size: 11px; color: var(--vscode-descriptionForeground); }
.stats-bar { display: flex; gap: 16px; padding: 10px 16px; border-bottom: 1px solid var(--vscode-panel-border); flex-wrap: wrap; }
.stat-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.stat-dot.error { background: var(--vscode-editorError-foreground, #f14c4c); }
.stat-dot.warning { background: var(--vscode-editorWarning-foreground, #cca700); }
.stat-dot.performance { background: #b267e6; }
.stat-dot.todo { background: var(--vscode-descriptionForeground); }
.stat-label { color: var(--vscode-descriptionForeground); }
.stat-count { font-weight: 600; }
.timeline-container { padding: 16px; overflow-x: auto; }
.timeline-svg { width: 100%; min-height: 120px; }
.timeline-dot { cursor: pointer; opacity: 0.85; transition: opacity 0.15s; }
.timeline-dot:hover { opacity: 1; stroke: var(--vscode-editor-foreground); stroke-width: 1; }
.empty-state { padding: 32px 16px; text-align: center; color: var(--vscode-disabledForeground); font-style: italic; }
.no-timestamps { padding: 32px 16px; text-align: center; color: var(--vscode-editorWarning-foreground); }
.axis-label { font-size: 10px; fill: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family, monospace); }
.axis-line { stroke: var(--vscode-panel-border); stroke-width: 1; }
.legend { display: flex; gap: 12px; padding: 8px 16px; font-size: 11px; color: var(--vscode-descriptionForeground); }
.legend-item { display: flex; align-items: center; gap: 4px; }
`;
}
