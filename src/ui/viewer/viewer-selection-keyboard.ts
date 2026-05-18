/**
 * Keyboard-driven line-selection extension for the log viewer.
 *
 * Builds on the click-selection primitives in viewer-copy.ts:
 *   - selectionStart  (anchor — set on the originating click, immutable until next non-shift click)
 *   - selectionEnd    (cursor — the moving end; what keyboard extension shifts)
 *   - updateSelectionHighlight()  (re-applies the .selected class per row)
 *
 * The viewer has no caret, so Shift+Arrow needs an implicit anchor when no
 * selection exists. We track the last non-shift click as that anchor, falling
 * back to the first visible line so keyboard-only users still get a sensible
 * starting point. Crossing the anchor naturally inverts direction (cursor
 * below anchor → shrinks; cursor at anchor → next shift+up jumps above):
 * getSelectedLines() and updateSelectionHighlight() already use min/max, so
 * the cursor may travel freely above or below the anchor without bookkeeping.
 *
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getSelectionKeyboardScript(): string {
    return /* javascript */ `
/* Implicit-caret tracker. Updated on plain (non-shift) clicks on a real row;
   shift-click already maintains selectionStart/End, so leave it alone there. */
var lastClickedIdx = -1;

if (viewportEl) viewportEl.addEventListener('click', function(e) {
    if (e.shiftKey) return;
    var lineEl = e.target.closest('.line, .stack-header, .marker');
    if (!lineEl) return;
    if (lineEl.parentElement !== viewportEl) return;
    var raw = lineEl.dataset ? lineEl.dataset.idx : null;
    if (raw === undefined || raw === null || raw === '') return;
    var idx = parseInt(raw, 10);
    if (!isNaN(idx) && idx >= 0) lastClickedIdx = idx;
});

/* Top of the actual viewport (not lastStart, which includes overscan).
   findIndexAtOffset is defined in viewer-scroll-anchor.ts and uses prefixSums. */
function _selFirstVisibleIdx() {
    if (!logEl || allLines.length === 0) return -1;
    if (typeof findIndexAtOffset === 'function' && prefixSums) {
        return findIndexAtOffset(logEl.scrollTop).index;
    }
    return typeof lastStart === 'number' && lastStart >= 0 ? lastStart : 0;
}

/* Step to the next visible/selectable line in 'direction' (+1/-1). Skips
   filtered/hidden/zero-height rows so keyboard motion matches what the eye sees.
   Returns -1 if no further selectable row exists in that direction. */
function _selNextIdx(from, direction) {
    var idx = from + direction;
    while (idx >= 0 && idx < allLines.length) {
        var it = allLines[idx];
        if (it && it.height > 0 && !it.excluded && !it.repeatHidden) return idx;
        idx += direction;
    }
    return -1;
}

/* Scroll just enough to bring idx into view. Mirrors editor "reveal" semantics:
   no movement if already visible; otherwise snap to the nearest edge. */
function _selScrollIdxIntoView(idx) {
    if (!logEl || !prefixSums || idx < 0 || idx >= allLines.length) return;
    var top = prefixSums[idx];
    var bottom = prefixSums[idx + 1];
    var viewTop = logEl.scrollTop;
    var viewBottom = viewTop + logEl.clientHeight;
    var newTop = -1;
    if (top < viewTop) newTop = top;
    else if (bottom > viewBottom) newTop = bottom - logEl.clientHeight;
    if (newTop < 0) return;
    if (window.setProgrammaticScroll) window.setProgrammaticScroll();
    suppressScroll = true;
    logEl.scrollTop = newTop;
    suppressScroll = false;
    autoScroll = false;
    renderViewport(false);
}

/* Approximate page size (in line indices) using the current viewport.
   Variable row heights mean we can't multiply — measure the actual span
   from the top of the viewport to ~80% down, matching pageUp/pageDown scroll. */
function _selPageSize() {
    if (!logEl || !prefixSums) return 10;
    if (typeof findIndexAtOffset !== 'function') return 10;
    var top = findIndexAtOffset(logEl.scrollTop).index;
    var bot = findIndexAtOffset(logEl.scrollTop + logEl.clientHeight * 0.8).index;
    return Math.max(1, bot - top);
}

/* Ensure a selection exists. Initializes anchor + cursor at lastClickedIdx,
   falling back to top-of-viewport. Returns false if no usable anchor (empty log). */
function _selEnsureActive() {
    if (selectionStart >= 0) return true;
    if (allLines.length === 0) return false;
    var anchor = lastClickedIdx >= 0 && lastClickedIdx < allLines.length
        ? lastClickedIdx
        : _selFirstVisibleIdx();
    if (anchor < 0 || anchor >= allLines.length) return false;
    selectionStart = anchor;
    selectionEnd = anchor;
    return true;
}

/* Core extension: move the cursor stepCount selectable rows in 'direction'.
   The cursor may pass through or cross the anchor — getSelectedLines() handles
   that via min/max, so we don't need separate "shrink" vs "extend" branches. */
function extendLineSelection(direction, stepCount) {
    if (!_selEnsureActive()) return;
    var moved = selectionEnd;
    for (var step = 0; step < stepCount; step++) {
        var next = _selNextIdx(moved, direction);
        if (next < 0) break;
        moved = next;
    }
    if (moved === selectionEnd) return;
    selectionEnd = moved;
    /* Drag-select leaves a native range; once the user switches to keyboard
       extension we treat the line model as authoritative and clear the native
       highlight so both don't render simultaneously. */
    var nat = window.getSelection();
    if (nat) nat.removeAllRanges();
    updateSelectionHighlight();
    _selScrollIdxIntoView(selectionEnd);
}

/* Extend to the first/last selectable line. +1 = forward to end, -1 = back to start. */
function extendLineSelectionToEdge(direction) {
    if (allLines.length === 0) return;
    extendLineSelection(direction, allLines.length);
}

/* Page-sized extension (Shift+PageUp / Shift+PageDown). */
function extendLineSelectionByPage(direction) {
    extendLineSelection(direction, _selPageSize());
}
`;
}
