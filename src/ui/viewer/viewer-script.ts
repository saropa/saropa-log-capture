/** Client-side JS for the log viewer: virtual scrolling, stack traces, auto-scroll. */
import { getKeyboardScript } from './viewer-script-keyboard';
import { getViewerScriptMessageHandler } from './viewer-script-messages';

export function getViewerScript(maxLines: number): string {
    return /* javascript */ `
var logEl = document.getElementById('log-content');
var spacerTop = document.getElementById('spacer-top');
var viewportEl = document.getElementById('viewport');
var spacerBottom = document.getElementById('spacer-bottom');
var jumpBtn = document.getElementById('jump-btn');
var jumpTopBtn = document.getElementById('jump-top-btn');
/** Only show scroll buttons when content exceeds this fraction of the viewport height. */
var SCROLL_BTN_THRESHOLD = 1.5;
var footerEl = document.getElementById('footer');
var footerTextEl = document.getElementById('footer-text');
var footerVersion = footerTextEl ? (footerTextEl.getAttribute('data-version') || '') : '';
/* Footer filename gestures: click=reveal, long-press=copy, dblclick=open folder. */
var _fnPressTimer = null;
var _fnLongFired = false;
if (footerTextEl) {
    footerTextEl.addEventListener('mousedown', function(e) {
        if (!e.target || !e.target.classList || !e.target.classList.contains('footer-filename')) return;
        _fnLongFired = false;
        _fnPressTimer = setTimeout(function() {
            _fnLongFired = true;
            vscodeApi.postMessage({ type: 'copyCurrentFilePath' });
            e.target.title = 'Copied!';
            setTimeout(function() { e.target.title = 'Click: reveal \\u00b7 Hold: copy path \\u00b7 Double-click: open folder'; }, 1500);
        }, 500);
    });
    footerTextEl.addEventListener('mouseup', function() { if (_fnPressTimer) { clearTimeout(_fnPressTimer); _fnPressTimer = null; } });
    footerTextEl.addEventListener('mouseleave', function() { if (_fnPressTimer) { clearTimeout(_fnPressTimer); _fnPressTimer = null; } });
    footerTextEl.addEventListener('click', function(e) {
        if (!e.target || !e.target.classList || !e.target.classList.contains('footer-filename')) return;
        if (_fnLongFired) { _fnLongFired = false; return; }
        vscodeApi.postMessage({ type: 'revealLogFile' });
    });
    footerTextEl.addEventListener('dblclick', function(e) {
        if (!e.target || !e.target.classList || !e.target.classList.contains('footer-filename')) return;
        e.preventDefault();
        vscodeApi.postMessage({ type: 'openCurrentFileFolder' });
    });
}
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

/** Strip HTML tags; null/undefined-safe so Copy All and copy-float never throw on missing line.html. */
function stripTags(html) { return (html == null ? '' : String(html)).replace(/<[^>]*>/g, ''); }
function isStackFrameText(html) { return /^\\s+at\\s/.test(stripTags(html)); }

function handleScroll() {
    if (typeof suppressScroll !== 'undefined' && suppressScroll) return;
    var atBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 30;
    autoScroll = atBottom; renderViewport(false);
    var isTall = logEl.scrollHeight > logEl.clientHeight * SCROLL_BTN_THRESHOLD;
    jumpBtn.style.display = (!atBottom && isTall) ? 'block' : 'none';
    if (jumpTopBtn) jumpTopBtn.style.display = (logEl.scrollTop > logEl.clientHeight * 0.5 && isTall) ? 'block' : 'none';
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
if (jumpTopBtn) jumpTopBtn.addEventListener('click', function() {
    if (window.isContextMenuOpen) return;
    if (window.setProgrammaticScroll) window.setProgrammaticScroll();
    suppressScroll = true; logEl.scrollTop = 0; suppressScroll = false;
    autoScroll = false; jumpTopBtn.style.display = 'none';
});

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
        fn.className = 'footer-filename'; fn.textContent = currentFilename; fn.title = 'Click: reveal \\u00b7 Hold: copy path \\u00b7 Double-click: open folder';
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

${getViewerScriptMessageHandler()}
${getKeyboardScript()}

var _resizeRaf = false;
new ResizeObserver(function() {
    if (_resizeRaf) return; _resizeRaf = true;
    requestAnimationFrame(function() { _resizeRaf = false; if (allLines.length > 0 && logEl.clientHeight > 0) { renderViewport(false); if (autoScroll && !window.isContextMenuOpen) { if (window.setProgrammaticScroll) window.setProgrammaticScroll(); suppressScroll = true; logEl.scrollTop = logEl.scrollHeight; suppressScroll = false; } } });
}).observe(logEl);
`;
}
