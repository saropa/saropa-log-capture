"use strict";
/**
 * DB_13: Timeline range calculation, viewport/filter band chrome, scroll binding, and brush interaction
 * for the performance panel Database tab.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPerformanceDbTabTimelineScript = getPerformanceDbTabTimelineScript;
/** Embeds into the performance panel IIFE; uses ppDbView, allLines, prefixSums, ppActiveTab. */
function getPerformanceDbTabTimelineScript() {
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
`;
}
//# sourceMappingURL=viewer-performance-db-tab-timeline.js.map