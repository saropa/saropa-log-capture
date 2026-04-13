/** CSS for the signal report webview panel. */

export function getSignalReportStyles(): string {
  return /* css */ `
body {
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
    line-height: 1.5;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 12px 16px;
    margin: 0;
}
h1 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 12px;
    display: flex;
    align-items: center;
    gap: 8px;
}
h2 {
    font-size: 14px;
    font-weight: 600;
    margin: 16px 0 8px;
    color: var(--vscode-foreground);
    border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    padding-bottom: 4px;
}
.conf-badge {
    display: inline-block;
    font-size: 12px;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 500;
}
.conf-badge--high {
    background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.15));
    color: var(--vscode-errorForeground, #f48771);
}
.conf-badge--medium {
    background: var(--vscode-inputValidation-warningBackground, rgba(255, 200, 0, 0.15));
    color: var(--vscode-editorWarning-foreground, #cca700);
}
.conf-badge--low {
    background: var(--vscode-badge-background, rgba(128, 128, 128, 0.15));
    color: var(--vscode-descriptionForeground);
}
.section-slot {
    margin: 8px 0;
    min-height: 24px;
}
.section-loading {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    font-size: 12px;
}
.evidence-block {
    margin: 8px 0;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    border-radius: 4px;
    overflow: hidden;
}
.evidence-header {
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    padding: 4px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
}
.evidence-lines {
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: var(--vscode-editor-font-size, 12px);
    line-height: 1.4;
    padding: 0;
    margin: 0;
}
.evidence-line {
    padding: 1px 8px;
    white-space: pre-wrap;
    word-break: break-all;
}
.evidence-line--target {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.25));
    font-weight: 600;
}
.evidence-line-num {
    display: inline-block;
    min-width: 4ch;
    text-align: right;
    margin-right: 8px;
    color: var(--vscode-editorLineNumber-foreground);
    user-select: none;
}
.no-data {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    font-size: 12px;
    padding: 8px 0;
}
details {
    margin: 4px 0;
}
details summary {
    cursor: pointer;
    font-weight: 500;
    padding: 4px 0;
    user-select: none;
}
details summary:hover {
    color: var(--vscode-textLink-foreground);
}
.recommendation {
    padding: 8px 12px;
    margin: 8px 0;
    border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    border-radius: 0 4px 4px 0;
    font-size: 12px;
}
.copy-btn {
    border: 1px solid var(--vscode-button-secondaryBorder, var(--vscode-widget-border));
    border-radius: 2px;
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    font-size: 11px;
    padding: 4px 10px;
    cursor: pointer;
    margin: 8px 0;
}
.copy-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, rgba(90, 93, 94, 0.5));
}
`;
}
