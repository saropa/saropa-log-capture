/**
 * CSS styles for search panel and watch features in the viewer webview.
 *
 * Covers search slide-out panel, match highlighting, and keyword watch chips.
 */
export function getSearchStyles(): string {
    return /* css */ `

/* ===================================================================
   Search Panel
   Slide-out panel from the right edge. Contains search input, mode
   toggles, match count, and prev/next navigation.
   Mirrors the options panel pattern (position:fixed, .visible class).
   =================================================================== */
#search-bar {
    position: fixed;
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
    z-index: 260;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: none;
}
#search-bar.visible {
    right: 0;
    pointer-events: auto;
}
.search-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--vscode-sideBarTitle-background, var(--vscode-panel-background));
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    font-weight: bold;
    font-size: 13px;
}
.search-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
}
.search-close:hover {
    color: var(--vscode-errorForeground, #f44);
}
.search-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
#search-input {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 4px 8px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
}
#search-input:focus {
    border-color: var(--vscode-focusBorder);
}
.search-toggles {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}
.search-toggles button {
    background: var(--vscode-button-secondaryBackground, transparent);
    border: 1px solid var(--vscode-input-border, var(--vscode-descriptionForeground));
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 3px;
}
.search-toggles button:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
.search-nav {
    display: flex;
    align-items: center;
    gap: 4px;
}
.search-nav button {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 3px;
}
.search-nav button:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
#match-count {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}
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
