/**
 * Scrollbar Minimap Script
 *
 * Always-on wide interactive panel replacing the native scrollbar. Shows:
 * - Level markers: error (red), warning (yellow), performance (purple),
 *   todo (gray), debug (brown), notice (blue) — info lines omitted
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

/** Wire up click-to-navigate and click-drag-to-scroll on the minimap. */
function initMinimapDrag() {
    minimapEl.addEventListener('mousedown', function(e) {
        if (mmHeight() === 0) return;
        e.preventDefault();
        scrollToMinimapY(e.clientY);
        var startY = e.clientY;
        function onMove(ev) {
            ev.preventDefault();
            if (!mmDragging && Math.abs(ev.clientY - startY) < 3) return;
            if (!mmDragging) {
                mmDragging = true;
                suppressScroll = true;
                minimapEl.classList.add('mm-dragging');
            }
            scrollToMinimapY(ev.clientY);
        }
        function onUp() {
            if (mmDragging) {
                mmDragging = false;
                suppressScroll = false;
                minimapEl.classList.remove('mm-dragging');
            }
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

function initMinimap() {
    minimapEl = document.getElementById('scrollbar-minimap');
    if (!minimapEl) return;
    var logContent = document.getElementById('log-content');
    if (!logContent) return;
    // Sync viewport indicator on scroll (RAF-debounced)
    var mmRaf = false;
    logContent.addEventListener('scroll', function() {
        if (!mmRaf) {
            mmRaf = true;
            requestAnimationFrame(function() { mmRaf = false; updateMinimapViewport(); });
        }
    });
    initMinimapDrag();
    // Forward wheel events to log content (handle all deltaModes)
    minimapEl.addEventListener('wheel', function(e) {
        e.preventDefault();
        var dy = e.deltaY;
        if (e.deltaMode === 1) dy *= ROW_HEIGHT;
        else if (e.deltaMode === 2) dy *= logContent.clientHeight;
        logContent.scrollTop += dy;
    }, { passive: false });
    updateMinimap();
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
    // Search match markers — skip hidden lines
    if (typeof matchIndices !== 'undefined' && matchIndices && matchIndices.length > 0) {
        for (var i = 0; i < matchIndices.length; i++) {
            var idx = matchIndices[i];
            if (idx >= 0 && idx < cumH.length && allLines[idx].height > 0) {
                var isCur = (typeof currentMatchIdx !== 'undefined') && currentMatchIdx === i;
                markers.push({ p: (cumH[idx] / running) * 100, t: isCur ? 'current-match' : 'search-match' });
            }
        }
    }
    // Level markers — all non-info levels, skip hidden and stack-frame lines
    for (var i = 0; i < allLines.length; i++) {
        if (allLines[i].height === 0 || allLines[i].type === 'stack-frame') continue;
        var lvl = allLines[i].level;
        if (lvl && lvl !== 'info') {
            markers.push({ p: (cumH[i] / running) * 100, t: lvl });
        }
    }
    return markers;
}

/** Rebuild all minimap markers from scratch. O(n) single pass. */
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
    if (running === 0) { minimapEl.innerHTML = ''; return; }
    var markers = collectMinimapMarkers(cumH, running);
    var html = '';
    for (var i = 0; i < markers.length; i++) {
        html += '<div class="minimap-marker minimap-' + markers[i].t + '" style="top:' + markers[i].p + '%"></div>';
    }
    // Viewport indicator (painted last, below markers via z-index)
    var logContent = document.getElementById('log-content');
    if (logContent && running > 0) {
        var sp = (logContent.scrollTop / running) * 100;
        var vh = Math.max((logContent.clientHeight / running) * 100, 1);
        html += '<div class="minimap-viewport" style="top:' + sp + '%;height:' + vh + '%"></div>';
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
    if (h === 0) return;
    vp.style.top = (logContent.scrollTop / h) * 100 + '%';
    vp.style.height = Math.max((logContent.clientHeight / h) * 100, 1) + '%';
}

function scheduleMinimap() {
    if (minimapDebounceTimer) return;
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
