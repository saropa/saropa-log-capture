"use strict";
/**
 * Timeline Panel Script
 *
 * JavaScript code for the timeline webview panel, handling virtual scrolling,
 * filtering, time scrubber, minimap, and keyboard navigation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdvancedScript = getAdvancedScript;
function getAdvancedScript(eventsJson, sessionStart, sessionEnd) {
    return `(function() {
    var vscode = acquireVsCodeApi();
    var allEvents = ${eventsJson};
    var sessionStart = ${sessionStart}, sessionEnd = ${sessionEnd};
    var visibleSources = new Set(allEvents.map(function(e) { return e.src; }));
    var viewStart = sessionStart, viewEnd = sessionEnd;
    var ROW_HEIGHT = 28, VISIBLE_BUFFER = 10;
    var container = document.getElementById('timeline-container');
    var scrollTop = 0, containerHeight = 0;

    function getFilteredEvents() {
        return allEvents.filter(function(e) {
            return visibleSources.has(e.src) && e.ts >= viewStart && e.ts <= viewEnd;
        });
    }

    function renderVirtualList() {
        var events = getFilteredEvents();
        containerHeight = container.clientHeight;
        var totalHeight = events.length * ROW_HEIGHT;
        var startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
        var endIdx = Math.min(events.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER);
        var html = '<div class="virtual-spacer" style="height:' + (startIdx * ROW_HEIGHT) + 'px"></div>';
        var lastTime = '';
        for (var i = startIdx; i < endIdx; i++) {
            var e = events[i];
            var time = formatTime(e.ts);
            var showTime = time !== lastTime; lastTime = time;
            var levelClass = 'level-' + e.lvl;
            var icon = e.lvl === 'error' ? '●' : e.lvl === 'warning' ? '⚠' : e.lvl === 'perf' ? '◆' : '○';
            var srcColor = getSourceColor(e.src);
            var srcLabel = getSourceLabel(e.src);
            var cid = e.cid, cdesc = e.cdesc || '';
            var corrAttr = cid ? ' data-cid="' + escapeAttr(cid) + '" title="' + escapeAttr(cdesc) + '"' : '';
            html += '<div class="event-row ' + levelClass + '" data-idx="' + i + '" data-source="' + e.src + '"' + (e.line ? ' data-line="' + e.line + '"' : '') + (e.file ? ' data-file="' + escapeAttr(e.file) + '"' : '') + corrAttr + '>';
            html += '<div class="event-time">' + (showTime ? time : '') + '</div>';
            html += '<div class="event-icon">' + icon + '</div>';
            html += '<div class="event-source" style="color:' + srcColor + '">[' + srcLabel + ']</div>';
            html += '<div class="event-summary">' + escapeHtml(e.sum) + (cid ? ' <span class="correlation-badge" title="' + escapeAttr(cdesc) + '">\\u27a4</span>' : '') + '</div></div>';
        }
        html += '<div class="virtual-spacer" style="height:' + ((events.length - endIdx) * ROW_HEIGHT) + 'px"></div>';
        container.innerHTML = html;
        container.style.overflowY = 'auto';
        updateMinimap(events);
    }

    function formatTime(ts) { var d = new Date(ts); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0'); }
    function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function escapeAttr(s) { return s.replace(/"/g,'&quot;'); }
    var sourceColors = {debug:'var(--vscode-debugIcon-startForeground,#89d185)',terminal:'var(--vscode-terminal-foreground,#ccc)',http:'var(--vscode-charts-green,#4dc9a2)',perf:'var(--vscode-charts-purple,#b267e6)',docker:'var(--vscode-charts-blue,#75beff)',events:'var(--vscode-charts-orange,#d18616)',database:'var(--vscode-charts-yellow,#dcdcaa)',browser:'var(--vscode-charts-red,#f14c4c)'};
    var sourceLabels = {debug:'Debug',terminal:'Terminal',http:'HTTP',perf:'Perf',docker:'Docker',events:'Events',database:'DB',browser:'Browser'};
    function getSourceColor(s) { return sourceColors[s] || 'var(--vscode-editor-foreground)'; }
    function getSourceLabel(s) { return sourceLabels[s] || s; }

    function updateMinimap(events) {
        var viewport = document.getElementById('minimap-viewport');
        var range = sessionEnd - sessionStart || 1;
        var left = ((viewStart - sessionStart) / range) * 100;
        var width = ((viewEnd - viewStart) / range) * 100;
        viewport.style.left = left + '%';
        viewport.style.width = width + '%';
    }

    function updateScrubber() {
        var range = sessionEnd - sessionStart || 1;
        var leftPct = ((viewStart - sessionStart) / range) * 100;
        var rightPct = ((viewEnd - sessionStart) / range) * 100;
        document.getElementById('handle-left').style.left = leftPct + '%';
        document.getElementById('handle-right').style.left = rightPct + '%';
        var rangeEl = document.getElementById('scrubber-range');
        rangeEl.style.left = leftPct + '%';
        rangeEl.style.width = (rightPct - leftPct) + '%';
    }

    container.addEventListener('scroll', function() { scrollTop = container.scrollTop; renderVirtualList(); });
    container.addEventListener('click', function(e) {
        var row = e.target.closest('.event-row');
        if (!row) return;
        if (e.target.classList.contains('correlation-badge') || e.target.closest('.correlation-badge')) {
            var cid = row.dataset.cid;
            if (cid) {
                container.querySelectorAll('.event-row.correlation-highlight').forEach(function(r) { r.classList.remove('correlation-highlight'); });
                container.querySelectorAll('.event-row').forEach(function(r) { if (r.dataset.cid === cid) r.classList.add('correlation-highlight'); });
            }
            return;
        }
        var src = row.dataset.source, line = row.dataset.line, file = row.dataset.file;
        if (src === 'debug' && line) { vscode.postMessage({ type: 'openLine', lineNumber: parseInt(line) }); }
        else if (file) { vscode.postMessage({ type: 'openSidecar', file: file }); }
    });

    document.querySelectorAll('.source-filter input').forEach(function(cb) {
        cb.addEventListener('change', function() {
            if (cb.checked) { visibleSources.add(cb.dataset.source); }
            else { visibleSources.delete(cb.dataset.source); }
            renderVirtualList();
        });
    });

    document.querySelectorAll('.export-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { vscode.postMessage({ type: 'export', format: btn.dataset.format }); });
    });

    document.querySelectorAll('.zoom-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var center = (viewStart + viewEnd) / 2, span = viewEnd - viewStart;
            if (btn.dataset.zoom === 'in') { span = Math.max(1000, span * 0.5); }
            else if (btn.dataset.zoom === 'out') { span = Math.min(sessionEnd - sessionStart, span * 2); }
            else { viewStart = sessionStart; viewEnd = sessionEnd; updateScrubber(); renderVirtualList(); return; }
            viewStart = Math.max(sessionStart, center - span / 2);
            viewEnd = Math.min(sessionEnd, center + span / 2);
            updateScrubber(); renderVirtualList();
        });
    });

    document.getElementById('minimap').addEventListener('click', function(e) {
        if (e.target.classList.contains('minimap-bar')) {
            var bucket = parseInt(e.target.dataset.bucket);
            var range = sessionEnd - sessionStart || 1;
            var center = sessionStart + (bucket / 100) * range;
            var span = viewEnd - viewStart;
            viewStart = Math.max(sessionStart, center - span / 2);
            viewEnd = Math.min(sessionEnd, viewStart + span);
            updateScrubber(); renderVirtualList();
        }
    });

    var dragging = null;
    document.getElementById('handle-left').addEventListener('mousedown', function() { dragging = 'left'; });
    document.getElementById('handle-right').addEventListener('mousedown', function() { dragging = 'right'; });
    document.addEventListener('mouseup', function() { dragging = null; });
    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        var track = document.querySelector('.scrubber-track');
        var rect = track.getBoundingClientRect();
        var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        var ts = sessionStart + pct * (sessionEnd - sessionStart);
        if (dragging === 'left') { viewStart = Math.min(ts, viewEnd - 1000); }
        else { viewEnd = Math.max(ts, viewStart + 1000); }
        updateScrubber(); renderVirtualList();
    });

    document.addEventListener('keydown', function(e) {
        var selected = container.querySelector('.event-row.selected');
        var rows = Array.from(container.querySelectorAll('.event-row'));
        var idx = selected ? rows.indexOf(selected) : -1;
        if (e.key === 'ArrowDown') { e.preventDefault(); selectRow(rows, idx + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); selectRow(rows, idx - 1); }
        else if (e.key === 'Enter' && selected) { selected.click(); }
    });

    function selectRow(rows, idx) {
        if (idx < 0) idx = 0;
        if (idx >= rows.length) idx = rows.length - 1;
        rows.forEach(function(r) { r.classList.remove('selected'); });
        if (rows[idx]) { rows[idx].classList.add('selected'); rows[idx].scrollIntoView({ block: 'nearest' }); }
    }

    updateScrubber();
    renderVirtualList();
    window.addEventListener('resize', function() { containerHeight = container.clientHeight; renderVirtualList(); });
})();`;
}
//# sourceMappingURL=timeline-panel-script.js.map