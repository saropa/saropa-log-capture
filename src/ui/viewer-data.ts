/**
 * Core data management and rendering for the log viewer webview.
 *
 * Contains the line data store (addToData, trimData), height calculations
 * (recalcHeights, calcItemHeight), and the virtual scrolling renderer
 * (renderItem, renderViewport).
 */
export function getViewerDataScript(): string {
    return /* javascript */ `
function addToData(html, isMarker, category, ts, fw) {
    if (isMarker) {
        if (typeof finalizeStackGroup === 'function' && activeGroupHeader) finalizeStackGroup(activeGroupHeader); activeGroupHeader = null;
        allLines.push({ html: html, type: 'marker', height: MARKER_HEIGHT, category: category, groupId: -1, timestamp: ts });
        totalHeight += MARKER_HEIGHT;
        return;
    }
    if (isStackFrameText(html)) {
        if (activeGroupHeader) {
            allLines.push({ html: html, type: 'stack-frame', height: 0, category: category, groupId: activeGroupHeader.groupId, timestamp: ts, fw: fw, level: 'error', sourceTag: activeGroupHeader.sourceTag, sourceFiltered: false });
            activeGroupHeader.frameCount++;
            return;
        }
        var gid = nextGroupId++;
        var sTagH = (typeof parseSourceTag === 'function') ? parseSourceTag(stripTags(html)) : null;
        var hdr = { html: html, type: 'stack-header', height: ROW_HEIGHT, category: category, groupId: gid, frameCount: 1, collapsed: true, timestamp: ts, fw: fw, level: 'error', seq: nextSeq++, sourceTag: sTagH, sourceFiltered: false };
        allLines.push(hdr);
        if (typeof registerSourceTag === 'function') { registerSourceTag(hdr); }
        activeGroupHeader = hdr;
        totalHeight += ROW_HEIGHT;
        return;
    }
    if (typeof finalizeStackGroup === 'function' && activeGroupHeader) finalizeStackGroup(activeGroupHeader); activeGroupHeader = null;
    var plain = stripTags(html);
    var lvl = (typeof classifyLevel === 'function') ? classifyLevel(plain, category) : 'info';
    var sTag = (typeof parseSourceTag === 'function') ? parseSourceTag(plain) : null;
    var lineItem = { html: html, type: 'line', height: ROW_HEIGHT, category: category, groupId: -1, timestamp: ts, level: lvl, seq: nextSeq++, sourceTag: sTag, sourceFiltered: false };
    allLines.push(lineItem);
    if (typeof registerSourceTag === 'function') { registerSourceTag(lineItem); }
    totalHeight += ROW_HEIGHT;
}

function toggleStackGroup(groupId) {
    for (var i = 0; i < allLines.length; i++) {
        if (allLines[i].groupId === groupId && allLines[i].type === 'stack-header') {
            allLines[i].collapsed = !allLines[i].collapsed;
            break;
        }
    }
    recalcHeights();
    renderViewport(true);
}

function trimData() {
    if (allLines.length <= MAX_LINES) return;
    var excess = allLines.length - MAX_LINES;
    if (typeof unregisterSourceTag === 'function') {
        for (var i = 0; i < excess; i++) { unregisterSourceTag(allLines[i]); }
    }
    for (var i = 0; i < excess; i++) { totalHeight -= allLines[i].height; }
    allLines.splice(0, excess);
    activeGroupHeader = null;
}

/**
 * Recalculate all line heights from scratch.
 * Called by every filter (category, exclusion, level) after setting their flags,
 * and by toggleStackGroup after toggling collapsed state. This is the single
 * source of truth for height — individual filters never manipulate heights directly.
 */
function recalcHeights() {
    totalHeight = 0;
    for (var i = 0; i < allLines.length; i++) {
        allLines[i].height = calcItemHeight(allLines[i]);
        totalHeight += allLines[i].height;
    }
}

/**
 * Determine the pixel height of a single line item.
 * Hidden (0) if any filter flag is set: filteredOut (category), excluded,
 * levelFiltered, or sourceFiltered (source tag toggle).
 * Stack frames inherit collapsed state from their group header.
 */
function calcItemHeight(item) {
    if (item.filteredOut || item.excluded || item.levelFiltered || item.sourceFiltered) return 0;
    if (item.type === 'marker') return MARKER_HEIGHT;
    if (item.type === 'stack-frame' && item.groupId >= 0) {
        for (var k = 0; k < allLines.length; k++) {
            if (allLines[k].groupId === item.groupId && allLines[k].type === 'stack-header') {
                return allLines[k].collapsed ? 0 : ROW_HEIGHT;
            }
        }
    }
    return ROW_HEIGHT;
}

/**
 * Renders a single log item to HTML.
 * Handles markers, stack frames, and regular lines with appropriate styling.
 * Applies search highlighting, pattern highlights, and category styling.
 */
function renderItem(item, idx) {
    var html = (typeof highlightSearchInHtml === 'function') ? highlightSearchInHtml(item.html) : item.html;

    var matchCls = (typeof isCurrentMatch === 'function' && isCurrentMatch(idx)) ? ' current-match'
        : (typeof isSearchMatch === 'function' && isSearchMatch(idx)) ? ' search-match' : '';

    if (item.type === 'marker') {
        return '<div class="marker">' + html + '</div>';
    }

    if (item.type === 'stack-header') {
        var ch = item.collapsed ? '\\u25b6' : '\\u25bc';
        var sf = item.frameCount > 1 ? '  [+' + (item.frameCount - 1) + ' frames]' : '';
        var dup = item.dupCount > 1 ? ' <span class="stack-dedup-badge">(x' + item.dupCount + ')</span>' : '';
        return '<div class="stack-header' + matchCls + '" data-gid="' + item.groupId + '">' + ch + ' ' + html.trim() + dup + sf + '</div>';
    }

    if (item.type === 'stack-frame') {
        return '<div class="line stack-line' + (item.fw ? ' framework-frame' : '') + matchCls + '">' + html + '</div>';
    }

    var cat = item.category === 'stderr' ? ' cat-stderr' : '';
    var gap = (typeof getSlowGapHtml === 'function') ? getSlowGapHtml(item, idx) : '';
    var elapsed = (typeof getElapsedPrefix === 'function') ? getElapsedPrefix(item, idx) : '';
    var deco = (typeof getDecorationPrefix === 'function') ? getDecorationPrefix(item) : '';
    var annHtml = (typeof getAnnotationHtml === 'function') ? getAnnotationHtml(idx) : '';

    var titleAttr = '';
    if (typeof applyHighlightStyles === 'function') {
        var plainText = stripTags(item.html);
        var hl = applyHighlightStyles(html, plainText);
        html = hl.html;
        titleAttr = hl.titleAttr;
    }

    var ctxCls = item.isContext ? ' context-line' : '';
    var tintCls = (typeof getLineTintClass === 'function') ? getLineTintClass(item) : '';
    return gap + '<div class="line' + cat + ctxCls + matchCls + tintCls + '"' + titleAttr + '>' + deco + elapsed + html + '</div>' + annHtml;
}

function renderViewport(force) {
    if (!logEl.clientHeight) return;
    var scrollTop = logEl.scrollTop;
    var viewH = logEl.clientHeight;
    var bufferPx = OVERSCAN * ROW_HEIGHT;
    var topTarget = Math.max(0, scrollTop - bufferPx);
    var bottomTarget = scrollTop + viewH + bufferPx;

    var cumH = 0;
    var startIdx = 0;
    var startOffset = 0;
    for (var i = 0; i < allLines.length; i++) {
        var h = allLines[i].height;
        if (cumH + h > topTarget) { startIdx = i; startOffset = cumH; break; }
        cumH += h;
        if (i === allLines.length - 1) { startIdx = allLines.length; startOffset = cumH; }
    }

    var parts = [];
    var renderH = 0;
    var endIdx = startIdx;
    for (var i = startIdx; i < allLines.length; i++) {
        if (allLines[i].height === 0) { endIdx = i; continue; }
        parts.push(renderItem(allLines[i], i));
        renderH += allLines[i].height;
        endIdx = i;
        if (startOffset + renderH > bottomTarget) break;
    }

    if (!force && startIdx === lastStart && endIdx === lastEnd) return;
    lastStart = startIdx;
    lastEnd = endIdx;

    viewportEl.innerHTML = parts.join('');
    spacerTop.style.height = startOffset + 'px';

    var bottomH = 0;
    for (var i = endIdx + 1; i < allLines.length; i++) { bottomH += allLines[i].height; }
    spacerBottom.style.height = bottomH + 'px';
}
`;
}
