/**
 * Session panel layout, header, toggles, and content area styles.
 * Composed by viewer-styles-session.ts.
 */

/** Session panel slide-out and header/toggle styles. */
export function getSessionPanelLayoutStyles(): string {
    return /* css */ `

/* ===================================================================
   Session Panel — slide-out (same pattern as search/options)
   =================================================================== */
.session-panel {
    width: 100%;
    min-width: 560px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.session-panel-resize {
    position: absolute; right: -3px; top: 0; bottom: 0; width: 6px;
    cursor: col-resize; z-index: 1;
}
.session-panel-resize:hover,
.session-panel-resize.dragging {
    background: var(--vscode-focusBorder);
    opacity: 0.5;
}

.session-panel.visible {
    display: flex;
}

.session-panel-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.session-header-clickable {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
}

.session-header-clickable:hover {
    color: var(--vscode-textLink-foreground);
}

.session-header-clickable:hover .session-header-path {
    color: var(--vscode-textLink-foreground);
    text-decoration: underline;
}

.session-panel-title {
    flex-shrink: 0;
}

.session-header-path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
}

/* Separator dot excluded from selection when user selects the path. */
.session-path-sep {
    user-select: none;
}

.session-panel-actions {
    display: flex;
    gap: 4px;
    align-items: center;
}

.session-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.session-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.session-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.session-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* --- Session panel display toggles --- */
.session-panel-toggles {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 4px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

/* Date range filter dropdown (All time / Last 7 days / Last 30 days). */
.session-date-range-select {
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid var(--vscode-input-border, transparent);
    background: var(--vscode-input-background, transparent);
    color: var(--vscode-input-foreground, var(--vscode-foreground));
    margin-right: 4px;
}

.session-toggle-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
}

.session-toggle-btn:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.session-sort-btn { margin-left: auto; }

.session-toggle-btn.active {
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    border-color: var(--vscode-focusBorder);
}

.session-panel-content {
    flex: 1;
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
}

/* --- Collections section --- */
.session-collections {
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBarSectionHeader-background, transparent);
}
.session-collections-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 2px;
}
.session-collections-hint {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 6px 0;
    line-height: 1.3;
}
.session-collections-list {
    margin-bottom: 6px;
}
.session-collections-create-row {
    margin-bottom: 0;
}
.session-collections-create-form {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.session-collections-name-input {
    font-size: 12px;
    padding: 4px 8px;
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    width: 100%;
    box-sizing: border-box;
}
.session-collections-name-input:focus {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
}
.session-collections-create-form-actions {
    display: flex;
    gap: 6px;
}
.session-collections-create-confirm {
    font-size: 12px;
    padding: 4px 10px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    cursor: pointer;
}
.session-collections-create-confirm:hover {
    background: var(--vscode-button-hoverBackground);
}
.session-collections-create-confirm:disabled {
    opacity: 0.6;
    cursor: default;
}
.session-collections-name-input:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}
.session-collections-create-cancel {
    font-size: 12px;
    padding: 4px 10px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    cursor: pointer;
}
.session-collections-create-cancel:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.session-collections-create-error {
    font-size: 11px;
    color: var(--vscode-errorForeground);
}
.session-collection-item {
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    border-radius: 3px;
}
.session-collection-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.session-collection-item.session-collection-active {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.session-collection-check {
    margin-left: 4px;
    font-weight: bold;
}
.session-collections-create {
    font-size: 12px;
    padding: 4px 8px;
    background: none;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
}
.session-collections-create:hover {
    background: var(--vscode-toolbar-hoverBackground);
}
`;
}
