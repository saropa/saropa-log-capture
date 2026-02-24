/**
 * CSS styles for interactive UI components in the viewer webview.
 *
 * Covers pinned section, exclusion controls, inline peek,
 * and scrollbar minimap. Level filter styles are in viewer-styles-level.ts.
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
    display: none;
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
@keyframes slide-in-left { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
.pinned-item {
    padding: 0 8px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    display: flex;
    align-items: baseline;
    gap: 4px;
    cursor: pointer;  /* click to scroll to original line */
    animation: slide-in-left 0.15s ease-out;
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
   Inline Peek
   Expandable context view inserted inline after the viewport.
   Shows surrounding lines around a right-click → Show Context target.
   =================================================================== */
@keyframes peek-reveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.inline-peek {
    border-top: 2px solid var(--vscode-focusBorder, #007acc);
    border-bottom: 2px solid var(--vscode-focusBorder, #007acc);
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
    margin: 4px 0;
    animation: peek-reveal 0.2s ease-out;
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

/* --- Scrollbar Minimap: interactive panel replacing native scrollbar --- */
.scrollbar-minimap {
    width: 60px; flex-shrink: 0; position: relative;
    align-self: stretch; overflow: hidden; cursor: pointer;
    border-left: 1px solid var(--vscode-editorOverviewRuler-border, rgba(127, 127, 127, 0.3));
}
.minimap-viewport {
    position: absolute; left: 0; right: 0; pointer-events: none; min-height: 10px;
    background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
    transition: top 0.08s linear;
}
.scrollbar-minimap:hover .minimap-viewport { background: var(--vscode-scrollbarSlider-hoverBackground, rgba(100, 100, 100, 0.7)); }
.scrollbar-minimap.mm-dragging .minimap-viewport { background: var(--vscode-scrollbarSlider-activeBackground, rgba(191, 191, 191, 0.4)); }

`;
}
