/** CSS for the insights drill-down sub-panel. */
export function getDrillDownStyles(): string {
    return /* css */ `
.drill-down-panel { margin: 4px 0 8px 16px; border-left: 2px solid var(--vscode-panel-border); padding-left: 8px; }
.drill-down-summary { padding: 4px 0; font-size: 11px; color: var(--vscode-descriptionForeground); }
.drill-down-loading { padding: 8px; color: var(--vscode-descriptionForeground); font-style: italic; font-size: 12px; }
.drill-down-empty { padding: 8px; color: var(--vscode-disabledForeground); font-style: italic; font-size: 12px; }
.drill-down-session { margin-bottom: 4px; }
.drill-down-session-name { font-size: 12px; font-weight: 500; color: var(--vscode-textLink-foreground); padding: 2px 0; }
.drill-down-match { display: flex; gap: 8px; padding: 2px 4px; cursor: pointer; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; border-radius: 3px; }
.drill-down-match:hover { background: var(--vscode-list-hoverBackground); }
.drill-down-line-num { color: var(--vscode-editorLineNumber-foreground); min-width: 36px; flex-shrink: 0; }
.drill-down-line-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.error-group { cursor: pointer; }
.error-group .expand-icon { font-size: 10px; margin-right: 4px; display: inline-block; transition: transform 0.15s; }
.error-group.expanded .expand-icon { transform: rotate(90deg); }
`;
}
