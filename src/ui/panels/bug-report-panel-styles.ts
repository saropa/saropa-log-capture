/** CSS styles for the bug report preview panel. */
export function getBugReportStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-font-family, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    padding: 16px; line-height: 1.5;
}
h1 { font-size: 1.4em; margin-bottom: 4px; }
h2 { font-size: 1.1em; margin-top: 16px; margin-bottom: 6px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
pre {
    background: var(--vscode-textCodeBlock-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 3px; padding: 8px; overflow-x: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.9em; white-space: pre-wrap; word-break: break-all;
}
table { border-collapse: collapse; width: 100%; margin: 4px 0; }
th, td {
    border: 1px solid var(--vscode-panel-border);
    padding: 4px 8px; text-align: left; font-size: 0.9em;
}
th { background: var(--vscode-sideBar-background); font-weight: 600; }
.meta { font-size: 0.85em; color: var(--vscode-descriptionForeground); }
.toolbar {
    display: flex; gap: 8px; margin: 12px 0; position: sticky; top: 0;
    background: var(--vscode-editor-background); padding: 4px 0; z-index: 10;
}
.toolbar button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; border-radius: 3px; padding: 4px 10px;
    cursor: pointer; font-size: 0.85em;
}
.toolbar button:hover { background: var(--vscode-button-hoverBackground); }
.loading {
    display: flex; align-items: center; justify-content: center;
    height: 200px; color: var(--vscode-descriptionForeground);
}
hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 16px 0; }
p { margin: 4px 0; }
strong { font-weight: 600; }
code { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.9em; background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 2px; }
ul { padding-left: 20px; margin: 4px 0; }
`;
}
