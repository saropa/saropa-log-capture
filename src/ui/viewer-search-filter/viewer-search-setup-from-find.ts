/**
 * Webview script fragment: `window.setupFromFindInFiles` for cross-file find integration.
 *
 * Injected after `getSearchScript` / toggles / history so `updateSearch`, `searchInputEl`, and
 * match indices are already defined. Keeps `viewer-search.ts` under the max-lines budget.
 */

/** Returns JS assigned to `window.setupFromFindInFiles` (no wrapping IIFE). */
export function getSearchSetupFromFindInFilesScript(): string {
    return /* javascript */ `
/** Activate in-file search from Find in Files without focusing the search strip. */
window.setupFromFindInFiles = function(msg) {
    searchCaseSensitive = !!msg.caseSensitive;
    searchRegexMode = !!msg.useRegex;
    searchWholeWord = !!msg.wholeWord;
    searchInputEl.value = msg.query || '';
    searchFilterMode = false;
    var cBtn = document.getElementById('search-case-toggle');
    var wBtn = document.getElementById('search-word-toggle');
    var rBtn = document.getElementById('search-regex-toggle');
    if (cBtn) {
        cBtn.classList.toggle('active', searchCaseSensitive);
        cBtn.setAttribute('aria-pressed', searchCaseSensitive ? 'true' : 'false');
    }
    if (wBtn) {
        wBtn.classList.toggle('active', searchWholeWord);
        wBtn.setAttribute('aria-pressed', searchWholeWord ? 'true' : 'false');
    }
    if (rBtn) {
        rBtn.classList.toggle('active', searchRegexMode);
        rBtn.setAttribute('aria-pressed', searchRegexMode ? 'true' : 'false');
    }
    if (searchModeToggleEl) {
        searchModeToggleEl.textContent = 'Mode: Highlight';
        searchModeToggleEl.classList.remove('active');
    }
    updateSearch();
    if (currentMatchIdx >= 0) scrollToMatch();
};
`;
}
