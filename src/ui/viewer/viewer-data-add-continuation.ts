/**
 * Continuation line collapsing for the log viewer.
 *
 * Flutter logcat splits long messages (e.g. SQL batch inserts) across many
 * consecutive lines with identical timestamps and logcat tags. This module
 * detects those runs and lets the user collapse them behind a `[+N lines]`
 * badge on the first line (the "header").
 *
 * **Detection heuristic:** consecutive `line` items where:
 * - Same `ts` (exact equality, non-null)
 * - Same `logcatTag` — OR, when neither line has a logcatTag: same
 *   `category` and child has no `sourceTag` (a bracket tag like `[log]`
 *   signals a new log entry, not a continuation)
 * - Max group size: 200
 *
 * Groups with >5 children auto-collapse; ≤5 stay expanded.
 *
 * Properties added to existing `line` items (no new item types):
 * - Header: `contGroupId`, `contCollapsed`, `contChildCount`
 * - Child:  `contGroupId`, `contIsChild`
 *
 * State: `contHeaderMap[groupId]` → header item.
 */

/** Returns the JavaScript for continuation line detection and toggling. */
export function getContinuationScript(): string {
    return /* javascript */ `
var activeContHeader = null;
var nextContGroupId = 0;
var contHeaderMap = {};
var contMaxChildren = 200;
var contAutoCollapseThreshold = 5;
var lastNormalLineForCont = null;

/** True when item can extend the active continuation group. */
function matchesContinuation(item, prev) {
    if (!prev || !item) return false;
    if (item.timestamp == null || prev.timestamp == null) return false;
    if (item.timestamp !== prev.timestamp) return false;
    // Primary path: both lines have a logcat tag — match on tag equality.
    if (item.logcatTag && prev.logcatTag) return item.logcatTag === prev.logcatTag;
    // Fallback for console lines (e.g. dart:developer log() split by DA):
    // same category, neither has a logcat tag, and the child has no source
    // tag (a [tag] prefix signals a new log entry, not a continuation).
    if (!item.logcatTag && !prev.logcatTag && item.category && item.category === prev.category) {
        return !item.sourceTag;
    }
    return false;
}

/**
 * Seal the active continuation group and auto-collapse if large.
 * When auto-collapsing, adjusts totalHeight and child heights so the
 * scroll area is correct without waiting for the next recalcHeights().
 */
function finalizeContinuationGroup() {
    if (!activeContHeader) return;
    var childCount = activeContHeader.contChildCount || 0;
    if (childCount > contAutoCollapseThreshold) {
        activeContHeader.contCollapsed = true;
        var gid = activeContHeader.contGroupId;
        var remaining = childCount;
        for (var ci = allLines.length - 1; ci >= 0 && remaining > 0; ci--) {
            if (allLines[ci].contGroupId === gid && allLines[ci].contIsChild) {
                if (allLines[ci].height > 0) {
                    totalHeight -= allLines[ci].height;
                    allLines[ci].height = 0;
                }
                remaining--;
            }
        }
    }
    activeContHeader = null;
}

/**
 * Called after pushing a normal line item to allLines.
 * Detects continuation runs and marks headers / children.
 */
function checkContinuationOnNormalLine(lineItem) {
    if (lineItem.type !== 'line' || lineItem.isSeparator) {
        finalizeContinuationGroup();
        lastNormalLineForCont = null;
        return;
    }

    if (activeContHeader) {
        if (matchesContinuation(lineItem, activeContHeader)
            && activeContHeader.contChildCount < contMaxChildren) {
            lineItem.contGroupId = activeContHeader.contGroupId;
            lineItem.contIsChild = true;
            activeContHeader.contChildCount++;
            lastNormalLineForCont = lineItem;
            return;
        }
        finalizeContinuationGroup();
    }

    if (lastNormalLineForCont && matchesContinuation(lineItem, lastNormalLineForCont)) {
        var gid = nextContGroupId++;
        var header = lastNormalLineForCont;
        header.contGroupId = gid;
        header.contCollapsed = false;
        header.contChildCount = 1;
        contHeaderMap[gid] = header;
        lineItem.contGroupId = gid;
        lineItem.contIsChild = true;
        activeContHeader = header;
    }

    lastNormalLineForCont = lineItem;
}

/** Break any active continuation (called before markers, stack frames, repeats). */
function breakContinuationGroup() {
    finalizeContinuationGroup();
    lastNormalLineForCont = null;
}

/** Toggle collapsed state of a continuation group. */
function toggleContinuationGroup(gid) {
    var header = contHeaderMap[gid];
    if (!header) return;
    header.contCollapsed = !header.contCollapsed;
    if (typeof recalcHeights === 'function') recalcHeights();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/** Reset all continuation state (used by clear). */
function resetContinuationState() {
    activeContHeader = null;
    nextContGroupId = 0;
    for (var k in contHeaderMap) delete contHeaderMap[k];
    lastNormalLineForCont = null;
}

/**
 * Clean up contHeaderMap entries for trimmed lines.
 * Called from trimData after splice.
 */
function cleanupContinuationAfterTrim(excess, trimmedLines) {
    for (var i = 0; i < trimmedLines.length; i++) {
        var t = trimmedLines[i];
        if (t.contGroupId != null && contHeaderMap[t.contGroupId] === t) {
            delete contHeaderMap[t.contGroupId];
        }
    }
    activeContHeader = null;
    lastNormalLineForCont = null;
}

/**
 * Expand any collapsed continuation group containing a search match child.
 * Called from scrollToMatch so hidden children become visible and the
 * cumulative-height scroll calculation uses correct values.
 */
function expandContinuationForSearch(idx) {
    var item = allLines[idx];
    if (!item || !item.contIsChild || item.contGroupId == null) return;
    var header = contHeaderMap[item.contGroupId];
    if (header && header.contCollapsed) {
        header.contCollapsed = false;
        if (typeof recalcHeights === 'function') recalcHeights();
    }
}
`;
}
