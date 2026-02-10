/**
 * CSS styles for the vertical icon bar (configurable left/right).
 *
 * Mirrors VS Code's activity bar: narrow column, codicon icons,
 * active indicator bar on the inner edge of the selected icon.
 * Default: left side. body[data-icon-bar="right"] overrides for right.
 */

/** Return CSS for the icon bar, its buttons, and position overrides. */
export function getIconBarStyles(): string {
    return /* css */ `

/* ===================================================================
   Icon Bar — vertical activity bar (default: left side)
   =================================================================== */
:root {
    --icon-bar-width: 36px;
}

#icon-bar {
    width: var(--icon-bar-width);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 4px;
    gap: 2px;
    background: var(--vscode-activityBar-background, var(--vscode-sideBar-background, var(--vscode-panel-background)));
    border-right: 1px solid var(--vscode-activityBar-border, var(--vscode-panel-border));
}

.ib-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--vscode-activityBar-inactiveForeground, var(--vscode-descriptionForeground));
    cursor: pointer;
    border-radius: 4px;
    position: relative;
    transition: color 0.15s;
}

.ib-icon:hover {
    color: var(--vscode-activityBar-foreground, var(--vscode-foreground));
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.ib-icon.ib-active {
    color: var(--vscode-activityBar-foreground, var(--vscode-foreground));
}

/* Active indicator bar on inner edge (right when bar is on left). */
.ib-icon.ib-active::before {
    content: '';
    position: absolute;
    right: 0;
    top: 4px;
    bottom: 4px;
    width: 2px;
    background: var(--vscode-activityBar-activeBorder, var(--vscode-focusBorder));
    border-radius: 1px;
}

.ib-icon .codicon {
    font-size: 18px;
}

.ib-badge {
    display: none;
    position: absolute;
    top: 2px;
    left: 2px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    font-size: 9px;
    font-weight: 600;
    line-height: 14px;
    text-align: center;
    border-radius: 7px;
    background: var(--vscode-activityBarBadge-background, #007acc);
    color: var(--vscode-activityBarBadge-foreground, #fff);
    pointer-events: none;
}

/* ===================================================================
   Right-side overrides — icon bar
   =================================================================== */
body[data-icon-bar="right"] #icon-bar {
    border-right: none;
    border-left: 1px solid var(--vscode-activityBar-border, var(--vscode-panel-border));
}
body[data-icon-bar="right"] .ib-icon.ib-active::before {
    right: auto; left: 0;
}
body[data-icon-bar="right"] .ib-badge {
    left: auto; right: 2px;
}

/* ===================================================================
   Right-side overrides — all slide-out panels
   =================================================================== */
body[data-icon-bar="right"] #search-bar,
body[data-icon-bar="right"] .session-panel,
body[data-icon-bar="right"] .options-panel,
body[data-icon-bar="right"] .find-panel,
body[data-icon-bar="right"] .bookmark-panel,
body[data-icon-bar="right"] .trash-panel,
body[data-icon-bar="right"] .info-panel {
    left: auto; right: -100%;
    border-right: none;
    border-left: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.3);
    transition: right 0.15s ease;
}
body[data-icon-bar="right"] #search-bar.visible,
body[data-icon-bar="right"] .session-panel.visible,
body[data-icon-bar="right"] .options-panel.visible,
body[data-icon-bar="right"] .find-panel.visible,
body[data-icon-bar="right"] .bookmark-panel.visible,
body[data-icon-bar="right"] .trash-panel.visible,
body[data-icon-bar="right"] .info-panel.visible {
    right: var(--icon-bar-width, 36px);
}
body[data-icon-bar="right"] .session-panel-resize {
    left: -3px; right: auto;
}
`;
}
