/**
 * CSS styles for the Bookmarks slide-out panel.
 * Follows the same fixed-position pattern as the session and find panels.
 */

/** Return CSS for the bookmark panel and its list items. */
export function getBookmarkPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Bookmark Panel — slide-out (same pattern as find panel)
   =================================================================== */
.bookmark-panel {
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

.bookmark-panel.visible {
    left: var(--icon-bar-width, 36px);
    pointer-events: auto;
}

.bookmark-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.bookmark-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.bookmark-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 14px;
}

.bookmark-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.bookmark-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.bookmark-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
}

/* --- Filter input --- */
.bookmark-input-wrapper {
    display: flex;
    align-items: center;
    margin: 8px 12px;
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px;
    background: var(--vscode-input-background, #1e1e1e);
    overflow: hidden;
}

.bookmark-input-wrapper:focus-within {
    border-color: var(--vscode-focusBorder, #007acc);
}

.bookmark-input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--vscode-input-foreground, inherit);
    font-size: 12px;
    padding: 4px 8px;
    outline: none;
    min-width: 0;
}

/* --- Bookmark list --- */
.bookmark-list {
    flex: 1;
    overflow-y: auto;
}

.bookmark-file-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    background: var(--vscode-sideBarSectionHeader-background, rgba(128, 128, 128, 0.1));
    border-bottom: 1px solid var(--vscode-panel-border);
}

.bookmark-file-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bookmark-count-badge {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: normal;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
}

.bookmark-file-delete {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 0 2px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.15s;
}

.bookmark-file-header:hover .bookmark-file-delete { opacity: 1; }
.bookmark-file-delete:hover { color: var(--vscode-errorForeground, #f44); }

/* --- Bookmark items --- */
.bookmark-item {
    padding: 6px 12px 6px 24px;
    cursor: pointer;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 12px;
    position: relative;
}

.bookmark-item:hover { background: var(--vscode-list-hoverBackground); }

.bookmark-item-main {
    display: flex;
    align-items: center;
    gap: 6px;
}

.bookmark-item-main .codicon { font-size: 14px; flex-shrink: 0; }

.bookmark-item-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bookmark-item-note {
    margin-top: 2px;
    padding-left: 20px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bookmark-item-actions {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
}

.bookmark-item:hover .bookmark-item-actions { opacity: 1; }

.bookmark-action-btn {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 12px;
}

.bookmark-action-btn:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.bookmark-action-btn.bookmark-delete:hover {
    color: var(--vscode-errorForeground, #f44);
}

/* --- Empty state --- */
.bookmark-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    white-space: pre-line;
}
`;
}
