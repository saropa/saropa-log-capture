"use strict";
/**
 * Webview-injected minimap interaction, viewport, scheduling, and initialization.
 * State + paint code lives in sibling modules concatenated before this script.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScrollbarMinimapInjectedScript = getScrollbarMinimapInjectedScript;
/** Returns the minimap drag, viewport, scheduling, and init JavaScript. */
function getScrollbarMinimapInjectedScript() {
    return /* javascript */ `

/** Clean up any active minimap drag state. */
function mmCleanupDrag() {
    if (mmDragging) {
        mmDragging = false;
        suppressScroll = false;
        if (minimapEl) minimapEl.classList.remove('mm-dragging');
    }
}

/** Wire up click-to-navigate and click-drag-to-scroll via pointer capture. */
function initMinimapDrag() {
    minimapEl.addEventListener('pointerdown', function(e) {
        if (totalHeight === 0) return;
        e.preventDefault();
        minimapEl.setPointerCapture(e.pointerId);
        scrollToMinimapY(e.clientY);
        var startY = e.clientY, pid = e.pointerId;
        function onMove(ev) {
            if (ev.pointerId !== pid) return;
            ev.preventDefault();
            if (!mmDragging && Math.abs(ev.clientY - startY) < 3) return;
            if (!mmDragging) {
                mmDragging = true;
                suppressScroll = true;
                minimapEl.classList.add('mm-dragging');
            }
            scrollToMinimapY(ev.clientY);
        }
        function onDone(ev) {
            if (ev && ev.pointerId !== undefined && ev.pointerId !== pid) return;
            mmCleanupDrag();
            minimapEl.removeEventListener('pointermove', onMove);
            minimapEl.removeEventListener('pointerup', onDone);
            minimapEl.removeEventListener('pointercancel', onDone);
            minimapEl.removeEventListener('lostpointercapture', onDone);
        }
        minimapEl.addEventListener('pointermove', onMove);
        minimapEl.addEventListener('pointerup', onDone);
        minimapEl.addEventListener('pointercancel', onDone);
        minimapEl.addEventListener('lostpointercapture', onDone);
    });
    window.addEventListener('blur', mmCleanupDrag);
}

/** Scroll log content so the clicked minimap Y position is centred. */
function scrollToMinimapY(clientY) {
    var logContent = document.getElementById('log-content');
    if (!logContent || !minimapEl || totalHeight === 0) return;
    var rect = minimapEl.getBoundingClientRect();
    var frac = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    logContent.scrollTop = Math.max(0, frac * totalHeight - logContent.clientHeight / 2);
    autoScroll = false;
    if (mmDragging) { renderViewport(false); updateMinimapViewport(); }
}

/** Reposition viewport indicator — O(1), no canvas repaint. */
function updateMinimapViewport() {
    if (!mmViewport || !minimapEl) return;
    var lc = document.getElementById('log-content');
    if (!lc) return;
    var h = totalHeight, mmH = minimapEl.clientHeight;
    if (h === 0 || mmH === 0) {
        mmViewport.style.display = 'none';
        if (mmOutsideArrowEl) mmOutsideArrowEl.style.visibility = 'hidden';
        return;
    }
    mmViewport.style.display = '';
    if (mmOutsideArrowEl) mmOutsideArrowEl.style.visibility = '';
    var topPx = Math.round((lc.scrollTop / h) * mmH);
    var vpH = Math.max(Math.round((lc.clientHeight / h) * mmH), 10);
    mmViewport.style.top = topPx + 'px';
    mmViewport.style.height = vpH + 'px';
    if (mmOutsideArrowGlyph && mmOutsideArrowEnabled) {
        var centerY = topPx + vpH / 2;
        var gh = 12;
        mmOutsideArrowGlyph.style.top = Math.max(0, Math.min(mmH - gh, centerY - gh / 2)) + 'px';
    }
}

/** Full rebuild: repaint canvas + reposition viewport. */
function updateMinimap() {
    clearTimeout(minimapDebounceTimer);
    minimapDebounceTimer = 0;
    paintMinimap();
    updateMinimapViewport();
}

function scheduleMinimap() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    clearTimeout(minimapDebounceTimer);
    minimapDebounceTimer = setTimeout(updateMinimap, 120);
}

function initMinimap() {
    minimapEl = document.getElementById('scrollbar-minimap');
    if (!minimapEl) return;
    mmOutsideArrowEl = document.getElementById('minimap-outside-arrow');
    mmOutsideArrowGlyph = mmOutsideArrowEl ? mmOutsideArrowEl.querySelector('.minimap-outside-arrow-glyph') : null;
    var logContent = document.getElementById('log-content');
    if (!logContent) return;

    mmCanvas = document.createElement('canvas');
    mmCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    minimapEl.appendChild(mmCanvas);
    mmCtx = mmCanvas.getContext('2d');

    mmViewport = document.createElement('div');
    mmViewport.className = 'minimap-viewport';
    if (mmViewportRedOutline) mmViewport.classList.add('minimap-viewport--red-outline');
    minimapEl.appendChild(mmViewport);

    initMmColors();
    mmWidthPx = Math.round(minimapEl.clientWidth) || mmWidthPx;
    if (mmOutsideArrowEl) mmOutsideArrowEl.classList.toggle('u-hidden', !mmOutsideArrowEnabled);
    syncMmColumnWidth();
    var mmRaf = false;
    logContent.addEventListener('scroll', function() {
        if (!mmRaf) {
            mmRaf = true;
            requestAnimationFrame(function() { mmRaf = false; updateMinimapViewport(); });
        }
    });
    initMinimapDrag();
    if (typeof initMinimapResize === 'function') initMinimapResize();
    minimapEl.addEventListener('wheel', function(e) {
        e.preventDefault();
        var dy = e.deltaY;
        if (e.deltaMode === 1) dy *= ROW_HEIGHT;
        else if (e.deltaMode === 2) dy *= logContent.clientHeight;
        logContent.scrollTop += dy;
    }, { passive: false });
    new ResizeObserver(function() { scheduleMinimap(); }).observe(minimapEl);
    if (typeof ResizeObserver !== 'undefined') {
        try { new ResizeObserver(function() { scheduleMinimap(); }).observe(logContent); } catch (e) {}
    }
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) scheduleMinimap();
    });
    requestAnimationFrame(function() { requestAnimationFrame(updateMinimap); });
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMinimap);
} else {
    initMinimap();
}

// Hook into search updates
var _originalUpdateSearch = updateSearch;
if (typeof updateSearch === 'function') {
    updateSearch = function() { _originalUpdateSearch(); scheduleMinimap(); };
}

// Hook into viewport renders — rebuild when data changed (force=true)
var _originalRenderViewport = renderViewport;
if (typeof renderViewport === 'function') {
    renderViewport = function(force) { _originalRenderViewport(force); if (force) scheduleMinimap(); };
}
`;
}
//# sourceMappingURL=viewer-scrollbar-minimap-injected.js.map