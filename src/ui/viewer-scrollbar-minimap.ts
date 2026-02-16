/**
 * Scrollbar Minimap Script — Canvas-based
 *
 * Paints severity markers and search highlights onto a canvas element
 * replacing the native scrollbar. Uses prefixSums from the scroll-anchor
 * system for pixel-accurate positioning.
 *
 * Features:
 * - Level markers: error, warning, performance, todo, debug, notice, info
 * - Search match and current match markers
 * - Draggable viewport indicator (DOM overlay on canvas)
 * - Click-to-navigate, drag-to-scroll, wheel forwarding
 * - HiDPI canvas rendering
 */

/** Returns the JavaScript code for the scrollbar minimap in the webview. */
export function getScrollbarMinimapScript(): string {
    return /* javascript */ `
var minimapEl = null;
var mmCanvas = null;
var mmCtx = null;
var mmViewport = null;
var mmDragging = false;
var minimapDebounceTimer = 0;
var mmColors = {};
var mmShowInfo = false;

/** Handle minimapShowInfo setting message from extension. */
function handleMinimapShowInfo(msg) {
    var prev = mmShowInfo;
    mmShowInfo = !!msg.show;
    if (prev !== mmShowInfo) scheduleMinimap();
}

/** Read VS Code theme colors with fallbacks. */
function initMmColors() {
    var cs = getComputedStyle(document.documentElement);
    function v(n, fb) { return cs.getPropertyValue(n).trim() || fb; }
    mmColors = {
        error: v('--vscode-editorOverviewRuler-errorForeground', 'rgba(244,68,68,0.85)'),
        warning: v('--vscode-editorOverviewRuler-warningForeground', 'rgba(204,167,0,0.85)'),
        performance: v('--vscode-editorOverviewRuler-infoForeground', 'rgba(156,39,176,0.85)'),
        todo: 'rgba(189,189,189,0.65)',
        debug: 'rgba(121,85,72,0.65)',
        notice: 'rgba(33,150,243,0.65)',
        info: 'rgba(78,201,176,0.65)',
        searchMatch: v('--vscode-editorOverviewRuler-findMatchForeground', 'rgba(234,92,0,0.85)'),
        currentMatch: 'rgba(255,150,50,1)'
    };
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

/** Resize canvas buffer for HiDPI. Returns true when dimensions changed. */
function resizeMmCanvas() {
    if (!mmCanvas || !minimapEl) return false;
    var dpr = window.devicePixelRatio || 1;
    var pw = Math.round(minimapEl.clientWidth * dpr);
    var ph = Math.round(minimapEl.clientHeight * dpr);
    if (mmCanvas.width === pw && mmCanvas.height === ph) return false;
    mmCanvas.width = pw;
    mmCanvas.height = ph;
    mmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
}

/** Resolve the pixel offset for line i using prefixSums or fallback array. */
function mmLineOffset(i, hasPfx, cumH) {
    return hasPfx ? prefixSums[i] : cumH[i];
}

/** Paint all markers onto the canvas in a single pass. */
function paintMinimap() {
    if (!mmCtx || !minimapEl) return;
    var mmW = minimapEl.clientWidth;
    var mmH = minimapEl.clientHeight;
    resizeMmCanvas();
    mmCtx.clearRect(0, 0, mmW, mmH);
    if (mmH < 10 || allLines.length === 0) return;

    // Resolve position source: prefixSums (authoritative) or manual fallback
    var hasPfx = prefixSums && prefixSums.length === allLines.length + 1;
    var total, cumH;
    if (hasPfx) {
        total = totalHeight;
    } else {
        cumH = new Array(allLines.length);
        total = 0;
        for (var i = 0; i < allLines.length; i++) { cumH[i] = total; total += allLines[i].height; }
    }
    if (total === 0) return;

    // Collect markers grouped by color to minimize fillStyle switches
    var groups = {};
    for (var i = 0; i < allLines.length; i++) {
        var it = allLines[i];
        if (it.height === 0 || it.type === 'stack-frame' || it.type === 'marker') continue;
        var lv = it.level;
        if (!lv || !mmColors[lv]) continue;
        if (lv === 'info' && !mmShowInfo) continue;
        var py = Math.round((mmLineOffset(i, hasPfx, cumH) / total) * mmH);
        if (!groups[lv]) groups[lv] = [];
        groups[lv].push(py);
    }

    // Paint severity markers
    var barH = 3;
    for (var lv in groups) {
        mmCtx.fillStyle = mmColors[lv];
        var arr = groups[lv];
        for (var j = 0; j < arr.length; j++) mmCtx.fillRect(0, arr[j], mmW, barH);
    }

    // Paint search markers on top (higher visual priority)
    paintSearchMarkers(hasPfx, cumH, total, mmW, mmH, barH);

    // Debug tooltip
    var mc = 0;
    for (var k in groups) mc += groups[k].length;
    minimapEl.title = mc + ' markers, ' + mmH + 'px panel, ' + Math.round(total) + 'px content';
}

/** Paint search-match and current-match markers onto the canvas. */
function paintSearchMarkers(hasPfx, cumH, total, mmW, mmH, barH) {
    if (typeof matchIndices === 'undefined' || !matchIndices || matchIndices.length === 0) return;
    for (var si = 0; si < matchIndices.length; si++) {
        var idx = matchIndices[si];
        if (idx < 0 || idx >= allLines.length || allLines[idx].height === 0) continue;
        var py = Math.round((mmLineOffset(idx, hasPfx, cumH) / total) * mmH);
        var isCur = (typeof currentMatchIdx !== 'undefined') && currentMatchIdx === si;
        mmCtx.fillStyle = isCur ? mmColors.currentMatch : mmColors.searchMatch;
        mmCtx.fillRect(0, py, mmW, barH);
    }
}

/** Reposition viewport indicator — O(1), no canvas repaint. */
function updateMinimapViewport() {
    if (!mmViewport || !minimapEl) return;
    var lc = document.getElementById('log-content');
    if (!lc) return;
    var h = totalHeight, mmH = minimapEl.clientHeight;
    if (h === 0 || mmH === 0) { mmViewport.style.display = 'none'; return; }
    mmViewport.style.display = '';
    mmViewport.style.top = Math.round((lc.scrollTop / h) * mmH) + 'px';
    mmViewport.style.height = Math.max(Math.round((lc.clientHeight / h) * mmH), 10) + 'px';
}

/** Full rebuild: repaint canvas + reposition viewport. */
function updateMinimap() {
    clearTimeout(minimapDebounceTimer);
    minimapDebounceTimer = 0;
    paintMinimap();
    updateMinimapViewport();
}

function scheduleMinimap() {
    clearTimeout(minimapDebounceTimer);
    minimapDebounceTimer = setTimeout(updateMinimap, 120);
}

function initMinimap() {
    minimapEl = document.getElementById('scrollbar-minimap');
    if (!minimapEl) return;
    var logContent = document.getElementById('log-content');
    if (!logContent) return;

    mmCanvas = document.createElement('canvas');
    mmCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    minimapEl.appendChild(mmCanvas);
    mmCtx = mmCanvas.getContext('2d');

    mmViewport = document.createElement('div');
    mmViewport.className = 'minimap-viewport';
    minimapEl.appendChild(mmViewport);

    initMmColors();
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

/** Returns the HTML for the scrollbar minimap element. */
export function getScrollbarMinimapHtml(): string {
    return `<div id="scrollbar-minimap" class="scrollbar-minimap"></div>`;
}
