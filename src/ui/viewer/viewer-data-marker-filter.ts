/**
 * DB signal marker visibility + consecutive-collapse passes.
 *
 * Runs inside recalcHeights() so marker flags track the current filter state:
 * - applyDbSignalMarkerVisibility(): hides db-signal markers when the user
 *   disables them via the filter drawer, OR when the anchor DB line is
 *   itself filtered/hidden (avoids "jump" links to invisible targets).
 * - applyConsecutiveDbMarkerCollapse(): collapses adjacent visible db-signal
 *   markers into one with a "× N" badge when nothing visible sits between them
 *   (prevents the stacking the user reported in DB_16 burst output).
 *
 * Flags read by calcItemHeight: `markerHidden`, `markerCollapsed`.
 * Flag read by renderItem: `markerCollapseCount` (shown only when > 1).
 */
export function getViewerDataMarkerFilterScript(): string {
    return /* javascript */ `
/** User toggle (Filters → SQL Commands → "Show DB signal markers"). Default on for backward compat. */
var dbSignalMarkersVisible = true;

/** Mirror of calcItemHeight's zero-height conditions for a non-marker line. Kept in sync when
 *  calcItemHeight gains new filter flags. Centralised here so both marker passes agree. */
function isNonMarkerItemEffectivelyHidden(it) {
    if (!it || it.type === 'marker') return false;
    if (it.filteredOut || it.excluded || it.levelFiltered || it.sourceFiltered
        || it.classFiltered || it.sqlPatternFiltered || it.searchFiltered
        || it.errorSuppressed || it.scopeFiltered || it.repeatHidden
        || it.compressDupHidden || it.metadataFiltered) return true;
    if (it.type === 'line' && it.timeRangeFiltered) return true;
    var peeking = (typeof isPeeking !== 'undefined' && isPeeking);
    if (!peeking && (it.userHidden || it.autoHidden)) return true;
    if (typeof isTierHidden === 'function' && isTierHidden(it)) return true;
    return false;
}

/** Set \`markerHidden\` on every db-signal marker based on the user toggle and anchor visibility. */
function applyDbSignalMarkerVisibility() {
    /* Build seq → index lookup once so anchor probing is O(1) per marker. Seq is unique per line item. */
    var seqToIdx = Object.create(null);
    for (var i = 0; i < allLines.length; i++) {
        var it = allLines[i];
        if (it && it.type !== 'marker' && typeof it.seq === 'number') {
            seqToIdx[it.seq] = i;
        }
    }
    for (var j = 0; j < allLines.length; j++) {
        var m = allLines[j];
        if (!m || m.type !== 'marker' || m.category !== 'db-signal') continue;
        if (!dbSignalMarkersVisible) { m.markerHidden = true; continue; }
        /* Orphan check: if the marker's jump target is filtered out, hide the marker too —
           clicking it would silently no-op (scrollToAnchorSeq skips height-0 items). */
        var anc = m.anchorSeq;
        if (typeof anc !== 'number') { m.markerHidden = false; continue; }
        var idx = seqToIdx[anc];
        if (idx == null) { m.markerHidden = false; continue; }
        m.markerHidden = isNonMarkerItemEffectivelyHidden(allLines[idx]);
    }
}

/** Merge runs of adjacent visible db-signal markers (nothing visible between) into one "× N" badge. */
function applyConsecutiveDbMarkerCollapse() {
    var headIdx = -1;
    for (var i = 0; i < allLines.length; i++) {
        var it = allLines[i];
        if (!it) continue;
        if (it.type === 'marker' && it.category === 'db-signal' && !it.markerHidden) {
            if (headIdx >= 0) {
                /* If any non-marker, non-hidden line lies between headIdx and i, the markers are
                   NOT consecutive visually — start a new run instead of collapsing. */
                var anyBetween = false;
                for (var k = headIdx + 1; k < i; k++) {
                    var kit = allLines[k];
                    if (!kit || kit.type === 'marker') continue;
                    if (!isNonMarkerItemEffectivelyHidden(kit)) { anyBetween = true; break; }
                }
                if (!anyBetween) {
                    it.markerCollapsed = true;
                    var head = allLines[headIdx];
                    head.markerCollapseCount = (head.markerCollapseCount || 1) + 1;
                    continue;
                }
            }
            headIdx = i;
            it.markerCollapsed = false;
            it.markerCollapseCount = 1;
        } else if (it.type !== 'marker') {
            /* A visible non-marker line resets the run — next marker starts a fresh head. */
            if (!isNonMarkerItemEffectivelyHidden(it)) headIdx = -1;
        }
    }
}

/** Filter-drawer handler: persists within the session (not per-file) and re-renders. */
function setDbSignalMarkersVisible(v) {
    dbSignalMarkersVisible = !!v;
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else if (typeof recalcHeights === 'function') { recalcHeights(); if (typeof renderViewport === 'function') renderViewport(true); }
}
`;
}
