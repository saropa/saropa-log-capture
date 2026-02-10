/**
 * CSS styles for the Find in Files slide-out panel.
 * Follows the same fixed-position pattern as the session and search panels.
 */

/** Return CSS for the find panel and its result items. */
export function getFindPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Find Panel — slide-out (same pattern as session panel)
   =================================================================== */
.find-panel {
    position: fixed;
    left: -100%;
    top: 0;
    bottom: 0;
    width: 25%;
    min-width: 280px;
    max-width: 400px;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    transition: left 0.3s ease;
    z-index: 240;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: none;
}

.find-panel.visible {
    left: var(--icon-bar-width, 36px);
    pointer-events: auto;
}

.find-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.find-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.find-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
}

/* --- Search input row --- */
.find-input-wrapper {
    display: flex;
    align-items: center;
    margin: 8px 12px;
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px;
    background: var(--vscode-input-background, #1e1e1e);
    overflow: hidden;
}

.find-input-wrapper:focus-within {
    border-color: var(--vscode-focusBorder, #007acc);
}

.find-input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--vscode-input-foreground, inherit);
    font-size: 12px;
    padding: 4px 8px;
    outline: none;
    min-width: 0;
}

.find-input-actions {
    display: flex;
    gap: 2px;
    padding: 0 4px;
}

.find-input-actions .search-input-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.find-input-actions .search-input-btn:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.find-input-actions .search-input-btn.active {
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    border-color: var(--vscode-focusBorder);
}

/* --- Summary and result list --- */
.find-summary {
    padding: 4px 12px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

.find-results {
    flex: 1;
    overflow-y: auto;
}

.find-result-item {
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 12px;
}

.find-result-item:hover {
    background: var(--vscode-list-hoverBackground);
}

.find-result-item.active {
    background: var(--vscode-list-activeSelectionBackground, rgba(4, 57, 94, 0.5));
    color: var(--vscode-list-activeSelectionForeground, inherit);
}

.find-result-item .codicon {
    font-size: 14px;
    flex-shrink: 0;
}

.find-result-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.find-result-badge {
    flex-shrink: 0;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
}

/* --- Empty / loading states --- */
.find-empty,
.find-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}
`;
}
