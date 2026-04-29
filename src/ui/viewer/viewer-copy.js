"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCopyScript = getCopyScript;
/**
 * Client-side JavaScript for multi-format copy in the log viewer.
 * Supports plain text, markdown, and bug report template formats.
 * Sends clipboard content to extension via postMessage.
 * Concatenated into the same script scope as viewer-script.ts.
 */
function getCopyScript() {
    return /* javascript */ `
var selectionStart = -1;
var selectionEnd = -1;

/* Copy expansion for collapsed SQL repeats.
   A "N × SQL repeated:" row is one allLines entry with an sqlRepeatDrilldown carrying
   repeatCount; the N individual SQL lines themselves are never pushed into allLines
   (see viewer-data-add-repeat-collapse.ts). Without expansion, copying that row gives
   the user one line of header text and zero of the content they see represented.
   We store the hidden anchor's text on the notification row as collapsedLineText /
   collapsedRawText, and emit repeatCount copies when serializing for the clipboard.
   Guard on height > 0: cleanupTrailingRepeats (marker boundary / trim) zeroes the
   notification height and un-hides the anchor; expanding an inert notification then
   would double the anchor's content. */
function isExpandableRepeatNotification(item) {
    if (!item || item.type !== 'repeat-notification') return false;
    if (!(item.height > 0)) return false;
    if (!item.collapsedLineText && !item.collapsedRawText) return false;
    var d = item.sqlRepeatDrilldown;
    return !!(d && d.repeatCount > 0);
}

function repeatCountForExpansion(item) {
    return (item.sqlRepeatDrilldown.repeatCount | 0) || 1;
}

function getSelectedLines() {
    var start = Math.min(selectionStart, selectionEnd);
    var end = Math.max(selectionStart, selectionEnd);
    if (start < 0 || end < 0 || start >= allLines.length) return [];
    var result = [];
    for (var i = start; i <= Math.min(end, allLines.length - 1); i++) {
        var it = allLines[i];
        if (it.excluded) continue;
        /* Skip the hidden anchor of an active SQL repeat: its content is already
           represented (and will be expanded below) by the corresponding
           repeat-notification row in the same range. Including it here would
           produce one extra SQL copy on top of the N from expansion. */
        if (it.repeatHidden) continue;
        result.push(it);
    }
    return result;
}

function getVisibleLines() {
    var result = [];
    for (var i = lastStart; i <= lastEnd && i < allLines.length; i++) {
        if (allLines[i].height > 0) result.push(allLines[i]);
    }
    return result;
}

function lineToPlainText(item) {
    if (isExpandableRepeatNotification(item)) {
        var n = repeatCountForExpansion(item);
        var txt = item.collapsedLineText || stripTags(item.collapsedRawText || '');
        var parts = new Array(n);
        for (var k = 0; k < n; k++) parts[k] = txt;
        return parts.join('\\n');
    }
    return stripTags(item.html);
}

function linesToPlainText(lines) {
    var parts = [];
    for (var i = 0; i < lines.length; i++) {
        parts.push(lineToPlainText(lines[i]));
    }
    return parts.join('\\n');
}

/* Count how many output lines linesToPlainText will actually produce so the
   "Copied N lines" toast reflects the expanded total rather than the count of
   allLines entries (which undercounts collapsed repeats by a factor of repeatCount). */
function countExpandedLines(lines) {
    var total = 0;
    for (var i = 0; i < lines.length; i++) {
        total += isExpandableRepeatNotification(lines[i]) ? repeatCountForExpansion(lines[i]) : 1;
    }
    return total;
}

function linesToMarkdown(lines) {
    return '\\x60\\x60\\x60\\n' + linesToPlainText(lines) + '\\n\\x60\\x60\\x60';
}

function linesToSnippet(lines) {
    return '\\x60\\x60\\x60log\\n' + linesToPlainText(lines) + '\\n\\x60\\x60\\x60';
}

function copyAsPlainText() {
    var lines = selectionStart >= 0 ? getSelectedLines() : getVisibleLines();
    if (lines.length === 0) return;
    vscodeApi.postMessage({ type: 'copyToClipboard', text: linesToPlainText(lines) });
}

function copyAsMarkdown() {
    var lines = selectionStart >= 0 ? getSelectedLines() : getVisibleLines();
    if (lines.length === 0) return;
    vscodeApi.postMessage({ type: 'copyToClipboard', text: linesToMarkdown(lines) });
}

function copyAsSnippet() {
    var lines = selectionStart >= 0 ? getSelectedLines() : getVisibleLines();
    if (lines.length === 0) return;
    vscodeApi.postMessage({ type: 'copyToClipboard', text: linesToSnippet(lines) });
}

function getAllCopyableLines() {
    var lines = [];
    for (var i = 0; i < allLines.length; i++) {
        var it = allLines[i];
        if (it.height <= 0) continue;
        if (it.type === 'marker') continue;
        lines.push(it);
    }
    return lines;
}

function lineToRawText(item) {
    if (isExpandableRepeatNotification(item)) {
        var n = repeatCountForExpansion(item);
        var txt = item.collapsedRawText != null ? item.collapsedRawText : (item.collapsedLineText || '');
        var parts = new Array(n);
        for (var k = 0; k < n; k++) parts[k] = txt;
        return parts.join('\\n');
    }
    return item.rawText != null ? item.rawText : stripTags(item.html);
}

function linesToRawText(lines) {
    var parts = [];
    for (var i = 0; i < lines.length; i++) {
        parts.push(lineToRawText(lines[i]));
    }
    return parts.join('\\n');
}

function copyAsRawText() {
    var lines = selectionStart >= 0 ? getSelectedLines() : getVisibleLines();
    if (lines.length === 0) return;
    vscodeApi.postMessage({ type: 'copyToClipboard', text: linesToRawText(lines) });
}

function copyAllToClipboard() {
    var lines = getAllCopyableLines();
    if (lines.length === 0) return;
    vscodeApi.postMessage({ type: 'copyToClipboard', text: linesToPlainText(lines) });
}

function copyAllFilteredWithCount() {
    var lines = getAllCopyableLines();
    if (lines.length === 0) return;
    /* lineCount reports the expanded total so the toast matches what landed on
       the clipboard — a single "12 × SQL repeated:" row contributes 12, not 1. */
    vscodeApi.postMessage({ type: 'copyAllFiltered', text: linesToPlainText(lines), lineCount: countExpandedLines(lines) });
}

function decorateLine(item, overrideText) {
    var text = overrideText != null ? overrideText : stripTags(item.html || '');
    var parts = [];
    /* Emoji dot only in copy when "Severity dot (copy only)" is checked; viewer uses gutter bar only. */
    var addingDot = typeof decoShowDot !== 'undefined' && decoShowDot && typeof getLevelDot === 'function';
    if (addingDot) {
        var dot = getLevelDot(item.level || 'info', !!item.fw);
        parts.push(dot);
        /* Strip leading emoji dot from text to avoid duplication — the line may already contain one. */
        if (text.indexOf(dot) === 0) text = text.substring(dot.length).replace(/^\\s+/, '');
    }
    if (item.seq !== undefined) {
        parts.push(String(item.seq).padStart(5, ' '));
    }
    if (typeof formatDecoTimestamp === 'function' && item.timestamp) {
        var ts = formatDecoTimestamp(item.timestamp);
        if (ts) parts.push(ts);
    }
    if (parts.length > 0) return parts.join('  ') + '  \\u00BB ' + text;
    return text;
}

function linesToDecoratedText(lines) {
    var parts = [];
    for (var i = 0; i < lines.length; i++) {
        var it = lines[i];
        if (isExpandableRepeatNotification(it)) {
            /* Expanded repeats share the notification's seq/timestamp — per-instance
               metadata was not retained at ingest (only the anchor and a drilldown
               snapshot are kept). Emitting N decorated copies with the same prefix
               is intentional: the decoration is a visual aid, not a claim of
               distinct timestamps. */
            var n = repeatCountForExpansion(it);
            var txt = it.collapsedLineText || stripTags(it.collapsedRawText || '');
            for (var k = 0; k < n; k++) parts.push(decorateLine(it, txt));
        } else {
            parts.push(decorateLine(it));
        }
    }
    return parts.join('\\n');
}

function copyAllDecorated() {
    var lines = getAllCopyableLines();
    if (lines.length === 0) return;
    vscodeApi.postMessage({ type: 'copyToClipboard', text: linesToDecoratedText(lines) });
}

if (viewportEl) viewportEl.addEventListener('click', function(e) {
    if (!e.shiftKey) return;
    var lineEl = e.target.closest('.line, .stack-header, .marker');
    if (!lineEl) return;
    var parent = lineEl.parentElement;
    if (parent !== viewportEl) return;
    var children = viewportEl.children;
    var clickOffset = -1;
    for (var i = 0; i < children.length; i++) {
        if (children[i] === lineEl) { clickOffset = i; break; }
    }
    if (clickOffset < 0) return;
    var dataIdx = lineEl.dataset.idx !== undefined ? parseInt(lineEl.dataset.idx, 10) : lastStart + clickOffset;
    if (selectionStart < 0 || !e.shiftKey) {
        selectionStart = dataIdx;
        selectionEnd = dataIdx;
    } else {
        selectionEnd = dataIdx;
    }
    updateSelectionHighlight();
});

function updateSelectionHighlight() {
    if (!viewportEl) return;
    var children = viewportEl.children;
    var start = Math.min(selectionStart, selectionEnd);
    var end = Math.max(selectionStart, selectionEnd);
    for (var i = 0; i < children.length; i++) {
        var idx = lastStart + i;
        if (idx >= start && idx <= end) {
            children[i].classList.add('selected');
        } else {
            children[i].classList.remove('selected');
        }
    }
}

var copyToastEl = null;
var copyToastTimer = 0;
function showCopyToast() {
    if (!copyToastEl) {
        copyToastEl = document.createElement('div');
        copyToastEl.className = 'copy-toast';
        copyToastEl.textContent = 'Copied';
        document.body.appendChild(copyToastEl);
    }
    clearTimeout(copyToastTimer);
    copyToastEl.classList.add('visible');
    copyToastTimer = setTimeout(function() { copyToastEl.classList.remove('visible'); }, 1500);
}

var copyFloat = document.getElementById('copy-float');
var copyFloatLineEl = null;
var copyFloatHideTimer = 0;
var wrapperEl = document.getElementById('log-content-wrapper');

function showCopyFloat(lineEl) {
    if (!copyFloat || !wrapperEl || !logEl) return;
    if (lineEl === copyFloatLineEl) return;
    copyFloatLineEl = lineEl;
    var wrapRect = wrapperEl.getBoundingClientRect();
    var logRect = logEl.getBoundingClientRect();
    var lineRect = lineEl.getBoundingClientRect();
    copyFloat.style.right = (wrapRect.right - logRect.right + 8) + 'px';
    copyFloat.style.display = 'block'; // must precede offsetHeight read
    var iconH = copyFloat.offsetHeight;
    var centerY = lineRect.top + (lineRect.height - iconH) / 2 - wrapRect.top;
    copyFloat.style.top = centerY + 'px';
}

function hideCopyFloat() {
    if (!copyFloat) return;
    copyFloat.style.display = 'none';
    copyFloatLineEl = null;
}

if (viewportEl) viewportEl.addEventListener('mouseover', function(e) {
    var lineEl = e.target.closest('.line, .stack-header');
    if (!lineEl || lineEl.classList.contains('marker')) { return; }
    clearTimeout(copyFloatHideTimer);
    showCopyFloat(lineEl);
});

if (viewportEl) viewportEl.addEventListener('mouseleave', function() {
    copyFloatHideTimer = setTimeout(hideCopyFloat, 150);
});

if (copyFloat) copyFloat.addEventListener('mouseenter', function() {
    clearTimeout(copyFloatHideTimer);
});
if (copyFloat) copyFloat.addEventListener('mouseleave', hideCopyFloat);

if (copyFloat) copyFloat.addEventListener('click', function(e) {
    e.preventDefault();
    if (!copyFloatLineEl) return;
    var ci = parseInt(copyFloatLineEl.dataset.idx, 10);
    if (ci >= 0 && ci < allLines.length) {
        /* Route through lineToPlainText so the hover-to-copy float expands a
           "N × SQL repeated" row into N lines, matching Ctrl+C behavior. */
        vscodeApi.postMessage({ type: 'copyToClipboard', text: lineToPlainText(allLines[ci]) });
        showCopyToast();
    }
});

if (logEl) logEl.addEventListener('scroll', function() {
    if (copyFloat && copyFloat.style.display !== 'none') hideCopyFloat();
}, { passive: true });

function clearSelection() {
    selectionStart = -1;
    selectionEnd = -1;
    if (!viewportEl) return;
    var selected = viewportEl.querySelectorAll('.selected');
    for (var i = 0; i < selected.length; i++) {
        selected[i].classList.remove('selected');
    }
}
`;
}
//# sourceMappingURL=viewer-copy.js.map