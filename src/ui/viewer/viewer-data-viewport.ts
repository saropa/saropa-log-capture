/** Viewport rendering helpers: hidden-line dividers and virtual scroll renderer.
 *  The severity-gutter connector (line joining consecutive same-level dots) is
 *  pure CSS in viewer-styles-decoration-bars.ts (a :has(+ .level-bar-X) sibling
 *  selector on each row). No JS chain bookkeeping lives here. */
export function getViewportRenderScript(): string {
    return /* javascript */ `
/** Count hidden non-blank lines between two allLines indices (exclusive). */
function countHiddenNonBlank(fromIdx, toIdx) {
    var count = 0, reasons = {};
    for (var i = fromIdx; i < toIdx; i++) {
        var item = allLines[i];
        if (!item || item.height > 0) continue;
        if (isLineContentBlank(item)) continue;
        if (item.contIsChild && item.contGroupId >= 0 && typeof contHeaderMap !== 'undefined') {
            var _cHdr = contHeaderMap[item.contGroupId];
            if (_cHdr && _cHdr.contCollapsed) continue;
        }
        count++;
        if (item.levelFiltered) reasons.level = (reasons.level || 0) + 1;
        if (item.excluded) reasons.excluded = (reasons.excluded || 0) + 1;
        if (item.filteredOut) reasons.category = (reasons.category || 0) + 1;
        if (item.sourceFiltered) reasons.source = (reasons.source || 0) + 1;
        if (item.searchFiltered) reasons.search = (reasons.search || 0) + 1;
        if (item.errorSuppressed) reasons.suppressed = (reasons.suppressed || 0) + 1;
        if (item.userHidden || item.autoHidden) reasons.hidden = (reasons.hidden || 0) + 1;
        if (item.repeatHidden) reasons.repeat = (reasons.repeat || 0) + 1;
        if (item.compressDupHidden) reasons.duplicate = (reasons.duplicate || 0) + 1;
        if (item.stackDedupHidden) reasons.duplicate = (reasons.duplicate || 0) + 1;
        if (item.classFiltered) reasons.classTag = (reasons.classTag || 0) + 1;
        if (item.sqlPatternFiltered) reasons.sqlPattern = (reasons.sqlPattern || 0) + 1;
        if (item.scopeFiltered) reasons.scope = (reasons.scope || 0) + 1;
        if (item.timeRangeFiltered) reasons.timeRange = (reasons.timeRange || 0) + 1;
        if (typeof isTierHidden === 'function' && isTierHidden(item)) reasons.tier = (reasons.tier || 0) + 1;
    }
    return { count: count, reasons: reasons };
}

/** Build tooltip text from hidden-line reason counts. */
function buildHiddenTip(info) {
    var parts = [];
    var r = info.reasons;
    if (r.level) parts.push(r.level + ' level-filtered');
    if (r.excluded) parts.push(r.excluded + ' excluded');
    if (r.category) parts.push(r.category + ' category-filtered');
    if (r.source) parts.push(r.source + ' source-filtered');
    if (r.search) parts.push(r.search + ' search-filtered');
    if (r.suppressed) parts.push(r.suppressed + ' suppressed');
    if (r.hidden) parts.push(r.hidden + ' manually hidden');
    if (r.tier) parts.push(r.tier + ' tier-filtered');
    if (r.repeat) parts.push(r.repeat + ' repeat-collapsed');
    if (r.duplicate) parts.push(r.duplicate + ' deduplicated');
    if (r.classTag) parts.push(r.classTag + ' class-filtered');
    if (r.sqlPattern) parts.push(r.sqlPattern + ' SQL-pattern-filtered');
    if (r.scope) parts.push(r.scope + ' scope-filtered');
    if (r.timeRange) parts.push(r.timeRange + ' time-range-filtered');
    var n = info.count;
    return n + ' hidden line' + (n !== 1 ? 's' : '') + (parts.length ? ': ' + parts.join(', ') : '');
}

function renderViewport(force) {
    if (!logEl || !logEl.clientHeight) return;
    /* Keep the decoration prefix-column width in sync with which decoration
       parts are enabled. Cheap: applyDecorationLayoutWidth() early-returns via
       a digit+flag signature when nothing relevant changed. This is the single
       hook covering every decoration-toggle path (each calls renderViewport),
       so individual toggle handlers don't each need to remember to call it. */
    if (typeof applyDecorationLayoutWidth === 'function') applyDecorationLayoutWidth();
    var scrollTop = logEl.scrollTop;
    var viewH = logEl.clientHeight;
    var bufferPx = OVERSCAN * ROW_HEIGHT;
    var topTarget = Math.max(0, scrollTop - bufferPx);
    var bottomTarget = scrollTop + viewH + bufferPx;
    var startIdx, startOffset, endIdx;

    if (typeof findIndexAtOffset === 'function' && prefixSums) {
        var sa = findIndexAtOffset(topTarget);
        startIdx = sa.index;
        startOffset = prefixSums[startIdx];
        var ea = findIndexAtOffset(bottomTarget);
        endIdx = ea.index;
    } else {
        // Fallback before prefix sums are built
        var cumH = 0; startIdx = 0; startOffset = 0;
        for (var i = 0; i < allLines.length; i++) {
            if (cumH + allLines[i].height > topTarget) { startIdx = i; startOffset = cumH; break; }
            cumH += allLines[i].height;
            if (i === allLines.length - 1) { startIdx = allLines.length; startOffset = cumH; }
        }
        var endH = 0; endIdx = startIdx;
        for (var i = startIdx; i < allLines.length; i++) {
            if (allLines[i].height === 0) { endIdx = i; continue; }
            endH += allLines[i].height; endIdx = i;
            if (startOffset + endH > bottomTarget) break;
        }
    }

    // Replay mode: only show lines 0..replayCurrentIndex (set by viewer-replay script)
    if (typeof window.replayMode !== 'undefined' && window.replayMode && typeof window.replayCurrentIndex === 'number') {
        var cap = window.replayCurrentIndex;
        if (endIdx > cap) endIdx = cap;
        if (startIdx > cap) startIdx = cap;
    }
    // Skip full DOM replace only when the visible line range is unchanged. Index-based
    // hysteresis (e.g. |startIdx-lastStart| < N) breaks when many lines have height 0
    // (filtered view): a tiny pixel scroll can jump startIdx by hundreds, forcing a
    // rebuild every frame and severe flicker. Equality matches the real virtual-scroll contract.
    var bottomH = (prefixSums && endIdx + 1 < prefixSums.length)
        ? totalHeight - prefixSums[endIdx + 1] : 0;
    if (!force && lastStart >= 0 &&
        startIdx === lastStart && endIdx === lastEnd) {
        return;
    }
    lastStart = startIdx; lastEnd = endIdx;
    /* Pre-pass: stamp _hiddenAfter and _triggeredPeekKey on every visible
       row before the DOM build. Each row's counter-chevron affordance reads
       these stamps in getDecorationPrefix → getCounterAffordance, so this
       pass is what makes "the chevron knows there are hidden lines below
       this row" possible without each renderItem call scanning forward. */
    if (typeof computeRowAffordances === 'function') computeRowAffordances();
    // Find previous visible line before viewport start for spacing calculation
    var prevVis = null;
    for (var sp = startIdx - 1; sp >= 0; sp--) {
        if (allLines[sp].height > 0) { prevVis = allLines[sp]; break; }
    }
    var parts = [];
    for (var i = startIdx; i <= endIdx && i < allLines.length; i++) {
        if (allLines[i].height === 0) continue;
        if (typeof window.replayMode !== 'undefined' && window.replayMode && typeof window.replayCurrentIndex === 'number' && i > window.replayCurrentIndex) continue;

        parts.push(renderItem(allLines[i], i, prevVis));

        prevVis = allLines[i];
    }
    /* Atomic DOM swap via <template> + replaceChildren()/appendChild(fragment)
       instead of the innerHTML-setter fast path on the live viewport. That
       fast path can recycle prior child nodes' GPU paint cache when a
       slot's bounding box and tag name match the incoming markup — Chromium
       then composites the new text on top of un-invalidated pixels from the
       previous row that occupied that slot, and we saw faint blue characters
       of an info-level row ghost through the green text of the next
       database-level row ("DRIFT: Drift debug server disconnected") until a
       :hover repaint cleared the layer. Attempt #1 tried per-row compositor
       promotion via transform: translateZ(0) (commit 49297d75); it did not
       eliminate the artifact in production (v7.17.0 dist). Parsing into a
       detached <template>, clearing the live viewport, and appending the
       fragment forces the browser to detach + dispose every prior child
       node before inserting fresh nodes whose paint records have no
       relationship to the old ones — closing the recycle path at its
       source. See bugs/viewer-row-paint-ghosting-attempts.md. */
    var _vTmpl = document.createElement('template');
    _vTmpl.innerHTML = parts.join('');
    viewportEl.replaceChildren();
    viewportEl.appendChild(_vTmpl.content);
    /* Severity-gutter connector: the line between consecutive same-level dots
       is purely CSS, painted by viewer-styles-decoration-bars.ts via a
       :has(+ .level-bar-X) selector on each row. No JS chain walking, no
       bridge stamping. The row's own level-bar-* class drives both the dot
       and the connecting stripe via --bar-color, so they cannot disagree. */
    spacerTop.style.height = startOffset + 'px';
    spacerBottom.style.height = bottomH + 'px';
    // Re-apply row selection highlight after DOM replace so shift-click selection is preserved (e.g. on right-click context menu).
    if (typeof updateSelectionHighlight === 'function') updateSelectionHighlight();
    /* Tag-column x-offset measurement: after the DOM update, query a real
       .deco-parsed-tag and write its actual left offset to
       --deco-tag-position-px. Consumed by the .viewer-divider chips /
       .dedup-badge / .stack-toggle so they sit in the exact same x-column
       as real tags. Doing this AFTER the DOM swap (not inside
       applyDecorationLayoutWidth which runs at the TOP of renderViewport)
       means the measurement reflects the just-rendered tag positions, not
       the previous render's stale state. */
    if (typeof measureTagColumnPosition === 'function') measureTagColumnPosition();
}
`;
}
