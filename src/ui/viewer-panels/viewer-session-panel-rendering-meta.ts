/**
 * Session panel: meta line builder and display-option applicator.
 * Extracted from viewer-session-panel-rendering.ts to keep that file under the
 * 300-line limit. Concatenated into the same IIFE, so it shares the panel's scope
 * (sessionDisplayOptions, escapeHtmlText, format helpers, etc.).
 */

export function getSessionMetaScript(): string {
    return /* javascript */ `
    /* Meta line: adapter, time, duration, size, tags — no dots (rendered as a sibling, see renderItem). */
    function buildSessionMeta(s, fileTime) {
        var parts = [];
        if (s.adapter) parts.push(escapeHtmlText(s.adapter));
        var timePart = '';
        var clockTime = s.formattedTime || s.formattedMtime || '';
        if (fileTime) {
            var md = new Date(s.mtime);
            var mtimeMatch = md.getHours() === fileTime.hours && md.getMinutes() === fileTime.minutes;
            if (!mtimeMatch) {
                timePart = formatTime12hFromParts(fileTime.hours, fileTime.minutes);
            } else if (sessionDisplayOptions.showDayHeadings) {
                timePart = s.relativeTime || clockTime;
            } else {
                var tl = s.formattedMtime || '';
                timePart = s.relativeTime ? tl + ' ' + s.relativeTime : tl;
            }
        } else {
            var timeLabel = sessionDisplayOptions.showDayHeadings ? clockTime : (s.formattedMtime || s.formattedTime || '');
            timePart = timeLabel ? (s.relativeTime ? timeLabel + ' ' + s.relativeTime : timeLabel) : (s.relativeTime || clockTime);
        }
        if (timePart) parts.push(escapeHtmlText(timePart));
        if (s.durationMs > 0) parts.push(escapeHtmlText(formatSessionDuration(s.durationMs)));
        if (s.size) parts.push(escapeHtmlText(formatSessionSize(s.size)));
        var allTags = (s.tags || []).map(function(t) { return '#' + t; })
            .concat((s.autoTags || []).map(function(t) { return '~' + t; }))
            .concat((s.correlationTags || []).slice(0, 3).map(function(t) { return '@' + t; }));
        if (allTags.length > 0) parts.push(escapeHtmlText(allTags.join(' ')));
        return parts.join(' \\u00b7 ');
    }

    function applySessionDisplayOptions(name) {
        var result = trimSessionSeconds(name);
        if (sessionDisplayOptions.stripDatetime) result = stripSessionDatetime(result);
        if (sessionDisplayOptions.normalizeNames) {
            result = normalizeSessionName(result);
            result = splitFileExt(result)[0];
        }
        return result;
    }
`;
}
