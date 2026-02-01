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
    right: -25%;
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
}

.options-panel.visible {
    right: 0;
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

.options-row input[type="checkbox"] {
    accent-color: var(--vscode-button-background);
    cursor: pointer;
}

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
}

/* Button to open options panel */
#options-panel-btn {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
}

#options-panel-btn:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
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
