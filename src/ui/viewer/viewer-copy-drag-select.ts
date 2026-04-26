/**
 * Drag-to-select handler for the log viewer.
 *
 * Why this exists: the viewport rebuilds its DOM on every scroll
 * ([viewer-data-viewport.ts] `viewportEl.innerHTML = parts.join('')`), which wipes the
 * browser's native text selection. Plain mouse drag-select therefore looks like it works
 * for two visible rows but produces an empty clipboard the moment scrolling — or simply a
 * full re-render — kicks in. The pre-existing shift+click model (`selectionStart` /
 * `selectionEnd` indices into `allLines`, see [viewer-copy.ts]) survives DOM rebuilds
 * because it is data-indexed, but no first-time user discovers shift+click on their own.
 *
 * This module makes ordinary left-button drag drive the same model selection so
 * Ctrl+C / right-click → Copy work the way users expect, including across many
 * collapsed-repeat chips and across viewport scroll boundaries.
 *
 * Coexistence with shift+click handler in `viewer-copy.ts`:
 *   - mousedown without shift starts drag tracking; mousedown with shift returns early so
 *     the click handler in `viewer-copy.ts` can extend the existing selection on click.
 *   - A single click (no movement past `dragSelectThresholdPx`) is a no-op for the model,
 *     preserving prior single-click semantics (link clicks, source-link navigation, etc.).
 */
