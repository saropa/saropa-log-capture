/**
 * Minimap canvas painting: colors, severity markers, SQL density, and search highlights.
 * Concatenated after state + before interaction code in the webview bundle.
 */

/** Returns minimap color init, canvas resize, and paint functions. */
export function getScrollbarMinimapPaintScript(): string {
    return /* javascript */ `
/** Read VS Code theme colors with fallbacks. */
function initMmColors() {
    var cs = getComputedStyle(document.documentElement);
    function v(n, fb) { return cs.getPropertyValue(n).trim() || fb; }
    /* Severity swatches mirror the canonical .level-dot-* hex palette in
       viewer-styles-level.ts (footer chip dots), just rendered at reduced alpha
       for the minimap. Why: single source of truth — the color in the footer
       chip equals the color in the scroll map, so users can scan the minimap
       and immediately know which level a tick represents without learning a
       second palette. Prior palette used different hues (teal vs green for
       info, yellow vs orange for warning) which created the "yellow??"
       confusion when the footer chip was orange but the minimap was yellow.
       Uniform 0.6 alpha for most levels; performance purple gets 0.85 because
       the hue is perceptually darker and would otherwise read as a faded
       stripe next to the brighter colors. */
    mmColors = {
        error: 'rgba(244,67,54,0.6)',
        warning: 'rgba(255,152,0,0.6)',
        performance: 'rgba(156,39,176,0.85)',
        todo: 'rgba(189,189,189,0.55)',
        debug: 'rgba(121,85,72,0.6)',
        notice: 'rgba(33,150,243,0.6)',
        info: 'rgba(76,175,80,0.6)',
        database: 'rgba(0,188,212,0.6)',
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

/**
 * Bar height capped to leave a 1px gap below each marker when vertical space allows.
 * Why: with a fixed 3px bar, adjacent lines at pitch ≥3px merge into a solid wall — the eye loses the
 * sense of discrete rows. Subtracting 1 from the per-line pitch reserves a visual gap whenever the
 * minimap has room for one; falls back to 1px (no gap) for sub-pixel pitch on long logs.
 */
function mmBarHeight(maxH, perLinePx) {
    return Math.max(1, Math.min(maxH, perLinePx - 1));
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
    /* Collect ticks in two layers:
       - "presence": every visible line that does NOT qualify for a colored severity
         tick (no level, unknown level, or info/debug/notice when mmShowInfo is off).
         Painted first as neutral low-alpha gray so the minimap reads as a density map
         instead of a sparse scatter with large black gaps.
       - "groups": severity-colored ticks, keyed by level and painted on top of presence. */
    var groups = {};
    var presence = [];
    var hiddenInfoCount = 0;
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
        /* Pitch to the next sampled line — drives mmBarHeight so adjacent bars leave a visual gap when room allows. */
        var nextI = i + step;
        var nextPy = nextI < allLines.length ? Math.round((mmLineOffset(nextI, hasPfx, cumH) / total) * mmH) : mmH;
        var barW = mmBarWidthFrac(it);
        var barH1 = mmBarHeight(3, nextPy - py);
        var lv = it.level;
        var hasSev = lv && mmColors[lv];
        var hiddenInfo = hasSev && (lv === 'info' || lv === 'debug' || lv === 'notice') && !mmShowInfo;
        if (!hasSev || hiddenInfo) {
            presence.push({ py: py, w: barW, h: barH1 });
            if (hiddenInfo) hiddenInfoCount++;
            continue;
        }
        if (!groups[lv]) groups[lv] = [];
        groups[lv].push({ py: py, w: barW, h: barH1 });
    }

    if (mmShowSqlDensity && sqlBuckets && slowSqlBuckets) {
        paintSqlDensityBuckets(sqlBuckets, slowSqlBuckets, mmW, mmH);
    }

    /* Paint neutral presence first so severity ticks layer on top — every visible
       line gets a mark, no more black gaps when info/debug/notice are hidden. */
    if (presence.length > 0) {
        mmCtx.fillStyle = 'rgba(140, 140, 140, 0.22)';
        for (var p = 0; p < presence.length; p++) {
            var pm = presence[p];
            mmCtx.fillRect(0, pm.py, mmW * pm.w, pm.h);
        }
    }

    // Paint severity markers on top
    var barH = 3;
    for (var lv in groups) {
        mmCtx.fillStyle = mmColors[lv];
        var arr = groups[lv];
        for (var j = 0; j < arr.length; j++) {
            var seg = arr[j];
            mmCtx.fillRect(0, seg.py, mmW * seg.w, seg.h);
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
    /* Hint fires when info/debug/notice lines are being drawn as neutral presence —
       user can enable "Show info on minimap" to upgrade them to colored ticks. */
    if (hiddenInfoCount > 0) {
        title += ' Gray ticks are info/debug/notice — enable "Show info on minimap" for colored ticks.';
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
        /* Pitch to the very next line (search is not sampled — every match paints). */
        var nextPy = idx + 1 < allLines.length ? Math.round((mmLineOffset(idx + 1, hasPfx, cumH) / total) * mmH) : mmH;
        var isCur = (typeof currentMatchIdx !== 'undefined') && currentMatchIdx === si;
        var sw = mmBarWidthFrac(allLines[idx]);
        mmCtx.fillStyle = isCur ? mmColors.currentMatch : mmColors.searchMatch;
        mmCtx.fillRect(0, py, mmW * sw, mmBarHeight(barH, nextPy - py));
    }
}
`;
}
