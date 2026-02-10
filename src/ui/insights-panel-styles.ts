/** CSS styles for the cross-session insights panel. */
export function getInsightsStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-font-family, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    padding: 0;
}
.header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    position: sticky; top: 0; z-index: 10;
}
.header-left { display: flex; flex-direction: column; gap: 2px; }
.title { font-size: 14px; font-weight: 600; }
.summary { font-size: 11px; color: var(--vscode-descriptionForeground); }
.header-right { display: flex; align-items: center; gap: 6px; }
.time-range-select {
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 3px; padding: 3px 6px;
    font-size: 11px; cursor: pointer;
}
.refresh-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; border-radius: 3px;
    padding: 4px 10px; cursor: pointer; font-size: 11px;
}
.refresh-btn:hover { background: var(--vscode-button-hoverBackground); }
.content { padding: 8px 16px; }
.section { margin-bottom: 12px; }
.section-header {
    font-weight: 600; cursor: pointer;
    padding: 6px 0; font-size: 13px;
    list-style: none;
}
.section-header::-webkit-details-marker { display: none; }
.section-header::before {
    content: '\\25B6'; display: inline-block; width: 16px;
    font-size: 10px; transition: transform 0.15s;
}
details[open] > .section-header::before { transform: rotate(90deg); }
.count {
    font-weight: normal; font-size: 11px;
    color: var(--vscode-descriptionForeground); margin-left: 6px;
}
.hot-file, .error-group {
    padding: 6px 8px; margin: 2px 0; border-radius: 3px; cursor: pointer;
    border: 1px solid transparent;
}
.hot-file:hover, .error-group:hover {
    background: var(--vscode-list-hoverBackground);
    border-color: var(--vscode-list-hoverForeground, transparent);
}
.file-row { display: flex; align-items: center; gap: 6px; }
.file-name { flex: 1; font-family: var(--vscode-editor-font-family, monospace); }
.session-count {
    font-size: 11px; color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}
.error-text {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    color: var(--vscode-errorForeground);
}
.error-meta {
    font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px;
}
.empty-state {
    padding: 8px 0; font-style: italic;
    color: var(--vscode-descriptionForeground);
}
.loading {
    display: flex; align-items: center; justify-content: center;
    height: 200px; color: var(--vscode-descriptionForeground);
}
.production-badge {
    display: inline-block; font-size: 11px; margin-top: 2px;
    color: var(--vscode-debugConsole-warningForeground, #ff9800);
}
.production-loading {
    font-size: 11px; padding: 4px 8px; font-style: italic;
    color: var(--vscode-descriptionForeground);
    animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.error-closed { opacity: 0.5; }
.error-actions { display: flex; gap: 4px; margin-top: 3px; }
.err-action {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none; padding: 1px 8px; cursor: pointer;
    border-radius: 2px; font-size: 11px;
}
.err-action:hover { background: var(--vscode-button-secondaryHoverBackground); }
`;
}
