import { getSearchPopoversScript } from './viewer-search-popovers';
/**
 * In-log search — webview script (injected string) for the Saropa Log Capture viewer.
 *
 * **Where it runs:** Bundled into the log viewer webview with other `get*Script()` modules.
 * **UI:** The DOM lives in the session nav (`getSessionNavSearchHtml`); there is no `#search-bar`
 * slide-out. Options and history use `position: fixed` panels positioned by
 * `positionSearchFloatingPanels()` so the session-nav wrapper’s `overflow` does not clip them.
 *
 * **Lifecycle:** `openSearch` / `closeSearch` gate the document-level “click outside to dismiss”
 * behaviour. `searchInput` `focus` calls `openSearch`
 * so keyboard users get the same semantics as Ctrl+F. Escape closes the options popover first,
 * then the search session.
 *
 * **Integration:** Cross-file find wiring is in `viewer-search-setup-from-find.ts`
 * (injected after this script). `window.positionSearchFloatingPanels` is called from search history rendering when
 * the list is cleared as well as when it is shown (see `viewer-search-history.ts`).
 *
 * **Search history:** `renderSearchHistory()` is gated on `searchOpen`. `closeSearch()` blurs the input and
 * calls `renderSearchHistory()` so the fixed Recent list does not outlive the find session.
 */

