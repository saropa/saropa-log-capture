"use strict";
/**
 * Session panel rendering functions (list, items, day headings, metadata).
 * Returns a JS fragment intended to run inside the session panel IIFE scope.
 * Includes pagination: only the current page of sessions is rendered; bar shows "Showing X–Y of Z" and Prev/Next when total > pageSize.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionRenderingScript = getSessionRenderingScript;
/** Get the session panel rendering script fragment. */
function getSessionRenderingScript() {
    return /* javascript */ `
    /* escapeAttr and escapeHtmlText are provided by the session panel IIFE bootstrap. */
    function renderSessionList(sessions) {
        if (sessionLoadingEl) sessionLoadingEl.style.display = 'none';
        if (!sessionListEl) return;
        if (!sessions || sessions.length === 0) {
            sessionListEl.innerHTML = '';
            if (sessionListPaginationEl) sessionListPaginationEl.style.display = 'none';
            if (sessionEmptyEl) sessionEmptyEl.style.display = '';
            return;
        }
        if (sessionEmptyEl) sessionEmptyEl.style.display = 'none';
        if (typeof rebuildSessionTagChips === 'function') rebuildSessionTagChips(sessions);
        markLatestByName(sessions, applySessionDisplayOptions);
        var active = sessions.filter(function(s) { return !s.trashed; });
        if (sessionDisplayOptions.showLatestOnly) active = active.filter(function(s) { return !!s.isLatestOfName; });
        if (typeof filterSessionsByTags === 'function') active = filterSessionsByTags(active);
        /* Date range filter: keep sessions with mtime >= (now - 7d or 30d). */
        var range = sessionDisplayOptions.dateRange || 'all';
        if (range !== 'all') {
            var now = Date.now(), ms = range === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
            var cutoff = now - ms;
            active = active.filter(function(s) { return (s.mtime || 0) >= cutoff; });
        }
        /* Compute which basenames need subfolder disambiguation. */
        var basenameCounts = {};
        for (var bi = 0; bi < active.length; bi++) {
            var bn = getSessionBasename(active[bi].displayName || active[bi].filename);
            basenameCounts[bn] = (basenameCounts[bn] || 0) + 1;
        }
        var sorted = sortSessions(active);
        var total = sorted.length;
        var pageSize = Math.max(1, sessionDisplayOptions.sessionListPageSize || 100);
        var totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (typeof sessionListPage === 'undefined') sessionListPage = 0;
        sessionListPage = Math.min(Math.max(0, sessionListPage), totalPages - 1);
        var start = sessionListPage * pageSize;
        var pageSessions = sorted.slice(start, start + pageSize);
        var html = sessionDisplayOptions.showDayHeadings ? renderGrouped(pageSessions, basenameCounts) : renderFlat(pageSessions, basenameCounts);
        sessionListEl.innerHTML = html;
        /* Pagination: show bar only when multiple pages; render "Showing X–Y of Z" and Prev/Next. */
        if (sessionListPaginationEl) {
            if (totalPages <= 1) {
                sessionListPaginationEl.style.display = 'none';
            } else {
                sessionListPaginationEl.style.display = '';
                var from = start + 1, to = Math.min(start + pageSize, total);
                var label = 'Showing ' + from + '\u2013' + to + ' of ' + total;
                sessionListPaginationEl.innerHTML = '<span class="session-list-pagination-label">' + escapeHtmlText(label) + '</span>'
                    + '<button type="button" id="session-pagination-prev" class="session-list-pagination-btn" title="Previous page" ' + (sessionListPage <= 0 ? ' disabled' : '') + '><span class="codicon codicon-chevron-left"></span></button>'
                    + '<button type="button" id="session-pagination-next" class="session-list-pagination-btn" title="Next page" ' + (sessionListPage >= totalPages - 1 ? ' disabled' : '') + '><span class="codicon codicon-chevron-right"></span></button>';
            }
        }
    }

    function sortSessions(sessions) {
        var list = sessions.slice();
        list.sort(function(a, b) {
            return sessionDisplayOptions.reverseSort
                ? (a.mtime || 0) - (b.mtime || 0) : (b.mtime || 0) - (a.mtime || 0);
        });
        return list;
    }

    function renderFlat(sessions, bnCounts) { return sessions.map(function(s) { return renderItem(s, bnCounts); }).join(''); }

    function renderGrouped(sessions, bnCounts) {
        var groups = [], currentKey = '';
        for (var i = 0; i < sessions.length; i++) {
            var key = toDateKey(sessions[i].mtime || 0);
            if (key !== currentKey) { currentKey = key; groups.push(renderDayHeading(sessions[i].mtime || 0)); }
            groups.push(renderItem(sessions[i], bnCounts));
        }
        return groups.join('');
    }

    function renderItem(s, bnCounts) {
        var icon = s.isActive ? 'codicon-record' : (s.hasTimestamps ? 'codicon-history' : 'codicon-output');
        var iconTitle = s.isActive ? 'Actively recording' : (s.hasTimestamps ? 'Completed session' : 'Log file');
        if (s.updatedInLastMinute) iconTitle = 'Log updated in the last minute';
        else if (s.updatedSinceViewed) iconTitle = 'Log has new lines since last viewed';
        /* selectedSessionUris is defined in session panel IIFE; multi-select state for Ctrl-click. Update dots only for non-active logs. */
        var cls = 'session-item' + (s.isActive ? ' session-item-active' : '') + (!s.isActive && s.updatedInLastMinute ? ' session-item-updated-recent' : '') + (!s.isActive && s.updatedSinceViewed && !s.updatedInLastMinute ? ' session-item-updated-since-viewed' : '') + (typeof selectedSessionUris !== 'undefined' && selectedSessionUris[s.uriString] ? ' session-item-selected' : '');
        var rawName = s.displayName || s.filename;
        var bn = getSessionBasename(rawName);
        /* Only show subfolder when basenames collide for disambiguation. */
        var displayInput = (bnCounts && bnCounts[bn] > 1) ? rawName : bn;
        var fileTime = sessionDisplayOptions.normalizeNames ? extractFilenameTime(bn) : null;
        var name = applySessionDisplayOptions(displayInput);
        var dots = renderSeverityDots(s);
        var meta = buildSessionMeta(s, dots, fileTime);
        var perfBadge = s.hasPerformanceData ? '<span class="session-item-perf" title="Performance data available"><span class="codicon codicon-graph-line"></span></span>' : '';
        /* Dot: red = updated in last minute, orange = new since last viewed; only for non-active logs. */
        var updateDot = !s.isActive && (s.updatedInLastMinute || s.updatedSinceViewed) ? '<span class="session-item-update-dot" title="' + (s.updatedInLastMinute ? 'Updated in the last minute' : 'New lines since last viewed') + '"></span>' : '';
        return '<div class="' + cls + '" data-uri="' + escapeAttr(s.uriString || '') + '" data-filename="' + escapeAttr(s.filename || '') + '">'
            + '<span class="session-item-icon" title="' + iconTitle + '"><span class="codicon ' + icon + '"></span>' + updateDot + '</span>'
            + '<div class="session-item-info">'
            + '<span class="session-item-name">' + escapeHtmlText(name) + (s.isLatestOfName ? ' <span class="session-latest">(latest)</span>' : '') + perfBadge + '</span>'
            + (meta ? '<span class="session-item-meta">' + meta + '</span>' : '')
            + '</div></div>';
    }

    function renderDayHeading(epochMs) {
        return '<div class="session-day-heading">' + escapeHtmlText(formatDayHeading(epochMs)) + '</div>';
    }

    /* Day heading/formatting helpers and formatSessionSize are loaded
       from viewer-session-transforms.ts as a separate script. */

    /* Build meta line: adapter, time (relative or clock; never blank), dots, duration, size, tags. */
    function buildSessionMeta(s, dotsHtml, fileTime) {
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
        if (dotsHtml) parts.push(dotsHtml);
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

    /** Render a lightweight preview list (filenames only, shimmer on metadata). */
    function renderSessionListPreview(previews) {
        if (sessionLoadingEl) sessionLoadingEl.style.display = 'none';
        if (!sessionListEl) return;
        if (!previews || previews.length === 0) return;
        if (sessionEmptyEl) sessionEmptyEl.style.display = 'none';
        if (sessionListPaginationEl) sessionListPaginationEl.style.display = 'none';
        var html = previews.map(function(p) {
            var bn = getSessionBasename(p.filename);
            var name = applySessionDisplayOptions(bn);
            return '<div class="session-item" data-uri="' + escapeAttr(p.uriString || '') + '" data-filename="' + escapeAttr(p.filename || '') + '">'
                + '<span class="session-item-icon" title="Log file"><span class="codicon codicon-output"></span></span>'
                + '<div class="session-item-info">'
                + '<span class="session-item-name">' + escapeHtmlText(name) + '</span>'
                + '<span class="session-item-meta session-shimmer-meta"></span>'
                + '</div></div>';
        }).join('');
        sessionListEl.innerHTML = html;
    }
`;
}
//# sourceMappingURL=viewer-session-panel-rendering.js.map