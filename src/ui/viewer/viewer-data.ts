/**
 * Core data management and rendering for the log viewer webview.
 *
 * Contains the line data store (addToData, trimData), height calculations
 * (recalcHeights, calcItemHeight), and the virtual scrolling renderer
 * (renderItem, renderViewport).
 */
import type { ViewerRepeatThresholds } from '../../modules/db/drift-db-repeat-thresholds';
import type { ViewerSlowBurstThresholds } from '../../modules/db/drift-db-slow-burst-thresholds';
import type { ViewerDbDetectorToggles } from '../../modules/config/config-types';
import { getCompressStreakScript } from './viewer-data-compress-streak';
import { getViewerDataAddScript } from './viewer-data-add';
import { getViewerDataHelpers } from './viewer-data-helpers';
import { getViewportRenderScript } from './viewer-data-viewport';

/** Options for building the viewer data webview script. */
export interface ViewerDataScriptOptions {
    readonly repeatThresholds?: Partial<ViewerRepeatThresholds>;
    readonly viewerDbInsightsEnabled?: boolean;
    readonly staticSqlFromFingerprintEnabled?: boolean;
    readonly slowBurstThresholds?: Partial<ViewerSlowBurstThresholds>;
    readonly dbDetectorToggles?: Partial<ViewerDbDetectorToggles>;
}

