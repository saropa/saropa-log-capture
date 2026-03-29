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
    padding: 1px 3px;
    gap: 2px;
}
.filter-drawer-level-row .level-count {
    min-width: 0;
}
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
.filter-drawer-footer select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 2px;
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
   Accordion Sections — 2-column grid
   =================================================================== */
.filter-drawer-sections {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 12px;
    padding: 4px 0;
}
.filter-accordion {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 3px;
    margin: 2px 0;
}
/* Expanded sections span full width */
.filter-accordion.expanded {
    grid-column: 1 / -1;
}
.filter-accordion-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 5px 8px;
    background: var(--vscode-sideBar-background, var(--vscode-panel-background));
    border: none;
    color: var(--vscode-foreground);
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    border-radius: 3px;
}
.filter-accordion-header:hover {
    background: var(--vscode-list-hoverBackground);
}
.filter-accordion-arrow {
    font-size: 11px;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}
.filter-accordion.expanded .filter-accordion-arrow {
    transform: rotate(90deg);
}
.filter-accordion-title { font-weight: 600; }
.filter-accordion-summary {
    flex: 1;
    text-align: right;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
}
/* Accordion body — hidden by default via max-height, animated on expand */
.filter-accordion-body {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    padding: 0 8px 0 16px;
    transition: max-height 0.2s ease-in-out, opacity 0.2s ease-in-out,
                padding-top 0.15s ease-in-out, padding-bottom 0.15s ease-in-out;
}
.filter-accordion.expanded .filter-accordion-body {
    max-height: 300px;
    opacity: 1;
    overflow-y: auto;
    padding-top: 4px;
    padding-bottom: 6px;
}

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
.filter-drawer-footer-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}
.filter-drawer-spacer { flex: 1; }
.filter-drawer-summary {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
    .filter-accordion-arrow,
    .filter-accordion-body { transition: none !important; }
}

`;
}
//# sourceMappingURL=viewer-styles-filter-drawer.js.map