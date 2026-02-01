/**
 * CSS styles for interactive UI components in the viewer webview.
 *
 * Covers pinned section, exclusion controls, statistics counters,
 * level filter buttons, inline peek, scrollbar minimap, and session header.
 */
export function getUiStyles(): string {
    return /* css */ `

/* ===================================================================
   Pinned Section
   Sticky area at the top of the viewport holding user-pinned lines.
   Scrollable with a max height so it doesn't dominate the view.
   Uses --vscode-panel-background to match the VS Code bottom panel.
   =================================================================== */
#pinned-section {
    position: sticky;
    top: 0;
    z-index: 5;
    /* Panel background blends with the VS Code bottom panel chrome */
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    max-height: 30vh;  /* cap height so pins don't eat all space */
    overflow-y: auto;
    flex-shrink: 0;
}
.pinned-header {
    font-size: 10px;
    padding: 2px 8px;
    color: var(--vscode-descriptionForeground);
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.pinned-item {
    padding: 0 8px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    display: flex;
    align-items: baseline;
    gap: 4px;
    cursor: pointer;  /* click to scroll to original line */
}
.pinned-item:hover {
    background: var(--vscode-list-hoverBackground);
}
/* Small "x" button to remove a pinned line */
.unpin-btn {
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    flex-shrink: 0;
}
.unpin-btn:hover {
    color: var(--vscode-errorForeground, #f44);
}
.pinned-text {
    flex: 1;
    overflow: hidden;
}

/* --- Line selection highlight (click or keyboard nav) --- */
.line.selected, .stack-header.selected, .marker.selected {
    background: var(--vscode-editor-selectionBackground, rgba(38, 79, 120, 0.5));
}

/* ===================================================================
   Exclusion Controls
   Footer elements for the pattern-based line exclusion feature.
   =================================================================== */
#exclusion-count {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}

/* ===================================================================
   Level Filter Circles
   Interactive toggles for each log level. Each circle shows its
   emoji plus a running count when > 0 (e.g. "🔴 4").
   Click to toggle the level on/off.
   =================================================================== */
.level-filter-group {
    display: flex;
    gap: 2px;
    align-items: center;
}
.level-circle {
    background: none;
    border: 1px solid transparent;
    font-size: 11px;
    padding: 1px 4px;
    cursor: pointer;
    opacity: 1;
    transition: opacity 0.2s ease, background 0.15s ease;
    line-height: 1.2;
    border-radius: 3px;
    white-space: nowrap;
}
.level-circle:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    border-color: var(--vscode-descriptionForeground);
}
/* Inactive (disabled) circles are dimmed and desaturated */
.level-circle:not(.active) {
    opacity: 0.25;
    filter: grayscale(0.8);
}
/* Lines outside the active level filter are dimmed as context */
.line.context-line { opacity: 0.4; }

/* ===================================================================
   Inline Peek
   Expandable context view inserted inline after the viewport.
   Shows surrounding lines around a double-clicked target line.
   =================================================================== */
.inline-peek {
    border-top: 2px solid var(--vscode-focusBorder, #007acc);
    border-bottom: 2px solid var(--vscode-focusBorder, #007acc);
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
    margin: 4px 0;
}
.peek-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
}
.peek-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
}
.peek-close:hover { color: var(--vscode-errorForeground, #f44); }
.peek-target {
    background: var(--vscode-editor-lineHighlightBackground, rgba(255, 255, 0, 0.15));
    border-left: 3px solid var(--vscode-editorLineNumber-activeForeground, #c6c6c6);
}
.peek-context { opacity: 0.7; }

/* ===================================================================
   Scrollbar Minimap
   Visual overview of search matches, errors, and warnings on scrollbar.
   =================================================================== */
.scrollbar-minimap {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 100%;
    pointer-events: none;
    z-index: 10;
}

.minimap-marker {
    position: absolute;
    width: 100%;
    height: 2px;
    pointer-events: none;
}

.minimap-search-match {
    background: var(--vscode-editorOverviewRuler-findMatchForeground, rgba(234, 92, 0, 0.8));
}

.minimap-current-match {
    background: var(--vscode-editorOverviewRuler-findMatchForeground, rgba(255, 150, 50, 1));
    height: 3px;
    z-index: 2;
}

.minimap-error {
    background: var(--vscode-editorOverviewRuler-errorForeground, rgba(244, 68, 68, 0.8));
}

.minimap-warning {
    background: var(--vscode-editorOverviewRuler-warningForeground, rgba(204, 167, 0, 0.8));
}

.minimap-viewport {
    position: absolute;
    width: 100%;
    background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
    border: 1px solid var(--vscode-scrollbarSlider-activeBackground, rgba(191, 191, 191, 0.4));
    pointer-events: none;
    z-index: 1;
}

/* ===================================================================
   Session Info — compact prefix line + modal overlay
   =================================================================== */
.session-info-prefix {
    padding: 3px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    border-bottom: 1px solid var(--vscode-panel-border);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
}
.session-info-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
}
.session-info-modal-content {
    background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 12px 16px;
    min-width: 240px;
    max-width: 90%;
    max-height: 80%;
    overflow-y: auto;
}
.session-info-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-weight: 600;
    font-size: 12px;
}
.session-info-modal-header button {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
}
.session-info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
}
.session-info-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 11px;
    line-height: 1.4;
}
.session-info-key {
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
    min-width: 100px;
    flex-shrink: 0;
}
.session-info-value {
    color: var(--vscode-foreground);
    word-break: break-word;
}
`;
}
