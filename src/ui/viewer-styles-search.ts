/**
 * CSS styles for search and watch features in the viewer webview.
 *
 * Covers search bar, match highlighting, and keyword watch chips.
 */
export function getSearchStyles(): string {
    return /* css */ `

/* ===================================================================
   Search Bar
   Inline find bar above the footer. Contains text input, match count,
   and prev/next navigation buttons.
   Uses --vscode-panel-background to match the VS Code bottom panel.
   Compact by default, expands when focused.
   =================================================================== */
#search-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    /* Panel background blends with the VS Code bottom panel chrome */
    background: var(--vscode-panel-background);
    border-top: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
    transition: padding 0.2s ease;
}
#search-bar:has(#search-input:focus) {
    padding: 4px 8px;
}
#search-input {
    flex: 1;
    min-width: 200px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 1px 4px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
    transition: padding 0.2s ease, font-size 0.2s ease;
}
#search-input:focus {
    border-color: var(--vscode-focusBorder);
    padding: 2px 6px;
    font-size: 12px;
}
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
`;
}
