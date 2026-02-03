/**
 * Scrollbar Minimap Script
 *
 * Always-on wide interactive panel replacing the native scrollbar. Shows:
 * - Error (red), warning (yellow), performance (purple) markers
 * - Search match (orange) and current match (bright orange) markers
 * - Draggable viewport indicator
 *
 * Supports click-to-scroll, drag-to-scroll, and wheel forwarding.
 */

/** Returns the JavaScript code for the scrollbar minimap in the webview. */
export function getScrollbarMinimapScript(): string {
    return /* javascript */ `
var minimapEl = null;
var minimapCachedHeight = 0;
var minimapDebounceTimer = 0;

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

    // Click + drag to scroll
    minimapEl.addEventListener('mousedown', function(e) {
        if (minimapCachedHeight === 0) return;
        e.preventDefault();
        minimapEl.classList.add('mm-dragging');
        scrollToMinimapY(e.clientY);
        function onMove(ev) { ev.preventDefault(); scrollToMinimapY(ev.clientY); }
        function onUp() {
            minimapEl.classList.remove('mm-dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // Forward wheel events to log content
    minimapEl.addEventListener('wheel', function(e) {
        e.preventDefault();
        logContent.scrollTop += e.deltaY;
    }, { passive: false });

    updateMinimap();
}

/** Scroll log content so the clicked minimap Y position is centered. */
function scrollToMinimapY(clientY) {
    var logContent = document.getElementById('log-content');
    if (!logContent || !minimapEl || minimapCachedHeight === 0) return;
    var rect = minimapEl.getBoundingClientRect();
    var fraction = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    var target = fraction * minimapCachedHeight - logContent.clientHeight / 2;
    if (typeof suppressScroll !== 'undefined') suppressScroll = true;
    logContent.scrollTop = Math.max(0, target);
    if (typeof suppressScroll !== 'undefined') suppressScroll = false;
    autoScroll = false;
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

    // Error / warning / performance markers — skip hidden and stack-frame lines
    for (var i = 0; i < allLines.length; i++) {
        if (allLines[i].height === 0) continue;
        if (allLines[i].type === 'stack-frame') continue;
        var lvl = allLines[i].level;
        if (lvl === 'error' || lvl === 'warning' || lvl === 'performance') {
            markers.push({ p: (cumH[i] / running) * 100, t: lvl });
        }
    }

    var html = '';
    for (var i = 0; i < markers.length; i++) {
        html += '<div class="minimap-marker minimap-' + markers[i].t + '" style="top:' + markers[i].p + '%"></div>';
    }

    // Viewport indicator
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
    if (!minimapEl || minimapCachedHeight === 0) return;
    var vp = minimapEl.querySelector('.minimap-viewport');
    if (!vp) return;
    var logContent = document.getElementById('log-content');
    if (!logContent) return;
    vp.style.top = (logContent.scrollTop / minimapCachedHeight) * 100 + '%';
    vp.style.height = Math.max((logContent.clientHeight / minimapCachedHeight) * 100, 1) + '%';
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
