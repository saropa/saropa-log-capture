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
   Level Filter — Compact Dot Summary (footer trigger)
   Row of tiny colored dots that opens the level fly-up menu.
   =================================================================== */
.level-summary {
    display: inline-flex;
    gap: 3px;
    align-items: center;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
}
.level-summary:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.level-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    transition: opacity 0.2s ease;
}
.level-dot:not(.active) { opacity: 0.2; }

/* ===================================================================
   Level Filter — Fly-up Menu
   Popup positioned above the footer showing full level toggles
   plus Select All / Select None. Stays open during toggling.
   =================================================================== */
#level-flyup {
    display: none;
    position: fixed;
    bottom: 30px;
    left: 8px;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
    padding: 6px;
    z-index: 150;
    min-width: 120px;
}
#level-flyup.visible { display: flex; flex-direction: column; gap: 2px; }
.level-flyup-header {
    display: flex;
    gap: 8px;
    padding: 2px 4px 4px;
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 2px;
    font-size: 11px;
}
.level-flyup-header a {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: none;
    cursor: pointer;
}
.level-flyup-header a:hover { text-decoration: underline; }

/* ===================================================================
   Level Filter Circles (inside fly-up)
   Interactive toggles for each log level.
   =================================================================== */
.level-circle {
    background: none;
    border: 1px solid transparent;
    color: inherit;
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

`;
}
