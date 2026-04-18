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
   Hidden Lines Counter
   Footer element showing count of manually hidden lines with peek toggle.
   =================================================================== */
.hidden-lines-counter {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0 4px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
}
.hidden-lines-counter:hover {
    color: var(--vscode-foreground);
}
.hidden-lines-counter.peeking {
    color: var(--vscode-inputValidation-infoForeground, #75beff);
}
.hidden-lines-counter.peeking .codicon::before {
    content: "\\eb99"; /* codicon-eye */
}
.hidden-lines-counter .codicon {
    font-size: 12px;
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
.scrollbar-minimap-column {
    flex: 0 0 auto;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    flex-shrink: 0;
    align-self: stretch;
}
.minimap-outside-arrow {
    flex: 0 0 12px;
    width: 12px;
    position: relative;
    align-self: stretch;
    pointer-events: none;
    overflow: visible;
}
.minimap-outside-arrow.u-hidden { display: none; }
/* Yellow triangle points at the vertical middle of the visible range (positioned by JS). */
.minimap-outside-arrow-glyph {
    position: absolute;
    left: 1px;
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-left: 9px solid #ffeb3b;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.9));
    transition: top 0.08s linear;
}
/* Drag-to-resize grip on the left edge of the minimap column */
.minimap-resize-handle {
    flex: 0 0 4px;
    width: 4px;
    cursor: col-resize;
    align-self: stretch;
    background: transparent;
    transition: background 0.15s;
    z-index: 1; /* above minimap canvas */
}
.minimap-resize-handle:hover {
    background: var(--vscode-sash-hoverBorder, rgba(0, 122, 204, 0.6));
}
/* Lock cursor to col-resize during drag so it does not flicker */
body.mm-resizing, body.mm-resizing * { cursor: col-resize !important; }
.scrollbar-minimap {
    flex: 0 0 auto;
    width: 60px;
    flex-shrink: 0;
    position: relative;
    align-self: stretch;
    overflow: hidden;
    cursor: pointer;
    border-left: 1px solid var(--vscode-editorOverviewRuler-border, rgba(127, 127, 127, 0.3));
}
.minimap-viewport {
    position: absolute; left: 0; right: 0; pointer-events: none; min-height: 10px;
    /* z-index ensures viewport renders above the canvas compositing layer */
    z-index: 1;
    /* Slightly more transparent than default theme slider so the log map shows through */
    background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.34));
    transition: top 0.08s linear;
    /* Reserve border space so toggling the outline doesn't shift size */
    border: 2px solid transparent;
    box-sizing: border-box;
}
.minimap-viewport.minimap-viewport--red-outline {
    border-color: rgba(239, 68, 68, 0.95);
    background: rgba(121, 121, 121, 0.30);
}
.scrollbar-minimap:hover .minimap-viewport { background: var(--vscode-scrollbarSlider-hoverBackground, rgba(100, 100, 100, 0.58)); }
.scrollbar-minimap:hover .minimap-viewport.minimap-viewport--red-outline {
    background: rgba(100, 100, 100, 0.38);
    border-color: rgba(255, 82, 82, 1);
}
.scrollbar-minimap.mm-dragging .minimap-viewport { background: var(--vscode-scrollbarSlider-activeBackground, rgba(191, 191, 191, 0.32)); }
.scrollbar-minimap.mm-dragging .minimap-viewport.minimap-viewport--red-outline {
    border-color: rgba(255, 82, 82, 1);
}

/* ===================================================================
   Auto-Hide Modal
   Pattern management popup for auto-hide feature.
   =================================================================== */
.auto-hide-modal { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; }
.auto-hide-modal-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.4); }
.auto-hide-modal-content {
    position: relative; z-index: 1; width: 400px; max-height: 60vh;
    background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
    border-radius: 6px; display: flex; flex-direction: column; overflow: hidden;
}
.auto-hide-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; font-size: 13px; font-weight: 600;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.auto-hide-modal-close { background: none; border: none; color: var(--vscode-descriptionForeground); font-size: 18px; cursor: pointer; padding: 0 4px; }
.auto-hide-modal-close:hover { color: var(--vscode-errorForeground, #f44); }
.auto-hide-modal-list { overflow-y: auto; max-height: 50vh; padding: 4px 0; }
.auto-hide-item {
    display: flex; align-items: center; gap: 6px; padding: 4px 12px; font-size: 12px;
}
.auto-hide-item:hover { background: var(--vscode-list-hoverBackground); }
.auto-hide-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.auto-hide-badge {
    font-size: 9px; padding: 1px 4px; border-radius: 3px;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
}
.auto-hide-badge.session { opacity: 0.6; }
.auto-hide-remove { background: none; border: none; color: var(--vscode-descriptionForeground); font-size: 14px; cursor: pointer; padding: 0 2px; }
.auto-hide-remove:hover { color: var(--vscode-errorForeground, #f44); }
.auto-hide-modal-empty { padding: 16px; text-align: center; font-size: 12px; color: var(--vscode-descriptionForeground); }

`;
}

export { getContextPopoverStyles } from '../viewer-context-menu/viewer-context-popover';

