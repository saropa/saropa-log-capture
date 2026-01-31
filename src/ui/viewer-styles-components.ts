/**
 * CSS styles for interactive UI components in the viewer webview.
 *
 * Covers search bar, keyword watch chips, pinned section,
 * exclusion controls, level filter buttons, and inline peek.
 */
export function getComponentStyles(): string {
    return /* css */ `

/* ===================================================================
   Search Bar
   Inline find bar above the footer. Contains text input, match count,
   and prev/next navigation buttons.
   Uses --vscode-panel-background to match the VS Code bottom panel.
   =================================================================== */
#search-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    /* Panel background blends with the VS Code bottom panel chrome */
    background: var(--vscode-panel-background);
    border-top: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
#search-input {
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 2px 6px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
}
#search-input:focus { border-color: var(--vscode-focusBorder); }
#match-count {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}
#search-bar button {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
}
#search-bar button:hover { color: var(--vscode-foreground); }

/* --- Search match highlighting --- */
mark {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
    color: inherit;
    border-radius: 2px;
}
/* Currently focused match gets a brighter highlight */
.current-match mark {
    background: var(--vscode-editor-findMatchBackground, rgba(255, 150, 50, 0.6));
}
.search-match {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.1));
}

/* ===================================================================
   Keyword Watch Chips
   Small badges in the footer showing hit counts for watched keywords.
   Flash animation plays when a new match arrives.
   =================================================================== */
#watch-counts {
    display: flex;
    gap: 4px;
    align-items: center;
}
.watch-chip {
    display: inline-block;
    font-size: 10px;
    padding: 0 5px;
    border-radius: 8px;
    white-space: nowrap;
}
/* Error-level watch chip (red) */
.watch-error {
    background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.2));
    color: var(--vscode-errorForeground, #f44);
}
/* Warning-level watch chip (yellow) */
.watch-warn {
    background: var(--vscode-inputValidation-warningBackground, rgba(255, 204, 0, 0.2));
    color: var(--vscode-editorWarning-foreground, #fc0);
}
/* Brief scale-up animation on new watch hit */
@keyframes watch-flash {
    0% { opacity: 1; transform: scale(1.2); }
    100% { opacity: 1; transform: scale(1); }
}
.watch-chip.flash {
    animation: watch-flash 0.4s ease-out;
}

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
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}
#exclusion-toggle {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
}

/* ===================================================================
   Level Filter Buttons
   Segmented button group in the footer for filtering log lines
   by severity level (All / Info / Warn / Error).
   =================================================================== */
.level-btn-group {
    display: flex;
    gap: 0;
    border: 1px solid var(--vscode-descriptionForeground);
    border-radius: 3px;
    overflow: hidden;
}
.level-btn {
    background: none;
    border: none;
    border-right: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
}
.level-btn:last-child { border-right: none; }
/* Active filter button highlighted with button theme */
.level-btn.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.level-btn:hover:not(.active) {
    background: var(--vscode-list-hoverBackground);
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
`;
}
