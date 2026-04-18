/**
 * CSS styles for the Collections slide-out panel.
 * Follows the same fixed-position pattern as other icon-bar panels.
 */

/** Return CSS for the collections panel and its content. */
export function getCollectionsPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Collections Panel — slide-out (same pattern as about/trash panels)
   =================================================================== */
.collections-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}
.collections-panel.visible { display: flex; }

.collections-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.collections-panel-close {
    background: none;
    border: none;
    color: var(--vscode-icon-foreground);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 14px;
}
.collections-panel-close:hover { color: var(--vscode-errorForeground); }

.collections-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}

/* ---- Explainer ---- */
.collections-explainer {
    background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
    border-left: 3px solid var(--vscode-textLink-foreground, #007acc);
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 12px;
    font-size: 11.5px;
    line-height: 1.55;
}
.collections-explainer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.collections-explainer-title {
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 4px;
}
.collections-explainer-close {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    opacity: 0.6;
    cursor: pointer;
    font-size: 12px;
    padding: 0 2px;
    line-height: 1;
    align-self: flex-start;
}
.collections-explainer-close:hover { opacity: 1; }

/* ---- Create / Merge ---- */
.collections-merge-btn {
    background: var(--vscode-button-secondaryBackground, rgba(127,127,127,0.2));
    color: var(--vscode-button-secondaryForeground, inherit);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    padding: 5px 10px;
    font-size: 11.5px;
    cursor: pointer;
    width: 100%;
    text-align: left;
}
.collections-merge-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, rgba(127,127,127,0.3));
}

.collections-merge-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.collections-rename-input {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    padding: 4px 8px;
    font-size: 12px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
}
.collections-rename-input:focus {
    border-color: var(--vscode-focusBorder);
}

.collections-create-actions {
    display: flex;
    gap: 6px;
}
.collections-create-confirm {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 4px 12px;
    font-size: 11.5px;
    cursor: pointer;
}
.collections-create-confirm:hover { opacity: 0.9; }
.collections-create-confirm:disabled { opacity: 0.5; cursor: default; }

.collections-create-cancel {
    background: var(--vscode-button-secondaryBackground, rgba(127,127,127,0.2));
    color: var(--vscode-button-secondaryForeground, inherit);
    border: none;
    border-radius: 3px;
    padding: 4px 12px;
    font-size: 11.5px;
    cursor: pointer;
}
.collections-create-cancel:hover { opacity: 0.85; }

.collections-create-error {
    color: var(--vscode-errorForeground);
    font-size: 11px;
    padding: 2px 0;
}

/* ---- Merge ---- */
.collections-merge-section { margin-bottom: 12px; }
.collections-merge-select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    padding: 4px 6px;
    font-size: 12px;
    width: 100%;
    box-sizing: border-box;
}
.collections-merge-form label {
    font-size: 11px;
    opacity: 0.8;
    margin-top: 4px;
}

/* ---- Loading / empty ---- */
.collections-loading {
    text-align: center;
    padding: 20px;
    opacity: 0.6;
    font-size: 12px;
}
.collections-empty {
    text-align: center;
    padding: 12px;
    opacity: 0.6;
    font-size: 11.5px;
}

/* ---- List items ---- */
.collections-list { display: flex; flex-direction: column; gap: 6px; }

.collections-item {
    background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.08));
    border: 1px solid var(--vscode-panel-border, transparent);
    border-radius: 4px;
    padding: 8px 10px;
    cursor: pointer;
    transition: background 0.1s;
}
.collections-item:hover {
    background: var(--vscode-list-activeSelectionBackground, rgba(127,127,127,0.15));
}
.collections-item-active {
    border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground));
}

.collections-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}
.collections-item-name {
    font-weight: 500;
    font-size: 12px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.collections-item-check {
    color: var(--vscode-terminal-ansiGreen, #4ec9b0);
    font-size: 13px;
    flex-shrink: 0;
}
.collections-item-meta {
    font-size: 10.5px;
    opacity: 0.65;
    margin-top: 2px;
}
.collections-item-actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
}
.collections-action-btn {
    background: none;
    border: none;
    color: var(--vscode-icon-foreground, inherit);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 12px;
    opacity: 0.6;
    border-radius: 3px;
}
.collections-action-btn:hover {
    opacity: 1;
    background: var(--vscode-toolbar-hoverBackground, rgba(127,127,127,0.15));
}
`;
}
