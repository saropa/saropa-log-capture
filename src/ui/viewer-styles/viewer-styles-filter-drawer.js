"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFilterDrawerStyles = getFilterDrawerStyles;
/**
 * CSS styles for the filter drawer and accordion sections.
 *
 * Extracted from viewer-styles-toolbar.ts to stay within
 * the 300 code-line limit.
 */
function getFilterDrawerStyles() {
    return /* css */ `

/* ===================================================================
   Filter Drawer — drops below toolbar
   =================================================================== */
.filter-drawer {
    background: var(--vscode-sideBar-background, var(--vscode-panel-background));
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 6px 8px;
    flex-shrink: 0;
    max-height: 50vh;
    overflow-y: auto;
}
.filter-drawer.u-hidden { display: none; }

/* Levels row */
.filter-drawer-levels {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.filter-drawer-level-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    flex: 1;
}
/* Level circles in drawer: horizontal inline instead of vertical list */
.filter-drawer-level-row .level-circle {
    width: auto;
    padding: 2px 4px;
    gap: 3px;
}
.filter-drawer-level-row .level-label { display: none; }
.filter-drawer-level-row .level-flyup-header {
    border-bottom: none;
    margin-bottom: 0;
    padding: 0;
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
.filter-drawer-app-only {
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 4px;
}

/* ===================================================================
   Accordion Sections
   =================================================================== */
.filter-accordion { border-bottom: 1px solid var(--vscode-panel-border); }
.filter-accordion:last-child { border-bottom: none; }
.filter-accordion-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 4px 2px;
    background: none;
    border: none;
    color: var(--vscode-foreground);
    font-size: 11px;
    cursor: pointer;
    text-align: left;
}
.filter-accordion-header:hover {
    background: var(--vscode-list-hoverBackground);
}
.filter-accordion-arrow {
    font-size: 10px;
    width: 12px;
    text-align: center;
    flex-shrink: 0;
}
.filter-accordion-title { font-weight: 600; }
.filter-accordion-summary {
    flex: 1;
    text-align: right;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
}
.filter-accordion-body {
    padding: 4px 2px 6px 16px;
}
.filter-accordion-body[hidden] { display: none; }

/* ===================================================================
   Filter Drawer Footer Row
   =================================================================== */
.filter-drawer-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 4px;
    border-top: 1px solid var(--vscode-panel-border);
    margin-top: 4px;
    font-size: 11px;
}
.filter-drawer-spacer { flex: 1; }
.filter-drawer-summary {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}

`;
}
//# sourceMappingURL=viewer-styles-filter-drawer.js.map