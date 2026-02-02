/**
 * Client-side JavaScript for search toggle buttons in the log viewer.
 *
 * Handles mode (highlight/filter), regex, case sensitivity, and
 * whole-word toggles. Each toggle updates its button label and
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
    if (searchInputEl.value) {
        updateSearch();
    }
}

function toggleRegexMode() {
    searchRegexMode = !searchRegexMode;
    var btn = document.getElementById('search-regex-toggle');
    if (btn) {
        btn.textContent = searchRegexMode ? '.*' : 'Aa';
        btn.title = searchRegexMode ? 'Regex mode (click for literal)' : 'Literal mode (click for regex)';
    }
    if (searchInputEl.value) {
        updateSearch();
    }
}

function toggleCaseSensitive() {
    searchCaseSensitive = !searchCaseSensitive;
    var btn = document.getElementById('search-case-toggle');
    if (btn) {
        btn.textContent = searchCaseSensitive ? 'AA' : 'Aa';
        btn.title = searchCaseSensitive ? 'Case sensitive (click for case insensitive)' : 'Case insensitive (click for case sensitive)';
        btn.style.fontWeight = searchCaseSensitive ? 'bold' : 'normal';
    }
    if (searchInputEl.value) {
        updateSearch();
    }
}

function toggleWholeWord() {
    searchWholeWord = !searchWholeWord;
    var btn = document.getElementById('search-word-toggle');
    if (btn) {
        btn.style.fontWeight = searchWholeWord ? 'bold' : 'normal';
        btn.title = searchWholeWord ? 'Match whole word (click for partial)' : 'Match partial (click for whole word)';
    }
    if (searchInputEl.value) {
        updateSearch();
    }
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
