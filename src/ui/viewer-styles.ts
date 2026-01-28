/** CSS styles for the log viewer webview. Uses --vscode-* CSS variables for theming. */
export function getViewerStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    overflow-y: auto;
    height: 100vh;
    display: flex;
    flex-direction: column;
}
#log-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}
.line {
    white-space: pre-wrap;
    word-break: break-all;
    padding: 0 8px;
    line-height: 1.5;
}
.line:hover { background: var(--vscode-list-hoverBackground); }
.source-link {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: none;
    cursor: pointer;
}
.source-link:hover { text-decoration: underline; }
.line.cat-stderr {
    color: var(--vscode-debugConsole-errorForeground, #f44);
}
#log-content.nowrap {
    overflow-x: auto;
}
#log-content.nowrap .line,
#log-content.nowrap .stack-header,
#log-content.nowrap .stack-frames .line {
    white-space: pre;
    word-break: normal;
}
.marker {
    border-top: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    border-bottom: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    background: var(--vscode-diffEditor-insertedLineBackground, rgba(40, 167, 69, 0.1));
    color: var(--vscode-editorGutter-addedBackground, #28a745);
    padding: 4px 8px;
    text-align: center;
    font-style: italic;
    line-height: 1.5;
}
.stack-group { margin: 0; }
.stack-header {
    padding: 0 8px;
    cursor: pointer;
    color: var(--vscode-errorForeground, #f44);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    user-select: none;
}
.stack-header:hover { background: var(--vscode-list-hoverBackground); }
.stack-group.collapsed .stack-frames { display: none; }
.stack-frames .line {
    padding-left: 20px;
    color: var(--vscode-descriptionForeground);
}
#jump-btn {
    display: none;
    position: fixed;
    bottom: 32px;
    right: 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10;
}
#jump-btn:hover { background: var(--vscode-button-hoverBackground); }
#footer {
    position: sticky;
    bottom: 0;
    background: var(--vscode-sideBar-background);
    border-top: 1px solid var(--vscode-panel-border);
    padding: 4px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
}
#footer.paused {
    color: var(--vscode-statusBarItem-warningForeground, #fc0);
    background: var(--vscode-statusBarItem-warningBackground, rgba(252, 192, 0, 0.15));
}
#wrap-toggle {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
    margin-left: auto;
}
#filter-select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    font-size: 10px;
    padding: 1px 4px;
    max-width: 120px;
    cursor: pointer;
}
#wrap-toggle:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
#search-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--vscode-sideBar-background);
    border-top: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
#search-input {
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 2px 6px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
}
#search-input:focus { border-color: var(--vscode-focusBorder); }
#match-count {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}
#search-bar button {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
}
#search-bar button:hover { color: var(--vscode-foreground); }
mark {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
    color: inherit;
    border-radius: 2px;
}
.current-match mark {
    background: var(--vscode-editor-findMatchBackground, rgba(255, 150, 50, 0.6));
}
.search-match {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.1));
}
#watch-counts {
    display: flex;
    gap: 4px;
    align-items: center;
}
.watch-chip {
    display: inline-block;
    font-size: 10px;
    padding: 0 5px;
    border-radius: 8px;
    white-space: nowrap;
}
.watch-error {
    background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.2));
    color: var(--vscode-errorForeground, #f44);
}
.watch-warn {
    background: var(--vscode-inputValidation-warningBackground, rgba(255, 204, 0, 0.2));
    color: var(--vscode-editorWarning-foreground, #fc0);
}
@keyframes watch-flash {
    0% { opacity: 1; transform: scale(1.2); }
    100% { opacity: 1; transform: scale(1); }
}
.watch-chip.flash {
    animation: watch-flash 0.4s ease-out;
}
#pinned-section {
    position: sticky;
    top: 0;
    z-index: 5;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    max-height: 30vh;
    overflow-y: auto;
    flex-shrink: 0;
}
.pinned-header {
    font-size: 10px;
    padding: 2px 8px;
    color: var(--vscode-descriptionForeground);
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.pinned-item {
    padding: 0 8px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    display: flex;
    align-items: baseline;
    gap: 4px;
    cursor: pointer;
}
.pinned-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.unpin-btn {
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    flex-shrink: 0;
}
.unpin-btn:hover {
    color: var(--vscode-errorForeground, #f44);
}
.pinned-text {
    flex: 1;
    overflow: hidden;
}
`;
}
