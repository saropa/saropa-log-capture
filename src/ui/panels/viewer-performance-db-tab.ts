/**
 * DB_13: Database analytics tab inside the performance panel (client-side rollup + simple timeline).
 */

/** Embeds into the performance panel IIFE; uses ppDbView, fmtNum, esc, allLines, dbInsightSessionRollup. */
export function getPerformanceDbTabScript(): string {
  return /* javascript */ `
    function buildDbStatsView() {
        if (!ppDbView) return;
        if (typeof dbInsightSessionRollup === 'undefined' || !dbInsightSessionRollup) {
            ppDbView.innerHTML = '<p class="pp-db-empty">No database line rollup in this session.</p>';
            return;
        }
        var keys = Object.keys(dbInsightSessionRollup);
        if (!keys.length) {
            ppDbView.innerHTML = '<p class="pp-db-empty">No Drift SQL fingerprints recorded.</p>';
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
        for (ki = 0; ki < entries.length; ki++) {
            if (entries[ki].countWithMs > 0) withDur++;
        }
        var html = '';
        html += '<div class="pp-db-summary">Queries (Drift lines): <strong>' + fmtNum(totalQ) + '</strong> · Fingerprints: <strong>' + distinct + '</strong>';
        if (withDur) html += ' · With duration metadata: <strong>' + withDur + '</strong>';
        html += '</div>';
        var bucketCount = 24;
        var tMin = Infinity, tMax = -Infinity;
        var bi, row, ts;
        if (typeof allLines !== 'undefined') {
            for (bi = 0; bi < allLines.length; bi++) {
                row = allLines[bi];
                if (!row || row.type !== 'line') continue;
                if (row.sourceTag !== 'database' && !(row.dbInsight && row.dbInsight.fingerprint)) continue;
                ts = row.timestamp || row.ts;
                if (typeof ts !== 'number' || !isFinite(ts)) continue;
                if (ts < tMin) tMin = ts;
                if (ts > tMax) tMax = ts;
            }
        }
        if (tMax > tMin && bucketCount > 0) {
            var buckets = new Array(bucketCount);
            for (bi = 0; bi < bucketCount; bi++) buckets[bi] = 0;
            var span = tMax - tMin || 1;
            if (typeof allLines !== 'undefined') {
                for (bi = 0; bi < allLines.length; bi++) {
                    row = allLines[bi];
                    if (!row || row.type !== 'line') continue;
                    if (row.sourceTag !== 'database' && !(row.dbInsight && row.dbInsight.fingerprint)) continue;
                    ts = row.timestamp || row.ts;
                    if (typeof ts !== 'number' || !isFinite(ts)) continue;
                    var ix = Math.floor(((ts - tMin) / span) * bucketCount);
                    if (ix < 0) ix = 0;
                    if (ix >= bucketCount) ix = bucketCount - 1;
                    buckets[ix]++;
                }
            }
            var maxB = 1;
            for (bi = 0; bi < bucketCount; bi++) if (buckets[bi] > maxB) maxB = buckets[bi];
            html += '<div class="pp-db-timeline"><div class="pp-db-timeline-label">DB activity over session time</div><div class="pp-db-bars">';
            for (bi = 0; bi < bucketCount; bi++) {
                var h = Math.round((buckets[bi] / maxB) * 100);
                html += '<div class="pp-db-bar-wrap" title="' + buckets[bi] + ' queries"><div class="pp-db-bar" style="height:' + h + '%"></div></div>';
            }
            html += '</div></div>';
        } else {
            html += '<p class="pp-db-note">No time-range for a timeline (need database lines with timestamps).</p>';
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
    }
`;
}
