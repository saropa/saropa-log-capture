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
        <div class="search-input-wrapper">
            <input id="search-input" type="text" placeholder="Search..." />
            <div class="search-input-actions">
                <button id="search-case-toggle" class="search-input-btn" title="Match Case"><span class="codicon codicon-case-sensitive"></span></button>
                <button id="search-word-toggle" class="search-input-btn" title="Match Whole Word"><span class="codicon codicon-whole-word"></span></button>
                <button id="search-regex-toggle" class="search-input-btn" title="Use Regular Expression"><span class="codicon codicon-regex"></span></button>
            </div>
        </div>
        <div id="search-history" class="search-history"></div>
        <div class="search-toggles">
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
    if (typeof closeSessionPanel === 'function') closeSessionPanel();
    searchBarEl.classList.add('visible');
    if (matchIndices.length === 0) { searchInputEl.value = ''; }
    searchInputEl.focus();
    if (searchInputEl.value) { updateSearch(); } else { clearSearchState(); }
    updateClearButton();
    if (typeof renderSearchHistory === 'function') renderSearchHistory();
}

function closeSearch() {
    if (!searchOpen) return;
    if (typeof addToSearchHistory === 'function' && searchInputEl.value.trim()) addToSearchHistory(searchInputEl.value.trim());
    searchOpen = false;
    searchBarEl.classList.remove('visible');
    if (typeof clearActivePanel === 'function') clearActivePanel('search');
    searchRegex = null;
    clearSearchFilter();
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
        clearSearchFilter();
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
        renderViewport(true);
    }
    if (currentMatchIdx >= 0 && !searchFilterMode) scrollToMatch();
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
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); }
}

function clearSearchFilter() {
    for (var i = 0; i < allLines.length; i++) {
        allLines[i].searchFiltered = false;
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); }
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
    var cumH = (typeof prefixSums !== 'undefined' && prefixSums && idx < prefixSums.length)
        ? prefixSums[idx] : 0;
    if (!cumH) { for (var i = 0; i < idx; i++) cumH += allLines[i].height; }
    suppressScroll = true;
    logEl.scrollTop = cumH - logEl.clientHeight / 2;
    suppressScroll = false;
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

searchInputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.shiftKey ? searchPrev() : searchNext(); e.preventDefault(); }
    if (e.key === 'Escape') { closeSearch(); e.preventDefault(); }
});
document.getElementById('search-next').addEventListener('click', searchNext);
document.getElementById('search-prev').addEventListener('click', searchPrev);
document.getElementById('search-close').addEventListener('click', closeSearch);

function updateClearButton() {
    /* no-op — retained for compatibility with search history input handler */
}

/* Prevent clicks inside the search panel from reaching the
   document-level close handler that calls closeSearch(). */
searchBarEl.addEventListener('click', function(e) { e.stopPropagation(); });

/* Close search panel when clicking outside it. */
document.addEventListener('click', function(e) {
    if (!searchOpen) return;
    var ibBtn = document.getElementById('ib-search');
    if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
    closeSearch();
});

/** Activate in-file search from Find in Files without opening the search panel. */
window.setupFromFindInFiles = function(msg) {
    searchCaseSensitive = !!msg.caseSensitive;
    searchRegexMode = !!msg.useRegex;
    searchWholeWord = !!msg.wholeWord;
    searchInputEl.value = msg.query || '';
    searchFilterMode = false;
    updateSearch();
    if (currentMatchIdx >= 0) scrollToMatch();
};
`;
}
