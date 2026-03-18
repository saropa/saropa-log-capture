/**
 * Current-session scan and render logic for the performance panel.
 * Extracted from viewer-performance-panel.ts for line-count management.
 *
 * All functions share the IIFE scope of the parent panel script, so they
 * can reference DOM element variables and helper functions declared there.
 */

/** Return JS that scans allLines for perf events and renders grouped results. */
export function getPerformanceCurrentScript(): string {
    return /* javascript */ `
    var ppPerfTraceRe = /\\bPERF\\s+([\\w.]+):\\s*(\\d+)\\s*ms/i;
    var ppChoreographerRe = /Skipped\\s+(\\d[\\d,]*)\\s+frames/i;
    var ppGcFreedRe = /GC\\s+freed\\s+([\\d,]+)\\s*KB/i;
    var ppGcTotalMsRe = /total\\s+([\\d.]+)\\s*ms/i;
    var ppTimeoutRe = /timed\\s+out\\s+after\\s+(\\d+)\\s*s/i;
    // Flutter/Dart memory phrases (must match level-classifier memoryPhraseRe); only lines already level performance are scanned.
    var ppMemoryRe = /\\b(Memory\\s*:\\s*\\d+|memory\\s+(?:pressure|usage|leak)|(?:old|new)\\s+gen\\s|retained\\s+\\d+|leak\\s+detected|potential\\s+leak)\\b/i;

    function buildCurrentView() {
        if (!ppCurrentView) return;
        var summary = scanCurrentSession();
        if (summary.total === 0) {
            ppCurrentView.innerHTML = '';
            if (ppEmpty) ppEmpty.style.display = '';
            return;
        }
        if (ppEmpty) ppEmpty.style.display = 'none';
        ppCurrentView.innerHTML = renderGroups(summary);
    }

    function scanCurrentSession() {
        var perf = [], jank = [], gc = [], timeouts = [], memory = [], other = [];
        if (typeof allLines === 'undefined') return { perf: perf, jank: jank, gc: gc, timeouts: timeouts, memory: memory, other: other, total: 0 };
        for (var i = 0; i < allLines.length; i++) {
            var item = allLines[i];
            if (!item || item.level !== 'performance') continue;
            var plain = typeof stripTags === 'function' ? stripTags(item.html) : item.html;
            classifyPerfLine(plain, i, item.timestamp, perf, jank, gc, timeouts, memory, other);
        }
        jank.sort(function(a, b) { return b.value - a.value; });
        gc.sort(function(a, b) { return b.value - a.value; });
        return { perf: perf, jank: jank, gc: gc, timeouts: timeouts, memory: memory, other: other, total: perf.length + jank.length + gc.length + timeouts.length + memory.length + other.length };
    }

    function classifyPerfLine(plain, idx, ts, perf, jank, gc, timeouts, memory, other) {
        var m;
        if ((m = ppPerfTraceRe.exec(plain))) { perf.push({ idx: idx, name: m[1], value: parseInt(m[2], 10), ts: ts }); }
        else if ((m = ppChoreographerRe.exec(plain))) { jank.push({ idx: idx, value: parseInt(m[1].replace(/,/g, ''), 10), ts: ts }); }
        else if ((m = ppGcFreedRe.exec(plain))) {
            var totalM = ppGcTotalMsRe.exec(plain);
            gc.push({ idx: idx, freed: parseInt(m[1].replace(/,/g, ''), 10), value: totalM ? parseFloat(totalM[1]) : 0, ts: ts });
        }
        else if ((m = ppTimeoutRe.exec(plain))) { timeouts.push({ idx: idx, value: parseInt(m[1], 10), ts: ts }); }
        else if (ppMemoryRe.test(plain)) { memory.push({ idx: idx, ts: ts }); }
        else { other.push({ idx: idx, ts: ts }); }
    }

    function renderGroups(s) {
        var html = '';
        if (s.perf.length) html += renderPerfTraceGroup(s.perf);
        if (s.jank.length) html += renderJankGroup(s.jank);
        if (s.gc.length) html += renderGcGroup(s.gc);
        if (s.timeouts.length) html += renderTimeoutGroup(s.timeouts);
        if (s.memory.length) html += renderMemoryGroup(s.memory);
        if (s.other.length) html += renderOtherGroup(s.other);
        return html;
    }

    function renderPerfTraceGroup(items) {
        var rows = items.map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">' + esc(it.name) + ': ' + it.value + 'ms</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('PERF Traces', items.length, '', rows);
    }

    function renderJankGroup(items) {
        var worst = items[0].value;
        var total = items.reduce(function(s, it) { return s + it.value; }, 0);
        var stats = 'Worst: ' + fmtNum(worst) + ' frames \\u00b7 Total: ' + fmtNum(total) + ' frames';
        var rows = items.map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">' + fmtNum(it.value) + ' frames</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('Choreographer', items.length, stats, rows);
    }

    function renderGcGroup(items) {
        var avgMs = Math.round(items.reduce(function(s, it) { return s + it.value; }, 0) / items.length);
        var totalFreed = items.reduce(function(s, it) { return s + (it.freed || 0); }, 0);
        var stats = 'Avg: ' + avgMs + 'ms \\u00b7 Freed: ' + fmtKB(totalFreed);
        var rows = items.map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">freed ' + fmtNum(it.freed || 0) + 'KB \\u00b7 ' + Math.round(it.value) + 'ms</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('GC', items.length, stats, rows);
    }

    function renderTimeoutGroup(items) {
        var rows = items.map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">' + it.value + 's timeout</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('Timeouts', items.length, '', rows);
    }

    function renderMemoryGroup(items) {
        var rows = items.slice(0, 50).map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">line ' + (it.idx + 1) + '</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('Memory', items.length, '', rows);
    }

    function renderOtherGroup(items) {
        var rows = items.slice(0, 50).map(function(it) {
            return '<div class="pp-event-row" data-idx="' + it.idx + '"><span class="pp-event-metric">line ' + (it.idx + 1) + '</span><span class="pp-event-time">' + fmtTs(it.ts) + '</span></div>';
        }).join('');
        return groupHtml('Other', items.length, '', rows);
    }

    function groupHtml(label, count, stats, rows) {
        var statsHtml = stats ? '<div class="pp-group-stats">' + stats + '</div>' : '';
        return '<div class="pp-group"><div class="pp-group-header"><span class="pp-group-arrow"></span><span>' + esc(label) + '</span><span class="pp-group-count">' + count + '</span></div><div class="pp-group-body">' + statsHtml + rows + '</div></div>';
    }
`;
}
