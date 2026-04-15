/** CSS for the ecosystem (companion extensions) section of the signal report. */

export function getEcosystemStyles(): string {
    return /* css */ `
/* Companion extensions (ecosystem) section */
.ecosystem-block { margin: 8px 0; }
.ecosystem-block-heading { font-weight: 600; font-size: 12px; margin: 0 0 4px; }
.ecosystem-data { margin: 4px 0; }
.ecosystem-data-row { display: flex; gap: 8px; padding: 2px 0; font-size: 12px; }
.ecosystem-data-label { flex-shrink: 0; min-width: 14ch; color: var(--vscode-descriptionForeground); font-weight: 500; }
.ecosystem-data-value { word-break: break-all; }
.ecosystem-status { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 0; color: var(--vscode-descriptionForeground); }
.ecosystem-status-icon { color: var(--vscode-testing-iconPassed, #73c991); font-weight: 700; }
.ecosystem-prompt {
    padding: 8px 12px;
    margin: 4px 0;
    border: 1px dashed var(--vscode-widget-border, rgba(128, 128, 128, 0.4));
    border-radius: 4px;
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    font-size: 12px;
}
.ecosystem-prompt-label { font-weight: 600; display: block; margin-bottom: 2px; }
.ecosystem-prompt-benefit { display: block; color: var(--vscode-descriptionForeground); margin-bottom: 6px; }
.ecosystem-prompt-link {
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
    text-decoration: none;
    font-weight: 500;
}
.ecosystem-prompt-link:hover { text-decoration: underline; }
`;
}
