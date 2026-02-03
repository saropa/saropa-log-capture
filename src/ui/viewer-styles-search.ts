/**
 * CSS styles for search panel and watch features in the viewer webview.
 *
 * Covers search slide-out panel and match highlighting.
 */
import { getSearchHistoryStyles } from './viewer-search-history';

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
    right: var(--icon-bar-width, 36px);
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
.search-input-wrapper {
    display: flex;
    align-items: center;
    width: 100%;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
}
.search-input-wrapper:focus-within {
    border-color: var(--vscode-focusBorder);
}
#search-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    color: var(--vscode-input-foreground);
    border: none;
    padding: 4px 2px 4px 8px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
}
.search-input-actions {
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 1px 2px;
    flex-shrink: 0;
}
.search-input-btn {
    background: transparent;
    border: 1px solid transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 1px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 20px;
    font-size: 14px;
}
.search-input-btn:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.search-input-btn.active {
    color: var(--vscode-inputOption-activeForeground, #fff);
    background: var(--vscode-inputOption-activeBackground, rgba(0, 120, 215, 0.6));
    border-color: var(--vscode-inputOption-activeBorder, var(--vscode-focusBorder, #007fd4));
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
/* Currently focused match gets a brighter highlight + brief pulse on navigation */
@keyframes match-pulse { 0% { box-shadow: 0 0 0 0 rgba(234, 92, 0, 0.4); } 100% { box-shadow: 0 0 0 4px transparent; } }
.current-match mark {
    background: var(--vscode-editor-findMatchBackground, rgba(255, 150, 50, 0.6));
    animation: match-pulse 0.4s ease-out;
}
.search-match {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.1));
}
` + getSearchHistoryStyles();
}
