/**
 * Session list items, day headings, context menu, and severity dots styles.
 * Composed by viewer-styles-session.ts.
 */

/** Session list and item styles. */
export function getSessionListStyles(): string {
    return /* css */ `

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

.session-item-selected {
    background: var(--vscode-list-inactiveSelectionBackground, var(--vscode-list-hoverBackground));
}
.session-item-selected:hover {
    background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
}

.session-item-active .session-item-icon .codicon {
    color: var(--vscode-charts-red, #f44336);
}

/* Recent-updates indicators: orange = new since last viewed, red = updated in last minute */
.session-item-update-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-left: 4px;
    flex-shrink: 0;
    vertical-align: middle;
    transition: opacity 0.15s ease;
}
.session-item-updated-recent .session-item-update-dot { background: var(--vscode-charts-red, #f44336); }
.session-item-updated-since-viewed .session-item-update-dot { background: var(--vscode-charts-orange, #e65100); }

.session-item-icon {
    user-select: none;
    display: inline-flex;
    align-items: center;
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

.session-item-perf {
    display: inline-flex;
    margin-left: 4px;
    vertical-align: middle;
    color: var(--vscode-charts-purple, #b267e6);
    font-size: 12px;
}
.session-item-perf .codicon { font-size: 12px; }

.session-item-meta {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* --- Latest suffix --- */
.session-latest { opacity: 0.5; font-style: italic; font-size: 11px; margin-left: 3px; }

/* --- Day headings (collapsible) --- */
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
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 4px;
}
.session-day-heading:hover {
    background: var(--vscode-list-hoverBackground);
}
.session-day-chevron {
    font-size: 12px;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}
/* File count shown dimmed in parentheses beside the date label. */
.session-day-count {
    font-weight: 400;
    opacity: 0.5;
}

/* Collapsed day group: hide session items. */
.session-day-group.collapsed > .session-day-items {
    display: none;
}

/* --- Session list pagination --- */
.session-list-pagination {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-top: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    flex-shrink: 0;
    transition: opacity 0.15s ease;
}
.session-list-pagination-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-right: auto;
}
.session-list-pagination-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border-radius: 2px;
    cursor: pointer;
}
.session-list-pagination-btn:hover:not(:disabled) {
    background: var(--vscode-button-secondaryHoverBackground);
}
.session-list-pagination-btn:disabled {
    opacity: 0.5;
    cursor: default;
}

/* --- Filtered-empty hint (shown when filters produce zero results) --- */
.session-empty-filtered {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

/* --- Name filter bar --- */
.session-name-filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: var(--vscode-editorInfo-background, rgba(55, 148, 255, 0.1));
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    color: var(--vscode-foreground);
}
.session-name-filter-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.session-name-filter-clear {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: none;
    border: 1px solid var(--vscode-button-border, transparent);
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    flex-shrink: 0;
}
.session-name-filter-clear:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
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
.sev-dots { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; color: var(--vscode-descriptionForeground); vertical-align: middle; }
.sev-pair { display: inline-flex; align-items: center; gap: 2px; }
.sev-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.sev-error { background: var(--vscode-charts-red, #f44336); }
.sev-warning { background: var(--vscode-charts-yellow, #ffc107); }
.sev-perf { background: var(--vscode-charts-purple, #a855f7); }
.sev-fw { background: var(--vscode-charts-blue, #2196f3); }
.sev-info { background: var(--vscode-charts-green, #4caf50); }
.sev-other { background: var(--vscode-descriptionForeground, #888); opacity: 0.5; }
`;
}
