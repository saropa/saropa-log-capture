/**
 * CSS styles for the Trash slide-out panel.
 * Follows the same fixed-position pattern as the bookmark panel.
 */

/** Return CSS for the trash panel and its list items. */
export function getTrashPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Trash Panel — slide-out (same pattern as bookmark panel)
   =================================================================== */
.trash-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--surface-1));
    border-right: 1px solid var(--vscode-sideBar-border, var(--border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.trash-panel.visible {
    display: flex;
}

.trash-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--border);
}

.trash-panel-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
}

.trash-panel-action {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    font-size: 14px;
}

.trash-panel-action:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.trash-panel-close {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-sm);
    font-size: 14px;
}

.trash-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.trash-panel-content {
    flex: 1;
    overflow-y: auto;
}

/* --- Trash items --- */
.trash-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: 6px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    opacity: 0.85;
}

.trash-item:hover {
    background: var(--vscode-list-hoverBackground);
    opacity: 1;
}

.trash-item-icon { flex-shrink: 0; padding-top: 1px; }
.trash-item-icon .codicon { font-size: 14px; color: var(--muted); }

.trash-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.trash-item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.trash-item-meta {
    font-size: 10px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* --- Empty state --- */
.trash-empty {
    padding: var(--space-4) var(--space-3);
    font-size: 12px;
    color: var(--muted);
    text-align: center;
}
`;
}
