/**
 * Client-side JavaScript for manual line hiding in the log viewer.
 * Allows users to hide individual lines, selections, or all visible lines via context menu.
 * Hidden lines are tracked by index and displayed with a counter that supports peek.
 * New logs are NOT hidden by default — only explicitly hidden lines are tracked.
 */
export function getHiddenLinesScript(): string {
    return /* javascript */ `
var hiddenLineIndices = new Set();
var isPeeking = false;
var hiddenCounterEl = null;

/** Refresh viewport after hiding changes. */
function refreshHiddenView() {
    updateHiddenDisplay();
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

function initHiddenLines() {
    hiddenCounterEl = document.getElementById('hidden-lines-counter');
    if (hiddenCounterEl) {
        hiddenCounterEl.addEventListener('click', togglePeek);
    }
}

/** Hide a single line by index. Markers cannot be hidden. */
function hideLine(idx) {
    if (idx < 0 || idx >= allLines.length) return;
    var item = allLines[idx];
    if (item.type === 'marker') return;
    hiddenLineIndices.add(idx);
    item.userHidden = true;
    refreshHiddenView();
}

/** Unhide a single line by index. */
function unhideLine(idx) {
    if (!hiddenLineIndices.has(idx)) return;
    hiddenLineIndices.delete(idx);
    if (idx < allLines.length) {
        allLines[idx].userHidden = false;
    }
    refreshHiddenView();
}

/** Hide all lines in the current shift+click selection. */
function hideSelection() {
    var start = Math.min(selectionStart, selectionEnd);
    var end = Math.max(selectionStart, selectionEnd);
    if (start < 0 || end < 0) return;
    for (var i = start; i <= end && i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') continue;
        hiddenLineIndices.add(i);
        item.userHidden = true;
    }
    clearSelection();
    refreshHiddenView();
}

/** Unhide all lines in the current shift+click selection. */
function unhideSelection() {
    var start = Math.min(selectionStart, selectionEnd);
    var end = Math.max(selectionStart, selectionEnd);
    if (start < 0 || end < 0) return;
    for (var i = start; i <= end && i < allLines.length; i++) {
        if (hiddenLineIndices.has(i)) {
            hiddenLineIndices.delete(i);
            allLines[i].userHidden = false;
        }
    }
    clearSelection();
    refreshHiddenView();
}

/** Hide all currently visible lines (respects other filters). */
function hideAllVisible() {
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') continue;
        if (item.height > 0) {
            hiddenLineIndices.add(i);
            item.userHidden = true;
        }
    }
    refreshHiddenView();
}

/** Unhide all manually hidden lines and exit peek mode. */
function unhideAll() {
    hiddenLineIndices.forEach(function(idx) {
        if (idx < allLines.length) {
            allLines[idx].userHidden = false;
        }
    });
    hiddenLineIndices.clear();
    isPeeking = false;
    refreshHiddenView();
}

/** Toggle peek mode: temporarily show hidden lines without clearing them. */
function togglePeek() {
    isPeeking = !isPeeking;
    hiddenLineIndices.forEach(function(idx) {
        if (idx < allLines.length) {
            allLines[idx].userHidden = !isPeeking;
        }
    });
    refreshHiddenView();
}

function getHiddenCount() {
    return hiddenLineIndices.size;
}

function hasHiddenLines() {
    return hiddenLineIndices.size > 0;
}

function hasSelectionWithHidden() {
    var start = Math.min(selectionStart, selectionEnd);
    var end = Math.max(selectionStart, selectionEnd);
    if (start < 0 || end < 0) return false;
    for (var i = start; i <= end && i < allLines.length; i++) {
        if (hiddenLineIndices.has(i)) return true;
    }
    return false;
}

function isLineHidden(idx) {
    return hiddenLineIndices.has(idx);
}

function updateHiddenDisplay() {
    if (!hiddenCounterEl) return;
    var count = hiddenLineIndices.size;
    if (count === 0) {
        hiddenCounterEl.style.display = 'none';
        hiddenCounterEl.classList.remove('peeking');
    } else {
        hiddenCounterEl.style.display = 'inline-flex';
        var label = count === 1 ? '1 hidden' : count + ' hidden';
        hiddenCounterEl.querySelector('.hidden-count-text').textContent = label;
        hiddenCounterEl.classList.toggle('peeking', isPeeking);
        hiddenCounterEl.title = isPeeking
            ? 'Peeking at hidden lines - click to re-hide'
            : 'Click to peek at hidden lines';
    }
}

function adjustHiddenIndicesAfterTrim(excessCount) {
    if (excessCount <= 0 || hiddenLineIndices.size === 0) return;
    var newSet = new Set();
    hiddenLineIndices.forEach(function(idx) {
        var newIdx = idx - excessCount;
        if (newIdx >= 0) newSet.add(newIdx);
    });
    hiddenLineIndices = newSet;
    updateHiddenDisplay();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHiddenLines);
} else {
    initHiddenLines();
}
`;
}
