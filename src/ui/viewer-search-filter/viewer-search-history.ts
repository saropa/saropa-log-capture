/**
 * Client-side JavaScript and CSS for search history in the log viewer.
 * Tracks recent search terms, persists in webview state, and provides
 * clickable history items plus Up/Down arrow navigation. Also registers
 * the debounced input handler so typing stays responsive on large logs.
 */

/** Returns CSS styles for search history items. */
export function getSearchHistoryStyles(): string {
    return /* css */ `
.search-history:empty { display: none; }
.search-history-header {
    padding: 4px 8px 2px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.7;
}
.search-history-item {
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.search-history-item:hover {
    background: var(--vscode-list-hoverBackground);
    color: var(--vscode-foreground);
}
`;
}

/** Returns JavaScript for search history and debounced input handling. */
export function getSearchHistoryScript(): string {
    return /* javascript */ `
var searchHistoryEl = document.getElementById('search-history');
var searchHistory = [];
var maxSearchHistory = 10;
var _savedHistState = vscodeApi.getState();
if (_savedHistState && _savedHistState.searchHistory) {
    searchHistory = _savedHistState.searchHistory;
}

function addToSearchHistory(term) {
    if (!term) return;
    var idx = searchHistory.indexOf(term);
    if (idx >= 0) searchHistory.splice(idx, 1);
    searchHistory.unshift(term);
    if (searchHistory.length > maxSearchHistory) searchHistory.length = maxSearchHistory;
    var st = vscodeApi.getState() || {};
    st.searchHistory = searchHistory;
    vscodeApi.setState(st);
}

function renderSearchHistory() {
    if (!searchHistoryEl) return;
    if (!searchHistory.length || searchInputEl.value) {
        searchHistoryEl.innerHTML = '';
        return;
    }
    var html = '<div class="search-history-header">Recent</div>';
    for (var i = 0; i < searchHistory.length; i++) {
        html += '<div class="search-history-item" data-idx="' + i + '">'
            + escapeHtml(searchHistory[i]) + '</div>';
    }
    searchHistoryEl.innerHTML = html;
}

if (searchHistoryEl) {
    searchHistoryEl.addEventListener('click', function(e) {
        var item = e.target.closest('.search-history-item');
        if (!item) return;
        var idx = parseInt(item.dataset.idx);
        if (idx >= 0 && idx < searchHistory.length) {
            searchInputEl.value = searchHistory[idx];
            updateClearButton();
            updateSearch();
            searchInputEl.focus();
        }
    });
}

/* Debounced search — shared by input and history navigation. */
var _searchTimer = null;
function debouncedSearch() {
    if (_searchTimer) clearTimeout(_searchTimer);
    _searchTimer = setTimeout(updateSearch, 150);
}

/* Debounced input handler — defers heavy search so typing stays responsive. */
var _histNavIdx = -1;
var _histOrigVal = '';
searchInputEl.addEventListener('input', function() {
    _histNavIdx = -1;
    updateClearButton();
    renderSearchHistory();
    debouncedSearch();
});

/* Up/Down arrow history navigation (like VS Code / terminal). */
searchInputEl.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowUp' && searchHistory.length > 0) {
        e.preventDefault();
        if (_histNavIdx < 0) _histOrigVal = searchInputEl.value;
        if (_histNavIdx < searchHistory.length - 1) {
            _histNavIdx++;
            searchInputEl.value = searchHistory[_histNavIdx];
            updateClearButton();
            debouncedSearch();
        }
    }
    if (e.key === 'ArrowDown' && _histNavIdx >= 0) {
        e.preventDefault();
        if (_histNavIdx > 0) {
            _histNavIdx--;
            searchInputEl.value = searchHistory[_histNavIdx];
        } else {
            _histNavIdx = -1;
            searchInputEl.value = _histOrigVal;
        }
        updateClearButton();
        debouncedSearch();
    }
});

renderSearchHistory();
`;
}
