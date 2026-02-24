/** Viewport rendering helpers: bar level detection and virtual scroll renderer. */
export function getViewportRenderScript(): string {
    return /* javascript */ `
/** Extract bar level (e.g. 'error') from element class, or null. */
function getBarLevel(el) {
    var m = /level-bar-(\\w+)/.exec(el.className);
    return m ? m[1] : null;
}

/** Find next viewport child with a severity dot, stopping at markers. */
function findNextBarSibling(children, startIdx) {
    for (var ni = startIdx + 1; ni < children.length; ni++) {
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

    // Hysteresis: only rebuild DOM when visible area shifts past half the overscan buffer
    var hyst = Math.floor(OVERSCAN / 2);
    if (!force && lastStart >= 0 &&
        Math.abs(startIdx - lastStart) < hyst &&
        Math.abs(endIdx - lastEnd) < hyst) { return; }
    lastStart = startIdx; lastEnd = endIdx;
    var parts = [];
    for (var i = startIdx; i <= endIdx && i < allLines.length; i++) {
        if (allLines[i].height === 0) continue;
        parts.push(renderItem(allLines[i], i));
    }
    viewportEl.innerHTML = parts.join('');
    // Connect consecutive same-color dots, bridging through no-dot lines
    var ch = viewportEl.children;
    for (var ci = 0; ci < ch.length; ci++) {
        var lvl = getBarLevel(ch[ci]);
        if (!lvl) continue;
        var ni = findNextBarSibling(ch, ci);
        if (ni < 0 || getBarLevel(ch[ni]) !== lvl) continue;
        ch[ci].classList.add('bar-down');
        ch[ni].classList.add('bar-up');
        for (var bi = ci + 1; bi < ni; bi++) {
            ch[bi].classList.add('bar-up', 'bar-down', 'bar-bridge', 'level-bar-' + lvl);
        }
    }
    spacerTop.style.height = startOffset + 'px';
    var bottomH = (prefixSums && endIdx + 1 < prefixSums.length)
        ? totalHeight - prefixSums[endIdx + 1] : 0;
    spacerBottom.style.height = bottomH + 'px';
}
`;
}
