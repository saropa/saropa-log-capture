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
import { getCompressDedupScript } from './viewer-data-compress-dedup';
import { getViewerDataAddScript } from './viewer-data-add';
import { getViewerDataHelpers } from './viewer-data-helpers';
import { getViewportRenderScript } from './viewer-data-viewport';
import { getCounterAffordanceScript } from './viewer-data-divider';

/** Options for building the viewer data webview script. */
export interface ViewerDataScriptOptions {
    readonly repeatThresholds?: Partial<ViewerRepeatThresholds>;
    readonly viewerDbSignalsEnabled?: boolean;
    readonly staticSqlFromFingerprintEnabled?: boolean;
    readonly slowBurstThresholds?: Partial<ViewerSlowBurstThresholds>;
    readonly dbDetectorToggles?: Partial<ViewerDbDetectorToggles>;
    /** Baked seed for `saropaLogCapture.accessibility.showCollapseDividerLabels` (default true). */
    readonly accessibilityShowCollapseDividerLabels?: boolean;
}

export function getViewerDataScript(opts: ViewerDataScriptOptions = {}): string {
    const {
        repeatThresholds,
        viewerDbSignalsEnabled = true,
        staticSqlFromFingerprintEnabled = true,
        slowBurstThresholds,
        dbDetectorToggles,
        /* Carried for backward-compat with callers that still pass it —
           between-row divider rows are retired (counter-row chevron handles
           collapsed-gap announcements now). Renamed to _* so lint does not
           flag it as unused. */
        accessibilityShowCollapseDividerLabels: _accessibilityShowCollapseDividerLabels = true,
    } = opts;
    return getViewerDataHelpers(repeatThresholds, viewerDbSignalsEnabled, slowBurstThresholds, dbDetectorToggles) + getCompressStreakScript() + getCompressDedupScript() + getViewerDataAddScript(staticSqlFromFingerprintEnabled) + /* javascript */ `

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
    /* A retained tree header may have been trimmed away — drop the dangling ref
       so a later child row never appends to a header no longer in allLines. */
    if (typeof resetTreeDetector === 'function') resetTreeDetector();
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
    /* Re-index pins, annotations, and screenshot badges the same way as the trackers
       above: they are keyed by the pre-splice allLines index, so a trim without this
       adjustment leaves them pointing at whatever unrelated row slid into their old
       slot (bug_025). Each helper no-ops when its own store is empty. */
    if (typeof adjustPinnedIndicesAfterTrim === 'function') adjustPinnedIndicesAfterTrim(excess);
    if (typeof adjustAnnotationsAfterTrim === 'function') adjustAnnotationsAfterTrim(excess);
    if (typeof adjustScreenshotByIdxAfterTrim === 'function') adjustScreenshotByIdxAfterTrim(excess);
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
        /* bug_027: pass i so calcItemHeight can look up an annotation at this allLines
           index (annotations are keyed by the same index renderItem/renderViewport use). */
        _row.height = calcItemHeight(_row, i);
        totalHeight += _row.height;
    }
    /* Invalidate visible-line cache so updateLineCount recalc runs after filter/layout change. */
    if (typeof window !== 'undefined') window.__visibleCountDirty = true;
    if (typeof buildPrefixSums === 'function') buildPrefixSums();
}

${getCounterAffordanceScript()}

${getViewportRenderScript()}
`;
}
