/**
 * CSS styles for the session comparison panel.
 *
 * Provides the complete stylesheet for the side-by-side diff view
 * including the header stats, sync scroll button, split panes,
 * and diff-highlighted lines.
 */
export function getComparisonStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
.stats {
    display: flex;
    gap: 16px;
    font-size: 12px;
}
.stat { display: flex; align-items: center; gap: 4px; }
.unique-a-dot, .unique-b-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}
.unique-a-dot { background: var(--vscode-diffEditor-removedTextBackground, rgba(255, 0, 0, 0.3)); }
.unique-b-dot { background: var(--vscode-diffEditor-insertedTextBackground, rgba(0, 255, 0, 0.3)); }
.sync-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
}
.sync-btn.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.sync-btn:hover {
    background: var(--vscode-button-hoverBackground);
}
.comparison {
    flex: 1;
    display: flex;
    overflow: hidden;
}
.pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.pane-a { border-right: 1px solid var(--vscode-panel-border); }
.pane-header {
    padding: 6px 12px;
    background: var(--vscode-editorGroupHeader-tabsBackground);
    border-bottom: 1px solid var(--vscode-panel-border);
    font-weight: bold;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pane-content {
    flex: 1;
    overflow: auto;
    padding: 4px 0;
}
.line {
    padding: 0 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
}
.line:hover {
    background: var(--vscode-list-hoverBackground);
}
.line.unique-a {
    background: var(--vscode-diffEditor-removedTextBackground, rgba(255, 0, 0, 0.15));
    border-left: 3px solid var(--vscode-diffEditor-removedLineBackground, #ff6b6b);
}
.line.unique-b {
    background: var(--vscode-diffEditor-insertedTextBackground, rgba(0, 255, 0, 0.15));
    border-left: 3px solid var(--vscode-diffEditor-insertedLineBackground, #51cf66);
}
.line.common {
    border-left: 3px solid transparent;
}
`;
}
