"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewportRenderScript = getViewportRenderScript;
/** Viewport rendering helpers: bar level detection and virtual scroll renderer. */
function getViewportRenderScript() {
    return /* javascript */ `
/** Extract bar level (e.g. 'error') from element class, or null. */
function getBarLevel(el) {
    var m = /level-bar-(\\w+)/.exec(el.className);
    return m ? m[1] : null;
}

/** Find next viewport child with a severity dot, stopping at markers. */
function findNextBarSibling(children, startIdx) {
    for (var ni = startIdx + 1; ni < children.length; ni++) {
        if (!children[ni]) continue;
        if (children[ni].classList.contains('marker')) return -1;
        if (getBarLevel(children[ni])) return ni;
    }
    return -1;
}

function renderViewport(force) {
    if (!logEl.clientHeight) return;
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
    for (var i = startIdx; i <= endIdx && i < allLines.length; i++) {
        if (allLines[i].height === 0) continue;
        if (typeof window.replayMode !== 'undefined' && window.replayMode && typeof window.replayCurrentIndex === 'number' && i > window.replayCurrentIndex) continue;
        parts.push(renderItem(allLines[i], i, prevVis));
        prevVis = allLines[i];
    }
    viewportEl.innerHTML = parts.join('');
    // Connect consecutive dots, bridging through no-dot lines
    var ch = viewportEl.children;
    for (var ci = 0; ci < ch.length; ci++) {
        if (!ch[ci]) continue;
        var lvl = getBarLevel(ch[ci]);
        if (!lvl) continue;
        var ni = findNextBarSibling(ch, ci);
        if (ni < 0 || !ch[ni]) continue;
        ch[ci].classList.add('bar-down');
        ch[ni].classList.add('bar-up');
        for (var bi = ci + 1; bi < ni; bi++) {
            if (ch[bi]) ch[bi].classList.add('bar-up', 'bar-down', 'bar-bridge', 'level-bar-' + lvl);
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
//# sourceMappingURL=viewer-data-viewport.js.map