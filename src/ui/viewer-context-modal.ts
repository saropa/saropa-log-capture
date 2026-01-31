/**
 * Viewer Inline Peek Script
 *
 * Provides an inline expandable context view that shows surrounding log
 * lines above and below a target line. Triggered by double-clicking a line.
 * Only one peek can be open at a time — opening a new one closes the old.
 *
 * Integration points:
 * - viewer-script.ts registers the dblclick handler
 * - Extension sends contextViewLines count via setContextViewLines message
 * - renderItem() is reused to render lines within the peek
 */

/**
 * Returns the JavaScript code for the inline peek in the webview.
 */
export function getContextModalScript(): string {
    return /* javascript */ `
/** Number of lines before and after to show in peek view. */
var contextViewLines = 10;

/** Index of the currently-peeked line, or -1 if none. */
var peekTargetIdx = -1;

/**
 * Open an inline peek centered on a specific line index.
 * Inserts context lines directly into the viewport after the target line.
 * If a peek is already open on this line, close it instead (toggle).
 *
 * @param {number} lineIdx - Index into allLines[] of the target line
 */
function openContextModal(lineIdx) {
    if (lineIdx < 0 || lineIdx >= allLines.length) { return; }

    // Toggle: close if already peeking this line
    if (peekTargetIdx === lineIdx) {
        closeContextModal();
        return;
    }

    // Close any existing peek first
    closeContextModal();
    peekTargetIdx = lineIdx;

    var start = Math.max(0, lineIdx - contextViewLines);
    var end = Math.min(allLines.length, lineIdx + contextViewLines + 1);

    var html = '<div class="peek-header">Context: line ' +
        (lineIdx + 1) + ' (' + contextViewLines + ' before/after)' +
        '<button class="peek-close" onclick="closeContextModal()">&#x2715;</button></div>';

    for (var i = start; i < end; i++) {
        var item = allLines[i];
        var lineHtml = renderItem(item, i);
        if (i === lineIdx) {
            html += '<div class="peek-target">' + lineHtml + '</div>';
        } else {
            html += '<div class="peek-context">' + lineHtml + '</div>';
        }
    }

    // Find the DOM element for the target line and insert peek after it
    var peekEl = document.createElement('div');
    peekEl.id = 'inline-peek';
    peekEl.className = 'inline-peek';
    peekEl.innerHTML = html;

    // Insert after the viewport (rendered as overlay-like section)
    var viewport = document.getElementById('viewport');
    if (viewport && viewport.parentNode) {
        viewport.parentNode.insertBefore(peekEl, viewport.nextSibling);
    }

    // Scroll the peek into view
    peekEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * Close the inline peek and remove it from the DOM.
 */
function closeContextModal() {
    peekTargetIdx = -1;
    var existing = document.getElementById('inline-peek');
    if (existing) { existing.remove(); }
}

/**
 * Handle setContextViewLines message from extension.
 */
function handleSetContextViewLines(msg) {
    contextViewLines = typeof msg.count === 'number' ? msg.count : 10;
}

// Register message handler
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'setContextViewLines') {
        handleSetContextViewLines(msg);
    }
});
`;
}

/**
 * Returns an empty string — inline peek needs no static HTML elements.
 * The peek is created dynamically via JavaScript when triggered.
 */
export function getContextModalHtml(): string {
    return '';
}
