/**
 * Scrollbar Minimap Script
 *
 * Always-on wide interactive panel replacing the native scrollbar. Shows:
 * - Level markers: error (red), warning (yellow), performance (purple),
 *   todo (gray), debug (brown), notice (blue), info (subtle green, <5 K lines)
 * - Search match (orange) and current match (bright orange) markers
 * - Draggable viewport indicator
 *
 * Supports click-to-navigate, click-drag-to-scroll, and wheel forwarding.
 */

/** Returns the JavaScript code for the scrollbar minimap in the webview. */
export function getScrollbarMinimapScript(): string {
    return /* javascript */ `
var minimapEl = null;
var minimapCachedHeight = 0;
var minimapDebounceTimer = 0;
var mmDragging = false;

/** Get the best available total content height (current > cached). */
function mmHeight() {
    return (typeof totalHeight !== 'undefined' && totalHeight > 0) ? totalHeight : minimapCachedHeight;
}

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
        if (mmHeight() === 0) return;
        e.preventDefault();
        minimapEl.setPointerCapture(e.pointerId);
        scrollToMinimapY(e.clientY);
        var startY = e.clientY;
        var pid = e.pointerId;
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

function initMinimap() {
    minimapEl = document.getElementById('scrollbar-minimap');
    if (!minimapEl) return;
    var logContent = document.getElementById('log-content');
    if (!logContent) return;
    var mmRaf = false;
    logContent.addEventListener('scroll', function() {
        if (!mmRaf) {
            mmRaf = true;
            requestAnimationFrame(function() { mmRaf = false; updateMinimapViewport(); });
        }
    });
    initMinimapDrag();
    minimapEl.addEventListener('wheel', function(e) {
        e.preventDefault();
        var dy = e.deltaY;
        if (e.deltaMode === 1) dy *= ROW_HEIGHT;
        else if (e.deltaMode === 2) dy *= logContent.clientHeight;
        logContent.scrollTop += dy;
    }, { passive: false });
    new ResizeObserver(function() { scheduleMinimap(); }).observe(minimapEl);
    // Rebuild when webview tab becomes visible (panel height may have changed)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) scheduleMinimap();
    });
    // Double-RAF: wait for layout to settle before first measurement
    requestAnimationFrame(function() { requestAnimationFrame(updateMinimap); });
}

/** Scroll log content so the clicked minimap Y position is centered. */
function scrollToMinimapY(clientY) {
    var logContent = document.getElementById('log-content');
    var h = mmHeight();
    if (!logContent || !minimapEl || h === 0) return;
    var rect = minimapEl.getBoundingClientRect();
    var fraction = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    var target = fraction * h - logContent.clientHeight / 2;
    logContent.scrollTop = Math.max(0, target);
    autoScroll = false;
    if (mmDragging) {
        renderViewport(false);
        updateMinimapViewport();
    }
}

/** Collect search-match and severity-level markers as {p, t} objects. */
function collectMinimapMarkers(cumH, running) {
    var markers = [];
    if (typeof matchIndices !== 'undefined' && matchIndices && matchIndices.length > 0) {
        for (var i = 0; i < matchIndices.length; i++) {
            var idx = matchIndices[i];
            if (idx >= 0 && idx < cumH.length && allLines[idx].height > 0) {
                var isCur = (typeof currentMatchIdx !== 'undefined') && currentMatchIdx === i;
                markers.push({ p: cumH[idx] / running, t: isCur ? 'current-match' : 'search-match' });
            }
        }
    }
    var visibleCount = 0;
    for (var i = 0; i < allLines.length; i++) {
        if (allLines[i].height > 0) visibleCount++;
    }
    var showInfo = visibleCount < 5000;
    for (var i = 0; i < allLines.length; i++) {
        if (allLines[i].height === 0 || allLines[i].type === 'stack-frame') continue;
        var lvl = allLines[i].level;
        if (!lvl) continue;
        if (lvl === 'info' && !showInfo) continue;
        markers.push({ p: cumH[i] / running, t: lvl });
    }
    return markers;
}

/** Rebuild all minimap markers from scratch using pixel positioning. */
function updateMinimap() {
    clearTimeout(minimapDebounceTimer);
    minimapDebounceTimer = 0;
    if (!minimapEl) { minimapCachedHeight = 0; return; }
    var cumH = new Array(allLines.length);
    var running = 0;
    for (var i = 0; i < allLines.length; i++) {
        cumH[i] = running;
        running += allLines[i].height;
    }
    minimapCachedHeight = running;
    var mmH = minimapEl.clientHeight;
    if (running === 0 || mmH < 50) {
        minimapEl.innerHTML = '';
        if (running > 0) minimapDebounceTimer = setTimeout(updateMinimap, 250);
        return;
    }
    var markers = collectMinimapMarkers(cumH, running);
    var lastP = markers.length > 0 ? markers[markers.length - 1].p : 0;
    minimapEl.title = markers.length + ' markers, panel=' + mmH + 'px, content=' + running + 'px, last@' + Math.round(lastP * 100) + '%';
    var html = '';
    for (var i = 0; i < markers.length; i++) {
        html += '<div class="minimap-marker minimap-' + markers[i].t + '" style="top:' + Math.round(markers[i].p * mmH) + 'px"></div>';
    }
    var logContent = document.getElementById('log-content');
    if (logContent && running > 0) {
        var spPx = Math.round((logContent.scrollTop / running) * mmH);
        var vhPx = Math.max(Math.round((logContent.clientHeight / running) * mmH), 10);
        html += '<div class="minimap-viewport" style="top:' + spPx + 'px;height:' + vhPx + 'px"></div>';
    }
    minimapEl.innerHTML = html;
}

/** Move viewport indicator on scroll — O(1), no marker rebuild. */
function updateMinimapViewport() {
    if (!minimapEl) return;
    var vp = minimapEl.querySelector('.minimap-viewport');
    if (!vp) return;
    var logContent = document.getElementById('log-content');
    if (!logContent) return;
    var h = mmHeight();
    var mmH = minimapEl.clientHeight;
    if (h === 0 || mmH === 0) return;
    vp.style.top = Math.round((logContent.scrollTop / h) * mmH) + 'px';
    vp.style.height = Math.max(Math.round((logContent.clientHeight / h) * mmH), 10) + 'px';
}

function scheduleMinimap() {
    clearTimeout(minimapDebounceTimer);
    minimapDebounceTimer = setTimeout(updateMinimap, 120);
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

/** Returns the HTML for the scrollbar minimap element. */
export function getScrollbarMinimapHtml(): string {
    return `<div id="scrollbar-minimap" class="scrollbar-minimap"></div>`;
}
