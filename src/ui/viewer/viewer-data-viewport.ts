/** Viewport rendering helpers: bar level detection, hidden-line chevrons, and virtual scroll renderer. */
export function getViewportRenderScript(): string {
    return /* javascript */ `
/** Extract bar level (e.g. 'error') from element class, or null. */
function getBarLevel(el) {
    var m = /level-bar-(\\w+)/.exec(el.className);
    return m ? m[1] : null;
}

/** Find next viewport child with a visible severity dot (non-blank), stopping at markers.
    Note: the prior .hidden-chevron / .peek-collapse skip was removed when the unified
    line-collapsing rethink retired those indicator elements — no render path emits
    them anymore, so there is nothing to skip. */
function findNextDotSibling(children, startIdx) {
    for (var ni = startIdx + 1; ni < children.length; ni++) {
        if (!children[ni]) continue;
        if (children[ni].classList.contains('marker')) return -1;
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

        /* Unified line-collapsing (plan: bugs/unified-line-collapsing.md).
           Replaces the separate .hidden-chevron (▼) and .peek-collapse (−) elements
           that used to be injected between visible rows. Both states now surface as
           a single class (.bar-hidden-rows) stamped onto the row immediately AFTER
           the hidden run (or the row starting a peek group) so its severity dot
           goes outlined — no extra DOM node, no margin glyph, no text content. The
           click handler in viewer-peek-chevron.ts delegates on .bar-hidden-rows
           and routes by which data-* attrs are present.

           WHY the row AFTER the gap rather than the row BEFORE: the render loop
           streams top-down and the row-before has already been emitted by the
           time we detect the gap (at row i). Marking the row-after is in-loop and
           requires no post-pass over the emitted strings, at the cost of a tiny
           mental model difference ("hidden rows are above me" vs "below me") —
           the tooltip text makes that explicit so the cue is unambiguous. */
        var _hiddenFrom = -1, _hiddenTo = -1, _hiddenTip = '';
        if (prevVisIdx >= 0 && i - prevVisIdx > 1) {
            var _hInfo = countHiddenNonBlank(prevVisIdx + 1, i);
            if (_hInfo.count > 0) {
                _hiddenFrom = prevVisIdx + 1;
                _hiddenTo = i;
                _hiddenTip = buildHiddenTip(_hInfo).replace(/"/g, '&quot;');
            }
        }
        var _peekKey = null;
        var _pk = allLines[i].peekAnchorKey;
        if (_pk !== undefined && _pk !== null && (i === 0 || allLines[i - 1].peekAnchorKey !== _pk)) {
            _peekKey = _pk;
        }

        var _rendered = renderItem(allLines[i], i, prevVis);
        /* Inject .bar-hidden-rows class + tooltip + routing data onto the outer div.
           Single regex: match the first class=" of the rendered row (always the outer
           wrapper) and prepend the extra attrs + class token. No other divs in the
           row string start with "class=\\"" at position 0, so the ^<div anchor keeps
           this unambiguous. */
        if (_peekKey !== null) {
            /* WHY tooltip text changed: the dot itself no longer collapses on
               click (see viewer-peek-chevron.ts). It is purely an indicator
               that this row is the start of an expanded peek group. The user
               collapses via the explicit .peek-collapse-link rendered just
               below this row. */
            _rendered = _rendered.replace(/^<div class="/,
                '<div data-peek-key="' + _peekKey + '" title="Lines below were revealed under this peek" class="bar-hidden-rows ');
        } else if (_hiddenFrom >= 0) {
            _rendered = _rendered.replace(/^<div class="/,
                '<div data-hidden-from="' + _hiddenFrom + '" data-hidden-to="' + _hiddenTo + '" title="' + _hiddenTip + '" class="bar-hidden-rows ');
        }
        parts.push(_rendered);
        /* Inline collapse control for peek groups: a thin sibling row holding
           the only click target that can collapse this peek. The severity dot
           on the row above is a no-op for clicks now — having a separate,
           visibly button-like element prevents the "I clicked the dot and my
           lines vanished" failure mode (bug 048). The .peek-collapse-row carries
           no level-bar-* class, so findNextDotSibling() naturally skips it
           and the bar-bridge post-pass treats it as a transparent gap. */
        if (_peekKey !== null) {
            parts.push('<div class="peek-collapse-row"><span class="peek-collapse-link" data-peek-key="'
                + _peekKey + '" title="Re-hide the lines revealed under this peek">\\u00d7 hide revealed lines</span></div>');
        }
        prevVis = allLines[i];
        prevVisIdx = i;
    }
    viewportEl.innerHTML = parts.join('');
    // Connect consecutive same-level dots, bridging through blank/non-dot lines.
    // The prior skips for .hidden-chevron / .peek-collapse were removed when the
    // unified line-collapsing rethink retired those indicator elements.
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
