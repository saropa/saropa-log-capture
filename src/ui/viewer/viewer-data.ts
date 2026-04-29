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
    readonly viewerDbSignalsEnabled?: boolean;
    readonly staticSqlFromFingerprintEnabled?: boolean;
    readonly slowBurstThresholds?: Partial<ViewerSlowBurstThresholds>;
    readonly dbDetectorToggles?: Partial<ViewerDbDetectorToggles>;
}

export function getViewerDataScript(opts: ViewerDataScriptOptions = {}): string {
    const {
        repeatThresholds,
        viewerDbSignalsEnabled = true,
        staticSqlFromFingerprintEnabled = true,
        slowBurstThresholds,
        dbDetectorToggles,
    } = opts;
    return getViewerDataHelpers(repeatThresholds, viewerDbSignalsEnabled, slowBurstThresholds, dbDetectorToggles) + getCompressStreakScript() + getViewerDataAddScript(staticSqlFromFingerprintEnabled) + /* javascript */ `

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
        /* Also clear the hidden-indices list stamped for the peek-dedup click
           handler. Without this, toggling compression off then on while a
           survivor's list is stale could point peekDedupFold at indices that
           are no longer hidden. */
        if (cleared.compressDupHiddenIndices != null) delete cleared.compressDupHiddenIndices;
    }
    var useConsecutive = (typeof compressLinesMode !== 'undefined') && compressLinesMode;
    var useGlobal = (typeof compressNonConsecutiveMode !== 'undefined') && compressNonConsecutiveMode;
    if (!useConsecutive && !useGlobal) return;

    /** Build a dedup key from the visible message body — strip the same
     *  structured/source-tag prefix that renderItem removes so lines that
     *  look identical on screen produce the same key.
     *  WHY stack-frame is accepted alongside 'line': a Drift SELECT flood
     *  (11 000+ queries) emits identical \`DriftDebugInterceptor._log (...dart:92:5)\`
     *  stack frames under every call. Gating on \`type === 'line'\` alone meant
     *  non-consecutive compression passed them through untouched and the viewer
     *  rendered thousands of visually identical stack rows. Same plain text
     *  produces the same dedup key across both types. See bugs/unified-line-collapsing.md. */
    function lineDedupeKey(row) {
        if (!row) return null;
        if (row.type !== 'line' && row.type !== 'stack-frame') return null;
        var html = row.html || '';
        /* Strip structured prefix (timestamp/PID/tag) the same way renderItem does. */
        var useStructured = (typeof structuredLineParsing !== 'undefined' && structuredLineParsing);
        if (useStructured && row.structuredPrefixLen > 0 && typeof stripHtmlPrefix === 'function') {
            html = stripHtmlPrefix(html, row.structuredPrefixLen);
        } else if (typeof stripSourceTagPrefix !== 'undefined' && stripSourceTagPrefix && row.sourceTag) {
            html = html.replace(/^(?:\\[[^\\]]+\\]\\s?)+/, '');
        }
        var t = stripTags(html).replace(/\\s+/g, ' ').trim();
        if (t.length === 0) return null;
        return t;
    }

    /**
     * True if this line may occupy vertical space when compressDup* flags are cleared.
     * Mirrors calcItemHeight filter gates so duplicate collapse matches what the user can see
     * under current level/source/search/app-only/blank-collapse options.
     * Accepts both 'line' and 'stack-frame' (see lineDedupeKey for rationale).
     */
    function isLineEligibleForDupCompress(row) {
        if (!row) return false;
        if (row.type !== 'line' && row.type !== 'stack-frame') return false;
        if (row.filteredOut || row.excluded || row.levelFiltered || row.sourceFiltered || row.classFiltered || row.sqlPatternFiltered || row.searchFiltered || row.errorSuppressed || row.scopeFiltered || row.repeatHidden || row.metadataFiltered || (row.type === 'line' && row.timeRangeFiltered)) return false;
        var peeking = (typeof isPeeking !== 'undefined' && isPeeking);
        if (!peeking && (row.userHidden || row.autoHidden)) return false;
        if ((typeof hideBlankLines !== 'undefined' && hideBlankLines) && isLineContentBlank(row)) return false;
        if (typeof isTierHidden === 'function' && isTierHidden(row)) return false;
        return true;
    }

    if (useConsecutive) {
        var runStart = -1;
        var runKey = null;

        /* compressDupHiddenIndices: list of allLines indices hidden under this
           run's survivor. The peek-dedup click handler (viewer-peek-chevron.ts)
           reads it to reveal exactly this fold without touching other folds.
           WHY stamped on the survivor and not recomputed on click: click-time
           recomputation would need lineDedupeKey access plus a full scan of
           allLines; stamping is O(N) once per dedup pass and O(1) per click. */
        function flushRun(endInclusive) {
            if (runStart < 0) return;
            var runLen = endInclusive - runStart + 1;
            if (runLen > 1) {
                var j, _hidden = [];
                for (j = runStart; j < endInclusive; j++) {
                    allLines[j].compressDupHidden = true;
                    _hidden.push(j);
                }
                allLines[endInclusive].compressDupCount = runLen;
                allLines[endInclusive].compressDupHiddenIndices = _hidden;
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
    /* Per-key list of hidden indices — survivor gets this in compressDupHiddenIndices
       so the peek-dedup click handler can reveal exactly this fold. See the
       consecutive-mode comment above for rationale. */
    var hiddenIdxByKey = Object.create(null);
    for (i = 0; i < allLines.length; i++) {
        var globalItem = allLines[i];
        var globalKey = lineDedupeKey(globalItem);
        if (globalKey === null || !isLineEligibleForDupCompress(globalItem)) continue;
        if (firstIdxByKey[globalKey] == null) {
            firstIdxByKey[globalKey] = i;
            countByKey[globalKey] = 1;
            hiddenIdxByKey[globalKey] = [];
        } else {
            globalItem.compressDupHidden = true;
            countByKey[globalKey]++;
            hiddenIdxByKey[globalKey].push(i);
        }
    }
    for (var key in countByKey) {
        var count = countByKey[key];
        if (count > 1) {
            allLines[firstIdxByKey[key]].compressDupCount = count;
            allLines[firstIdxByKey[key]].compressDupHiddenIndices = hiddenIdxByKey[key];
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
    /* Marker visibility + consecutive-collapse passes must run BEFORE the height loop so that
       calcItemHeight can honour markerHidden/markerCollapsed. They depend only on flags set by
       the triggering filter (levelFiltered, tier state, etc.) — those are already in place by
       the time any filter reaches recalcHeights. */
    if (typeof applyDbSignalMarkerVisibility === 'function') applyDbSignalMarkerVisibility();
    if (typeof applyConsecutiveDbMarkerCollapse === 'function') applyConsecutiveDbMarkerCollapse();
    totalHeight = 0;
    for (var i = 0; i < allLines.length; i++) {
        var _row = allLines[i];
        if (_row.type === 'line') _row.viewerLineIndex = i;
        _row.height = calcItemHeight(_row);
        totalHeight += _row.height;
    }
    /* Invalidate visible-line cache so updateLineCount recalc runs after filter/layout change. */
    if (typeof window !== 'undefined') window.__visibleCountDirty = true;
    if (typeof buildPrefixSums === 'function') buildPrefixSums();
}

${getViewportRenderScript()}
`;
}
