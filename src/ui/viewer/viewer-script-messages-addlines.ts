/**
 * 'addLines' host-message handler for the log viewer webview. Extracted from
 * viewer-script-messages.ts to keep that file under the line limit.
 */

export function getViewerScriptAddLinesHandlerScript(): string {
    return /* javascript */ `
function handleAddLinesMessage(msg) {
    var isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    for (var i = 0; i < msg.lines.length; i++) {
        var ln = msg.lines[i], beforeAddLen = allLines.length;
        addToData(ln.text, ln.isMarker, ln.category, ln.timestamp, ln.fw, ln.sourcePath, ln.elapsedMs, ln.qualityPercent, ln.source, ln.rawText, ln.tier); stampSourceLineNoOnNewItems(beforeAddLen, ln.sourceLineNo); stampFileCodeOnNewItems(beforeAddLen, ln.logFileUri, ln.timestamp);
        if (typeof applyLintDataToLastLine === 'function') applyLintDataToLastLine(ln);
    }
    trimData();
    /* Badge counts must equal what the level filter shows. Recompute here — after the
       addToData loop and trimData have settled allLines, repeat-collapse, and trimming —
       so the tally reads the same per-row item.level the filter reads (effective, post-
       demotion, post-collapse), not a separate raw classification that diverges. */
    if (typeof recomputeStatsCounters === 'function') recomputeStatsCounters();
    if (msg.lineCount !== undefined) {
        lineCount = msg.lineCount;
        // Decoration width only changes when line-count digit width crosses a threshold.
        if (typeof applyDecorationLayoutWidth === 'function') applyDecorationLayoutWidth();
    }
    /* Compress mode mutates heights: any compression mode can mutate prior line heights/visibility; must full recalc, not appendPrefixSums only. */
    if ((typeof compressLinesMode !== 'undefined' && compressLinesMode)
        || (typeof compressNonConsecutiveMode !== 'undefined' && compressNonConsecutiveMode)) {
        if (typeof recalcHeights === 'function') recalcHeights();
        if (typeof buildPrefixSums === 'function') buildPrefixSums();
    } else if (typeof buildPrefixSums === 'function' && typeof appendPrefixSums === 'function') {
        if (prefixSums && prefixSums.length + msg.lines.length === allLines.length + 1) { appendPrefixSums(); }
        else { buildPrefixSums(); }
    }
    if (!isHidden) {
        // Use hysteresis (force=false) so we skip full DOM replace when visible range unchanged,
        // preserving text selection while the log is being written to.
        renderViewport(false);
        if (typeof scheduleMinimap === 'function') scheduleMinimap();
        // Render-snap-render: the render above used the OLD scrollTop and only reaches OVERSCAN rows past the previous bottom. When a streaming batch is larger than that the snapped viewport lands inside the empty bottom spacer and the contents appear to jump until the next event paints the new tail. The trailing renderViewport(false) re-uses the snapped scrollTop and is cheap on small batches (early-returns on unchanged range).
        // Suppress snap-to-bottom while the user is selecting: the snap changes the viewport range mid-drag, which makes renderViewport rewrite DOM and wipes any native within-line selection the user is building. With the snap suppressed the visible range stays put and renderViewport's hysteresis early-returns, preserving both native and model selections during streaming. Sticky-bottom resumes on the next batch after selection clears.
        if (autoScroll && !window.isContextMenuOpen && (typeof isUserSelecting !== 'function' || !isUserSelecting())) { if (window.setProgrammaticScroll) window.setProgrammaticScroll(); suppressScroll = true; logEl.scrollTop = logEl.scrollHeight; suppressScroll = false; renderViewport(false); }
        updateFooterText();
    }
    if (typeof scheduleRootCauseHypothesesRefresh === 'function') scheduleRootCauseHypothesesRefresh();
    /* Refresh the Trouble Mode severity chart once per batch (no-op while the mode is off). */
    if (typeof scheduleTroubleChartUpdate === 'function') scheduleTroubleChartUpdate();
    /* Warm-up filter re-applies when the app-ready boundary first resolves mid-load
       (no-op while the filter is off or the boundary is unchanged). */
    if (typeof maybeReapplyWarmupOnBoundaryChange === 'function') maybeReapplyWarmupOnBoundaryChange();
}
`;
}
