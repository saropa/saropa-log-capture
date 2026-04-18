/**
 * CSS styles for search in the log viewer webview.
 *
 * **Layout:** The compact find row sits in `#session-nav` (see `viewer-content-body.ts`), not in `#panel-slot`.
 *
 * **Match-option toggles (case / whole word / regex):** By default they are hidden (`display: none`) until
 * either the search shell has `:focus-within` or `.session-search-compact` has `.has-search-query` (set from
 * script when the input has non-whitespace text). The workspace setting
 * `saropaLogCapture.viewerAlwaysShowSearchMatchOptions` adds `body.search-match-options-always`, which
 * forces the toggles visible at all times for power users.
 *
 * **Floating UI:** History and the highlight/filter mode popover use `position: fixed`; coordinates are
 * applied in `viewer-search.ts` (`positionSearchFloatingPanels`) so parent `overflow` does not clip them.
 *
 * **Highlighting:** `mark` / `.current-match` use editor find-match theme tokens where available.
 */
import { getSearchHistoryStyles } from '../viewer-search-filter/viewer-search-history';

export function getSearchStyles(): string {
    return /* css */ `

/* ===================================================================
   Session nav — compact find row (align with editor find / input options)
   =================================================================== */
.session-nav-search-outer {
    position: relative;
    margin-left: auto;
    /* Shrink on one row; grows up to max-width when wrapping to its own line. */
    flex: 1 1 200px;
    min-width: min(120px, 100%);
    max-width: 350px;
    align-self: center;
}
.session-search-compact {
    width: 100%;
}
.session-search-input-shell {
    display: flex;
    align-items: stretch;
    min-height: 24px;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    overflow: hidden;
}
.session-search-input-shell:focus-within {
    border-color: var(--vscode-focusBorder);
}
#search-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    color: var(--vscode-input-foreground);
    border: none;
    padding: 3px 4px 3px 6px;
    font-size: 13px;
    font-family: var(--vscode-font-family);
    line-height: 18px;
    outline: none;
}
.session-search-trailing {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 0;
    padding: 0 3px 0 0;
    border-left: 1px solid var(--vscode-input-border, var(--vscode-widget-border, rgba(127, 127, 127, 0.3)));
    margin-left: 2px;
    padding-left: 3px;
}
/* Case / whole word / regex — editor-style controls, shown only while searching (focus or active query) to keep the title bar calm. */
.session-search-toggles-inline {
    display: none;
    align-items: center;
    flex-shrink: 0;
    gap: 0;
    padding: 0 4px 0 2px;
    border-right: 1px solid var(--vscode-input-border, var(--vscode-widget-border, rgba(127, 127, 127, 0.3)));
    margin-right: 2px;
}
.session-search-input-shell:focus-within .session-search-toggles-inline,
.session-search-compact.has-search-query .session-search-toggles-inline {
    display: flex;
}
/* Workspace setting: always show case / whole word / regex (overrides progressive disclosure). */
body.search-match-options-always .session-search-toggles-inline {
    display: flex;
}
.session-search-match-count {
    font-size: 11px;
    line-height: 1;
    font-family: var(--vscode-font-family);
    color: var(--vscode-input-foreground);
    opacity: 0.85;
    white-space: nowrap;
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 5px 0 3px;
    user-select: none;
}
/* Borderless icon buttons — same idea as find widget / workbench toolbar */
.session-search-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    margin: 0;
    border: 1px solid transparent;
    border-radius: 2px;
    box-sizing: border-box;
    background: transparent;
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
    cursor: pointer;
}
.session-search-icon-btn:hover {
    background: var(--vscode-toolbar-hoverBackground);
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
}
.session-search-icon-btn:disabled {
    opacity: 0.35;
    cursor: default;
    background: transparent;
}
.session-search-icon-btn .codicon {
    font-size: 16px;
}
/* Clear button sits inside the input shell — reduce size to avoid stretching the row */
.search-clear-btn {
    flex-shrink: 0;
    opacity: 0.7;
}
.search-clear-btn:hover {
    opacity: 1;
}
.session-search-funnel-btn[aria-expanded="true"] {
    background: var(--vscode-toolbar-activeBackground, var(--vscode-button-secondaryBackground));
    color: var(--vscode-toolbar-activeForeground, var(--vscode-foreground));
}

/* Options popover (fixed position; coordinates from script) */
.search-options-popover {
    margin: 0;
    padding: 0;
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, var(--vscode-panel-border)));
    border-radius: 3px;
    box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.36));
}
.search-options-popover[hidden] {
    display: none !important;
}
.search-options-popover-inner {
    padding: 5px 6px 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.search-options-toggles {
    display: flex;
    align-items: center;
    gap: 2px;
}
.session-search-toggles-inline .search-input-btn,
.search-options-toggles .search-input-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
    cursor: pointer;
    padding: 2px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    box-sizing: border-box;
}
.session-search-toggles-inline .search-input-btn:hover,
.search-options-toggles .search-input-btn:hover {
    background: var(--vscode-toolbar-hoverBackground);
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
}
/* Match find-input-actions in find panel (not high-contrast inputOption pills unless theme sets them). */
.session-search-toggles-inline .search-input-btn.active,
.search-options-toggles .search-input-btn.active {
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground);
    border-color: var(--vscode-focusBorder);
}
.session-search-toggles-inline .search-input-btn .codicon,
.search-options-toggles .search-input-btn .codicon {
    font-size: 16px;
}
.search-mode-toggle {
    display: block;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 12px;
    font-family: var(--vscode-font-family);
    line-height: 18px;
    padding: 4px 6px;
    border-radius: 2px;
}
.search-mode-toggle:hover {
    background: var(--vscode-toolbar-hoverBackground);
}
.search-mode-toggle.active {
    background: var(--vscode-toolbar-activeBackground, var(--vscode-button-secondaryBackground));
    color: var(--vscode-toolbar-activeForeground, var(--vscode-foreground));
}

/* Floating search history under the field */
.session-search-history:not(:empty) {
    overflow-y: auto;
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, var(--vscode-panel-border)));
    border-radius: 3px;
    box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.36));
}

/* --- Search match highlighting --- */
mark {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
    color: inherit;
    border-radius: 2px;
}
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
