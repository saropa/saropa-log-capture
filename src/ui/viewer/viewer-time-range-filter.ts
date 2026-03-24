/**
 * Optional time-range filter driven by the Performance → Database tab timeline brush (DB_13).
 * Composes with category/level/search filters via `timeRangeFiltered` on `type === 'line'` rows only.
 */

/** Returns the embedded viewer script; must run after `recalcHeights` / `calcItemHeight` exist. */
export function getViewerTimeRangeFilterScript(): string {
  return /* javascript */ `
var dbTimeFilterActive = false;
var dbTimeFilterMin = 0;
var dbTimeFilterMax = 0;

/** Clear DB tab time brush filter without affecting other filters. */
function clearDbTimeRangeFilter() {
    if (!dbTimeFilterActive) return;
    dbTimeFilterActive = false;
    dbTimeFilterMin = 0;
    dbTimeFilterMax = 0;
    var i, it;
    for (i = 0; i < allLines.length; i++) {
        it = allLines[i];
        if (it && it.timeRangeFiltered) it.timeRangeFiltered = false;
    }
    if (typeof recalcAndRender === 'function') recalcAndRender();
    else { recalcHeights(); renderViewport(true); }
    if (typeof scheduleMinimap === 'function') scheduleMinimap();
    if (typeof updateFilterBadge === 'function') updateFilterBadge();
    if (typeof window !== 'undefined' && typeof window.updateDbTimelineChrome === 'function') window.updateDbTimelineChrome();
    if (typeof window !== 'undefined' && typeof window._refreshDbPerfTabAfterTimeFilter === 'function') window._refreshDbPerfTabAfterTimeFilter();
}

/**
 * Restrict visible log lines to [lo, hi] ms timestamps (inclusive). Only type === 'line' rows with
 * numeric timestamps participate; other rows stay visible. Does not run until the user completes a brush.
 */
function applyDbTimeRangeFilter(lo, hi) {
    if (typeof lo !== 'number' || typeof hi !== 'number' || !isFinite(lo) || !isFinite(hi)) return;
    if (lo > hi) { var swap = lo; lo = hi; hi = swap; }
    dbTimeFilterActive = true;
    dbTimeFilterMin = lo;
    dbTimeFilterMax = hi;
    var i, it, ts;
    for (i = 0; i < allLines.length; i++) {
        it = allLines[i];
        if (!it || it.type !== 'line') {
            if (it && it.timeRangeFiltered) it.timeRangeFiltered = false;
            continue;
        }
        ts = it.timestamp;
        if (typeof ts !== 'number' || !isFinite(ts)) {
            it.timeRangeFiltered = false;
            continue;
        }
        it.timeRangeFiltered = ts < lo || ts > hi;
    }
    if (typeof recalcAndRender === 'function') recalcAndRender();
    else { recalcHeights(); renderViewport(true); }
    if (typeof scheduleMinimap === 'function') scheduleMinimap();
    if (typeof updateFilterBadge === 'function') updateFilterBadge();
    if (typeof window !== 'undefined' && typeof window.scrollToFirstLineInDbTimeRange === 'function') {
        window.scrollToFirstLineInDbTimeRange(lo, hi);
    }
    if (typeof window !== 'undefined' && typeof window._refreshDbPerfTabAfterTimeFilter === 'function') {
        window._refreshDbPerfTabAfterTimeFilter();
    }
    if (typeof window !== 'undefined' && typeof window.updateDbTimelineChrome === 'function') window.updateDbTimelineChrome();
}
`;
}
