"use strict";
/**
 * Error-rate-over-time tab for the Performance panel.
 *
 * Scans `allLines` for error/warning lines, buckets them by timestamp,
 * detects spikes via moving average, and renders an SVG bar chart.
 * Click a bar to scroll the viewer to the first line in that bucket.
 *
 * Shares the IIFE scope of `viewer-performance-panel.ts`, so
 * `esc()`, `fmtTs()`, `fmtNum()`, `ppEmpty`, `scrollToLineNumber`,
 * `allLines`, and `stripTags` are all available.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorRateTabScript = getErrorRateTabScript;
/** Return JS that builds the error-rate chart inside the performance panel. */
function getErrorRateTabScript() {
    return /* javascript */ `
    var erShowWarnings = true;
    var erDetectSpikes = true;
    var erBucketSizeSetting = 'auto';

    function buildErrorRateView() {
        var view = ${erView()};
        if (!view) return;
        if (typeof allLines === 'undefined' || !allLines.length) {
            view.innerHTML = '';
            if (ppEmpty) { ppEmpty.textContent = 'No log lines loaded'; ppEmpty.style.display = ''; }
            return;
        }
        var buckets = bucketErrors(allLines);
        if (!buckets.length || buckets.every(function(b) { return b.errors === 0 && b.warnings === 0; })) {
            view.innerHTML = '';
            if (ppEmpty) { ppEmpty.textContent = 'No errors or warnings found'; ppEmpty.style.display = ''; }
            return;
        }
        if (ppEmpty) ppEmpty.style.display = 'none';
        var spikes = erDetectSpikes ? detectSpikes(buckets) : [];
        view.innerHTML = renderErrorRateSummary(buckets, spikes) + renderErrorRateChart(buckets, spikes);
        bindErrorRateClicks(view, buckets);
    }

    function bucketErrors(lines) {
        var firstTs = 0, lastTs = 0, items = [];
        for (var i = 0; i < lines.length; i++) {
            var it = lines[i];
            if (!it || it.type === 'marker' || it.type === 'run-separator') continue;
            if (it.level !== 'error' && it.level !== 'warning') continue;
            if (!erShowWarnings && it.level === 'warning') continue;
            var ts = it.timestamp || 0;
            if (ts > 0) {
                if (!firstTs || ts < firstTs) firstTs = ts;
                if (ts > lastTs) lastTs = ts;
            }
            items.push({ ts: ts, level: it.level, idx: i });
        }
        if (!items.length) return [];
        var span = lastTs - firstTs;
        if (span <= 0) return [{ startMs: firstTs, errors: countLevel(items, 'error'), warnings: countLevel(items, 'warning'), firstIdx: items[0].idx }];
        var bucketMs = parseBucketSize(erBucketSizeSetting, span);
        var count = Math.min(Math.ceil(span / bucketMs), 200);
        var result = [];
        for (var b = 0; b < count; b++) {
            result.push({ startMs: firstTs + b * bucketMs, errors: 0, warnings: 0, firstIdx: -1 });
        }
        for (var j = 0; j < items.length; j++) {
            var bi = Math.min(Math.floor((items[j].ts - firstTs) / bucketMs), count - 1);
            if (bi < 0) bi = 0;
            if (items[j].level === 'error') result[bi].errors++;
            else result[bi].warnings++;
            if (result[bi].firstIdx < 0) result[bi].firstIdx = items[j].idx;
        }
        return result;
    }

    function countLevel(items, level) {
        var n = 0;
        for (var i = 0; i < items.length; i++) { if (items[i].level === level) n++; }
        return n;
    }

    function parseBucketSize(setting, spanMs) {
        var fixed = { '10s': 10000, '30s': 30000, '1m': 60000, '5m': 300000 };
        if (fixed[setting]) return fixed[setting];
        var auto = spanMs / 100;
        return Math.max(1000, Math.min(auto, 300000));
    }

    function detectSpikes(buckets) {
        if (buckets.length < 2) return [];
        var flags = [];
        for (var i = 0; i < buckets.length; i++) {
            var total = buckets[i].errors + buckets[i].warnings;
            var windowStart = Math.max(0, i - 5);
            var sum = 0, cnt = 0;
            for (var j = windowStart; j < i; j++) { sum += buckets[j].errors + buckets[j].warnings; cnt++; }
            var avg = cnt > 0 ? sum / cnt : 0;
            flags.push(avg > 0 && total > 3 * avg);
        }
        return flags;
    }

    ${getRenderFunctions()}
`;
}
function erView() {
    return `document.getElementById(ppIdPrefix + 'pp-error-rate-view')`;
}
function getRenderFunctions() {
    return /* javascript */ `
    function renderErrorRateSummary(buckets, spikes) {
        var totalE = 0, totalW = 0, spikeCount = 0;
        for (var i = 0; i < buckets.length; i++) { totalE += buckets[i].errors; totalW += buckets[i].warnings; }
        for (var s = 0; s < spikes.length; s++) { if (spikes[s]) spikeCount++; }
        var parts = ['<span class="pp-er-count pp-er-count-error">' + fmtNum(totalE) + ' error' + (totalE !== 1 ? 's' : '') + '</span>'];
        if (erShowWarnings) parts.push('<span class="pp-er-count pp-er-count-warning">' + fmtNum(totalW) + ' warning' + (totalW !== 1 ? 's' : '') + '</span>');
        if (spikeCount) parts.push('<span class="pp-er-count pp-er-count-spike">' + spikeCount + ' spike' + (spikeCount !== 1 ? 's' : '') + '</span>');
        return '<div class="pp-er-summary">' + parts.join(' \\u00b7 ') + '</div>';
    }

    function renderErrorRateChart(buckets, spikes) {
        var maxCount = 1;
        for (var i = 0; i < buckets.length; i++) {
            var t = buckets[i].errors + buckets[i].warnings;
            if (t > maxCount) maxCount = t;
        }
        var w = 380, h = 120, pad = { top: 16, right: 8, bottom: 24, left: 32 };
        var chartW = w - pad.left - pad.right;
        var chartH = h - pad.top - pad.bottom;
        var barW = Math.max(1, chartW / buckets.length - 1);
        var svg = '<svg class="pp-er-chart" viewBox="0 0 ' + w + ' ' + h + '">';
        svg += '<line x1="' + pad.left + '" y1="' + (h - pad.bottom) + '" x2="' + (w - pad.right) + '" y2="' + (h - pad.bottom) + '" class="pp-chart-axis"/>';
        svg += '<line x1="' + pad.left + '" y1="' + pad.top + '" x2="' + pad.left + '" y2="' + (h - pad.bottom) + '" class="pp-chart-axis"/>';
        svg += renderYAxisLabels(maxCount, chartH, pad, h);
        svg += renderXAxisLabels(buckets, chartW, pad, h);
        for (var b = 0; b < buckets.length; b++) {
            var x = pad.left + b * (chartW / buckets.length);
            var eH = (buckets[b].errors / maxCount) * chartH;
            var wH = (buckets[b].warnings / maxCount) * chartH;
            var totalH = eH + wH;
            if (totalH > 0) {
                var y = h - pad.bottom - totalH;
                if (wH > 0) svg += '<rect class="pp-er-bar pp-er-bar-warning" data-bar="' + b + '" x="' + x + '" y="' + y + '" width="' + barW + '" height="' + wH + '"><title>' + barTooltip(buckets[b]) + '</title></rect>';
                if (eH > 0) svg += '<rect class="pp-er-bar pp-er-bar-error" data-bar="' + b + '" x="' + x + '" y="' + (h - pad.bottom - eH) + '" width="' + barW + '" height="' + eH + '"><title>' + barTooltip(buckets[b]) + '</title></rect>';
            }
            if (spikes[b]) svg += '<text class="pp-er-spike-marker" x="' + (x + barW / 2) + '" y="' + (h - pad.bottom - totalH - 3) + '" text-anchor="middle">\\u26A0</text>';
        }
        svg += '</svg>';
        return '<div class="pp-er-chart-container">' + svg + '</div>';
    }

    function renderYAxisLabels(maxCount, chartH, pad, h) {
        var ticks = computeYTicks(maxCount);
        var svg = '';
        for (var i = 0; i < ticks.length; i++) {
            var y = h - pad.bottom - (ticks[i] / maxCount) * chartH;
            svg += '<text class="pp-chart-label" x="' + (pad.left - 4) + '" y="' + (y + 3) + '" text-anchor="end">' + ticks[i] + '</text>';
            svg += '<line x1="' + pad.left + '" y1="' + y + '" x2="' + (380 - pad.right) + '" y2="' + y + '" stroke-dasharray="2,3" class="pp-chart-axis" opacity="0.3"/>';
        }
        return svg;
    }

    function computeYTicks(maxCount) {
        if (maxCount <= 5) {
            var arr = [];
            for (var i = 1; i <= maxCount; i++) arr.push(i);
            return arr;
        }
        var step = Math.ceil(maxCount / 4);
        var ticks = [];
        for (var t = step; t <= maxCount; t += step) ticks.push(t);
        return ticks;
    }

    function renderXAxisLabels(buckets, chartW, pad, h) {
        if (buckets.length < 2) return '';
        var labelCount = Math.min(buckets.length, 6);
        var step = Math.max(1, Math.floor(buckets.length / labelCount));
        var svg = '';
        for (var i = 0; i < buckets.length; i += step) {
            var x = pad.left + i * (chartW / buckets.length) + (chartW / buckets.length) / 2;
            svg += '<text class="pp-chart-label" x="' + x + '" y="' + (h - 4) + '" text-anchor="middle">' + fmtTs(buckets[i].startMs) + '</text>';
        }
        return svg;
    }

    function barTooltip(bucket) {
        var parts = [];
        if (bucket.errors) parts.push(bucket.errors + ' error' + (bucket.errors !== 1 ? 's' : ''));
        if (bucket.warnings) parts.push(bucket.warnings + ' warning' + (bucket.warnings !== 1 ? 's' : ''));
        return parts.join(', ') + ' at ' + fmtTs(bucket.startMs);
    }

    function bindErrorRateClicks(view, buckets) {
        view.addEventListener('click', function(e) {
            var bar = e.target.closest('[data-bar]');
            if (!bar) return;
            var bi = parseInt(bar.dataset.bar, 10);
            if (isNaN(bi) || !buckets[bi]) return;
            var idx = buckets[bi].firstIdx;
            if (idx >= 0 && typeof scrollToLineNumber === 'function') scrollToLineNumber(idx + 1);
        });
    }
`;
}
//# sourceMappingURL=viewer-error-rate-tab.js.map