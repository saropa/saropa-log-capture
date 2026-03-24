/**
 * DB_13: Database analytics tab — rollup KPIs, time buckets (aligned with minimap bucket count formula),
 * passive viewport band on the timeline, optional brush → time filter, Drift Advisor summary row.
 */

/** Embeds into the performance panel IIFE; uses ppDbView, fmtNum, esc, ppActiveTab, vscodeApi, allLines, prefixSums. */
export function getPerformanceDbTabScript(): string {
  return /* javascript */ `
    var ppDbScrollBound = false;
    function lineIndexAtContentY(y) {
        if (!allLines || allLines.length === 0) return 0;
        if (prefixSums && prefixSums.length === allLines.length + 1) {
            var lo = 0, hi = allLines.length, mid;
            while (lo < hi) {
                mid = (lo + hi + 1) >> 1;
                if (prefixSums[mid] <= y) lo = mid;
                else hi = mid - 1;
            }
            return Math.min(lo, allLines.length - 1);
        }
        var acc = 0, i;
        for (i = 0; i < allLines.length; i++) {
            var hh = allLines[i].height || 0;
            if (acc + hh > y) return i;
            acc += hh;
        }
        return Math.max(0, allLines.length - 1);
    }
    function lineTimestampAtOrAfter(i0) {
        var j, row, t;
        for (j = i0; j < allLines.length && j < i0 + 400; j++) {
            row = allLines[j];
            if (!row || row.type !== 'line') continue;
            t = row.timestamp;
            if (typeof t === 'number' && isFinite(t)) return t;
        }
        return null;
    }
    function lineTimestampAtOrBefore(i0) {
        var j, row, t;
        for (j = i0; j >= 0 && j > i0 - 400; j--) {
            row = allLines[j];
            if (!row || row.type !== 'line') continue;
            t = row.timestamp;
            if (typeof t === 'number' && isFinite(t)) return t;
        }
        return null;
    }
    function dbVisibleTimeRangeFromScroll() {
        var lc = document.getElementById('log-content');
        var meta = window.ppDbTimelineMeta;
        if (!lc || !meta) return null;
        var iTop = lineIndexAtContentY(lc.scrollTop);
        var iBot = lineIndexAtContentY(lc.scrollTop + lc.clientHeight);
        var tA = lineTimestampAtOrAfter(iTop);
        var tB = lineTimestampAtOrBefore(iBot);
        if (tA == null && tB == null) return null;
        if (tA == null) tA = tB;
        if (tB == null) tB = tA;
        return { lo: Math.min(tA, tB), hi: Math.max(tA, tB) };
    }
    function updateDbTimelineChrome() {
        var meta = window.ppDbTimelineMeta;
        var track = ppDbView && ppDbView.querySelector('.pp-db-timeline-track');
        if (!track || !meta) return;
        var band = track.querySelector('.pp-db-viewport-band');
        var filt = track.querySelector('.pp-db-filter-band');
        if (band) {
            var vr = dbVisibleTimeRangeFromScroll();
            var sp = meta.span || 1;
            if (vr && isFinite(vr.lo) && isFinite(vr.hi)) {
                var p0 = ((vr.lo - meta.tMin) / sp) * 100;
                var p1 = ((vr.hi - meta.tMin) / sp) * 100;
                p0 = Math.max(0, Math.min(100, p0));
                p1 = Math.max(0, Math.min(100, p1));
                if (p1 < p0) { var sw = p0; p0 = p1; p1 = sw; }
                band.style.display = '';
                band.style.left = p0 + '%';
                band.style.width = Math.max(0.4, p1 - p0) + '%';
            } else {
                band.style.display = 'none';
            }
        }
        if (filt) {
            if (typeof dbTimeFilterActive !== 'undefined' && dbTimeFilterActive) {
                var spf = meta.span || 1;
                var f0 = ((dbTimeFilterMin - meta.tMin) / spf) * 100;
                var f1 = ((dbTimeFilterMax - meta.tMin) / spf) * 100;
                f0 = Math.max(0, Math.min(100, f0));
                f1 = Math.max(0, Math.min(100, f1));
                if (f1 < f0) { var sw2 = f0; f0 = f1; f1 = sw2; }
                filt.style.display = '';
                filt.style.left = f0 + '%';
                filt.style.width = Math.max(0.4, f1 - f0) + '%';
            } else {
                filt.style.display = 'none';
            }
        }
        var sel = track.querySelector('.pp-db-brush-selection');
        if (sel && (!dbTimeFilterActive)) sel.style.display = 'none';
    }
    function scrollToFirstLineInDbTimeRange(lo, hi) {
        var i, it, ts;
        for (i = 0; i < allLines.length; i++) {
            it = allLines[i];
            if (!it || it.type !== 'line') continue;
            ts = it.timestamp;
            if (typeof ts !== 'number' || !isFinite(ts)) continue;
            if (ts < lo || ts > hi) continue;
            if (it.timeRangeFiltered) continue;
            if (typeof scrollToLineNumber === 'function') scrollToLineNumber(i + 1);
            return;
        }
    }
    function ensureDbTimelineScrollBinding() {
        if (ppDbScrollBound) return;
        var lc = document.getElementById('log-content');
        if (!lc) return;
        ppDbScrollBound = true;
        lc.addEventListener('scroll', function() {
            if (ppActiveTab !== 'db') return;
            updateDbTimelineChrome();
        }, { passive: true });
    }
    function wireDbTimelineBrush(track, meta) {
        var brushEl = track.querySelector('.pp-db-brush-selection');
        var dragging = false, startX = 0, curX = 0;
        function fracFromEvent(e) {
            var r = track.getBoundingClientRect();
            if (r.width <= 0) return 0;
            return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        }
        function paintBrush(a, b) {
            var lo = Math.min(a, b), hi = Math.max(a, b);
            if (brushEl) {
                brushEl.style.display = hi - lo < 0.001 ? 'none' : '';
                brushEl.style.left = (100 * lo) + '%';
                brushEl.style.width = (100 * Math.max(0, hi - lo)) + '%';
            }
        }
        track.addEventListener('pointerdown', function(e) {
            if (e.button !== 0) return;
            dragging = true;
            startX = fracFromEvent(e);
            curX = startX;
            paintBrush(startX, curX);
            try { track.setPointerCapture(e.pointerId); } catch (_c) {}
        });
        track.addEventListener('pointermove', function(e) {
            if (!dragging) return;
            curX = fracFromEvent(e);
            paintBrush(startX, curX);
        });
        function finish(e) {
            if (!dragging) return;
            dragging = false;
            try { track.releasePointerCapture(e.pointerId); } catch (_r) {}
            var loF = Math.min(startX, curX), hiF = Math.max(startX, curX);
            if (hiF - loF < 0.02) {
                if (brushEl) brushEl.style.display = 'none';
                return;
            }
            var tLo = meta.tMin + loF * meta.span;
            var tHi = meta.tMin + hiF * meta.span;
            if (typeof applyDbTimeRangeFilter === 'function') applyDbTimeRangeFilter(tLo, tHi);
        }
        track.addEventListener('pointerup', finish);
        track.addEventListener('pointercancel', finish);
    }
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
            if (t && t.closest && t.closest('[data-pp-db-clear-time]')) {
                e.preventDefault();
                if (typeof clearDbTimeRangeFilter === 'function') clearDbTimeRangeFilter();
            }
        });
    }

    function buildDbStatsView() {
        if (!ppDbView) return;
        bindDbViewChromeOnce();
        if (typeof dbInsightSessionRollup === 'undefined' || !dbInsightSessionRollup) {
            ppDbView.innerHTML = '<p class="pp-db-empty">No database line rollup in this session.</p>';
            window.ppDbTimelineMeta = null;
            return;
        }
        var keys = Object.keys(dbInsightSessionRollup);
        if (!keys.length) {
            ppDbView.innerHTML = '<p class="pp-db-empty">No Drift SQL fingerprints recorded.</p>';
            window.ppDbTimelineMeta = null;
            return;
        }
        var entries = [];
        var ki, fp, ent;
        for (ki = 0; ki < keys.length; ki++) {
            fp = keys[ki];
            ent = dbInsightSessionRollup[fp];
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
                if (row.sourceTag !== 'database' && !(row.dbInsight && row.dbInsight.fingerprint)) continue;
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
                if (row.sourceTag !== 'database' && !(row.dbInsight && row.dbInsight.fingerprint)) continue;
                ts = row.timestamp;
                if (typeof ts !== 'number' || !isFinite(ts)) continue;
                if (ts < tMin) tMin = ts;
                if (ts > tMax) tMax = ts;
            }
        }
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
                    if (row.sourceTag !== 'database' && !(row.dbInsight && row.dbInsight.fingerprint)) continue;
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
        html += '<div class="pp-db-table-title">Top fingerprints by volume</div><table class="pp-db-table"><thead><tr><th>#</th><th>Fingerprint (truncated)</th><th>Count</th><th>Avg ms</th></tr></thead><tbody>';
        var maxRows = 15;
        for (bi = 0; bi < entries.length && bi < maxRows; bi++) {
            var e = entries[bi];
            var avg = e.countWithMs > 0 ? Math.round(e.sumMs / e.countWithMs) : '\\u2014';
            var fshow = e.fp.length > 72 ? e.fp.substring(0, 69) + '...' : e.fp;
            html += '<tr><td>' + (bi + 1) + '</td><td class="pp-db-fp" title="' + esc(e.fp) + '">' + esc(fshow) + '</td><td>' + fmtNum(e.count) + '</td><td>' + avg + '</td></tr>';
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
