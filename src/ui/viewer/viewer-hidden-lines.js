"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHiddenLinesScript = getHiddenLinesScript;
/**
 * Client-side JavaScript for manual line hiding and auto-hide patterns in the log viewer.
 * Allows users to hide individual lines, selections, or all visible lines via context menu.
 * Auto-hide patterns match text substrings (case-insensitive) to hide lines automatically.
 * Hidden lines are tracked by index; auto-hidden lines are tracked by pattern match.
 * New logs are checked against auto-hide patterns on arrival (in addToData).
 */
function getHiddenLinesScript() {
    return /* javascript */ `
var hiddenLineIndices = new Set();
var isPeeking = false;
var hiddenCounterEl = null;

/** Session-only auto-hide patterns (cleared when session ends). */
var sessionAutoHidePatterns = [];
/** Persistent auto-hide patterns (from VS Code settings). */
var persistentAutoHidePatterns = [];
/** Count of lines hidden by auto-hide patterns (for combined counter). */
var autoHiddenCount = 0;

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
        hiddenCounterEl.addEventListener('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof openAutoHideModal === 'function') openAutoHideModal();
        });
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

/** Combined count of hidden lines, avoiding double-counting lines that are both userHidden and autoHidden. */
function getHiddenCount() {
    var overlap = 0;
    hiddenLineIndices.forEach(function(idx) {
        if (idx < allLines.length && allLines[idx].autoHidden) overlap++;
    });
    return hiddenLineIndices.size + autoHiddenCount - overlap;
}

function hasHiddenLines() {
    return hiddenLineIndices.size > 0 || autoHiddenCount > 0;
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

/** Test whether plain text matches any auto-hide pattern (case-insensitive). */
function testAutoHide(plainText) {
    if (sessionAutoHidePatterns.length === 0 && persistentAutoHidePatterns.length === 0) return false;
    var lower = plainText.toLowerCase();
    for (var i = 0; i < sessionAutoHidePatterns.length; i++) {
        if (lower.indexOf(sessionAutoHidePatterns[i]) >= 0) return true;
    }
    for (var j = 0; j < persistentAutoHidePatterns.length; j++) {
        if (lower.indexOf(persistentAutoHidePatterns[j]) >= 0) return true;
    }
    return false;
}

/** Apply auto-hide patterns to all existing lines. */
function applyAutoHide() {
    autoHiddenCount = 0;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') continue;
        var plain = stripTags(item.html || '');
        item.autoHidden = testAutoHide(plain);
        if (item.autoHidden) autoHiddenCount++;
    }
    refreshHiddenView();
}

/** Add a session-only auto-hide pattern. */
function addAutoHidePatternSession(text) {
    var pattern = text.trim().toLowerCase();
    if (!pattern) return;
    if (sessionAutoHidePatterns.indexOf(pattern) >= 0) return;
    if (persistentAutoHidePatterns.indexOf(pattern) >= 0) return;
    sessionAutoHidePatterns.push(pattern);
    applyAutoHide();
}

/** Add a persistent auto-hide pattern (session + saved to settings). */
function addAutoHidePatternAlways(text) {
    var pattern = text.trim().toLowerCase();
    if (!pattern) return;
    if (persistentAutoHidePatterns.indexOf(pattern) < 0) {
        persistentAutoHidePatterns.push(pattern);
    }
    /* Remove from session-only if it was there */
    var si = sessionAutoHidePatterns.indexOf(pattern);
    if (si >= 0) sessionAutoHidePatterns.splice(si, 1);
    vscodeApi.postMessage({ type: 'addAutoHidePattern', pattern: text.trim() });
    applyAutoHide();
}

/** Handle setAutoHidePatterns message from extension. */
function handleSetAutoHidePatterns(msg) {
    if (!Array.isArray(msg.patterns)) return;
    persistentAutoHidePatterns = [];
    for (var i = 0; i < msg.patterns.length; i++) {
        var p = (msg.patterns[i] || '').trim().toLowerCase();
        if (p) persistentAutoHidePatterns.push(p);
    }
    applyAutoHide();
}

function updateHiddenDisplay() {
    if (!hiddenCounterEl) return;
    var count = getHiddenCount();
    if (count === 0) {
        hiddenCounterEl.classList.add('u-hidden');
        hiddenCounterEl.classList.remove('peeking');
    } else {
        hiddenCounterEl.classList.remove('u-hidden');
        hiddenCounterEl.querySelector('.hidden-count-text').textContent = String(count);
        hiddenCounterEl.classList.toggle('peeking', isPeeking);
        hiddenCounterEl.title = isPeeking
            ? 'Peeking at hidden lines \\u2014 click to re-hide'
            : count + ' hidden \\u2014 click to peek, double-click to manage';
    }
}

function adjustHiddenIndicesAfterTrim(excessCount) {
    if (excessCount <= 0) return;
    /* autoHiddenCount already decremented in trimData's pre-splice loop. */
    if (hiddenLineIndices.size > 0) {
        var newSet = new Set();
        hiddenLineIndices.forEach(function(idx) {
            var newIdx = idx - excessCount;
            if (newIdx >= 0) newSet.add(newIdx);
        });
        hiddenLineIndices = newSet;
    }
    updateHiddenDisplay();
}

/** Get all auto-hide patterns (session + persistent) for the modal. */
function getAllAutoHidePatterns() {
    var result = [];
    for (var i = 0; i < persistentAutoHidePatterns.length; i++) {
        result.push({ pattern: persistentAutoHidePatterns[i], persistent: true });
    }
    for (var j = 0; j < sessionAutoHidePatterns.length; j++) {
        result.push({ pattern: sessionAutoHidePatterns[j], persistent: false });
    }
    return result;
}

/** Remove an auto-hide pattern by value. */
function removeAutoHidePattern(pattern, persistent) {
    var lower = pattern.toLowerCase();
    if (persistent) {
        persistentAutoHidePatterns = persistentAutoHidePatterns.filter(function(p) { return p !== lower; });
        vscodeApi.postMessage({ type: 'removeAutoHidePattern', pattern: pattern });
    } else {
        sessionAutoHidePatterns = sessionAutoHidePatterns.filter(function(p) { return p !== lower; });
    }
    applyAutoHide();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHiddenLines);
} else {
    initHiddenLines();
}
`;
}
//# sourceMappingURL=viewer-hidden-lines.js.map