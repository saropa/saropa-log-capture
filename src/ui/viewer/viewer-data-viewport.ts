/** Viewport rendering helpers: bar level detection, hidden-line dividers, and virtual scroll renderer. */
export function getViewportRenderScript(): string {
    return /* javascript */ `
/** Extract bar level (e.g. 'error') from element class, or null. */
function getBarLevel(el) {
    var m = /level-bar-(\\w+)/.exec(el.className);
    return m ? m[1] : null;
}

/** Find next viewport child with a visible severity dot (non-blank), stopping at markers.
    Skips .viewer-divider sibling rows because they are control affordances injected
    between log rows (see bugs/048_plan-severity-gutter-decoupling.md and
    viewer-data-divider.ts) — they do not own a severity level and must not short-circuit
    the connector chain that joins consecutive same-level dots. */
function findNextDotSibling(children, startIdx) {
    for (var ni = startIdx + 1; ni < children.length; ni++) {
        if (!children[ni]) continue;
        if (children[ni].classList.contains('marker')) return -1;
        if (children[ni].classList.contains('viewer-divider')) continue;
        var lvl = getBarLevel(children[ni]);
        if (lvl && !children[ni].classList.contains('line-blank')) return ni;
    }
    return -1;
}

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
    // Find previous visible line before viewport start for spacing calculation
    var prevVis = null;
    for (var sp = startIdx - 1; sp >= 0; sp--) {
        if (allLines[sp].height > 0) { prevVis = allLines[sp]; break; }
    }
    var parts = [];
    var prevVisIdx = -1;
    for (var i = startIdx; i <= endIdx && i < allLines.length; i++) {
        if (allLines[i].height === 0) continue;
        if (typeof window.replayMode !== 'undefined' && window.replayMode && typeof window.replayCurrentIndex === 'number' && i > window.replayCurrentIndex) continue;

        /* Severity-gutter decoupling (plan: bugs/048_plan-severity-gutter-decoupling.md).
           Filter-hidden gaps and expanded peek ranges no longer overload the
           severity dot — they surface as dedicated .viewer-divider rows
           injected as siblings of the actual log rows. The divider carries
           its own click target, count, and reason text so the user knows
           what will happen BEFORE clicking. The gutter dot stays purely
           informational; this kills the "I clicked the dot and my lines
           vanished" failure mode the plan exists to fix. */
        var _hiddenFrom = -1, _hiddenTo = -1, _hInfo = null;
        if (prevVisIdx >= 0 && i - prevVisIdx > 1) {
            _hInfo = countHiddenNonBlank(prevVisIdx + 1, i);
            if (_hInfo.count > 0) {
                _hiddenFrom = prevVisIdx + 1;
                _hiddenTo = i;
            }
        }
        /* Peek-group boundary detection: peekAnchorKey is set on every item
           inside the expanded range. First-of-group = preceding allLines item
           does not share the key. Last-of-group = following allLines item
           does not share the key. The check uses allLines (not visible-only)
           because the peek range is contiguous in allLines order, and the
           leading/trailing divider must straddle the actual range edges
           even if some interior items happen to be hidden by orthogonal
           filters at render time. */
        var _pk = allLines[i].peekAnchorKey;
        var _hasPk = (_pk !== undefined && _pk !== null);
        var _peekFirst = _hasPk && (i === 0 || allLines[i - 1].peekAnchorKey !== _pk);
        var _peekLast = _hasPk && (i === allLines.length - 1 || allLines[i + 1].peekAnchorKey !== _pk);
        /* Dedup peeks own their toggle via the inline .dedup-badge on the
           survivor row (the badge mutates "×N" → "×N hide" once expanded).
           Suppress the leading/trailing brackets for dedup so the user is
           not offered a redundant collapse target on a non-survivor row. */
        var _dividersOk = _hasPk && allLines[i].peekKind !== 'dedup';

        /* Leading divider: filter-hidden gap above this row.
           WHY emit even when the row is also a peek-anchor: the gap divider
           and the peek "hide" divider report different things. Stacking them
           is rare (peeking removes the gap that produced it), but if both
           apply they read as two distinct controls. */
        if (_hiddenFrom >= 0 && typeof buildHiddenGapDivider === 'function') {
            parts.push(buildHiddenGapDivider(_hiddenFrom, _hiddenTo, _hInfo));
        }
        /* Leading divider: this row starts an expanded filter peek group.
           The "hide" action collapses the WHOLE group from the top. */
        if (_peekFirst && _dividersOk && typeof buildPeekHideDivider === 'function') {
            parts.push(buildPeekHideDivider(_pk, countPeekedLines(_pk), 'start'));
        }

        parts.push(renderItem(allLines[i], i, prevVis));

        /* Trailing divider: this row is the LAST of an expanded filter peek
           group. The "hide" action collapses the WHOLE group from the
           bottom — the user can collapse from wherever they scrolled to
           without scrolling back up to the leading divider (Principle 3
           of the plan). */
        if (_peekLast && _dividersOk && typeof buildPeekHideDivider === 'function') {
            parts.push(buildPeekHideDivider(_pk, countPeekedLines(_pk), 'end'));
        }
        /* Trailing divider: preview-mode stack groups announce their trimmed
           frames here. The divider's "show all" action expands the whole
           stack via toggleStackGroup(gid), routed through the click handler
           in viewer-peek-chevron.ts. */
        var _previewInfo = (typeof getPreviewModeHiddenInfo === 'function')
            ? getPreviewModeHiddenInfo(allLines[i]) : null;
        if (_previewInfo && typeof buildPreviewFramesDivider === 'function') {
            parts.push(buildPreviewFramesDivider(_previewInfo));
        }

        prevVis = allLines[i];
        prevVisIdx = i;
    }
    viewportEl.innerHTML = parts.join('');
    /* Connect consecutive same-level dots, bridging through blank/non-dot
       lines AND through .viewer-divider control rows. findNextDotSibling
       already skips dividers when searching for the next dot; the bridge
       loop below then walks every intermediate child including dividers
       and adds bar-bridge + level-bar-* so the connector ::after paints
       through them. The .viewer-divider[class*="level-bar-"]::before {
       display:none; } CSS rule keeps the dividers' own dots suppressed
       even when they pick up a level class from this bridging. */
    var ch = viewportEl.children;
    for (var ci = 0; ci < ch.length; ci++) {
        if (!ch[ci]) continue;
        var lvl = getBarLevel(ch[ci]);
        if (!lvl || ch[ci].classList.contains('line-blank')) continue;
        var ni = findNextDotSibling(ch, ci);
        if (ni < 0 || !ch[ni]) continue;
        var nextLvl = getBarLevel(ch[ni]);
        if (nextLvl !== lvl) { ci = ni - 1; continue; }
        ch[ci].classList.add('bar-down');
        ch[ni].classList.add('bar-up');
        for (var bi = ci + 1; bi < ni; bi++) {
            if (ch[bi]) {
                ch[bi].classList.add('bar-up', 'bar-down', 'bar-bridge', 'level-bar-' + lvl);
            }
        }
        ci = ni - 1;
    }
    spacerTop.style.height = startOffset + 'px';
    spacerBottom.style.height = bottomH + 'px';
    // Re-apply row selection highlight after DOM replace so shift-click selection is preserved (e.g. on right-click context menu).
    if (typeof updateSelectionHighlight === 'function') updateSelectionHighlight();
}
`;
}
