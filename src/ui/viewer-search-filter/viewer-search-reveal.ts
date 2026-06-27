/**
 * Search match reveal — webview script for the Saropa Log Capture viewer.
 *
 * **Problem this solves:** a search match can be invisible even when the count
 * badge says "1 of 1" — the line sits inside a collapsed group (continuation /
 * stack trace / Flutter banner / ASCII-art block) or is hidden by a filter
 * (level, tier, exclusions, source/class/SQL tag, scope, metadata, time range,
 * manual hide). Navigating to such a match scrolled to a zero-height row, so the
 * user saw nothing. This module makes a search match ALWAYS visible.
 *
 * **Two reveal categories, treated differently on purpose:**
 *  - COLLAPSES are reversible groupings the user can re-open at will, so we
 *    auto-expand them silently (`expandCollapsesForMatch`).
 *  - FILTERS encode user intent to hide, so we do NOT silently disable them.
 *    Instead we force-show that ONE matched line via the established
 *    `peekOverride` mechanism (same as gap/dedup peeks in viewer-peek-chevron.ts
 *    — non-destructive, leaves global filter state intact) AND surface a notice
 *    naming the responsible filter with a one-click "disable that filter" action
 *    (`searchFilterHider` + the `#search-hidden-notice` element).
 *
 * Concatenated into the same script scope as viewer-search.ts (shared
 * `allLines`, `matchIndices`, `calcItemHeight`, `recalcHeights`, `renderViewport`).
 */
