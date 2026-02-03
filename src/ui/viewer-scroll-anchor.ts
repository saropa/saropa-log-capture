/**
 * Scroll Anchor Script
 *
 * Provides prefix-sum based position lookups, binary search for
 * O(log n) viewport calculations, and scroll anchoring so that
 * filter/layout changes keep the same content visible.
 *
 * Globals introduced:
 *   suppressScroll   — skip handleScroll during programmatic scrollTop
 *   prefixSums       — cumulative height array for O(1) position lookup
 *   recalcAndRender  — anchored replacement for recalcHeights + renderViewport
 */
export function getScrollAnchorScript(): string {
    return /* javascript */ `
/** When true, the scroll event handler skips rendering. */
var suppressScroll = false;

/**
 * Cumulative height array: prefixSums[i] = sum of heights for lines 0..i-1.
 * Length is allLines.length + 1. prefixSums[0] = 0.
 * @type {number[]|null}
 */
var prefixSums = null;

/**
 * Rebuild the prefix-sum array from scratch in O(n).
 * Also sets totalHeight to the final cumulative value.
 */
function buildPrefixSums() {
    var len = allLines.length;
    prefixSums = new Array(len + 1);
    prefixSums[0] = 0;
    for (var i = 0; i < len; i++) {
        prefixSums[i + 1] = prefixSums[i] + allLines[i].height;
    }
    totalHeight = prefixSums[len];
}

/**
 * Binary search on prefixSums to find the line at a pixel offset.
 * @param {number} px — scroll offset in pixels
 * @returns {{ index: number, offset: number }}
 *   index  — the line index whose top edge is at or just before px
 *   offset — how far px is past that line's top edge
 */
function findIndexAtOffset(px) {
    if (!prefixSums || prefixSums.length < 2) {
        return { index: 0, offset: 0 };
    }
    var lo = 0;
    var hi = allLines.length;
    while (lo < hi) {
        var mid = (lo + hi) >>> 1;
        if (prefixSums[mid + 1] <= px) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    var idx = Math.min(lo, allLines.length - 1);
    return { index: idx, offset: px - prefixSums[idx] };
}

/**
 * Anchored recalc + render. Replaces every
 *   recalcHeights(); renderViewport(true);
 * call site with scroll-position preservation.
 *
 * When autoScroll is true the viewer sticks to the bottom.
 * Otherwise the first visible line is kept at its current
 * screen position after heights change.
 */
function recalcAndRender() {
    var anchorIdx = -1;
    var anchorOff = 0;

    if (!autoScroll && allLines.length > 0 && logEl.clientHeight > 0) {
        if (prefixSums) {
            var a = findIndexAtOffset(logEl.scrollTop);
            anchorIdx = a.index;
            anchorOff = a.offset;
        }
    }

    recalcHeights();
    buildPrefixSums();
    renderViewport(true);

    suppressScroll = true;
    if (anchorIdx >= 0) {
        if (anchorIdx >= allLines.length) {
            anchorIdx = allLines.length - 1;
        }
        if (anchorIdx >= 0) {
            logEl.scrollTop = prefixSums[anchorIdx] + anchorOff;
        }
    } else if (autoScroll) {
        logEl.scrollTop = logEl.scrollHeight;
    }
    suppressScroll = false;
}
`;
}
