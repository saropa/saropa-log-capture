/** Client-side JS for the log viewer: virtual scrolling, stack traces, auto-scroll. */
import { getKeyboardScript } from './viewer-script-keyboard';
export function getViewerScript(maxLines: number): string {
    return /* javascript */ `
var logEl = document.getElementById('log-content');
var spacerTop = document.getElementById('spacer-top');
var viewportEl = document.getElementById('viewport');
var spacerBottom = document.getElementById('spacer-bottom');
var jumpBtn = document.getElementById('jump-btn');
var footerEl = document.getElementById('footer');
var footerTextEl = document.getElementById('footer-text');
var footerVersion = footerTextEl ? (footerTextEl.getAttribute('data-version') || '') : '';
if (footerTextEl) footerTextEl.addEventListener('click', function(e) {
    if (e.target && e.target.classList && e.target.classList.contains('footer-filename')) vscodeApi.postMessage({ type: 'revealLogFile' });
});
var wrapToggle = document.getElementById('wrap-toggle');

var vscodeApi = acquireVsCodeApi();
window._vscodeApi = vscodeApi;
if (window._scriptErrors && window._scriptErrors.length) {
    vscodeApi.postMessage({ type: 'scriptError', errors: window._scriptErrors });
}
var MAX_LINES = ${maxLines};
var ROW_HEIGHT = 20;
var MARKER_HEIGHT = 28;
var OVERSCAN = 30;

var allLines = [], totalHeight = 0, lineCount = 0;
var autoScroll = true, isPaused = false, isViewingFile = false, wordWrap = false;
var nextGroupId = 0, activeGroupHeader = null, groupHeaderMap = {};
var lastStart = -1, lastEnd = -1, rafPending = false;
var currentFilename = '', nextSeq = 1, scrollMemory = {};
var loadTruncatedInfo = null;

function stripTags(html) { return html.replace(/<[^>]*>/g, ''); }
function isStackFrameText(html) { return /^\\s+at\\s/.test(stripTags(html)); }

function handleScroll() {
    if (typeof suppressScroll !== 'undefined' && suppressScroll) return;
    var atBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 30;
    autoScroll = atBottom; renderViewport(false);
    jumpBtn.style.display = atBottom ? 'none' : 'block';
}

logEl.addEventListener('scroll', function() {
    if (!rafPending) { rafPending = true; requestAnimationFrame(function() { rafPending = false; handleScroll(); }); }
});

logEl.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    var scale = e.deltaMode === 2 ? logEl.clientHeight : e.deltaMode === 1 ? ROW_HEIGHT : 1;
    logEl.scrollTop += e.deltaY * scale;
}, { passive: false });

viewportEl.addEventListener('click', function(e) {
    var urlLink = e.target.closest('.url-link');
    if (urlLink) {
        e.preventDefault();
        vscodeApi.postMessage({ type: 'openUrl', url: urlLink.dataset.url || '' });
        return;
    }
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

function toggleWrap() { wordWrap = !wordWrap; logEl.classList.toggle('nowrap', !wordWrap); renderViewport(true); }
if (wrapToggle) wrapToggle.addEventListener('click', toggleWrap);
jumpBtn.addEventListener('click', jumpToBottom);

function getCenterIdx() {
    var mid = logEl.scrollTop + logEl.clientHeight / 2;
    if (typeof findIndexAtOffset === 'function' && prefixSums) return findIndexAtOffset(mid).index;
    var h = 0;
    for (var ci = 0; ci < allLines.length; ci++) { h += allLines[ci].height; if (h >= mid) return ci; }
    return allLines.length - 1;
}

function jumpToBottom() {
    if (window.isContextMenuOpen) return;
    if (window.setProgrammaticScroll) window.setProgrammaticScroll();
    suppressScroll = true; logEl.scrollTop = logEl.scrollHeight; suppressScroll = false;
    autoScroll = true; jumpBtn.style.display = 'none';
}

function formatNumber(n) { return String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }

function updateFooterText() {
    footerTextEl.textContent = '';
    var prefix = isViewingFile ? '' : (isPaused ? '\\u23F8 ' : '\\u25CF ');
    if (prefix) footerTextEl.appendChild(document.createTextNode(prefix));
    if (currentFilename) {
        var fn = document.createElement('span');
        fn.className = 'footer-filename'; fn.textContent = currentFilename; fn.title = 'Reveal in Session History';
        footerTextEl.appendChild(fn);
    }
    if (loadTruncatedInfo) {
        footerTextEl.appendChild(document.createTextNode(' \\u00b7 Showing first ' + formatNumber(loadTruncatedInfo.shown) + ' of ' + formatNumber(loadTruncatedInfo.total) + ' lines'));
    }
    updateLineCount();
    updateFooterVersionLink();
}

function updateFooterVersionLink() {
    var link = document.getElementById('footer-version-link');
    if (link && footerVersion) {
        link.textContent = footerVersion;
        link.style.display = '';
    } else if (link) link.style.display = 'none';
}

function updateFooterSelection() {
    var el = document.getElementById('footer-selection');
    if (!el) return;
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed) { el.textContent = ''; return; }
    var viewport = document.getElementById('viewport');
    if (!viewport || (!viewport.contains(sel.anchorNode) && !viewport.contains(sel.focusNode))) { el.textContent = ''; return; }
    var text = sel.toString();
    var lineCount = (text.match(/\\n/g) || []).length + 1;
    var charCount = text.length;
    el.textContent = lineCount + ' line' + (lineCount !== 1 ? 's' : '') + ', ' + charCount + ' char' + (charCount !== 1 ? 's' : '') + ' selected';
}
var selectionUpdateRaf = null;
function scheduleFooterSelectionUpdate() {
    if (selectionUpdateRaf) return;
    selectionUpdateRaf = requestAnimationFrame(function() {
        selectionUpdateRaf = null;
        updateFooterSelection();
    });
}
if (viewportEl) {
    document.addEventListener('selectionchange', scheduleFooterSelectionUpdate);
    viewportEl.addEventListener('mouseup', function() { setTimeout(updateFooterSelection, 0); });
    viewportEl.addEventListener('keyup', scheduleFooterSelectionUpdate);
}
var footerVersionLink = document.getElementById('footer-version-link');
if (footerVersionLink) {
    footerVersionLink.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation(); /* Prevent document outside-click from closing the panel we are opening */
        if (typeof setActivePanel === 'function') setActivePanel('about');
    });
    updateFooterVersionLink();
}

var cachedVisibleCount = 0, lastVisibleCountTime = 0;
function updateLineCount() {
    var el = document.getElementById('line-count');
    if (!el) return;
    if (lineCount <= 0) { el.textContent = ''; return; }
    var badge = document.getElementById('filter-badge');
    var isFiltered = badge && badge.style.display !== 'none';
    if (isFiltered) {
        if (typeof window !== 'undefined' && window.__visibleCountDirty) { cachedVisibleCount = -1; window.__visibleCountDirty = false; }
        var now = Date.now();
        if (now - lastVisibleCountTime < 1000 && cachedVisibleCount >= 0) { el.textContent = formatNumber(cachedVisibleCount) + '/' + formatNumber(lineCount) + ' lines'; return; }
        lastVisibleCountTime = now;
        var visible = 0; for (var i = 0; i < allLines.length; i++) { if (allLines[i].height > 0) visible++; }
        cachedVisibleCount = visible; el.textContent = formatNumber(visible) + '/' + formatNumber(lineCount) + ' lines';
    } else { cachedVisibleCount = -1; el.textContent = formatNumber(lineCount) + ' lines'; }
}

window.addEventListener('message', function(event) {
    var msg = event.data;
    switch (msg.type) {
        case 'addLines': {
            var isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
            for (var i = 0; i < msg.lines.length; i++) {
                var ln = msg.lines[i];
                addToData(ln.text, ln.isMarker, ln.category, ln.timestamp, ln.fw, ln.sourcePath);
            }
            trimData();
            if (msg.lineCount !== undefined) lineCount = msg.lineCount;
            if (typeof buildPrefixSums === 'function' && typeof appendPrefixSums === 'function') {
                if (prefixSums && prefixSums.length + msg.lines.length === allLines.length + 1) { appendPrefixSums(); }
                else { buildPrefixSums(); }
            }
            if (!isHidden) {
                renderViewport(true);
                if (typeof scheduleMinimap === 'function') scheduleMinimap();
                if (autoScroll && !window.isContextMenuOpen) { if (window.setProgrammaticScroll) window.setProgrammaticScroll(); suppressScroll = true; logEl.scrollTop = logEl.scrollHeight; suppressScroll = false; }
                updateFooterText();
            }
            break;
        }
        case 'clear':
            loadTruncatedInfo = null;
            if (currentFilename && !autoScroll) { scrollMemory[currentFilename] = logEl.scrollTop; }
            autoScroll = true;
            allLines.length = 0; totalHeight = 0; lineCount = 0; activeGroupHeader = null; nextSeq = 1;
            lastStart = -1; lastEnd = -1; groupHeaderMap = {}; prefixSums = null;
            cachedVisibleCount = 0; if (typeof window !== 'undefined') window.__visibleCountDirty = false;
            isPaused = false; isViewingFile = false; footerEl.classList.remove('paused');
            if (typeof closeContextModal === 'function') closeContextModal(); if (typeof closeInfoPanel === 'function') closeInfoPanel();
            if (typeof resetSourceTags === 'function') resetSourceTags(); if (typeof resetClassTags === 'function') resetClassTags(); if (typeof resetScopeFilter === 'function') resetScopeFilter(); if (typeof updateSessionNav === 'function') updateSessionNav(false, false, 0, 0);
            if (typeof clearRunNav === 'function') clearRunNav();
            if (typeof repeatTracker !== 'undefined') { repeatTracker.lastHash = null; repeatTracker.lastPlainText = null; repeatTracker.lastLevel = null; repeatTracker.count = 0; repeatTracker.lastTimestamp = 0; repeatTracker.lastLineIndex = -1; }
            footerTextEl.textContent = 'Cleared'; updateLineCount(); renderViewport(true); if (typeof scheduleMinimap === 'function') scheduleMinimap();
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
            if (isViewingFile) { autoScroll = false; }
            updateFooterText();
            break;
        case 'setSessionInfo':
            if (typeof applySessionInfo === 'function') applySessionInfo(msg.info);
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
        case 'setShowDecorations':
            if (typeof handleSetShowDecorations === 'function') handleSetShowDecorations(msg);
            break;
        case 'errorClassificationSettings':
            if (typeof handleErrorClassificationSettings === 'function') handleErrorClassificationSettings(msg);
            break;
        case 'splitInfo':
            if (typeof handleSplitInfo === 'function') handleSplitInfo(msg);
            break;
        case 'runBoundaries':
            if (typeof handleRunBoundaries === 'function') handleRunBoundaries(msg);
            break;
        case 'sessionNavInfo':
            if (typeof handleSessionNavInfo === 'function') handleSessionNavInfo(msg);
            break;
        case 'scrollToLine': {
            if (window.isContextMenuOpen) break;
            var li = Math.max(0, Math.min(Number(msg.line) - 1, allLines.length - 1));
            var ch = 0; for (var si = 0; si < li; si++) ch += allLines[si].height;
            if (window.setProgrammaticScroll) window.setProgrammaticScroll();
            suppressScroll = true; logEl.scrollTop = ch; suppressScroll = false;
            autoScroll = false; break;
        }
        case 'setupFindSearch':
            if (typeof setupFromFindInFiles === 'function') setupFromFindInFiles(msg);
            break;
        case 'findNextMatch':
            if (typeof searchNext === 'function') searchNext();
            break;
        case 'loadTruncated':
            loadTruncatedInfo = { shown: msg.shown || 0, total: msg.total || 0 };
            updateFooterText();
            break;
        case 'loadComplete':
            if (currentFilename && scrollMemory[currentFilename] !== undefined && !window.isContextMenuOpen) {
                if (window.setProgrammaticScroll) window.setProgrammaticScroll();
                suppressScroll = true; logEl.scrollTop = scrollMemory[currentFilename]; suppressScroll = false;
                autoScroll = false; jumpBtn.style.display = 'block'; renderViewport(true);
            }
            updateFooterText();
            break;
        case 'setScopeContext':
            if (typeof handleScopeContextMessage === 'function') handleScopeContextMessage(msg);
            break;
        case 'minimapShowInfo':
            if (typeof handleMinimapShowInfo === 'function') handleMinimapShowInfo(msg);
            break;
        case 'minimapWidth':
            if (typeof handleMinimapWidth === 'function') handleMinimapWidth(msg);
            break;
        case 'iconBarPosition':
            document.body.dataset.iconBar = msg.position || 'left';
            break;
    }
});

${getKeyboardScript()}

var _resizeRaf = false;
new ResizeObserver(function() {
    if (_resizeRaf) return; _resizeRaf = true;
    requestAnimationFrame(function() { _resizeRaf = false; if (allLines.length > 0 && logEl.clientHeight > 0) { renderViewport(false); if (autoScroll && !window.isContextMenuOpen) { if (window.setProgrammaticScroll) window.setProgrammaticScroll(); suppressScroll = true; logEl.scrollTop = logEl.scrollHeight; suppressScroll = false; } } });
}).observe(logEl);
`;
}
