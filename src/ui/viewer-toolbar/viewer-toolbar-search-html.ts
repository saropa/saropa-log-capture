/**
 * Search flyout HTML — floating overlay anchored top-right of the log area.
 *
 * Toggled via the view title bar `$(search)` icon or the webview toolbar search button.
 * Contains the search input with clear [x] button, case/word/regex toggles,
 * match navigation, highlight/filter mode popover, and search history.
 *
 * Preserved IDs: `#search-input`, `#search-clear-btn`, `#search-case-toggle`,
 * `#search-word-toggle`, `#search-regex-toggle`, `#match-count`, `#search-prev`,
 * `#search-next`, `#search-funnel-btn`, `#search-mode-toggle`,
 * `#search-options-popover`, `#search-history`.
 */

/** Search flyout HTML fragment — inserted after the toolbar element. */
export function getSearchFlyoutHtml(): string {
    return /* html */ `
<div id="search-flyout" class="search-flyout u-hidden" role="search" aria-label="Search in log">
    <div class="search-flyout-row">
        <div class="session-search-input-shell">
            <input id="search-input" type="text" placeholder="Filter or search in log\u2026" title="Type to search or filter log lines" autocomplete="off" />
            <button type="button" id="search-clear-btn" class="session-search-icon-btn search-clear-btn" title="Clear search" aria-label="Clear search" style="display:none">
                <span class="codicon codicon-close"></span>
            </button>
            <div class="session-search-trailing">
                <div class="session-search-toggles-inline search-input-actions" role="group" aria-label="Match options">
                    <button type="button" id="search-case-toggle" class="search-input-btn" title="Match Case — toggle case-sensitive search" aria-label="Match Case" aria-pressed="false"><span class="codicon codicon-case-sensitive"></span></button>
                    <button type="button" id="search-word-toggle" class="search-input-btn" title="Match Whole Word — only match complete words" aria-label="Match Whole Word" aria-pressed="false"><span class="codicon codicon-whole-word"></span></button>
                    <button type="button" id="search-regex-toggle" class="search-input-btn" title="Use Regular Expression — interpret search as regex pattern" aria-label="Use Regular Expression" aria-pressed="false"><span class="codicon codicon-regex"></span></button>
                </div>
                <span id="match-count" class="session-search-match-count" title="Number of matches found"></span>
                <button type="button" id="search-prev" class="session-search-icon-btn" title="Jump to the previous match (Shift+F3)" aria-label="Previous match">
                    <span class="codicon codicon-chevron-up"></span>
                </button>
                <button type="button" id="search-next" class="session-search-icon-btn" title="Jump to the next match (F3)" aria-label="Next match">
                    <span class="codicon codicon-chevron-down"></span>
                </button>
                <button type="button" id="search-funnel-btn" class="session-search-icon-btn session-search-funnel-btn" title="Switch between highlighting matches and filtering non-matching lines" aria-expanded="false" aria-haspopup="true" aria-label="Search display mode">
                    <span class="codicon codicon-filter"></span>
                </button>
            </div>
        </div>
    </div>
    <div id="search-options-popover" class="search-flyout-options" role="dialog" aria-label="Search display mode" hidden>
        <div class="search-options-popover-inner">
            <button type="button" id="search-mode-toggle" class="search-mode-toggle" title="Toggle between Highlight mode (show all, highlight matches) and Filter mode (hide non-matches)">Mode: Highlight</button>
        </div>
    </div>
    <div id="search-history" class="search-history search-flyout-history"></div>
</div>`;
}
