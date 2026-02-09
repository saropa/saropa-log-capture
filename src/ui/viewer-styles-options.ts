/**
 * CSS styles for the options panel in the viewer webview.
 *
 * Slide-out panel from the right side with organized sections for all viewer settings.
 */
export function getOptionsStyles(): string {
    return /* css */ `

/* ===================================================================
   Options Panel
   Slide-out panel from the right side showing all viewer settings
   organized into logical sections.
   =================================================================== */
.options-panel {
    position: fixed;
    /* Must be -100% (not -25%) to fully hide off-screen: min-width 280px
       exceeds 25% in narrow sidebar viewports, leaving the panel partially
       visible and blocking clicks on footer buttons underneath. */
    right: -100%;
    top: 0;
    bottom: 0;
    width: 25%;
    min-width: 280px;
    max-width: 400px;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-left: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.3);
    transition: right 0.3s ease;
    z-index: 250;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: none;
}

.options-panel.visible {
    right: var(--icon-bar-width, 36px);
    pointer-events: auto;
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
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
}

.options-close:hover {
    color: var(--vscode-errorForeground, #f44);
}

.options-search-wrapper {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background);
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    padding: 4px 8px;
}
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

/* Action buttons in options panel (Export, Reset) */
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

/* --- Exclusion pattern chips: removable pills in noise-reduction section --- */
.exclusion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 0 2px;
}
.exclusion-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 10px;
    border: 1px solid var(--vscode-descriptionForeground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    white-space: nowrap;
    max-width: 100%;
    transition: opacity 0.15s;
}
.exclusion-chip-text {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
}
.exclusion-chip-remove {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
}
.exclusion-chip-remove:hover {
    color: var(--vscode-errorForeground, #f44);
}
.exclusion-chips-disabled .exclusion-chip {
    opacity: 0.4;
}

/* --- Inline exclusion add input --- */
.exclusion-input-wrapper {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    margin: 4px 0;
}
.exclusion-input-wrapper:focus-within {
    border-color: var(--vscode-focusBorder);
}
#exclusion-add-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    color: var(--vscode-input-foreground);
    border: none;
    padding: 4px 8px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
}
#exclusion-add-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-left: 1px solid var(--vscode-input-border, transparent);
    font-size: 11px;
    padding: 4px 10px;
    cursor: pointer;
    flex-shrink: 0;
}
#exclusion-add-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Audio preview buttons */
.preview-sound-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 2px;
    margin-left: 4px;
}

.preview-sound-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Volume slider (range input) */
input[type="range"] {
    cursor: pointer;
    accent-color: var(--vscode-button-background);
}
`;
}
