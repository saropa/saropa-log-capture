/**
 * Session panel rendering functions (list, items, day headings, metadata).
 * Returns a JS fragment intended to run inside the session panel IIFE scope.
 * Includes pagination: only the current page of sessions is rendered; bar shows "Showing X–Y of Z" and Prev/Next when total > pageSize.
 */

/** Get the session panel rendering script fragment. */
export function getSessionRenderingScript(): string {
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
        /* Date range filter: keep sessions with mtime >= (now - range). */
        var range = sessionDisplayOptions.dateRange || 'all';
        if (range !== 'all') {
            var h = 60 * 60 * 1000, d = 24 * h;
            var rangeMs = { '1h': h, '4h': 4*h, '8h': 8*h, '1d': d, '7d': 7*d, '30d': 30*d, '3m': 91*d, '6m': 182*d, '1y': 365*d };
            var cutoff = Date.now() - (rangeMs[range] || 0);
            active = active.filter(function(s) { return (s.mtime || 0) >= cutoff; });
        }
        /* Name filter: hide or show-only sessions matching a canonical name.
           Recompute the canonical target from rawBasename each render so the filter
           adapts when the user toggles stripDatetime or normalizeNames. */
        if (sessionNameFilter) {
            var nfMode = sessionNameFilter.mode;
            var nfTarget = applySessionDisplayOptions(sessionNameFilter.rawBasename);
            active = active.filter(function(s) {
                var cn = applySessionDisplayOptions(getSessionRawBasename(s));
                return nfMode === 'only' ? cn === nfTarget : cn !== nfTarget;
            });
        }
        /* When all filters produce zero results, show a hint instead of a blank list. */
        if (active.length === 0) {
            sessionListEl.innerHTML = '<div class="session-empty-filtered">No sessions match the current filters</div>';
            if (sessionListPaginationEl) sessionListPaginationEl.style.display = 'none';
            renderNameFilterBar();
            return;
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
        renderNameFilterBar();
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

    /** Update the name filter bar: show label + clear button when active, hide when not. */
    function renderNameFilterBar() {
        var nameFilterBarEl = document.getElementById('session-name-filter-bar');
        if (!nameFilterBarEl) return;
        if (!sessionNameFilter) {
            nameFilterBarEl.style.display = 'none';
            nameFilterBarEl.innerHTML = '';
            return;
        }
        /* Display label uses current display-option transforms so it matches
           what the user sees in the list (adapts when Dates/Tidy change). */
        var nfLabel = applySessionDisplayOptions(sessionNameFilter.rawBasename);
        var verb = sessionNameFilter.mode === 'only' ? 'Showing only' : 'Hiding';
        nameFilterBarEl.innerHTML = '<span class="session-name-filter-label">'
            + '<span class="codicon codicon-filter"></span> '
            + escapeHtmlText(verb + ': ' + nfLabel)
            + '</span>'
            + '<button type="button" id="session-name-filter-clear" class="session-name-filter-clear" title="Clear name filter" aria-label="Clear name filter">'
            + '<span class="codicon codicon-close"></span> Show All</button>';
        nameFilterBarEl.style.display = '';
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
        var groups = [], currentKey = '', dayItems = [];
        for (var i = 0; i < sessions.length; i++) {
            var key = toDateKey(sessions[i].mtime || 0);
            if (key !== currentKey) {
                /* Flush previous day group. */
                if (currentKey) groups.push(renderDayGroup(currentKey, dayItems));
                currentKey = key;
                dayItems = [];
            }
            dayItems.push(renderItem(sessions[i], bnCounts));
        }
        /* Flush final day group. */
        if (currentKey) groups.push(renderDayGroup(currentKey, dayItems));
        return groups.join('');
    }

    /** Wrap a day heading and its items in a collapsible group container. */
    function renderDayGroup(dateKey, itemsHtml) {
        var collapsed = !!collapsedDays[dateKey];
        var cls = 'session-day-group' + (collapsed ? ' collapsed' : '');
        return '<div class="' + cls + '" data-day-key="' + escapeAttr(dateKey) + '">'
            + renderDayHeading(dateKey, collapsed)
            + '<div class="session-day-items">' + itemsHtml.join('') + '</div>'
            + '</div>';
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

    function renderDayHeading(dateKey, collapsed) {
        var chevron = collapsed ? 'codicon-chevron-right' : 'codicon-chevron-down';
        return '<div class="session-day-heading" role="button" tabindex="0" aria-expanded="' + (!collapsed) + '">'
            + '<span class="session-day-chevron codicon ' + chevron + '"></span>'
            + escapeHtmlText(formatDayHeading(dateKeyToEpoch(dateKey)))
            + '</div>';
    }

    /** Convert a YYYY-MM-DD date key back to epoch ms (noon local time). */
    function dateKeyToEpoch(key) {
        var parts = key.split('-');
        return new Date(+parts[0], +parts[1] - 1, +parts[2], 12).getTime();
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

    /**
     * Render a lightweight preview list (filenames only, shimmer on metadata).
     * Called once per directory level during streaming scan — appends to existing
     * items so the first filenames appear immediately while subdirectories continue loading.
     */
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
        /* Append instead of replace — multiple batches arrive as directories are scanned. */
        sessionListEl.insertAdjacentHTML('beforeend', html);
    }

    /** Update preview items in-place with resolved metadata (progressive loading). */
    function updateSessionBatchItems(items) {
        if (!sessionListEl || !items) return;
        for (var i = 0; i < items.length; i++) {
            var s = items[i];
            var el = sessionListEl.querySelector('.session-item[data-uri="' + CSS.escape(s.uriString || '') + '"]');
            if (!el) continue;
            var icon = s.isActive ? 'codicon-record' : (s.hasTimestamps ? 'codicon-history' : 'codicon-output');
            var iconTitle = s.isActive ? 'Actively recording' : (s.hasTimestamps ? 'Completed session' : 'Log file');
            var iconEl = el.querySelector('.session-item-icon');
            if (iconEl) {
                var dot = !s.isActive && (s.updatedInLastMinute || s.updatedSinceViewed)
                    ? '<span class="session-item-update-dot" title="' + (s.updatedInLastMinute ? 'Updated in the last minute' : 'New lines since last viewed') + '"></span>' : '';
                iconEl.innerHTML = '<span class="codicon ' + icon + '"></span>' + dot;
                iconEl.title = iconTitle;
            }
            var metaEl = el.querySelector('.session-item-meta');
            if (metaEl) {
                metaEl.classList.remove('session-shimmer-meta');
                var dots = renderSeverityDots(s);
                metaEl.innerHTML = buildSessionMeta(s, dots, null);
            }
        }
    }
`;
}
