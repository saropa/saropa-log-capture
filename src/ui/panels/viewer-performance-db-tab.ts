/**
 * DB_13: Database analytics tab — rollup KPIs, time buckets (aligned with minimap bucket count formula),
 * passive viewport band on the timeline, optional brush → time filter, Drift Advisor summary row.
 */
import { getPerformanceDbTabTimelineScript } from './viewer-performance-db-tab-timeline';

/** Embeds into the performance panel IIFE; uses ppDbView, fmtNum, esc, ppActiveTab, vscodeApi, allLines, prefixSums. */
export function getPerformanceDbTabScript(): string {
  return getPerformanceDbTabTimelineScript() + /* javascript */ `
    function buildDriftAdvisorDbPanelHtml() {
        var dm = (typeof window !== 'undefined' && window.driftAdvisorDbPanelMeta) ? window.driftAdvisorDbPanelMeta : null;
        if (!dm || typeof dm !== 'object') return '';
        var perf = dm.performance;
        var parts = [];
        parts.push('<div class="pp-db-drift-row">');
        parts.push('<span class="pp-db-drift-title">Drift Advisor</span>');
        if (perf && typeof perf === 'object') {
            var tq = perf.totalQueries, sq = perf.slowCount, av = perf.avgDurationMs;
            if (typeof tq === 'number' && isFinite(tq)) parts.push(' \\u00b7 Queries: <strong>' + fmtNum(Math.round(tq)) + '</strong>');
            if (typeof sq === 'number' && isFinite(sq)) parts.push(' \\u00b7 Slow: <strong>' + fmtNum(Math.round(sq)) + '</strong>');
            if (typeof av === 'number' && isFinite(av)) parts.push(' \\u00b7 Avg ms: <strong>' + Math.round(av) + '</strong>');
        }
        var an = dm.anomalies;
        if (an && typeof an === 'object' && typeof an.count === 'number' && isFinite(an.count) && an.count > 0) {
            parts.push(' \\u00b7 Anomalies: <strong>' + fmtNum(Math.round(an.count)) + '</strong>');
        }
        if (typeof window !== 'undefined' && window.driftAdvisorAvailable) {
            parts.push(' <button type="button" class="pp-db-drift-open" data-pp-db-drift-open="1">Open panel</button>');
        }
        parts.push('</div>');
        return parts.join('');
    }
    function bindDbViewChromeOnce() {
        if (!ppDbView || ppDbView._ppDbUiBound) return;
        ppDbView._ppDbUiBound = true;
        ppDbView.addEventListener('click', function(e) {
            var t = e.target;
            if (t && t.closest && t.closest('[data-pp-db-drift-open]')) {
                e.preventDefault();
                vscodeApi.postMessage({ type: 'openDriftAdvisor' });
                return;
            }
            var st = t && t.closest && t.closest('.pp-db-static-src');
            if (st) {
                e.preventDefault();
                var enc = st.getAttribute('data-pp-db-fp') || '';
                var fpDec = enc ? decodeURIComponent(enc) : '';
                if (fpDec && typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled) {
                    vscodeApi.postMessage({ type: 'findStaticSourcesForSqlFingerprint', fingerprint: fpDec });
                }
                return;
            }
            if (t && t.closest && t.closest('[data-pp-db-clear-time]')) {
                e.preventDefault();
                if (typeof clearDbTimeRangeFilter === 'function') clearDbTimeRangeFilter();
            }
        });
    }

    function buildDbStatsView() {
        if (!ppDbView) return;
        bindDbViewChromeOnce();
        if (typeof dbSignalSessionRollup === 'undefined' || !dbSignalSessionRollup) {
            ppDbView.innerHTML = '<p class="pp-db-empty">No database line rollup in this session.</p>';
            window.ppDbTimelineMeta = null;
            return;
        }
        var keys = Object.keys(dbSignalSessionRollup);
        if (!keys.length) {
            ppDbView.innerHTML = '<p class="pp-db-empty">No Drift SQL fingerprints recorded.</p>';
            window.ppDbTimelineMeta = null;
            return;
        }
        var entries = [];
        var ki, fp, ent;
        for (ki = 0; ki < keys.length; ki++) {
            fp = keys[ki];
            ent = dbSignalSessionRollup[fp];
            if (!ent) continue;
            entries.push({ fp: fp, count: ent.count, sumMs: ent.sumMs, countWithMs: ent.countWithMs, maxMs: ent.maxMs });
        }
        entries.sort(function(a, b) { return b.count - a.count; });
        var totalQ = entries.reduce(function(s, x) { return s + x.count; }, 0);
        var distinct = entries.length;
        var withDur = 0;
        var sumDurMs = 0;
        for (ki = 0; ki < entries.length; ki++) {
            if (entries[ki].countWithMs > 0) {
                withDur++;
                sumDurMs += entries[ki].sumMs;
            }
        }
        var slowTh = 500;
        if (typeof viewerSlowBurstThresholds !== 'undefined' && viewerSlowBurstThresholds.slowQueryMs > 0) {
            slowTh = viewerSlowBurstThresholds.slowQueryMs;
        }
        var durLineN = 0, slowLineN = 0;
        var h0 = 0, h1 = 0, h2 = 0, h3 = 0;
        var bi, row, ts, ms;
        if (typeof allLines !== 'undefined') {
            for (bi = 0; bi < allLines.length; bi++) {
                row = allLines[bi];
                if (!row || row.type !== 'line') continue;
                if (row.sourceTag !== 'database' && !(row.dbSignal && row.dbSignal.fingerprint)) continue;
                ms = row.elapsedMs;
                if (typeof ms === 'number' && isFinite(ms) && ms >= 0) {
                    durLineN++;
                    if (ms >= slowTh) slowLineN++;
                    if (ms < 10) h0++;
                    else if (ms < 50) h1++;
                    else if (ms < 200) h2++;
                    else h3++;
                }
            }
        }
        var html = '';
        html += buildDriftAdvisorDbPanelHtml();
        html += '<div class="pp-db-summary">Queries (Drift lines): <strong>' + fmtNum(totalQ) + '</strong> \\u00b7 Fingerprints: <strong>' + fmtNum(distinct) + '</strong>';
        if (withDur) {
            html += ' \\u00b7 With duration metadata: <strong>' + fmtNum(withDur) + '</strong>';
            var cntMs = entries.reduce(function(s, x) { return s + x.countWithMs; }, 0);
            var avgFp = cntMs > 0 ? Math.round(sumDurMs / cntMs) : 0;
            if (avgFp > 0) html += ' \\u00b7 Rollup avg ms (where known): <strong>' + avgFp + '</strong>';
        }
        if (durLineN > 0) {
            html += ' \\u00b7 Slow lines (\\u2265' + slowTh + 'ms): <strong>' + Math.round(100 * slowLineN / durLineN) + '%</strong> of lines with duration';
        }
        html += '</div>';
        if (typeof dbTimeFilterActive !== 'undefined' && dbTimeFilterActive) {
            html += '<div class="pp-db-time-filter-bar"><span class="pp-db-time-filter-label">Time filter active</span>'
                + '<button type="button" class="pp-db-clear-time" data-pp-db-clear-time="1">Clear time filter</button></div>';
        }
        var tMin = Infinity, tMax = -Infinity;
        if (typeof allLines !== 'undefined') {
            for (bi = 0; bi < allLines.length; bi++) {
                row = allLines[bi];
                if (!row || row.type !== 'line') continue;
                if (row.sourceTag !== 'database' && !(row.dbSignal && row.dbSignal.fingerprint)) continue;
                ts = row.timestamp;
                if (typeof ts !== 'number' || !isFinite(ts)) continue;
                if (ts < tMin) tMin = ts;
                if (ts > tMax) tMax = ts;
            }
        }
        /* Nominal bar-track height (see .pp-db-bars in viewer-styles-performance). floor(56/2)=28 clamps to N=48 via sessionTimeBucketCountForHeightPx — unlike minimap mmH, so timeline N often < minimap N. */
        var barsH = 56;
        var bucketCount = (typeof sessionTimeBucketCountForHeightPx === 'function')
            ? sessionTimeBucketCountForHeightPx(barsH)
            : 48;
        if (tMax > tMin && bucketCount > 0) {
            var buckets = new Array(bucketCount);
            for (bi = 0; bi < bucketCount; bi++) buckets[bi] = 0;
            var span = tMax - tMin || 1;
            if (typeof allLines !== 'undefined') {
                for (bi = 0; bi < allLines.length; bi++) {
                    row = allLines[bi];
                    if (!row || row.type !== 'line') continue;
                    if (row.sourceTag !== 'database' && !(row.dbSignal && row.dbSignal.fingerprint)) continue;
                    ts = row.timestamp;
                    if (typeof ts !== 'number' || !isFinite(ts)) continue;
                    var ix = (typeof sessionTimeBucketIndex === 'function')
                        ? sessionTimeBucketIndex(ts, tMin, tMax, bucketCount)
                        : 0;
                    buckets[ix]++;
                }
            }
            var maxB = 1;
            for (bi = 0; bi < bucketCount; bi++) if (buckets[bi] > maxB) maxB = buckets[bi];
            html += '<div class="pp-db-timeline"><div class="pp-db-timeline-label">DB activity over session time <span class="pp-db-timeline-hint">(drag to filter by time)</span></div>';
            html += '<div class="pp-db-timeline-track" title="Drag horizontally to set a time range filter">';
            html += '<div class="pp-db-viewport-band" aria-hidden="true"></div>';
            html += '<div class="pp-db-filter-band" aria-hidden="true"></div>';
            html += '<div class="pp-db-brush-selection" aria-hidden="true"></div>';
            html += '<div class="pp-db-bars">';
            for (bi = 0; bi < bucketCount; bi++) {
                var bh = Math.round((buckets[bi] / maxB) * 100);
                html += '<div class="pp-db-bar-wrap" title="' + buckets[bi] + ' queries"><div class="pp-db-bar" style="height:' + bh + '%"></div></div>';
            }
            html += '</div></div></div>';
            window.ppDbTimelineMeta = { tMin: tMin, tMax: tMax, span: span, bucketCount: bucketCount };
        } else {
            html += '<p class="pp-db-note">No time-range for a timeline (need database lines with timestamps).</p>';
            window.ppDbTimelineMeta = null;
        }
        if (h0 + h1 + h2 + h3 > 0) {
            html += '<div class="pp-db-histo">Duration on DB lines: &lt;10ms ' + fmtNum(h0)
                + ' \\u00b7 10\\u201350ms ' + fmtNum(h1)
                + ' \\u00b7 50\\u2013200ms ' + fmtNum(h2)
                + ' \\u00b7 \\u2265200ms ' + fmtNum(h3) + '</div>';
        }
        var staticSqlTab = (typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled);
        html += '<div class="pp-db-table-title">Top fingerprints by volume</div><table class="pp-db-table"><thead><tr><th>#</th><th>Fingerprint (truncated)</th><th>Count</th><th>Avg ms</th>';
        if (staticSqlTab) html += '<th>Static sources</th>';
        html += '</tr></thead><tbody>';
        var maxRows = 15;
        for (bi = 0; bi < entries.length && bi < maxRows; bi++) {
            var e = entries[bi];
            var avg = e.countWithMs > 0 ? Math.round(e.sumMs / e.countWithMs) : '\\u2014';
            var fshow = e.fp.length > 72 ? e.fp.substring(0, 69) + '...' : e.fp;
            html += '<tr><td>' + (bi + 1) + '</td><td class="pp-db-fp" title="' + esc(e.fp) + '">' + esc(fshow) + '</td><td>' + fmtNum(e.count) + '</td><td>' + avg + '</td>';
            if (staticSqlTab) {
                html += '<td><button type="button" class="pp-db-static-src" data-pp-db-fp="' + encodeURIComponent(e.fp) + '" title="Possible Dart sources (project index; not stack trace)">Sources</button></td>';
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        ppDbView.innerHTML = html;
        ensureDbTimelineScrollBinding();
        var tr = ppDbView.querySelector('.pp-db-timeline-track');
        if (tr && window.ppDbTimelineMeta) {
            wireDbTimelineBrush(tr, window.ppDbTimelineMeta);
        }
        requestAnimationFrame(function() {
            updateDbTimelineChrome();
        });
    }
    window.updateDbTimelineChrome = updateDbTimelineChrome;
    window.scrollToFirstLineInDbTimeRange = scrollToFirstLineInDbTimeRange;
`;
}
