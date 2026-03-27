/**
 * Options panel CSS: Integrations screen and Keyboard shortcuts view.
 */

export function getOptionsExtraStyles(): string {
    return /* css */ `

/* ===================================================================
   Integrations screen (dedicated view inside options panel)
   =================================================================== */
.integrations-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}
.integrations-view-hidden {
    display: none !important;
}
.shortcuts-view-hidden {
    display: none !important;
}
.integrations-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--vscode-sideBarTitle-background, var(--vscode-panel-background));
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    font-weight: bold;
    font-size: 13px;
}
.integrations-back {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 4px;
    border-radius: 3px;
    font-size: 14px;
    transition: color 0.15s ease, background 0.15s ease;
}
.integrations-back:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.integrations-title { flex: 1; }
.integrations-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}
.integrations-intro {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.4;
    margin: 0 0 12px 0;
}
.integrations-search-wrapper {
    margin: 0 0 10px 0;
}
.integrations-search-wrapper input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--vscode-input-border, transparent);
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 12px;
}
.integrations-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 4px 8px;
    padding: 10px 0;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(255, 255, 255, 0.1));
    cursor: pointer;
    font-size: 12px;
}
.integrations-row:hover {
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
}
.integrations-row {
    transition: background 0.15s ease;
}
.integrations-row input[type="checkbox"] {
    accent-color: var(--vscode-button-background);
    cursor: pointer;
    flex-shrink: 0;
    margin-top: 2px;
}
.integrations-label {
    font-weight: 600;
    flex: 0 0 auto;
}
.integrations-desc {
    flex: 1 1 100%;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.35;
    margin: 4px 0 0 24px;
}
/* Multi-line ellipsis follows panel width; avoids a fixed character cut-off. */
.integrations-desc-collapsible .integrations-desc-preview {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    overflow: hidden;
}
.integrations-expanded-block .integrations-desc-full {
    display: block;
}
.integrations-desc-toggle {
    display: block;
    margin: 4px 0 0 0;
    border: none;
    background: none;
    color: var(--vscode-textLink-foreground, var(--vscode-focusBorder));
    cursor: pointer;
    font-size: inherit;
    padding: 0;
    text-align: left;
}
.integrations-note {
    margin: 8px 0 0 0;
    font-size: inherit;
    font-weight: inherit;
    font-style: normal;
    color: inherit;
    line-height: inherit;
}
.integrations-perf { }
.integrations-perf-warning {
    margin: 0 3px 0 4px;
}
.integrations-when { }

/* Keyboard shortcuts view */
.shortcuts-h3 {
    font-size: 12px;
    font-weight: 600;
    margin: 16px 0 8px 0;
    color: var(--vscode-foreground);
}
.shortcuts-h3:first-of-type { margin-top: 0; }
.shortcuts-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-bottom: 12px;
}
.shortcuts-table th,
.shortcuts-table td {
    padding: 4px 8px 4px 0;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(255, 255, 255, 0.1));
}
.shortcuts-table th {
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
}
.shortcuts-table kbd {
    font-family: var(--vscode-editor-font-family, var(--monaco-monospace-font));
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--vscode-keybindingLabel-background, rgba(128, 128, 128, 0.2));
    border: 1px solid var(--vscode-keybindingLabel-border, rgba(128, 128, 128, 0.35));
}
`;
}