/** Returns the JavaScript for search (highlight, filter, F3 navigation). */
export function getSearchScript(): string {
    return getSearchPopoversScript() + /* javascript */ `
var sessionNavSearchOuter = document.getElementById('search-flyout');
var searchInputEl = document.getElementById('search-input');
var matchCountEl = document.getElementById('match-count');
var toolbarSearchBadge = document.getElementById('toolbar-search-count');
var searchModeToggleEl = document.getElementById('search-mode-toggle');
var searchFunnelBtn = document.getElementById('search-funnel-btn');
var searchOptionsPopover = document.getElementById('search-options-popover');
var sessionSearchCompactEl = document.querySelector('.session-search-compact');

/** Show case/word/regex toggles when the field is focused or there is a non-empty query (keeps the nav bar compact otherwise). */
function syncSearchMatchOptionsVisibility() {
    if (!sessionSearchCompactEl) return;
    sessionSearchCompactEl.classList.toggle('has-search-query', !!(searchInputEl && searchInputEl.value && searchInputEl.value.trim()));
}

var searchOpen = false;
var searchOptionsOpen = false;
var searchRegex = null;
var matchIndices = [];
var currentMatchIdx = -1;
var searchFilterMode = false;
var searchFilterDirty = false;
var searchRegexMode = false;
var searchCaseSensitive = false;
var searchWholeWord = false;

function openSearch() {
    if (!searchInputEl) return;
    if (searchOpen) { searchInputEl.focus(); return; }
    searchOpen = true;
    if (typeof closeOptionsPanel === 'function') closeOptionsPanel();
    if (typeof closeSessionPanel === 'function') closeSessionPanel();
    searchInputEl.focus();
    if (searchInputEl.value) { updateSearch(); } else { clearSearchState(); }
    updateClearButton();
    if (typeof renderSearchHistory === 'function') renderSearchHistory();
    requestAnimationFrame(positionSearchFloatingPanels);
    syncSearchMatchOptionsVisibility();
}

function closeSearch() {
    if (!searchOpen) return;
    closeSearchOptionsPopover();
    if (typeof addToSearchHistory === 'function' && searchInputEl && searchInputEl.value.trim()) addToSearchHistory(searchInputEl.value.trim());
    searchOpen = false;
    if (searchInputEl) searchInputEl.blur();
    if (typeof renderSearchHistory === 'function') renderSearchHistory();
    if (typeof clearActivePanel === 'function') clearActivePanel('search');
    searchRegex = null;
    clearSearchFilteredFlags();
    renderViewport(true); // clears match highlighting (and covers non-filter case)
    syncSearchMatchOptionsVisibility();
}

function toggleSearchPanel() {
    if (searchOpen) { closeSearch(); } else { openSearch(); }
}

function clearSearchState() {
    searchRegex = null;
    matchIndices = [];
    currentMatchIdx = -1;
    if (matchCountEl) matchCountEl.textContent = '';
    if (toolbarSearchBadge) toolbarSearchBadge.textContent = '';
    var sp = document.getElementById('search-prev');
    var sn = document.getElementById('search-next');
    if (sp) sp.disabled = true;
    if (sn) sn.disabled = true;
}

function escapeForRegex(s) {
    return s.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
}

function updateSearch() {
    try {
        var query = searchInputEl ? searchInputEl.value : '';
        if (!query) {
            clearSearchState();
            clearSearchFilteredFlags();
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
            if (matchCountEl) matchCountEl.textContent = 'Invalid regex';
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
            clearSearchFilteredFlags();
            renderViewport(true);
        }
        if (currentMatchIdx >= 0 && !searchFilterMode) scrollToMatch();
    } finally {
        syncSearchMatchOptionsVisibility();
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
    searchFilterDirty = true;
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); }
}

/** Reset the searchFiltered flag on every line item so all lines become visible again. */
function clearSearchFilteredFlags() {
    if (!searchFilterDirty) return;
    searchFilterDirty = false;
    for (var i = 0; i < allLines.length; i++) {
        allLines[i].searchFiltered = false;
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); }
}

function updateMatchDisplay() {
    if (matchIndices.length === 0) {
        if (matchCountEl) matchCountEl.textContent = (searchInputEl && searchInputEl.value) ? 'No matches' : '';
    } else {
        if (matchCountEl) matchCountEl.textContent = (currentMatchIdx + 1) + '/' + matchIndices.length;
    }
    var sp = document.getElementById('search-prev');
    var sn = document.getElementById('search-next');
    var navDisabled = matchIndices.length === 0;
    if (sp) sp.disabled = navDisabled;
    if (sn) sn.disabled = navDisabled;
    if (toolbarSearchBadge) {
        toolbarSearchBadge.textContent = matchIndices.length > 0 ? String(matchIndices.length) : '';
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
    if (currentMatchIdx < 0 || window.isContextMenuOpen) return;
    var idx = matchIndices[currentMatchIdx];
    if (typeof expandContinuationForSearch === 'function') expandContinuationForSearch(idx);
    var cumH = (typeof prefixSums !== 'undefined' && prefixSums && idx < prefixSums.length)
        ? prefixSums[idx] : 0;
    if (!cumH) { for (var i = 0; i < idx; i++) cumH += allLines[i].height; }
    if (!logEl) return;
    if (window.setProgrammaticScroll) window.setProgrammaticScroll();
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

if (searchInputEl) searchInputEl.addEventListener('focus', function() {
    if (!searchOpen) { openSearch(); }
});

if (searchInputEl) searchInputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.shiftKey ? searchPrev() : searchNext(); e.preventDefault(); }
    if (e.key === 'Escape') {
        if (searchOptionsOpen) { closeSearchOptionsPopover(); }
        else { closeSearch(); }
        e.preventDefault();
    }
});
var searchNextBtn = document.getElementById('search-next');
var searchPrevBtn = document.getElementById('search-prev');
if (searchNextBtn) searchNextBtn.addEventListener('click', searchNext);
if (searchPrevBtn) searchPrevBtn.addEventListener('click', searchPrev);
if (searchFunnelBtn) {
    searchFunnelBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleSearchOptionsPopover();
    });
}

function updateClearButton() {
    /* no-op — retained for compatibility with search history input handler */
}

/* Prevent clicks inside the session search strip from reaching the
   document-level close handler that calls closeSearch(). */
if (sessionNavSearchOuter) {
    sessionNavSearchOuter.addEventListener('click', function(e) { e.stopPropagation(); });
}

/* Close search when clicking outside the strip (and close options popover on any outside click). */
document.addEventListener('click', function(e) {
    if (searchOptionsOpen && searchOptionsPopover && !searchOptionsPopover.contains(e.target) && searchFunnelBtn && !searchFunnelBtn.contains(e.target)) {
        closeSearchOptionsPopover();
    }
    if (!searchOpen) return;
    if (sessionNavSearchOuter && sessionNavSearchOuter.contains(e.target)) return;
    closeSearch();
});
`;
}
