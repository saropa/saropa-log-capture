/**
 * Client-side JavaScript for multi-format copy in the log viewer.
 * Supports plain text, markdown, and bug report template formats.
 * Sends clipboard content to extension via postMessage.
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getCopyScript(): string {
    return /* javascript */ `
var selectionStart = -1;
var selectionEnd = -1;

function getSelectedLines() {
    var start = Math.min(selectionStart, selectionEnd);
    var end = Math.max(selectionStart, selectionEnd);
    if (start < 0 || end < 0 || start >= allLines.length) return [];
    var result = [];
    for (var i = start; i <= Math.min(end, allLines.length - 1); i++) {
        if (!allLines[i].excluded) result.push(allLines[i]);
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

function linesToPlainText(lines) {
    var parts = [];
    for (var i = 0; i < lines.length; i++) {
        parts.push(stripTags(lines[i].html));
    }
    return parts.join('\\n');
}

function linesToMarkdown(lines) {
    return '\\x60\\x60\\x60\\n' + linesToPlainText(lines) + '\\n\\x60\\x60\\x60';
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

viewportEl.addEventListener('click', function(e) {
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
    var dataIdx = lastStart + clickOffset;
    if (selectionStart < 0 || !e.shiftKey) {
        selectionStart = dataIdx;
        selectionEnd = dataIdx;
    } else {
        selectionEnd = dataIdx;
    }
    updateSelectionHighlight();
});

function updateSelectionHighlight() {
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

function clearSelection() {
    selectionStart = -1;
    selectionEnd = -1;
    var selected = viewportEl.querySelectorAll('.selected');
    for (var i = 0; i < selected.length; i++) {
        selected[i].classList.remove('selected');
    }
}
`;
}