export function getCopyDragSelectScript(): string {
    return /* javascript */ `
/* Threshold below which a mousedown+mouseup is treated as a click, not a drag. Keeps
   accidental jitter from clearing/replacing an existing model selection on plain clicks. */
var dragSelectThresholdPx = 4;
var dragSelectStartIdx = -1;
var dragSelectActive = false;
var dragSelectStartX = 0;
var dragSelectStartY = 0;
/* Last cursor position during drag — sampled by the autoscroll tick so we can resolve the
   row under the cursor each frame even when the mouse is stationary at a viewport edge. */
var dragSelectLastX = 0;
var dragSelectLastY = 0;
var dragSelectAutoscrollTimer = 0;
var dragSelectAutoscrollSpeed = 0;

/* Selectors to ignore on mousedown — clicking these should retain their primary action
   (open link, click button, expand peek, etc.) rather than starting a drag-select. */
var dragSelectIgnoreSelector = 'a, button, input, textarea, select, .source-link, .url-link, .stack-arrow, .peek-collapse, .stack-toggle, [role="button"]';

function getDragRowDataIdx(target) {
    if (!target || !target.closest) return -1;
    var rowEl = target.closest('.line, .stack-header, .marker');
    if (!rowEl) return -1;
    /* Only top-level viewport children carry a data-idx that maps into allLines.
       Nested .line elements (rare but possible inside embedded panels) would otherwise
       resolve to an idx that does not match allLines. */
    if (rowEl.parentElement !== viewportEl) return -1;
    var v = rowEl.dataset ? rowEl.dataset.idx : null;
    if (v === undefined || v === null || v === '') return -1;
    var n = parseInt(v, 10);
    return isNaN(n) ? -1 : n;
}

function clearNativeTextSelection() {
    var s = (typeof window !== 'undefined' && window.getSelection) ? window.getSelection() : null;
    if (!s) return;
    try { if (s.removeAllRanges) s.removeAllRanges(); } catch (_e) { /* webview quirks */ }
}

function dragSelectResolveIdxAtPoint(clientX, clientY) {
    /* elementFromPoint is needed when the mousemove target is a child element that is
       not itself a row (e.g. a span inside .line), or when autoscrolling has shifted
       new content under a stationary cursor. */
    var elAt = (typeof document !== 'undefined' && document.elementFromPoint)
        ? document.elementFromPoint(clientX, clientY) : null;
    return elAt ? getDragRowDataIdx(elAt) : -1;
}

function dragSelectAutoscrollTick() {
    if (!dragSelectActive || !logEl) return;
    if (dragSelectAutoscrollSpeed !== 0) {
        logEl.scrollTop += dragSelectAutoscrollSpeed;
    }
    /* Even when speed is zero, re-resolve the row under the cursor: the viewport may
       have re-rendered (filter toggle, late ingest) and the cached selectionEnd could
       point at a row that is no longer under the cursor. */
    var idx = dragSelectResolveIdxAtPoint(dragSelectLastX, dragSelectLastY);
    if (idx >= 0 && idx !== selectionEnd) {
        selectionEnd = idx;
        if (typeof updateSelectionHighlight === 'function') updateSelectionHighlight();
    }
}

function startDragSelectAutoscroll() {
    if (dragSelectAutoscrollTimer) return;
    dragSelectAutoscrollTimer = setInterval(dragSelectAutoscrollTick, 16);
}

function stopDragSelectAutoscroll() {
    if (dragSelectAutoscrollTimer) {
        clearInterval(dragSelectAutoscrollTimer);
        dragSelectAutoscrollTimer = 0;
    }
    dragSelectAutoscrollSpeed = 0;
}

function updateDragSelectAutoscroll(clientY) {
    if (!logEl) { dragSelectAutoscrollSpeed = 0; return; }
    var rect = logEl.getBoundingClientRect();
    /* Edge band where autoscroll engages. 30px is large enough to be reachable when the
       user is dragging at speed but small enough that a mostly-still cursor near the
       middle does not start scrolling. */
    var edge = 30;
    if (clientY < rect.top + edge) {
        /* Negative speed scrolls up. Magnitude grows as the cursor approaches the edge
           so dragging hard against the boundary scrolls fast, easing off does not. */
        dragSelectAutoscrollSpeed = -Math.max(4, Math.round(rect.top + edge - clientY));
    } else if (clientY > rect.bottom - edge) {
        dragSelectAutoscrollSpeed = Math.max(4, Math.round(clientY - (rect.bottom - edge)));
    } else {
        dragSelectAutoscrollSpeed = 0;
    }
}

function activateDragSelect() {
    dragSelectActive = true;
    selectionStart = dragSelectStartIdx;
    selectionEnd = dragSelectStartIdx;
    /* Native browser selection would otherwise fight our model selection — rendering both
       a blue text-highlight (gone after the next scroll re-render) and our row class. */
    clearNativeTextSelection();
    startDragSelectAutoscroll();
    if (typeof updateSelectionHighlight === 'function') updateSelectionHighlight();
}

function onDragSelectMouseDown(e) {
    if (e.button !== 0) return;
    /* shift+click is owned by the existing handler in viewer-copy.ts which extends the
       current selection. Returning early here lets that handler run on the subsequent
       click event. ctrl/meta are reserved for future modifier-click semantics. */
    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && e.target.closest && e.target.closest(dragSelectIgnoreSelector)) return;
    var idx = getDragRowDataIdx(e.target);
    if (idx < 0) return;
    dragSelectStartIdx = idx;
    dragSelectStartX = e.clientX;
    dragSelectStartY = e.clientY;
    dragSelectLastX = e.clientX;
    dragSelectLastY = e.clientY;
    dragSelectActive = false;
}

function onDragSelectMouseMove(e) {
    if (dragSelectStartIdx < 0) return;
    /* Defensive: if the left button is no longer held (mouseup outside iframe, focus
       loss, OS-level interrupt) we must release drag state immediately. Otherwise
       dragSelectActive stays true and the 16ms autoscroll pump runs forever, which
       presents to the user as the entire viewer flickering near the bottom edge as
       autoscroll repeatedly snaps scrollTop and forces re-renders. */
    if ((e.buttons & 1) === 0) {
        onDragSelectMouseUp();
        return;
    }
    dragSelectLastX = e.clientX;
    dragSelectLastY = e.clientY;
    if (!dragSelectActive) {
        var dx = e.clientX - dragSelectStartX;
        var dy = e.clientY - dragSelectStartY;
        if (dx * dx + dy * dy < dragSelectThresholdPx * dragSelectThresholdPx) return;
        activateDragSelect();
    }
    /* Try the direct event target first (cheap), then elementFromPoint (handles cursors
       that have moved off any row, e.g. into the gutter or onto a child span). */
    var idx = getDragRowDataIdx(e.target);
    if (idx < 0) idx = dragSelectResolveIdxAtPoint(e.clientX, e.clientY);
    if (idx >= 0 && idx !== selectionEnd) {
        selectionEnd = idx;
        if (typeof updateSelectionHighlight === 'function') updateSelectionHighlight();
    }
    updateDragSelectAutoscroll(e.clientY);
    /* Suppress the browser's own text-selection drag — we are providing the selection
       UI via the .selected class. Without this, the native blue highlight would briefly
       paint until the next scroll-driven viewport re-render wiped it out. */
    if (e.preventDefault) e.preventDefault();
}

function onDragSelectMouseUp() {
    if (dragSelectStartIdx < 0) return;
    dragSelectStartIdx = -1;
    dragSelectActive = false;
    stopDragSelectAutoscroll();
}

if (viewportEl) viewportEl.addEventListener('mousedown', onDragSelectMouseDown);
/* mousemove/mouseup live on document so dragging out of the viewport (over the gutter,
   over the toolbar, over the iframe edge) keeps tracking until the user releases. */
document.addEventListener('mousemove', onDragSelectMouseMove);
document.addEventListener('mouseup', onDragSelectMouseUp);
/* Belt-and-braces: release drag state on window/iframe focus loss and visibility
   change. Without these, a mouseup that lands on a different OS window (or a quick
   alt-tab during drag) can leave the autoscroll pump running and the viewer appears
   to flicker on its own. The mouseup handler is a no-op when no drag is in flight. */
window.addEventListener('blur', onDragSelectMouseUp);
document.addEventListener('visibilitychange', function() { if (document.hidden) onDragSelectMouseUp(); });
document.addEventListener('mouseleave', onDragSelectMouseUp);
`;
}
