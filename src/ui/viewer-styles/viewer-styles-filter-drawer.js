"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFilterDrawerStyles = getFilterDrawerStyles;
/**
 * CSS styles for the Filters slide-out panel with vertical tab sidebar.
 *
 * The panel lives in #panel-slot alongside Sessions, Bookmarks, etc.
 * Layout: header → levels row → vertical tabs (left) + content (right).
 */
function getFilterDrawerStyles() {
    return /* css */ `

/* ===================================================================
   Filters Panel — full-height slide-out in panel-slot
   =================================================================== */
.filters-panel {
    width: 100%;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}
.filters-panel.visible { display: flex; }

/* Header */
.filters-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--vscode-sideBarTitle-background, var(--vscode-panel-background));
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    font-weight: bold;
    font-size: 13px;
    flex-shrink: 0;
}
.filters-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}
.filters-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* Levels row — compact, wraps inside the panel */
.filters-panel .filter-drawer-levels {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 6px 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
.filter-drawer-level-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    flex: 1;
}
.filter-drawer-level-row .level-circle {
    width: auto;
    padding: 1px 3px;
    gap: 2px;
}
.filter-drawer-level-row .level-count { min-width: 0; }
.filter-drawer-level-row .level-label { display: none; }
.filter-drawer-level-row .level-flyup-header {
    border-bottom: none;
    margin-bottom: 0;
    padding: 0;
}
.level-flyup-header button {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 3px;
}
.level-flyup-header button:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.level-flyup-header button.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.level-flyup-header button.active:hover {
    background: var(--vscode-button-hoverBackground);
}
.filter-drawer-context {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-left: 4px;
}
.filter-drawer-context input[type="range"] { width: 60px; }

/* Log Sources divider between tiers */
.log-inputs-divider {
    border-top: 1px dashed var(--vscode-panel-border);
    margin: 4px 0;
}

/* ===================================================================
   Tab Layout — vertical sidebar (left) + panel content (right)
   Fills remaining height below the levels row.
   =================================================================== */
.filter-tab-layout {
    display: flex;
    flex: 1;
    min-height: 0;
}

/* Vertical tab bar — stacked buttons on the left */
.filter-tab-bar {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-right: 1px solid var(--vscode-panel-border);
    padding: 4px 0;
    gap: 1px;
}
.filter-tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px 5px 6px;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    text-align: left;
    transition: color 0.1s, border-color 0.1s;
}
.filter-tab:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-list-hoverBackground);
}
.filter-tab[aria-selected="true"] {
    color: var(--vscode-foreground);
    border-left-color: var(--vscode-focusBorder, #007fd4);
    font-weight: 600;
}
.filter-tab .codicon { font-size: 14px; flex-shrink: 0; }

/* Labels hidden when tab bar labels are toggled off */
.filter-tab-label { pointer-events: none; }
.filter-tab-bar:not(.ftb-labels-visible) .filter-tab-label,
.filter-tab-bar:not(.ftb-labels-visible) .filter-tab-count {
    display: none;
}
/* When labels hidden, reduce padding so icons are compact */
.filter-tab-bar:not(.ftb-labels-visible) .filter-tab {
    padding: 5px 8px;
    justify-content: center;
}

/* Count suffix — hidden when empty, dimmed text */
.filter-tab-count {
    font-size: 10px;
    opacity: 0.7;
}
.filter-tab-count:empty { display: none; }

/* ===================================================================
   Tab Panels — fill remaining width, scroll independently
   =================================================================== */
.filter-tab-panels {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
}
.filter-tab-panel {
    padding: 6px 10px;
}
.filter-tab-panel[style*="display: none"],
.filter-tab-panel[style*="display:none"] {
    padding: 0;
    overflow: hidden;
}

/* Filter drawer summary — hidden, kept for backward compat */
.filter-drawer-summary {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}

`;
}
//# sourceMappingURL=viewer-styles-filter-drawer.js.map