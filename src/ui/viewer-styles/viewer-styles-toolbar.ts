/**
 * CSS styles for the log viewer toolbar, search flyout, filter drawer,
 * and actions dropdown.
 *
 * The toolbar replaces both the old session-nav header and footer bar.
 * Uses --vscode-* CSS variables to match the active theme.
 */
export function getToolbarStyles(): string {
    return /* css */ `

/* ===================================================================
   Toolbar — persistent top bar (never hides on scroll)
   =================================================================== */
.viewer-toolbar {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    min-height: 28px;
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    flex-shrink: 0;
    user-select: none;
}
.viewer-toolbar.paused {
    color: var(--vscode-statusBarItem-warningForeground, #fc0);
    background: var(--vscode-statusBarItem-warningBackground, rgba(252, 192, 0, 0.15));
}
.toolbar-left {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}
.toolbar-right {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    overflow: hidden;
}
.toolbar-filename {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
    transition: color 0.15s ease;
}
.toolbar-filename:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration-style: solid;
}
.toolbar-sep {
    width: 1px;
    height: 16px;
    background: var(--vscode-panel-border);
    flex-shrink: 0;
}

/* ===================================================================
   Toolbar Icon Buttons
   =================================================================== */
.toolbar-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 22px;
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    border-radius: 3px;
    position: relative;
    flex-shrink: 0;
}
.toolbar-icon-btn:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-foreground);
}
.toolbar-icon-btn[aria-expanded="true"] {
    background: var(--vscode-toolbar-activeBackground, rgba(99, 102, 106, 0.31));
    color: var(--vscode-foreground);
}
.toolbar-badge {
    position: absolute;
    top: 0;
    right: 0;
    font-size: 8px;
    min-width: 12px;
    height: 12px;
    line-height: 12px;
    text-align: center;
    border-radius: 6px;
    background: var(--vscode-badge-background, #007acc);
    color: var(--vscode-badge-foreground, #fff);
    font-weight: bold;
}
.toolbar-badge:empty { display: none; }

/* Nav label in toolbar */
.viewer-toolbar .nav-bar-label { font-size: 11px; white-space: nowrap; }
.viewer-toolbar .session-details-inline { font-size: 11px; opacity: 0.7; }

/* ===================================================================
   Search Flyout — drops below toolbar
   =================================================================== */
.search-flyout {
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 4px 8px;
    flex-shrink: 0;
}
.search-flyout.u-hidden { display: none; }
.search-flyout-row { display: flex; align-items: center; }
.search-flyout-options { padding: 4px 0; }
.search-flyout-history { max-height: 150px; overflow-y: auto; }

/* ===================================================================
   Actions Dropdown — positioned below actions button
   =================================================================== */
.toolbar-actions-dropdown {
    position: relative;
    display: inline-flex;
}
.toolbar-actions-popover {
    display: none;
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 200px;
    max-width: min(90vw, 420px);
    width: max-content;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    background: var(--vscode-editorWidget-background, var(--vscode-panel-background));
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    z-index: 100;
}
/* toolbar-actions-open: toolbar script; footer-actions-open: replay script compat */
.toolbar-actions-popover.toolbar-actions-open,
.toolbar-actions-popover.footer-actions-open { display: block; }

/* Reuse footer-actions-item styles for backward compat */
.toolbar-actions-dropdown .footer-actions-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--vscode-foreground);
    font-size: 11px;
    text-align: left;
    padding: 4px 6px;
    cursor: pointer;
    white-space: nowrap;
}
.toolbar-actions-dropdown .footer-actions-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.toolbar-actions-dropdown .footer-actions-separator {
    border: none;
    border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    margin: 3px 4px;
}

/* ===================================================================
   Footer compat styles (for elements that kept footer class names)
   =================================================================== */
#line-count { white-space: nowrap; font-variant-numeric: tabular-nums; }
.footer-selection { white-space: nowrap; font-variant-numeric: tabular-nums; margin-left: 6px; }
.footer-selection:empty { display: none; }
@keyframes badge-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.filter-badge {
    display: none;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background, #007acc);
    color: var(--vscode-badge-foreground, #fff);
    cursor: pointer;
    white-space: nowrap;
    font-weight: bold;
    line-height: 1;
    animation: badge-pop 0.2s ease-out;
}
.filter-badge:hover { opacity: 0.85; }

/* Hidden lines counter (migrated from footer) */
.hidden-lines-counter {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    padding: 1px 4px;
    border-radius: 3px;
}
.hidden-lines-counter:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* ===================================================================
   Reduced Motion
   =================================================================== */
@media (prefers-reduced-motion: reduce) {
    .search-flyout,
    .filter-drawer,
    .toolbar-actions-popover,
    .filter-badge { animation: none; transition: none; }
}

`;
}
