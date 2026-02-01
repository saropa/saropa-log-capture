/**
 * Client-side JavaScript for the log viewer webview.
 * Virtual scrolling: stores all lines in a JS array, renders only the
 * visible window. Handles stack trace grouping, auto-scroll, word wrap.
 *
 * @param maxLines - Maximum lines retained in the data array.
 */
export function getViewerScript(maxLines: number): string {
    return /* javascript */ `
var logEl = document.getElementById('log-content');
var spacerTop = document.getElementById('spacer-top');
var viewportEl = document.getElementById('viewport');
var spacerBottom = document.getElementById('spacer-bottom');
var jumpBtn = document.getElementById('jump-btn');
var footerEl = document.getElementById('footer');
var footerTextEl = document.getElementById('footer-text');
var wrapToggle = document.getElementById('wrap-toggle');
var viewerHeader = document.getElementById('viewer-header');
var headerFilename = document.getElementById('header-filename');
var headerToggle = document.getElementById('header-toggle');

var vscodeApi = acquireVsCodeApi();
window._vscodeApi = vscodeApi;
if (window._scriptErrors && window._scriptErrors.length) {
    vscodeApi.postMessage({ type: 'scriptError', errors: window._scriptErrors });
}
var MAX_LINES = ${maxLines};
var ROW_HEIGHT = 20;
var MARKER_HEIGHT = 28;
var OVERSCAN = 30;

var allLines = [];
var totalHeight = 0;
var lineCount = 0;
var autoScroll = true;
var isPaused = false;
/** True when viewing a historical log file (disables "Recording:" footer). */
var isViewingFile = false;
var wordWrap = true;
var nextGroupId = 0;
var activeGroupHeader = null;
var lastStart = -1;
var lastEnd = -1;
var rafPending = false;
var currentFilename = '';
var nextSeq = 1;
var headerCollapsed = false;

function stripTags(html) {
    return html.replace(/<[^>]*>/g, '');
}

function isStackFrameText(html) {
    return /^\\s+at\\s/.test(stripTags(html));
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

viewportEl.addEventListener('dblclick', function(e) {
    var lineEl = e.target.closest('.line, .stack-header, .marker');
    if (!lineEl) { return; }
    // Use querySelectorAll for line-level elements only — renderItem() can emit
    // sibling gap/annotation divs that would throw off a raw children[] count.
    var lineEls = viewportEl.querySelectorAll(':scope > .line, :scope > .stack-header, :scope > .marker');
    var visIdx = -1;
    for (var ci = 0; ci < lineEls.length; ci++) {
        if (lineEls[ci] === lineEl) { visIdx = ci; break; }
    }
    if (visIdx < 0) { return; }
    // Map the Nth visible DOM element back to the corresponding allLines index.
    var count = 0;
    for (var ai = lastStart; ai <= lastEnd && ai < allLines.length; ai++) {
        if (allLines[ai].height === 0) { continue; }
        if (count === visIdx) {
            if (typeof openContextModal === 'function') { openContextModal(ai); }
            return;
        }
        count++;
    }
});

function toggleWrap() {
    wordWrap = !wordWrap;
    logEl.classList.toggle('nowrap', !wordWrap);
    renderViewport(true);
}

if (wrapToggle) wrapToggle.addEventListener('click', toggleWrap);
jumpBtn.addEventListener('click', jumpToBottom);
if (headerToggle) headerToggle.addEventListener('click', toggleHeader);

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

/** Update header filename display. */
function updateHeaderFilename() {
    if (headerFilename) {
        headerFilename.textContent = currentFilename || '';
    }
}

/** Toggle header visibility. */
function toggleHeader() {
    headerCollapsed = !headerCollapsed;
    if (viewerHeader) {
        viewerHeader.classList.toggle('collapsed', headerCollapsed);
    }
}

/** Update footer to reflect current mode: historical / paused / recording. */
function updateFooterText() {
    if (isViewingFile) {
        footerTextEl.textContent = lineCount + ' lines';
        return;
    }
    footerTextEl.textContent = isPaused
        ? '\\u23F8 ' + lineCount + ' lines'
        : '\\u25CF ' + lineCount + ' lines';
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
            allLines.length = 0; totalHeight = 0; lineCount = 0; activeGroupHeader = null; nextSeq = 1;
            isPaused = false; isViewingFile = false; footerEl.classList.remove('paused');
            if (typeof closeContextModal === 'function') { closeContextModal(); }
            if (typeof resetSourceTags === 'function') { resetSourceTags(); }
            if (typeof repeatTracker !== 'undefined') {
                repeatTracker.lastHash = null;
                repeatTracker.lastPlainText = null;
                repeatTracker.lastLevel = null;
                repeatTracker.count = 0;
                repeatTracker.lastTimestamp = 0;
            }
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
        case 'setViewingMode':
            isViewingFile = !!msg.viewing;
            updateFooterText();
            break;
        case 'setSessionInfo':
            if (typeof applySessionInfo === 'function') applySessionInfo(msg.info);
            break;
        case 'setFilename':
            currentFilename = msg.filename || '';
            updateHeaderFilename();
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
        case 'setShowDecorations':
            if (typeof handleSetShowDecorations === 'function') handleSetShowDecorations(msg);
            break;
        case 'errorClassificationSettings':
            if (typeof handleErrorClassificationSettings === 'function') handleErrorClassificationSettings(msg);
            break;
        case 'sourcePreview':
            if (typeof handleSourcePreviewResponse === 'function') handleSourcePreviewResponse(msg);
            break;
        case 'splitInfo':
            if (typeof handleSplitInfo === 'function') handleSplitInfo(msg);
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
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A' && typeof copyAllToClipboard === 'function') {
        e.preventDefault(); copyAllToClipboard(); return;
    }
    if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key === 'f')) {
        e.preventDefault();
        if (typeof openSearch === 'function') openSearch();
        return;
    }
    if (e.key === 'Escape') {
        if (typeof closeContextModal === 'function' && typeof peekTargetIdx !== 'undefined' && peekTargetIdx >= 0) {
            closeContextModal();
            return;
        }
        if (typeof closeSearch === 'function') {
            closeSearch();
        }
        return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === ' ') { e.preventDefault(); vscodeApi.postMessage({ type: 'togglePause' }); }
    else if (e.key === 'w' || e.key === 'W') { toggleWrap(); }
    else if (e.key === 'Home') { logEl.scrollTop = 0; autoScroll = false; }
    else if (e.key === 'End') { jumpToBottom(); }
    else if (e.key === 'm' || e.key === 'M') { vscodeApi.postMessage({ type: 'insertMarker' }); }
    else if ((e.key === 'p' || e.key === 'P') && typeof togglePin === 'function') { togglePin(getCenterIdx()); }
    else if ((e.key === 'n' || e.key === 'N') && typeof promptAnnotation === 'function') { promptAnnotation(getCenterIdx()); }
});

// Retry rendering when viewport element receives dimensions after layout
var _logResizeObs = new ResizeObserver(function() {
    if (allLines.length > 0 && logEl.clientHeight > 0) {
        renderViewport(true);
        if (autoScroll) logEl.scrollTop = logEl.scrollHeight;
    }
});
_logResizeObs.observe(logEl);
`;
}
