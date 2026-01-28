/**
 * Client-side JavaScript for the log viewer webview.
 * Virtual scrolling: stores all lines in a JS array, renders only the
 * visible window. Handles stack trace grouping, auto-scroll, word wrap.
 *
 * @param maxLines - Maximum lines retained in the data array.
 */
export function getViewerScript(maxLines: number): string {
    return /* javascript */ `
const logEl = document.getElementById('log-content');
const spacerTop = document.getElementById('spacer-top');
const viewportEl = document.getElementById('viewport');
const spacerBottom = document.getElementById('spacer-bottom');
const jumpBtn = document.getElementById('jump-btn');
const footerEl = document.getElementById('footer');
const footerTextEl = document.getElementById('footer-text');
const wrapToggle = document.getElementById('wrap-toggle');

const vscodeApi = acquireVsCodeApi();
const MAX_LINES = ${maxLines};
const ROW_HEIGHT = 20;
const MARKER_HEIGHT = 28;
const OVERSCAN = 30;

const allLines = [];
let totalHeight = 0;
let lineCount = 0;
let autoScroll = true;
let isPaused = false;
let wordWrap = true;
let nextGroupId = 0;
let activeGroupHeader = null;
let lastStart = -1;
let lastEnd = -1;
let rafPending = false;
let currentFilename = '';

function stripTags(html) {
    return html.replace(/<[^>]*>/g, '');
}

function isStackFrameText(html) {
    return /^\\s+at\\s/.test(stripTags(html));
}

function addToData(html, isMarker, category, ts, fw) {
    if (isMarker) {
        if (typeof finalizeStackGroup === 'function' && activeGroupHeader) finalizeStackGroup(activeGroupHeader); activeGroupHeader = null;
        allLines.push({ html: html, type: 'marker', height: MARKER_HEIGHT, category: category, groupId: -1, timestamp: ts });
        totalHeight += MARKER_HEIGHT;
        return;
    }
    if (isStackFrameText(html)) {
        if (activeGroupHeader) {
            allLines.push({ html: html, type: 'stack-frame', height: 0, category: category, groupId: activeGroupHeader.groupId, timestamp: ts, fw: fw });
            activeGroupHeader.frameCount++;
            return;
        }
        var gid = nextGroupId++;
        var hdr = { html: html, type: 'stack-header', height: ROW_HEIGHT, category: category, groupId: gid, frameCount: 1, collapsed: true, timestamp: ts, fw: fw };
        allLines.push(hdr);
        activeGroupHeader = hdr;
        totalHeight += ROW_HEIGHT;
        return;
    }
    if (typeof finalizeStackGroup === 'function' && activeGroupHeader) finalizeStackGroup(activeGroupHeader); activeGroupHeader = null;
    allLines.push({ html: html, type: 'line', height: ROW_HEIGHT, category: category, groupId: -1, timestamp: ts });
    totalHeight += ROW_HEIGHT;
}

function toggleStackGroup(groupId) {
    var header = null;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.groupId !== groupId) continue;
        if (item.type === 'stack-header') {
            header = item;
            header.collapsed = !header.collapsed;
        } else if (item.type === 'stack-frame' && header) {
            var newH = header.collapsed ? 0 : ROW_HEIGHT;
            totalHeight += newH - item.height;
            item.height = newH;
        }
    }
    renderViewport(true);
}

function trimData() {
    if (allLines.length <= MAX_LINES) return;
    var excess = allLines.length - MAX_LINES;
    for (var i = 0; i < excess; i++) { totalHeight -= allLines[i].height; }
    allLines.splice(0, excess);
    activeGroupHeader = null;
}

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
    var annHtml = (typeof getAnnotationHtml === 'function') ? getAnnotationHtml(idx) : '';
    return gap + '<div class="line' + cat + matchCls + '">' + elapsed + html + '</div>' + annHtml;
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

function handleScroll() {
    var atBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 30;
    autoScroll = atBottom;
    jumpBtn.style.display = atBottom ? 'none' : 'block';
    renderViewport(false);
}

logEl.addEventListener('scroll', function() {
    if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(function() { rafPending = false; handleScroll(); });
    }
});

viewportEl.addEventListener('click', function(e) {
    var link = e.target.closest('.source-link');
    if (link) {
        e.preventDefault();
        vscodeApi.postMessage({
            type: 'linkClicked',
            path: link.dataset.path || '',
            line: parseInt(link.dataset.line || '1'),
            col: parseInt(link.dataset.col || '1'),
            splitEditor: e.ctrlKey || e.metaKey,
        });
        return;
    }
    var header = e.target.closest('.stack-header');
    if (header && header.dataset.gid !== undefined) {
        toggleStackGroup(parseInt(header.dataset.gid));
    }
});

function toggleWrap() {
    wordWrap = !wordWrap;
    logEl.classList.toggle('nowrap', !wordWrap);
    wrapToggle.textContent = wordWrap ? 'No Wrap' : 'Wrap';
    renderViewport(true);
}

wrapToggle.addEventListener('click', toggleWrap);

function getCenterIdx() {
    var mid = logEl.scrollTop + logEl.clientHeight / 2;
    var h = 0;
    for (var ci = 0; ci < allLines.length; ci++) {
        h += allLines[ci].height;
        if (h >= mid) return ci;
    }
    return allLines.length - 1;
}

function jumpToBottom() {
    logEl.scrollTop = logEl.scrollHeight;
    autoScroll = true;
    jumpBtn.style.display = 'none';
}

function updateFooterText() {
    var suffix = currentFilename ? ' | ' + currentFilename : '';
    footerTextEl.textContent = isPaused
        ? 'PAUSED \\u2014 ' + lineCount + ' lines' + suffix
        : 'Recording: ' + lineCount + ' lines' + suffix;
}

window.addEventListener('message', function(event) {
    var msg = event.data;
    switch (msg.type) {
        case 'addLines':
            for (var i = 0; i < msg.lines.length; i++) {
                var ln = msg.lines[i];
                addToData(ln.text, ln.isMarker, ln.category, ln.timestamp, ln.fw);
            }
            trimData();
            if (msg.lineCount !== undefined) lineCount = msg.lineCount;
            renderViewport(true);
            if (autoScroll) logEl.scrollTop = logEl.scrollHeight;
            updateFooterText();
            break;
        case 'clear':
            allLines.length = 0; totalHeight = 0; lineCount = 0; activeGroupHeader = null;
            isPaused = false; footerEl.classList.remove('paused');
            footerTextEl.textContent = 'Cleared'; renderViewport(true);
            break;
        case 'updateFooter':
            footerTextEl.textContent = msg.text;
            break;
        case 'setPaused':
            isPaused = msg.paused;
            footerEl.classList.toggle('paused', isPaused);
            updateFooterText();
            break;
        case 'setFilename':
            currentFilename = msg.filename || '';
            updateFooterText();
            break;
        case 'setCategories':
            handleSetCategories(msg);
            break;
        case 'updateWatchCounts':
            if (typeof handleUpdateWatchCounts === 'function') handleUpdateWatchCounts(msg);
            break;
        case 'setExclusions':
            if (typeof handleSetExclusions === 'function') handleSetExclusions(msg);
            break;
        case 'loadAnnotations':
            if (typeof handleLoadAnnotations === 'function') handleLoadAnnotations(msg);
            break;
        case 'setAnnotation':
            if (typeof setAnnotation === 'function') setAnnotation(msg.lineIndex, msg.text);
            break;
        case 'setShowElapsed':
            if (typeof handleSetShowElapsed === 'function') handleSetShowElapsed(msg);
            break;
    }
});

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && typeof copyAsPlainText === 'function') {
        if (selectionStart >= 0) { e.preventDefault(); copyAsPlainText(); return; }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C' && typeof copyAsMarkdown === 'function') {
        e.preventDefault(); copyAsMarkdown(); return;
    }
    if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key === 'f')) {
        e.preventDefault();
        if (typeof openSearch === 'function') openSearch();
        return;
    }
    if (e.key === 'Escape') { if (typeof closeSearch === 'function') closeSearch(); return; }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === ' ') { e.preventDefault(); vscodeApi.postMessage({ type: 'togglePause' }); }
    else if (e.key === 'w' || e.key === 'W') { toggleWrap(); }
    else if (e.key === 'Home') { logEl.scrollTop = 0; autoScroll = false; }
    else if (e.key === 'End') { jumpToBottom(); }
    else if (e.key === 'm' || e.key === 'M') { vscodeApi.postMessage({ type: 'insertMarker' }); }
    else if ((e.key === 'p' || e.key === 'P') && typeof togglePin === 'function') { togglePin(getCenterIdx()); }
    else if ((e.key === 'n' || e.key === 'N') && typeof promptAnnotation === 'function') { promptAnnotation(getCenterIdx()); }
});
`;
}
