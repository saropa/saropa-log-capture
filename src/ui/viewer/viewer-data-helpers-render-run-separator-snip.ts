/** `renderItem` branch for run-separator rows (keeps viewer-data-helpers-render.ts under max-lines). */
export const VIEWER_RENDER_EMBED_RUN_SEPARATOR = /* javascript */ `
    if (item.type === 'run-separator') {
        var rs = item.runSummary;
        if (!rs) return '<div class="run-separator"' + idxAttr + '></div>';
        var startStr = (typeof formatRunTime === 'function') ? formatRunTime(rs.startTime) : '--:--:--';
        var endStr = (typeof formatRunTime === 'function') ? formatRunTime(rs.endTime) : '--:--:--';
        var durStr = (typeof formatDuration === 'function') ? formatDuration(rs.durationMs) : '';
        var runNum = (item.runIndex != null) ? item.runIndex + 1 : 0;
        var dots = '';
        if (rs.errors > 0) dots += '<span class="run-sep-dot run-sep-dot-error" title="Errors">' + rs.errors + '</span>';
        if (rs.warnings > 0) dots += '<span class="run-sep-dot run-sep-dot-warning" title="Warnings">' + rs.warnings + '</span>';
        if (rs.perfs > 0) dots += '<span class="run-sep-dot run-sep-dot-perf" title="Perf">' + rs.perfs + '</span>';
        if (rs.infos > 0) dots += '<span class="run-sep-dot run-sep-dot-info" title="Info">' + rs.infos + '</span>';
        if (!dots) dots = '<span class="run-sep-dot run-sep-dot-none">0</span>';
        return '<div class="run-separator"' + idxAttr + '><div class="run-separator-inner">' +
            '<span class="run-sep-title">Run ' + runNum + '</span>' +
            '<span class="run-sep-times">' + startStr + ' \\u2013 ' + endStr + '</span>' +
            '<span class="run-sep-duration">' + durStr + '</span>' +
            '<span class="run-sep-counts">' + dots + '</span></div></div>';
    }
`;
