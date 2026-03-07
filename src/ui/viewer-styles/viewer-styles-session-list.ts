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

.session-item-active .session-item-icon .codicon {
    color: var(--vscode-charts-red, #f44336);
}

.session-item-icon {
    user-select: none;
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
