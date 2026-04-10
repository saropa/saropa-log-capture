"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerScriptFooterChunk = getViewerScriptFooterChunk;
/** Footer rendering/selection/line-count script chunk for the viewer. */
function getViewerScriptFooterChunk() {
    return /* javascript */ `
function formatNumber(n) { return String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }

function updateFooterText() {
    if (!footerTextEl) return;
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
}

/** No-op — version link removed (now on About sidebar label). */
function updateFooterVersionLink() {}

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
var cachedVisibleCount = 0, lastVisibleCountTime = 0;
function updateLineCount() {
    var el = document.getElementById('line-count');
    if (!el) return;
    if (lineCount <= 0) { el.textContent = ''; return; }
    var badge = document.getElementById('toolbar-filter-count');
    var isFiltered = badge && badge.textContent !== '';
    if (isFiltered) {
        if (typeof window !== 'undefined' && window.__visibleCountDirty) { cachedVisibleCount = -1; window.__visibleCountDirty = false; }
        var now = Date.now();
        if (now - lastVisibleCountTime < 1000 && cachedVisibleCount >= 0) { el.textContent = formatNumber(cachedVisibleCount) + '/' + formatNumber(lineCount) + ' lines'; return; }
        lastVisibleCountTime = now;
        var visible = 0; for (var i = 0; i < allLines.length; i++) { if (allLines[i].height > 0) visible++; }
        cachedVisibleCount = visible; el.textContent = formatNumber(visible) + '/' + formatNumber(lineCount) + ' lines';
    } else { cachedVisibleCount = -1; el.textContent = formatNumber(lineCount) + ' lines'; }
}
`;
}
//# sourceMappingURL=viewer-script-footer.js.map