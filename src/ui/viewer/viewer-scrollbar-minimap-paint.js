"use strict";
/**
 * Minimap canvas painting: colors, severity markers, SQL density, and search highlights.
 * Concatenated after state + before interaction code in the webview bundle.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScrollbarMinimapPaintScript = getScrollbarMinimapPaintScript;
/** Returns minimap color init, canvas resize, and paint functions. */
function getScrollbarMinimapPaintScript() {
    return /* javascript */ `
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
        sqlDensity: 'rgba(200, 120, 180, 1)',
        sqlSlowDensity: 'rgba(255, 189, 89, 1)',
        searchMatch: v('--vscode-editorOverviewRuler-findMatchForeground', 'rgba(234,92,0,0.85)'),
        currentMatch: 'rgba(255,150,50,1)',
        /* Full-canvas base under SQL bands and severity ticks. */
        track: v('--vscode-scrollbarSlider-background', 'rgba(100, 100, 100, 0.26)')
    };
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
        title += ' Shading: SQL (pink) and slow SQL (orange) by position in the log.';
    } else {
        title += ' Turn on "SQL activity on scroll map" in Layout options for SQL shading.';
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
`;
}
//# sourceMappingURL=viewer-scrollbar-minimap-paint.js.map