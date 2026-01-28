/**
 * Client-side JavaScript for the search bar in the log viewer webview.
 * Provides regex search, match highlighting, and F3/Shift+F3 navigation.
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getSearchScript(): string {
    return /* javascript */ `
var searchBarEl = document.getElementById('search-bar');
var searchInputEl = document.getElementById('search-input');
var matchCountEl = document.getElementById('match-count');

var searchOpen = false;
var searchRegex = null;
var matchIndices = [];
var currentMatchIdx = -1;

function openSearch() {
    if (searchOpen) { searchInputEl.focus(); return; }
    searchOpen = true;
    searchBarEl.style.display = 'flex';
    searchInputEl.value = '';
    searchInputEl.focus();
    clearSearchState();
}

function closeSearch() {
    if (!searchOpen) return;
    searchOpen = false;
    searchBarEl.style.display = 'none';
    clearSearchState();
    renderViewport(true);
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
    if (!query) { clearSearchState(); renderViewport(true); return; }
    try {
        searchRegex = new RegExp(escapeForRegex(query), 'gi');
    } catch (e) {
        clearSearchState();
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
    renderViewport(true);
    if (currentMatchIdx >= 0) scrollToMatch();
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
document.getElementById('search-next').addEventListener('click', searchNext);
document.getElementById('search-prev').addEventListener('click', searchPrev);
document.getElementById('search-close').addEventListener('click', closeSearch);
`;
}
