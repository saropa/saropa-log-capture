/**
 * Client-side JavaScript for search toggle buttons in the log viewer.
 *
 * Handles mode (highlight/filter), regex, case sensitivity, and
 * whole-word toggles. Each toggle flips its active CSS class and
 * re-runs the current search via the shared updateSearch() function.
 */

/** Returns JavaScript for the search toggle button logic and event wiring. */
export function getSearchTogglesScript(): string {
    return /* javascript */ `
function toggleSearchMode() {
    searchFilterMode = !searchFilterMode;
    if (searchModeToggleEl) {
        searchModeToggleEl.textContent = searchFilterMode ? 'Mode: Filter' : 'Mode: Highlight';
    }
    updateSearch();
}

function toggleRegexMode() {
    searchRegexMode = !searchRegexMode;
    var btn = document.getElementById('search-regex-toggle');
    if (btn) btn.classList.toggle('active', searchRegexMode);
    if (searchInputEl.value) updateSearch();
}

function toggleCaseSensitive() {
    searchCaseSensitive = !searchCaseSensitive;
    var btn = document.getElementById('search-case-toggle');
    if (btn) btn.classList.toggle('active', searchCaseSensitive);
    if (searchInputEl.value) updateSearch();
}

function toggleWholeWord() {
    searchWholeWord = !searchWholeWord;
    var btn = document.getElementById('search-word-toggle');
    if (btn) btn.classList.toggle('active', searchWholeWord);
    if (searchInputEl.value) updateSearch();
}

if (searchModeToggleEl) {
    searchModeToggleEl.addEventListener('click', toggleSearchMode);
}
var searchRegexToggleEl = document.getElementById('search-regex-toggle');
if (searchRegexToggleEl) {
    searchRegexToggleEl.addEventListener('click', toggleRegexMode);
}
var searchCaseToggleEl = document.getElementById('search-case-toggle');
if (searchCaseToggleEl) {
    searchCaseToggleEl.addEventListener('click', toggleCaseSensitive);
}
var searchWordToggleEl = document.getElementById('search-word-toggle');
if (searchWordToggleEl) {
    searchWordToggleEl.addEventListener('click', toggleWholeWord);
}
`;
}