export function getViewerDataScript(opts: ViewerDataScriptOptions = {}): string {
    const {
        repeatThresholds,
        viewerDbInsightsEnabled = true,
        staticSqlFromFingerprintEnabled = true,
        slowBurstThresholds,
        dbDetectorToggles,
    } = opts;
    return getViewerDataHelpers(repeatThresholds, viewerDbInsightsEnabled, slowBurstThresholds, dbDetectorToggles) + getCompressStreakScript() + getViewerDataAddScript(staticSqlFromFingerprintEnabled) + /* javascript */ `

function scrollToAnchorSeq(seq) {
    if (seq == null || !isFinite(seq) || allLines.length === 0 || window.isContextMenuOpen) return;
    var i, it;
    for (i = 0; i < allLines.length; i++) {
        it = allLines[i];
        if (it && it.seq === seq && it.height > 0) {
            var offset = 0;
            for (var j = 0; j < i; j++) offset += allLines[j].height;
            if (window.setProgrammaticScroll) window.setProgrammaticScroll();
            suppressScroll = true;
            logEl.scrollTop = Math.max(0, offset - logEl.clientHeight / 2 + (it.height || ROW_HEIGHT) / 2);
            suppressScroll = false;
            autoScroll = false;
            if (typeof jumpBtn !== 'undefined' && jumpBtn) jumpBtn.style.display = 'block';
            if (typeof renderViewport === 'function') renderViewport(false);
            return;
        }
    }
}

function trimData() {
    if (allLines.length <= MAX_LINES) return;
    var excess = allLines.length - MAX_LINES;
    var removedHeight = 0;
    var trimmedForCont = [];
    for (var i = 0; i < excess; i++) {
        if (typeof unregisterSourceTag === 'function') unregisterSourceTag(allLines[i]);
        if (typeof unregisterClassTags === 'function') unregisterClassTags(allLines[i]);
        if (typeof unregisterSqlPattern === 'function') unregisterSqlPattern(allLines[i]);
        if (allLines[i].type === 'stack-header') delete groupHeaderMap[allLines[i].groupId];
        if (allLines[i].contGroupId != null) trimmedForCont.push(allLines[i]);
        if (allLines[i].autoHidden && typeof autoHiddenCount !== 'undefined') autoHiddenCount--;
        removedHeight += allLines[i].height;
        totalHeight -= allLines[i].height;
    }
    allLines.splice(0, excess);
    activeGroupHeader = null;
    if (typeof cleanupContinuationAfterTrim === 'function') cleanupContinuationAfterTrim(excess, trimmedForCont);
    // Adjust art-block tracker: if in-progress block was trimmed away, reset; otherwise shift index
    if (typeof artBlockTracker !== 'undefined' && artBlockTracker.startIdx >= 0) {
        artBlockTracker.startIdx -= excess;
        if (artBlockTracker.startIdx < 0) { artBlockTracker.startIdx = -1; artBlockTracker.count = 0; }
    }
    // Adjust repeat tracker index after splice so it still points at the correct line
    if (repeatTracker.lastLineIndex >= 0) {
        repeatTracker.lastLineIndex -= excess;
        if (repeatTracker.lastLineIndex < 0) repeatTracker.lastLineIndex = -1;
    }
    if (repeatTracker.lastRepeatNotificationIndex >= 0) {
        repeatTracker.lastRepeatNotificationIndex -= excess;
        if (repeatTracker.lastRepeatNotificationIndex < 0) repeatTracker.lastRepeatNotificationIndex = -1;
    }
    // Adjust hidden line indices after splice
    if (typeof adjustHiddenIndicesAfterTrim === 'function') adjustHiddenIndicesAfterTrim(excess);
    if (removedHeight > 0 && !autoScroll && !window.isContextMenuOpen) {
        if (window.setProgrammaticScroll) window.setProgrammaticScroll();
        suppressScroll = true;
        logEl.scrollTop = Math.max(0, logEl.scrollTop - removedHeight);
        suppressScroll = false;
    }
    if (typeof finalizeSqlPatternState === 'function') finalizeSqlPatternState();
    else if (typeof buildPrefixSums === 'function') buildPrefixSums();
    if (typeof pruneDbDetectorStateAfterTrim === 'function' && allLines.length > 0) {
        var oldestKept = allLines[0].timestamp;
        if (typeof oldestKept === 'number' && isFinite(oldestKept)) {
            pruneDbDetectorStateAfterTrim(oldestKept);
        }
    }
    if (typeof updateSqlToolbarButton === 'function') updateSqlToolbarButton();
}

/**
 * Compression modes:
 * - compressLinesMode: collapse consecutive identical type==='line' rows (normalized plain text).
 *   Earlier rows in each run get compressDupHidden; the last gets compressDupCount.
 * - compressNonConsecutiveMode: collapse identical type==='line' rows globally.
 *   The first seen row keeps compressDupCount; later duplicates get compressDupHidden.
 *
 * Blank lines are intentionally excluded from both modes (blank handling is controlled only by
 * hideBlankLines).
 *
 * Duplicate grouping runs after level/source/search filters set flags on each row. Only rows
 * that would still be eligible for layout (same rules as calcItemHeight except compressDup*)
 * participate, so e.g. "Errors only" does not show one error line with a ×N badge inflated by
 * hidden info duplicates.
 *
 * Always clears compressDupHidden / compressDupCount on every call first, then returns early if
 * compress is off — so toggling compress off cannot leave stale flags on line objects.
 *
 * Performance: O(n) over allLines per recalcHeights. With compress on, addLines must call
 * recalcHeights (see viewer-script-messages) because a new tail line can change which prior
 * line is hidden in a duplicate run.
 */
function applyCompressDedupModes() {
    var i;
    for (i = 0; i < allLines.length; i++) {
        var cleared = allLines[i];
        if (cleared.compressDupHidden) cleared.compressDupHidden = false;
        if (cleared.compressDupCount != null) delete cleared.compressDupCount;
    }
    var useConsecutive = (typeof compressLinesMode !== 'undefined') && compressLinesMode;
    var useGlobal = (typeof compressNonConsecutiveMode !== 'undefined') && compressNonConsecutiveMode;
    if (!useConsecutive && !useGlobal) return;

    function lineDedupeKey(row) {
        if (!row || row.type !== 'line') return null;
        var t = stripTags(row.html || '').replace(/\\s+/g, ' ').trim();
        if (t.length === 0) return null;
        return t;
    }

    /**
     * True if this line may occupy vertical space when compressDup* flags are cleared.
     * Mirrors calcItemHeight filter gates so duplicate collapse matches what the user can see
     * under current level/source/search/app-only/blank-collapse options.
     */
    function isLineEligibleForDupCompress(row) {
        if (!row || row.type !== 'line') return false;
        if (typeof window !== 'undefined' && window.enabledSources && row.source && window.enabledSources.indexOf(row.source) < 0) return false;
        if (row.filteredOut || row.excluded || row.levelFiltered || row.sourceFiltered || row.classFiltered || row.sqlPatternFiltered || row.searchFiltered || row.errorSuppressed || row.scopeFiltered || row.repeatHidden || (row.type === 'line' && row.timeRangeFiltered)) return false;
        var peeking = (typeof isPeeking !== 'undefined' && isPeeking);
        if (!peeking && (row.userHidden || row.autoHidden)) return false;
        if ((typeof hideBlankLines !== 'undefined' && hideBlankLines) && isLineContentBlank(row)) return false;
        if (typeof isTierHidden === 'function' && isTierHidden(row)) return false;
        return true;
    }

    if (useConsecutive) {
        var runStart = -1;
        var runKey = null;

        function flushRun(endInclusive) {
            if (runStart < 0) return;
            var runLen = endInclusive - runStart + 1;
            if (runLen > 1) {
                var j;
                for (j = runStart; j < endInclusive; j++) {
                    allLines[j].compressDupHidden = true;
                }
                allLines[endInclusive].compressDupCount = runLen;
            }
            runStart = -1;
            runKey = null;
        }

        for (i = 0; i < allLines.length; i++) {
            var item = allLines[i];
            var k = lineDedupeKey(item);
            if (k === null || !isLineEligibleForDupCompress(item)) {
                flushRun(i - 1);
                continue;
            }
            if (runKey === null) {
                runStart = i;
                runKey = k;
            } else if (k !== runKey) {
                flushRun(i - 1);
                runStart = i;
                runKey = k;
            }
        }
        flushRun(allLines.length - 1);
        return;
    }

    var firstIdxByKey = Object.create(null);
    var countByKey = Object.create(null);
    for (i = 0; i < allLines.length; i++) {
        var globalItem = allLines[i];
        var globalKey = lineDedupeKey(globalItem);
        if (globalKey === null || !isLineEligibleForDupCompress(globalItem)) continue;
        if (firstIdxByKey[globalKey] == null) {
            firstIdxByKey[globalKey] = i;
            countByKey[globalKey] = 1;
        } else {
            globalItem.compressDupHidden = true;
            countByKey[globalKey]++;
        }
    }
    for (var key in countByKey) {
        var count = countByKey[key];
        if (count > 1) {
            allLines[firstIdxByKey[key]].compressDupCount = count;
        }
    }
}

/**
 * Recalculate all line heights from scratch.
 * Called by every filter (category, exclusion, level) after setting their flags,
 * and by toggleStackGroup after toggling collapsed state. This is the single
 * source of truth for height — individual filters never manipulate heights directly.
 */
function recalcHeights() {
    applyCompressDedupModes();
    totalHeight = 0;
    for (var i = 0; i < allLines.length; i++) {
        allLines[i].height = calcItemHeight(allLines[i]);
        totalHeight += allLines[i].height;
    }
    /* Invalidate visible-line cache so updateLineCount recalc runs after filter/layout change. */
    if (typeof window !== 'undefined') window.__visibleCountDirty = true;
    if (typeof buildPrefixSums === 'function') buildPrefixSums();
}

${getViewportRenderScript()}
`;
}
