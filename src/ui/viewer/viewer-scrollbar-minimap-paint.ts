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
    /* Per-pixel-row severity reduction. Each y-pixel in the minimap shows the
       highest-priority level among source lines that map to it — no alpha
       stacking, no source-over compositing surprises, exactly one deterministic
       color per pixel. Replaces the old "stamp every line and let the blend
       operator sort it out" approach, which saturated into gray walls at
       sub-pixel pitch and produced unpredictable color mixing wherever
       different-severity lines collided. Priority order reflects what users
       actually scan the minimap for: error first, then warning, performance,
       notice, database, info, debug, todo; presence is the catch-all for
       lines with no level or info/debug/notice lines when mmShowInfo is off. */
    var LV_EMPTY = 0;
    var LV_PRESENCE = 1;
    var LV_TODO = 2;
    var LV_DEBUG = 3;
    var LV_INFO = 4;
    var LV_DATABASE = 5;
    var LV_NOTICE = 6;
    var LV_PERFORMANCE = 7;
    var LV_WARNING = 8;
    var LV_ERROR = 9;
    var lvFromName = {
        error: LV_ERROR, warning: LV_WARNING, performance: LV_PERFORMANCE,
        notice: LV_NOTICE, database: LV_DATABASE, info: LV_INFO,
        debug: LV_DEBUG, todo: LV_TODO
    };
    var lvColors = [null, 'rgba(140,140,140,0.28)',
        mmColors.todo, mmColors.debug, mmColors.info, mmColors.database,
        mmColors.notice, mmColors.performance, mmColors.warning, mmColors.error];

    var bucketLv = new Uint8Array(mmH);
    var bucketW = new Float32Array(mmH);
    var hiddenInfoCount = 0;

    for (var i = 0; i < allLines.length; i += step) {
        var it = allLines[i];
        if (it.height === 0 || it.type === 'stack-frame' || it.type === 'marker') continue;
        var py = Math.round((mmLineOffset(i, hasPfx, cumH) / total) * mmH);
        if (py < 0 || py >= mmH) continue;
        /* SQL density must not depend on severity visibility (hidden info dots). */
        if (mmShowSqlDensity && sqlBuckets && slowSqlBuckets) {
            var plainSql = stripTags(it.html || '');
            if (isLikelySqlLine(it, plainSql)) {
                var bi = Math.min(densityBucketCount - 1, Math.max(0, Math.floor((py / Math.max(1, mmH)) * densityBucketCount)));
                sqlBuckets[bi]++;
                if (isLikelySlowSqlLine(it, plainSql)) slowSqlBuckets[bi]++;
            }
        }
        var lvEnum = lvFromName[it.level] || LV_EMPTY;
        /* mmShowInfo off demotes info/debug/notice to presence priority: the
           line still marks its pixel (no black gaps) but can be overridden by
           any higher-severity line landing on the same pixel. */
        if (!mmShowInfo && (lvEnum === LV_INFO || lvEnum === LV_DEBUG || lvEnum === LV_NOTICE)) {
            hiddenInfoCount++;
            lvEnum = LV_PRESENCE;
        } else if (lvEnum === LV_EMPTY) {
            lvEnum = LV_PRESENCE;
        }
        var prev = bucketLv[py];
        if (lvEnum > prev) {
            bucketLv[py] = lvEnum;
            bucketW[py] = mmBarWidthFrac(it);
        } else if (lvEnum === prev) {
            /* Same priority at same pixel: keep the widest so proportional-width
               still shows the longest line falling into this pixel. */
            var w2 = mmBarWidthFrac(it);
            if (w2 > bucketW[py]) bucketW[py] = w2;
        }
    }

    if (mmShowSqlDensity && sqlBuckets && slowSqlBuckets) {
        paintSqlDensityBuckets(sqlBuckets, slowSqlBuckets, mmW, mmH);
    }

    /* Pre-compute bar heights: extend each filled pixel up to 3px tall when
       the next filled pixel is ≥4px away, collapse to 1px at dense pitch.
       Preserves the old "1px gap between bars when space allows" aesthetic
       without per-source-line next-y lookups. */
    var fillHeights = new Uint8Array(mmH);
    var prevFilled = -1;
    for (var yh = 0; yh < mmH; yh++) {
        if (bucketLv[yh] === LV_EMPTY) continue;
        if (prevFilled >= 0) {
            var gap = yh - prevFilled;
            fillHeights[prevFilled] = gap >= 4 ? 3 : Math.max(1, gap - 1);
        }
        prevFilled = yh;
    }
    if (prevFilled >= 0) fillHeights[prevFilled] = 3;

    /* Paint in priority order (low → high). Each pixel is painted exactly
       once — by its bucket's chosen level — at that level's full intended
       alpha. Grouped by level to minimize fillStyle switches. */
    var barH = 3;
    for (var lvIdx = LV_PRESENCE; lvIdx <= LV_ERROR; lvIdx++) {
        var color = lvColors[lvIdx];
        if (!color) continue;
        mmCtx.fillStyle = color;
        for (var yy = 0; yy < mmH; yy++) {
            if (bucketLv[yy] !== lvIdx) continue;
            mmCtx.fillRect(0, yy, mmW * bucketW[yy], fillHeights[yy]);
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
