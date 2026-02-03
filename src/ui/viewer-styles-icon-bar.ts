/**
 * CSS styles for the right-side vertical icon bar.
 *
 * Mirrors VS Code's activity bar: narrow column, codicon icons,
 * active indicator bar on the left edge of the selected icon.
 */

/** Return CSS for the icon bar and its icon buttons. */
export function getIconBarStyles(): string {
    return /* css */ `

/* ===================================================================
   Icon Bar — right-edge vertical activity bar
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
    border-left: 1px solid var(--vscode-activityBar-border, var(--vscode-panel-border));
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

/* Active indicator bar on the left edge, matching VS Code's activity bar. */
.ib-icon.ib-active::before {
    content: '';
    position: absolute;
    left: 0;
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
    right: 2px;
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
`;
}
