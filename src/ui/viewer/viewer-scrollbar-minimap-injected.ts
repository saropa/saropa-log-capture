/* eslint-disable max-lines -- Single embedded webview bundle (minimap runtime); splitting would fragment shared state and hooks. */
/**
 * Webview-injected minimap script body (appended after SQL density helpers).
 */

/** Returns the main minimap JavaScript embedded in the log viewer webview. */
export function getScrollbarMinimapInjectedScript(): string {
    return /* javascript */ `
var minimapEl = null;
var mmCanvas = null;
var mmCtx = null;
var mmViewport = null;
var mmDragging = false;
var minimapDebounceTimer = 0;
var mmColors = {};
var mmShowInfo = false;
var mmShowSqlDensity = true;
/** When true (default), marker width ≈ min(100%, line length / reference line length); see mmBarWidthFrac. */
var mmProportionalLines = true;
var mmWidthPx = 60;
var mmViewportRedOutline = false;
var mmOutsideArrowEnabled = false;
var mmOutsideArrowEl = null;
var mmOutsideArrowGlyph = null;
var MM_OUTSIDE_ARROW_STRIP_PX = 12;

/** Total horizontal width of minimap column + optional outside arrow (for --mm-w and jump/replay inset). */
function syncMmColumnWidth() {
    var wrapper = document.getElementById('log-content-wrapper');
    if (wrapper) {
        var arrowPx = (mmOutsideArrowEnabled && mmOutsideArrowEl && !mmOutsideArrowEl.classList.contains('u-hidden')) ? MM_OUTSIDE_ARROW_STRIP_PX : 0;
        wrapper.style.setProperty('--mm-w', (arrowPx + mmWidthPx) + 'px');
    }
    if (typeof syncJumpButtonInset === 'function') syncJumpButtonInset();
}

/** Handle minimapShowInfo setting message from extension. */
function handleMinimapShowInfo(msg) {
    var prev = mmShowInfo;
    mmShowInfo = !!msg.show;
    if (prev !== mmShowInfo) scheduleMinimap();
}

/** Handle minimapWidth setting message from extension. */
function handleMinimapWidth(msg) {
    if (!minimapEl) return;
    var sizes = { xsmall: 28, small: 40, medium: 60, large: 90, xlarge: 120 };
    mmWidthPx = sizes[msg.width] || 60;
    minimapEl.style.width = mmWidthPx + 'px';
    syncMmColumnWidth();
    if (typeof minimapWidthSetting !== 'undefined') minimapWidthSetting = msg.width || 'medium';
    if (typeof syncOptionsPanelUi === 'function') syncOptionsPanelUi();
}

/** Optional strong red border on the viewport rectangle (settings: minimapViewportRedOutline). */
function handleMinimapViewportRedOutline(msg) {
    mmViewportRedOutline = msg.show === true;
    if (mmViewport) mmViewport.classList.toggle('minimap-viewport--red-outline', mmViewportRedOutline);
}

/** Optional yellow arrow strip left of the minimap (settings: minimapViewportOutsideArrow). */
function handleMinimapViewportOutsideArrow(msg) {
    mmOutsideArrowEnabled = msg.show === true;
    if (mmOutsideArrowEl) mmOutsideArrowEl.classList.toggle('u-hidden', !mmOutsideArrowEnabled);
    syncMmColumnWidth();
    updateMinimapViewport();
}

/** Handle minimapShowSqlDensity setting message from extension/options UI. */
function handleMinimapShowSqlDensity(msg) {
    var prev = mmShowSqlDensity;
    mmShowSqlDensity = msg.show !== false;
    if (prev !== mmShowSqlDensity) scheduleMinimap();
}

/** minimapProportionalLines setting: narrow bars by text length vs log pane width (VS Code–style silhouette). */
function handleMinimapProportionalLines(msg) {
    var next = msg.show !== false;
    if (next === mmProportionalLines) return;
    mmProportionalLines = next;
    scheduleMinimap();
}

/**
 * Approximate how many characters fit on one row of #log-content at the current width.
 * Fixed average char width — good enough for a minimap silhouette; updates on resize.
 */
function mmCharsPerContentLine() {
    var lc = document.getElementById('log-content');
    var w = lc && lc.clientWidth > 0 ? lc.clientWidth : 400;
    w = Math.max(24, w);
    var perChar = 7.15;
    return Math.max(8, Math.floor(w / perChar));
}

/**
 * Width fraction (0–1] for one logical line: text length vs one reference row, capped at 100%.
 * With word wrap on, lines longer than one row count as full width (they span the pane).
 */
function mmBarWidthFrac(it) {
    if (!mmProportionalLines) return 1;
    var plain = stripTags(it.html || '');
    var len = plain.length;
    var ref = mmCharsPerContentLine();
    if (ref < 1) ref = 1;
    var wrapOn = (typeof wordWrap !== 'undefined' && wordWrap);
    var raw = !wrapOn ? (len / ref) : (len <= ref ? (len / ref) : 1);
    var frac = Math.min(1, raw);
    if (len === 0) frac = Math.max(frac, 0.06);
    return Math.max(0.02, frac);
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
        sqlDensity: 'rgba(90, 180, 255, 1)',
        sqlSlowDensity: 'rgba(255, 189, 89, 1)',
        searchMatch: v('--vscode-editorOverviewRuler-findMatchForeground', 'rgba(234,92,0,0.85)'),
        currentMatch: 'rgba(255,150,50,1)',
        /* Full-canvas base under SQL bands and severity ticks. */
        track: v('--vscode-scrollbarSlider-background', 'rgba(100, 100, 100, 0.26)')
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

var MM_SAMPLE_THRESHOLD = 50000;
/** Paint all markers onto the canvas in a single pass. Skips when document hidden; samples when line count > MM_SAMPLE_THRESHOLD. */
function paintMinimap() {
    if (!mmCtx || !minimapEl) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    var mmW = minimapEl.clientWidth;
    var mmH = minimapEl.clientHeight;
    resizeMmCanvas();
    mmCtx.clearRect(0, 0, mmW, mmH);
    mmCtx.globalAlpha = 1;
    mmCtx.fillStyle = mmColors.track || 'rgba(100, 100, 100, 0.26)';
    mmCtx.fillRect(0, 0, mmW, mmH);
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

    var step = allLines.length > MM_SAMPLE_THRESHOLD ? Math.max(1, Math.floor(allLines.length / MM_SAMPLE_THRESHOLD)) : 1;
    /* Count formula shared with DB tab (session-time-buckets.ts); SQL buckets here are scroll-Y, not session time — see module doc. */
    var densityBucketCount = (typeof sessionTimeBucketCountForHeightPx === 'function')
        ? sessionTimeBucketCountForHeightPx(mmH)
        : Math.max(48, Math.min(180, Math.floor(mmH / 2)));
    var sqlBuckets = null;
    var slowSqlBuckets = null;
    if (mmShowSqlDensity) {
        sqlBuckets = new Uint16Array(densityBucketCount);
        slowSqlBuckets = new Uint16Array(densityBucketCount);
    }
    // Collect markers grouped by color to minimize fillStyle switches
    var groups = {};
    for (var i = 0; i < allLines.length; i += step) {
        var it = allLines[i];
        if (it.height === 0 || it.type === 'stack-frame' || it.type === 'marker') continue;
        var py = Math.round((mmLineOffset(i, hasPfx, cumH) / total) * mmH);
        /* SQL density must not depend on minimap severity visibility (e.g. hidden info dots). */
        if (mmShowSqlDensity && sqlBuckets && slowSqlBuckets) {
            var plainSql = stripTags(it.html || '');
            if (isLikelySqlLine(it, plainSql)) {
                var bi = Math.min(densityBucketCount - 1, Math.max(0, Math.floor((py / Math.max(1, mmH)) * densityBucketCount)));
                sqlBuckets[bi]++;
                if (isLikelySlowSqlLine(it, plainSql)) slowSqlBuckets[bi]++;
            }
        }
        var lv = it.level;
        if (!lv || !mmColors[lv]) continue;
        if (lv === 'info' && !mmShowInfo) continue;
        if (!groups[lv]) groups[lv] = [];
        groups[lv].push({ py: py, w: mmBarWidthFrac(it) });
    }

    if (mmShowSqlDensity && sqlBuckets && slowSqlBuckets) {
        paintSqlDensityBuckets(sqlBuckets, slowSqlBuckets, mmW, mmH);
    }

    // Paint severity markers
    var barH = 3;
    for (var lv in groups) {
        mmCtx.fillStyle = mmColors[lv];
        var arr = groups[lv];
        for (var j = 0; j < arr.length; j++) {
            var seg = arr[j];
            mmCtx.fillRect(0, seg.py, mmW * seg.w, barH);
        }
    }

    var mc = 0;
    for (var k in groups) mc += groups[k].length;
    /* When "show info on minimap" is off, typical Saropa logs are mostly info — severity groups are empty and the canvas stays blank. Draw a neutral presence band so opened files and dense info streams still show scroll structure. */
    if (mc === 0 && total > 0) {
        mmCtx.fillStyle = 'rgba(140, 140, 140, 0.24)';
        var barN = 2;
        for (var ni = 0; ni < allLines.length; ni += step) {
            var nit = allLines[ni];
            if (nit.height === 0 || nit.type === 'stack-frame' || nit.type === 'marker') continue;
            var npy = Math.round((mmLineOffset(ni, hasPfx, cumH) / total) * mmH);
            var nw = mmBarWidthFrac(nit);
            mmCtx.fillRect(0, npy, mmW * nw, barN);
        }
    }

    // Paint search markers on top (higher visual priority)
    paintSearchMarkers(hasPfx, cumH, total, mmW, mmH, barH);

    /* Hover: plain language (tooltip strings are easy to misread as errors when they look like debug dumps). */
    var title = 'Scroll map — click or drag to jump. Ticks: log level and search.';
    if (mmShowSqlDensity) {
        title += ' Shading: SQL (blue) and slow SQL (orange) by position in the log.';
    } else {
        title += ' Turn on “SQL activity on scroll map” in Layout options for SQL shading.';
    }
    if (mc === 0 && total > 0) {
        title += ' Enable info markers in settings for colored ticks on info-heavy logs.';
    }
    title += ' ' + Math.round(total) + ' px content.';
    minimapEl.title = title;
}

/** Paint search-match and current-match markers onto the canvas. */
function paintSearchMarkers(hasPfx, cumH, total, mmW, mmH, barH) {
    if (typeof matchIndices === 'undefined' || !matchIndices || matchIndices.length === 0) return;
    for (var si = 0; si < matchIndices.length; si++) {
        var idx = matchIndices[si];
        if (idx < 0 || idx >= allLines.length || allLines[idx].height === 0) continue;
        var py = Math.round((mmLineOffset(idx, hasPfx, cumH) / total) * mmH);
        var isCur = (typeof currentMatchIdx !== 'undefined') && currentMatchIdx === si;
        var sw = mmBarWidthFrac(allLines[idx]);
        mmCtx.fillStyle = isCur ? mmColors.currentMatch : mmColors.searchMatch;
        mmCtx.fillRect(0, py, mmW * sw, barH);
    }
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
