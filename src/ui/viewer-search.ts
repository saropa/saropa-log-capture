/**
 * Client-side JavaScript and HTML for the search panel in the log viewer.
 * Provides regex search, match highlighting, and F3/Shift+F3 navigation.
 * Panel slides in from the right, matching the options panel pattern.
 */

/** Returns the HTML for the search slide-out panel. */
export function getSearchPanelHtml(): string {
    return /* html */ `<div id="search-bar">
    <div class="search-header">
        <span>Search</span>
        <button class="search-close" id="search-close" title="Close (Escape)">&times;</button>
    </div>
    <div class="search-content">
        <input id="search-input" type="text" placeholder="Search..." />
        <div class="search-toggles">
            <button id="search-regex-toggle" title="Literal mode (click for regex)">Aa</button>
            <button id="search-case-toggle" title="Case insensitive (click for case sensitive)">Aa</button>
            <button id="search-word-toggle" title="Match partial (click for whole word)">\\b</button>
            <button id="search-mode-toggle" title="Toggle highlight/filter mode">Mode: Highlight</button>
        </div>
        <div class="search-nav">
            <span id="match-count"></span>
            <button id="search-prev" title="Previous (Shift+F3)">&#x25B2; Prev</button>
            <button id="search-next" title="Next (F3)">&#x25BC; Next</button>
        </div>
    </div>
</div>`;
}

/** Returns the JavaScript for the search panel logic. */
export function getSearchScript(): string {
    return /* javascript */ `
var searchBarEl = document.getElementById('search-bar');
var searchInputEl = document.getElementById('search-input');
var matchCountEl = document.getElementById('match-count');
var searchModeToggleEl = document.getElementById('search-mode-toggle');

var searchOpen = false;
var searchRegex = null;
var matchIndices = [];
var currentMatchIdx = -1;
var searchFilterMode = false;
var searchRegexMode = false;
var searchCaseSensitive = false;
var searchWholeWord = false;

function openSearch() {
    if (searchOpen) { searchInputEl.focus(); return; }
    searchOpen = true;
    if (typeof closeOptionsPanel === 'function') closeOptionsPanel();
    searchBarEl.classList.add('visible');
    searchInputEl.value = '';
    searchInputEl.focus();
    clearSearchState();
}

function closeSearch() {
    if (!searchOpen) return;
    searchOpen = false;
    searchBarEl.classList.remove('visible');
    clearSearchState();
    if (searchFilterMode) {
        clearSearchFilter();
    }
    renderViewport(true);
}

function toggleSearchPanel() {
    if (searchOpen) { closeSearch(); } else { openSearch(); }
}

function clearSearchState() {
    searchRegex = null;
    matchIndices = [];
    currentMatchIdx = -1;
    matchCountEl.textContent = '';
}

function escapeForRegex(s) {
    return s.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
}

function updateSearch() {
    var query = searchInputEl.value;
    if (!query) {
        clearSearchState();
        if (searchFilterMode) {
            clearSearchFilter();
        }
        renderViewport(true);
        return;
    }
    try {
        var pattern = searchRegexMode ? query : escapeForRegex(query);
        if (searchWholeWord && !searchRegexMode) {
            pattern = '\\\\b' + pattern + '\\\\b';
        }
        var flags = 'g' + (searchCaseSensitive ? '' : 'i');
        searchRegex = new RegExp(pattern, flags);
    } catch (e) {
        clearSearchState();
        matchCountEl.textContent = 'Invalid regex';
        return;
    }
    matchIndices = [];
    for (var i = 0; i < allLines.length; i++) {
        var plain = stripTags(allLines[i].html);
        searchRegex.lastIndex = 0;
        if (searchRegex.test(plain)) {
            matchIndices.push(i);
        }
    }
    currentMatchIdx = matchIndices.length > 0 ? 0 : -1;
    updateMatchDisplay();
    if (searchFilterMode) {
        applySearchFilter();
    } else {
        clearSearchFilter();
    }
    renderViewport(true);
    if (currentMatchIdx >= 0 && !searchFilterMode) scrollToMatch();
}

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

function applySearchFilter() {
    var matchSet = new Set(matchIndices);
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') {
            item.searchFiltered = false;
        } else {
            item.searchFiltered = !matchSet.has(i);
        }
    }
    recalcHeights();
}

function clearSearchFilter() {
    for (var i = 0; i < allLines.length; i++) {
        allLines[i].searchFiltered = false;
    }
    recalcHeights();
}

function updateMatchDisplay() {
    if (matchIndices.length === 0) {
        matchCountEl.textContent = searchInputEl.value ? 'No matches' : '';
    } else {
        matchCountEl.textContent = (currentMatchIdx + 1) + '/' + matchIndices.length;
    }
}

function searchNext() {
    if (matchIndices.length === 0) return;
    currentMatchIdx = (currentMatchIdx + 1) % matchIndices.length;
    updateMatchDisplay();
    scrollToMatch();
    renderViewport(true);
}

function searchPrev() {
    if (matchIndices.length === 0) return;
    currentMatchIdx = (currentMatchIdx - 1 + matchIndices.length) % matchIndices.length;
    updateMatchDisplay();
    scrollToMatch();
    renderViewport(true);
}

function scrollToMatch() {
    if (currentMatchIdx < 0) return;
    var idx = matchIndices[currentMatchIdx];
    var cumH = 0;
    for (var i = 0; i < idx; i++) cumH += allLines[i].height;
    logEl.scrollTop = cumH - logEl.clientHeight / 2;
    autoScroll = false;
}

function highlightSearchInHtml(html) {
    if (!searchRegex) return html;
    searchRegex.lastIndex = 0;
    return html.replace(/(<[^>]*>)|([^<]+)/g, function(m, tag, text) {
        if (tag) return tag;
        searchRegex.lastIndex = 0;
        return text.replace(searchRegex, '<mark>$&</mark>');
    });
}

function isSearchMatch(idx) {
    return searchRegex && matchIndices.indexOf(idx) !== -1;
}

function isCurrentMatch(idx) {
    return currentMatchIdx >= 0 && matchIndices[currentMatchIdx] === idx;
}

searchInputEl.addEventListener('input', updateSearch);
searchInputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.shiftKey ? searchPrev() : searchNext(); e.preventDefault(); }
    if (e.key === 'Escape') { closeSearch(); e.preventDefault(); }
});
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
document.getElementById('search-next').addEventListener('click', searchNext);
document.getElementById('search-prev').addEventListener('click', searchPrev);
document.getElementById('search-close').addEventListener('click', closeSearch);

/* Toggle button in footer toolbar. */
var searchPanelBtn = document.getElementById('search-panel-btn');
if (searchPanelBtn) {
    searchPanelBtn.addEventListener('click', toggleSearchPanel);
}

/* Close search panel when clicking outside it. */
document.addEventListener('click', function(e) {
    if (!searchOpen) return;
    var panel = document.getElementById('search-bar');
    var searchBtn = document.getElementById('search-panel-btn');
    if (panel && !panel.contains(e.target) && searchBtn !== e.target && !searchBtn?.contains(e.target)) {
        closeSearch();
    }
});
`;
}
