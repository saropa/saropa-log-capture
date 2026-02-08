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

function getAllCopyableLines() {
    var lines = [];
    for (var i = 0; i < allLines.length; i++) {
        if (allLines[i].height > 0 && allLines[i].type !== 'marker') {
            lines.push(allLines[i]);
        }
    }
    return lines;
}

function copyAllToClipboard() {
    var lines = getAllCopyableLines();
    if (lines.length === 0) return;
    vscodeApi.postMessage({ type: 'copyToClipboard', text: linesToPlainText(lines) });
}

function decorateLine(item) {
    var text = stripTags(item.html || '');
    var parts = [];
    if (typeof getLevelDot === 'function') {
        parts.push(getLevelDot(item.level || 'info', !!item.fw));
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
        parts.push(decorateLine(lines[i]));
    }
    return parts.join('\\n');
}

function copyAllDecorated() {
    var lines = getAllCopyableLines();
    if (lines.length === 0) return;
    vscodeApi.postMessage({ type: 'copyToClipboard', text: linesToDecoratedText(lines) });
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
    if (lineEl === copyFloatLineEl) return;
    copyFloatLineEl = lineEl;
    var wrapRect = wrapperEl.getBoundingClientRect();
    var logRect = logEl.getBoundingClientRect();
    var lineRect = lineEl.getBoundingClientRect();
    copyFloat.style.right = (wrapRect.right - logRect.right + 4) + 'px';
    copyFloat.style.top = (lineRect.top - wrapRect.top + 2) + 'px';
    copyFloat.style.display = 'block';
}

function hideCopyFloat() {
    copyFloat.style.display = 'none';
    copyFloatLineEl = null;
}

viewportEl.addEventListener('mouseover', function(e) {
    var lineEl = e.target.closest('.line, .stack-header');
    if (!lineEl || lineEl.classList.contains('marker')) { return; }
    clearTimeout(copyFloatHideTimer);
    showCopyFloat(lineEl);
});

viewportEl.addEventListener('mouseleave', function() {
    copyFloatHideTimer = setTimeout(hideCopyFloat, 150);
});

copyFloat.addEventListener('mouseenter', function() {
    clearTimeout(copyFloatHideTimer);
});
copyFloat.addEventListener('mouseleave', hideCopyFloat);

copyFloat.addEventListener('click', function(e) {
    e.preventDefault();
    if (!copyFloatLineEl) return;
    var ci = parseInt(copyFloatLineEl.dataset.idx, 10);
    if (ci >= 0 && ci < allLines.length) {
        vscodeApi.postMessage({ type: 'copyToClipboard', text: stripTags(allLines[ci].html) });
        showCopyToast();
    }
});

logEl.addEventListener('scroll', function() {
    if (copyFloat.style.display !== 'none') hideCopyFloat();
}, { passive: true });

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
