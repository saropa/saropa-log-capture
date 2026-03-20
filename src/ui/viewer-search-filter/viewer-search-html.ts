/**
 * Session-nav compact search — static HTML fragment for the log viewer webview.
 *
 * Injected inside `#session-nav` (see `viewer-content-body.ts`), **not** in `#panel-slot`.
 * Keeps stable element ids consumed by `getSearchScript`, `getSearchTogglesScript`, and
 * `getSearchHistoryScript` (`#search-input`, toggle buttons, `#search-history`, etc.).
 */

/** HTML for the title-bar search strip (far right) and floating aux panels. */
export function getSessionNavSearchHtml(): string {
    return /* html */ `<div id="session-nav-search-outer" class="session-nav-search-outer">
    <div class="session-search-compact" role="search" aria-label="Search in log">
        <div class="session-search-input-shell">
            <input id="search-input" type="text" placeholder="Filter or search in log…" autocomplete="off" />
            <div class="session-search-trailing">
                <span id="match-count" class="session-search-match-count"></span>
                <button type="button" id="search-prev" class="session-search-icon-btn" title="Previous match (Shift+F3)" aria-label="Previous match">
                    <span class="codicon codicon-chevron-up"></span>
                </button>
                <button type="button" id="search-next" class="session-search-icon-btn" title="Next match (F3)" aria-label="Next match">
                    <span class="codicon codicon-chevron-down"></span>
                </button>
                <button type="button" id="search-funnel-btn" class="session-search-icon-btn session-search-funnel-btn" title="Match options and mode" aria-expanded="false" aria-haspopup="true" aria-label="Search options">
                    <span class="codicon codicon-filter"></span>
                </button>
            </div>
        </div>
    </div>
    <div id="search-options-popover" class="search-options-popover" role="dialog" aria-label="Search options" hidden>
        <div class="search-options-popover-inner">
            <div class="search-input-actions search-options-toggles">
                <button type="button" id="search-case-toggle" class="search-input-btn" title="Match Case"><span class="codicon codicon-case-sensitive"></span></button>
                <button type="button" id="search-word-toggle" class="search-input-btn" title="Match Whole Word"><span class="codicon codicon-whole-word"></span></button>
                <button type="button" id="search-regex-toggle" class="search-input-btn" title="Use Regular Expression"><span class="codicon codicon-regex"></span></button>
            </div>
            <button type="button" id="search-mode-toggle" class="search-mode-toggle" title="Toggle highlight/filter mode">Mode: Highlight</button>
        </div>
    </div>
    <div id="search-history" class="search-history session-search-history"></div>
</div>`;
}
