/**
 * CSS styles for the session history slide-out panel.
 *
 * Follows the same fixed-position slide-in pattern as the search
 * and options panels, sitting to the left of the icon bar.
 */

/** Return CSS for the session panel and its list items. */
export function getSessionPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Session Panel — slide-out (same pattern as search/options)
   =================================================================== */
.session-panel {
    position: fixed;
    left: -100%;
    top: 0;
    bottom: 0;
    width: 25%;
    min-width: 280px;
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
    left: var(--icon-bar-width, 36px);
    pointer-events: auto;
}

.session-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
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
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.session-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
}

/* --- Session panel display toggles --- */
.session-panel-toggles {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 4px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
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

.session-toggle-btn.active {
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    border-color: var(--vscode-focusBorder);
}

.session-panel-content {
    flex: 1;
    overflow-y: auto;
}

/* --- Session list items --- */
.session-item {
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.session-item:hover {
    background: var(--vscode-list-hoverBackground);
}

.session-item-active .session-item-icon .codicon {
    color: var(--vscode-charts-red, #f44336);
}

.session-item-icon .codicon {
    font-size: 14px;
    margin-top: 2px;
}

.session-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.session-item-name {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.session-item-meta {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* --- Latest suffix --- */
.session-latest { opacity: 0.5; font-style: italic; font-size: 11px; margin-left: 3px; }

/* --- Day headings --- */
.session-day-heading {
    padding: 6px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-textLink-foreground, #3794ff);
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    position: sticky;
    top: 0;
    z-index: 1;
}

/* --- Trashed items (icon is already codicon-trash; section heading separates them) --- */
.session-item-trashed .session-item-icon .codicon { color: var(--vscode-descriptionForeground); }

/* --- Trash section heading --- */
.session-trash-heading {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 12px 4px; font-size: 11px; font-weight: 600;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
    border-top: 2px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    position: sticky; top: 0; z-index: 1;
}
.session-trash-heading-label { display: flex; align-items: center; gap: 4px; }
.session-trash-badge { font-size: 10px; opacity: 0.8; }
.session-trash-empty-btn {
    background: none; border: none; cursor: pointer; font-size: 11px;
    color: var(--vscode-errorForeground, #f44); padding: 0 4px;
}
.session-trash-empty-btn:hover { text-decoration: underline; }

/* --- Trash toggle badge --- */
.session-toggle-badge {
    font-size: 9px; min-width: 14px; text-align: center; border-radius: 7px;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
    padding: 0 3px; line-height: 14px;
}

/* --- Session context menu --- */
.session-context-menu {
    display: none; position: fixed; z-index: 300;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    padding: 4px 0; min-width: 180px; overflow-y: auto;
}
.session-context-menu.visible { display: block; }

/* --- Severity dots --- */
.sev-dots { font-size: 10px; color: var(--vscode-descriptionForeground); }
.sev-dot {
    display: inline-block; width: 7px; height: 7px;
    border-radius: 50%; margin-right: 2px; vertical-align: middle;
}
.sev-error { background: var(--vscode-charts-red, #f44336); }
.sev-warning { background: var(--vscode-charts-yellow, #ffc107); }
.sev-perf { background: var(--vscode-charts-blue, #2196f3); }
.sev-bar { display: inline-flex; width: 40px; height: 6px; border-radius: 2px; overflow: hidden; vertical-align: middle; margin-left: 4px; background: var(--vscode-panel-border); }
.sev-bar-e { background: var(--vscode-charts-red, #f44336); }
.sev-bar-w { background: var(--vscode-charts-yellow, #ffc107); }
.sev-bar-p { background: var(--vscode-charts-blue, #2196f3); }

/* --- Session tag chips --- */
.session-tags-section {
    padding: 4px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.session-tag-chips {
    display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
}

/* --- Empty / loading states --- */
.session-empty,
.session-loading {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}
`;
}