export function getSearchRevealScript(): string {
    return /* javascript */ `
/* Indices of lines force-shown by search via peekOverride this session. Tracked
   so closing / clearing / re-running the search restores their hidden state. */
var searchRevealIndices = [];
/* Descriptor for the filter hiding the current match (or null). Held so the
   notice's Disable button knows which filter to turn off. */
var currentSearchHider = null;

var searchHiddenNoticeEl = document.getElementById('search-hidden-notice');
var searchHiddenLabelEl = document.getElementById('search-hidden-label');
var searchHiddenDisableEl = document.getElementById('search-hidden-disable');

/* Table of filter "hiders". Each entry: test(item) → is THIS filter hiding the
   line; nameKey → human filter name for the notice; disable() → globally turn
   the filter off (guarded by typeof so a missing helper is a no-op, never a
   crash). Ordered most-likely-first; the first match wins. Mirrors the gate
   order in calcItemHeight (viewer-data-helpers-core.ts). */
var SEARCH_FILTER_HIDERS = [
    { nameKey: 'viewer.search.filterName.level', test: function(it) { return !!it.levelFiltered; },
      disable: function() { if (typeof selectAllLevels === 'function') selectAllLevels(); } },
    { nameKey: 'viewer.search.filterName.tier', test: function(it) { return typeof isTierHidden === 'function' && isTierHidden(it); },
      disable: function() { if (typeof resetTiersToAll === 'function') { resetTiersToAll(); if (typeof recalcHeights === 'function') recalcHeights(); if (typeof renderViewport === 'function') renderViewport(true); } } },
    { nameKey: 'viewer.search.filterName.exclusions', test: function(it) { return !!it.excluded; },
      disable: function() { if (typeof setExclusionsEnabled === 'function') setExclusionsEnabled(false); } },
    { nameKey: 'viewer.search.filterName.sourceTag', test: function(it) { return !!it.sourceFiltered; },
      disable: function() { if (typeof hiddenSourceTags !== 'undefined') hiddenSourceTags = {}; if (typeof applySourceTagFilter === 'function') applySourceTagFilter(); } },
    { nameKey: 'viewer.search.filterName.classTag', test: function(it) { return !!it.classFiltered; },
      disable: function() { if (typeof hiddenClassTags !== 'undefined') hiddenClassTags = {}; if (typeof applyClassTagFilter === 'function') applyClassTagFilter(); } },
    { nameKey: 'viewer.search.filterName.sqlPattern', test: function(it) { return !!it.sqlPatternFiltered; },
      disable: function() { if (typeof hiddenSqlVerbs !== 'undefined') hiddenSqlVerbs = {}; if (typeof applySqlPatternFilter === 'function') applySqlPatternFilter(); } },
    { nameKey: 'viewer.search.filterName.scope', test: function(it) { return !!it.scopeFiltered; },
      disable: function() { if (typeof setScopeLevel === 'function') setScopeLevel('all'); } },
    { nameKey: 'viewer.search.filterName.metadata', test: function(it) { return !!it.metadataFiltered; },
      disable: function() { if (typeof clearMetadataFilters === 'function') clearMetadataFilters(); } },
    { nameKey: 'viewer.search.filterName.timeRange', test: function(it) { return !!it.timeRangeFiltered; },
      disable: function() { if (typeof clearDbTimeRangeFilter === 'function') clearDbTimeRangeFilter(); } },
    { nameKey: 'viewer.search.filterName.category', test: function(it) { return !!it.filteredOut; },
      disable: function() { activeFilters = null; if (typeof applyFilter === 'function') applyFilter(); } },
    { nameKey: 'viewer.search.filterName.errorSuppression', test: function(it) { return !!it.errorSuppressed; },
      disable: function() { if (typeof suppressTransientErrors !== 'undefined') suppressTransientErrors = false; if (typeof applyErrorSuppression === 'function') applyErrorSuppression(); } },
    { nameKey: 'viewer.search.filterName.hidden', test: function(it) { return !!it.userHidden; },
      disable: function() { if (typeof unhideAll === 'function') unhideAll(); } },
    { nameKey: 'viewer.search.filterName.autoHide', test: function(it) { return !!it.autoHidden; },
      disable: function() { if (typeof sessionAutoHidePatterns !== 'undefined') sessionAutoHidePatterns = []; if (typeof persistentAutoHidePatterns !== 'undefined') persistentAutoHidePatterns = []; if (typeof applyAutoHide === 'function') applyAutoHide(); } }
];

/** Return the filter hiding this line as { name, disable }, or null. Reads the
    filter FLAGS directly (not peekOverride) so a line force-shown by a previous
    search nav still reports its underlying filter when revisited. */
function searchFilterHider(item) {
    if (!item) return null;
    for (var i = 0; i < SEARCH_FILTER_HIDERS.length; i++) {
        var h = SEARCH_FILTER_HIDERS[i];
        if (h.test(item)) return { name: vt(h.nameKey), disable: h.disable };
    }
    return null;
}

/** Expand any collapsed grouping that hides this match. Sets the collapse flags
    directly (idempotent) rather than toggling, so calling twice never re-collapses.
    Returns true if anything changed (caller recalcs heights). */
function expandCollapsesForMatch(idx) {
    var item = allLines[idx];
    if (!item) return false;
    var changed = false;
    if (item.contIsChild && item.contGroupId != null && typeof contHeaderMap !== 'undefined') {
        var ch = contHeaderMap[item.contGroupId];
        if (ch && ch.contCollapsed) { ch.contCollapsed = false; changed = true; }
    }
    if (item.type === 'stack-frame' && item.groupId >= 0 && typeof groupHeaderMap !== 'undefined') {
        var gh = groupHeaderMap[item.groupId];
        if (gh && gh.collapsed !== false) { gh.collapsed = false; changed = true; }
    }
    if (item.bannerGroupId !== undefined && item.bannerGroupId >= 0 && item.bannerRole !== 'header' && typeof bannerHeaderMap !== 'undefined') {
        var bh = bannerHeaderMap[item.bannerGroupId];
        if (bh && bh.bannerCollapsed) { bh.bannerCollapsed = false; changed = true; }
    }
    /* ASCII-art blocks store artCollapsed per row; toggleAsciiArtBlock flips the
       whole contiguous block. Only call when collapsed so the toggle expands. */
    if (item.artCollapsed && typeof toggleAsciiArtBlock === 'function') { toggleAsciiArtBlock(idx); changed = true; }
    return changed;
}

/** Make the match at idx visible: expand collapses, and if a filter still hides
    it, force-show just that line via peekOverride and raise the filter notice.
    Called from scrollToMatch BEFORE the cumulative-height read so prefix sums
    reflect the newly-visible row. */
function revealMatchForSearch(idx) {
    var item = allLines[idx];
    if (!item) return;
    var changed = expandCollapsesForMatch(idx);
    var hider = searchFilterHider(item);
    if (hider) {
        /* peekOverride bypasses every filter gate in calcItemHeight for this one
           row (NOT collapse gates — those are handled above). searchPeek marks it
           as ours so clearSearchReveals only undoes search-set overrides, never a
           gap/dedup peek the user opened. No peekAnchorKey: that would make the
           divider logic render a collapse chevron we do not want for search. */
        if (!item.peekOverride) {
            item.peekOverride = true;
            item.searchPeek = true;
            if (searchRevealIndices.indexOf(idx) < 0) searchRevealIndices.push(idx);
            changed = true;
        }
        showSearchHiddenNotice(hider);
    } else {
        hideSearchHiddenNotice();
    }
    if (changed && typeof recalcHeights === 'function') recalcHeights();
}

/** Undo every peekOverride this search set, leaving gap/dedup peeks alone. Does
    NOT re-collapse expanded groups — re-collapsing what the user searched into
    would be surprising. Caller re-renders. */
function clearSearchReveals() {
    if (!searchRevealIndices.length) return;
    for (var i = 0; i < searchRevealIndices.length; i++) {
        var item = allLines[searchRevealIndices[i]];
        if (item && item.searchPeek) {
            item.searchPeek = false;
            /* Only drop the override if no real peek group still owns this row. */
            if (item.peekAnchorKey == null) item.peekOverride = false;
        }
    }
    searchRevealIndices = [];
}

/** Count matches that are hidden by a filter/collapse (so the badge can report
    "N hidden by filters"). A row force-shown by search counts as hidden — it is
    only visible because we peeked it. */
function searchMatchIsHidden(idx) {
    var item = allLines[idx];
    if (!item) return false;
    if (item.searchPeek) return true;
    return (typeof calcItemHeight === 'function') ? (calcItemHeight(item) === 0) : false;
}

function countHiddenSearchMatches() {
    var n = 0;
    for (var i = 0; i < matchIndices.length; i++) {
        if (searchMatchIsHidden(matchIndices[i])) n++;
    }
    return n;
}

/** Show the "hidden by the <Filter> filter" notice with a Disable action. */
function showSearchHiddenNotice(hider) {
    currentSearchHider = hider;
    if (searchHiddenLabelEl) searchHiddenLabelEl.textContent = vt('viewer.search.hiddenNotice', hider.name);
    if (searchHiddenDisableEl) searchHiddenDisableEl.textContent = vt('viewer.search.hiddenNotice.disable', hider.name);
    if (searchHiddenNoticeEl) searchHiddenNoticeEl.hidden = false;
}

function hideSearchHiddenNotice() {
    currentSearchHider = null;
    if (searchHiddenNoticeEl) searchHiddenNoticeEl.hidden = true;
}

/* Disable the responsible filter on click, drop the now-redundant peek, and
   re-center on the match (which is visible normally now, so no notice). */
if (searchHiddenDisableEl) {
    searchHiddenDisableEl.addEventListener('click', function(e) {
        e.stopPropagation();
        if (currentSearchHider && typeof currentSearchHider.disable === 'function') currentSearchHider.disable();
        clearSearchReveals();
        hideSearchHiddenNotice();
        if (typeof recalcHeights === 'function') recalcHeights();
        if (typeof renderViewport === 'function') renderViewport(true);
        if (typeof updateMatchDisplay === 'function') updateMatchDisplay();
        if (typeof scrollToMatch === 'function') scrollToMatch();
    });
}
`;
}
