"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOptionsStyles = getOptionsStyles;
/**
 * CSS styles for the options panel in the viewer webview.
 *
 * Slide-out panel from the right side with organized sections for all viewer settings.
 */
const viewer_styles_exclusion_chips_1 = require("./viewer-styles-exclusion-chips");
const viewer_styles_options_extra_1 = require("./viewer-styles-options-extra");
function getOptionsStyles() {
    return /* css */ `

/* ===================================================================
   Options Panel
   Slide-out panel showing all viewer settings
   organized into logical sections.
   =================================================================== */
.options-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.options-panel.visible {
    display: flex;
}

.options-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--vscode-sideBarTitle-background, var(--vscode-panel-background));
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    font-weight: bold;
    font-size: 13px;
}

.options-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-size: 14px;
}

.options-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.options-search-wrapper {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background);
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    padding: 4px 8px;
}
#filters-search,
#options-search {
    flex: 1;
    min-width: 0;
    background: transparent;
    color: var(--vscode-input-foreground);
    border: none;
    padding: 3px 4px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
}
.options-search-clear {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    visibility: hidden;
}
.options-search-clear.visible { visibility: visible; }
.options-search-clear:hover { color: var(--vscode-errorForeground, #f44); }

.options-filtered-hidden { display: none !important; }

.options-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
}

.options-section {
    margin-bottom: 16px;
    padding: 0 12px;
}

.options-section-title {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 8px 0;
    padding: 0;
}

.options-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12px;
    cursor: pointer;
}

.options-row input[type="checkbox"], .options-row input[type="radio"] {
    accent-color: var(--vscode-button-background);
    cursor: pointer;
}
.scope-disabled { opacity: 0.4; pointer-events: none; }

.options-row select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 2px;
    flex: 1;
}

.options-row:has(select) {
    cursor: default;
}

.options-row:hover:has(input[type="checkbox"]) {
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
}

.options-indent {
    margin-left: 20px;
    padding-left: 12px;
    border-left: 2px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.1));
    transition: opacity 0.15s ease;
}

.options-indent-disabled {
    opacity: 0.4;
    pointer-events: none;
}

.options-row input:disabled + span,
.deco-settings-row input:disabled + span {
    opacity: 0.4;
}

/* Action buttons in options panel (Reset to default, Reset extension settings) */
.options-action-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 11px;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 3px;
    width: 100%;
}
.options-action-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Hint/status text under a control */
.options-hint {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.8;
    padding: 0 0 4px 24px;
}

/* Log Streams: subheading before external sidecar checkboxes */
.source-external-group-title {
    margin-top: 8px;
    padding-top: 4px;
    font-weight: 600;
    opacity: 0.95;
}

/* Code Location Scope: contextual warning when narrowing hides most lines */
.scope-filter-hint {
    margin-top: 6px;
    padding-left: 8px;
    border-left: 2px solid var(--vscode-editorWarning-foreground);
}
.scope-hint-reset-btn {
    margin-left: 8px;
    padding: 1px 6px;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    font-size: 10px;
    cursor: pointer;
}
.scope-hint-reset-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Integrations button in options (opens Integrations screen) */
.options-integrations-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 12px;
    padding: 6px 12px;
    cursor: pointer;
    border-radius: 3px;
    width: 100%;
    text-align: left;
}
.options-integrations-btn:hover {
    background: var(--vscode-button-hoverBackground);
}
.options-integrations-btn .codicon { font-size: 14px; }

/* Hide options content when Integrations view is shown */
.options-content-hidden {
    display: none !important;
}

` + (0, viewer_styles_options_extra_1.getOptionsExtraStyles)() + (0, viewer_styles_exclusion_chips_1.getExclusionChipStyles)();
}
//# sourceMappingURL=viewer-styles-options.js.map