/** CSS for session info prefix line and slide-out info panel. */
export function getInfoPanelStyles(): string {
    return /* css */ `
/* ===================================================================
   Session Info — compact prefix line + slide-out panel
   =================================================================== */
.session-info-prefix {
    padding: 3px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    border-bottom: 1px solid var(--vscode-panel-border);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
}

/* --- Info panel (slide-out, same pattern as session/options panels) --- */
.info-panel {
    position: fixed;
    left: -100%;
    top: 0;
    bottom: 0;
    width: 25%;
    min-width: 240px;
    max-width: 360px;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    transition: left 0.15s ease;
    z-index: 240;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: none;
}
.info-panel.visible {
    left: var(--icon-bar-width, 36px);
    pointer-events: auto;
}
.info-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.info-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}
.info-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
}
.info-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
}
.info-panel-empty { font-size: 12px; color: var(--vscode-descriptionForeground); text-align: center; padding: 16px 0; }
.session-info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
}
.session-info-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 11px;
    line-height: 1.4;
}
.session-info-key {
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
    min-width: 100px;
    flex-shrink: 0;
}
.session-info-value {
    color: var(--vscode-foreground);
    word-break: break-word;
}
`;
}
