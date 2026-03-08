/**
 * Session panel rendering functions (list, items, day headings, metadata).
 * Returns a JS fragment intended to run inside the session panel IIFE scope.
 */

/** Get the session panel rendering script fragment. */
export function getSessionRenderingScript(): string {
    return /* javascript */ `
    function renderSessionList(sessions) {
        if (sessionLoadingEl) sessionLoadingEl.style.display = 'none';
        if (!sessionListEl) return;
        if (!sessions || sessions.length === 0) {
            sessionListEl.innerHTML = '';
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
        var html = sessionDisplayOptions.showDayHeadings ? renderGrouped(sorted, basenameCounts) : renderFlat(sorted, basenameCounts);
        sessionListEl.innerHTML = html;
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
        var cls = 'session-item' + (s.isActive ? ' session-item-active' : '');
        var rawName = s.displayName || s.filename;
        var bn = getSessionBasename(rawName);
        /* Only show subfolder when basenames collide for disambiguation. */
        var displayInput = (bnCounts && bnCounts[bn] > 1) ? rawName : bn;
        var fileTime = sessionDisplayOptions.normalizeNames ? extractFilenameTime(bn) : null;
        var name = applySessionDisplayOptions(displayInput);
        var dots = renderSeverityDots(s);
        var meta = buildSessionMeta(s, dots, fileTime);
        return '<div class="' + cls + '" data-uri="' + escapeAttr(s.uriString || '') + '" data-filename="' + escapeAttr(s.filename || '') + '">'
            + '<span class="session-item-icon" title="' + iconTitle + '"><span class="codicon ' + icon + '"></span></span>'
            + '<div class="session-item-info">'
            + '<span class="session-item-name">' + escapeHtmlText(name) + (s.isLatestOfName ? ' <span class="session-latest">(latest)</span>' : '') + '</span>'
            + (meta ? '<span class="session-item-meta">' + meta + '</span>' : '')
            + '</div></div>';
    }

    function renderDayHeading(epochMs) {
        return '<div class="session-day-heading">' + escapeHtmlText(formatDayHeading(epochMs)) + '</div>';
    }

    /* Day heading/formatting helpers and formatSessionSize are loaded
       from viewer-session-transforms.ts as a separate script. */

    function buildSessionMeta(s, dotsHtml, fileTime) {
        var parts = [];
        if (s.adapter) parts.push(escapeHtmlText(s.adapter));
        var timePart = '';
        if (fileTime) {
            var md = new Date(s.mtime);
            var mtimeMatch = md.getHours() === fileTime.hours && md.getMinutes() === fileTime.minutes;
            if (!mtimeMatch) {
                timePart = formatTime12hFromParts(fileTime.hours, fileTime.minutes);
            } else if (sessionDisplayOptions.showDayHeadings) {
                timePart = s.relativeTime || '';
            } else {
                var tl = s.formattedMtime || '';
                timePart = s.relativeTime ? tl + ' ' + s.relativeTime : tl;
            }
        } else {
            var timeLabel = sessionDisplayOptions.showDayHeadings ? (s.formattedTime || s.formattedMtime) : s.formattedMtime;
            timePart = timeLabel ? (s.relativeTime ? timeLabel + ' ' + s.relativeTime : timeLabel) : '';
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
`;
}
