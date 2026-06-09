/**
 * Session panel rendering functions (list, items, day headings, metadata).
 * Returns a JS fragment intended to run inside the session panel IIFE scope.
 * Includes pagination: only the current page of sessions is rendered; bar shows "Showing X–Y of Z" and Prev/Next when total > pageSize.
 */
import { getSessionGroupRenderingScript } from './viewer-session-panel-rendering-groups';
import { getControllerGroupingScript } from './viewer-session-panel-controllers';
import { getNewerLogBannerScript } from './viewer-session-panel-reports-bucket';
import { getSessionStreamingScript } from './viewer-session-panel-rendering-stream';

/** Get the session panel rendering script fragment. */
export function getSessionRenderingScript(): string {
    return getSessionGroupRenderingScript() + getControllerGroupingScript() + getNewerLogBannerScript() + getSessionStreamingScript() + /* javascript */ `
    /* escapeAttr and escapeHtmlText are provided by the session panel IIFE bootstrap. */
    function renderSessionList(sessions) {
        if (sessionLoadingEl) sessionLoadingEl.style.display = 'none';
        if (!sessionListEl) return;
        /* No badge on the Logs icon: the count plateaus at "99+" for any project with history,
           so the badge stops being information and becomes permanent visual noise. The actual
           total is visible inside the panel header when opened. */
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
        /* "Latest only" no longer drops older rows here — that hid them with no trace. The day
           grouping keeps the latest row visible and folds older namesakes behind a clickable
           "+N older" badge (see visibleUnits / renderOlderBadge). markLatestByName above stamped
           isLatestOfName / _olderCount that those use. */
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
            sessionListEl.innerHTML = '<div class="session-empty-filtered">' + vt('viewer.session.noMatch') + '</div>';
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
        /* Newer-log banner: flips visibility based on unreadSinceFocus on any rendered row.
           Called against the SORTED list (post-filter, post-page) so the banner only fires
           when an unread log is actually visible — hiding it would surprise the user. Plan: 001. */
        if (typeof renderNewerLogBanner === 'function') renderNewerLogBanner(sorted);
        renderNameFilterBar();
        /* Pagination: show bar only when multiple pages; render "Showing X–Y of Z" and Prev/Next. */
        if (sessionListPaginationEl) {
            if (totalPages <= 1) {
                sessionListPaginationEl.style.display = 'none';
            } else {
                sessionListPaginationEl.style.display = '';
                var from = start + 1, to = Math.min(start + pageSize, total);
                var label = vt('viewer.session.pagination.showing', from, to, total);
                sessionListPaginationEl.innerHTML = '<span class="session-list-pagination-label">' + escapeHtmlText(label) + '</span>'
                    + '<button type="button" id="session-pagination-prev" class="session-list-pagination-btn" title="' + vt('viewer.session.pagination.prev') + '" ' + (sessionListPage <= 0 ? ' disabled' : '') + '><span class="codicon codicon-chevron-left"></span></button>'
                    + '<button type="button" id="session-pagination-next" class="session-list-pagination-btn" title="' + vt('viewer.session.pagination.next') + '" ' + (sessionListPage >= totalPages - 1 ? ' disabled' : '') + '><span class="codicon codicon-chevron-right"></span></button>';
            }
        }
        /* One-shot scroll on panel open — see scrollSessionListToCurrentOrTop for rationale. */
        if (pendingScrollOnOpen) { pendingScrollOnOpen = false; scrollSessionListToCurrentOrTop(); }
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
        var verb = sessionNameFilter.mode === 'only' ? vt('viewer.session.nameFilter.only', nfLabel) : vt('viewer.session.nameFilter.hiding', nfLabel);
        nameFilterBarEl.innerHTML = '<span class="session-name-filter-label">'
            + '<span class="codicon codicon-filter"></span> '
            + escapeHtmlText(verb)
            + '</span>'
            + '<button type="button" id="session-name-filter-clear" class="session-name-filter-clear" title="' + vt('viewer.session.nameFilter.clear.title') + '" aria-label="' + vt('viewer.session.nameFilter.clear.title') + '">'
            + '<span class="codicon codicon-close"></span> ' + vt('viewer.session.nameFilter.showAll') + '</button>';
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

    /* Flat (day-headings-off) view still groups by controller and honors Latest-only collapse —
       renderControllerList treats the whole list as one pseudo-day for the nearest-earlier attach. */
    function renderFlat(sessions, bnCounts) { return renderControllerList(sessions, bnCounts); }

    function renderGrouped(sessions, bnCounts) {
        var groups = [], currentKey = '', dayRecords = [];
        for (var i = 0; i < sessions.length; i++) {
            var key = toDateKey(sessions[i].mtime || 0);
            if (key !== currentKey) {
                /* Flush previous day group. */
                if (currentKey) groups.push(renderDayGroup(currentKey, dayRecords, bnCounts));
                currentKey = key;
                dayRecords = [];
            }
            dayRecords.push(sessions[i]);
        }
        /* Flush final day group. */
        if (currentKey) groups.push(renderDayGroup(currentKey, dayRecords, bnCounts));
        return groups.join('');
    }

    /* renderDayGroup is now provided by getReportsBucketAndBannerScript() — that version
       partitions each day's records into project rows + a per-day Reports bucket. The old
       local implementation was removed because function declarations hoist and the later
       declaration would win, silently undoing the Reports-bucket split. Plan: 001. */

    function renderItem(s, bnCounts) {
        var icon = s.isActive ? 'codicon-record' : (s.hasTimestamps ? 'codicon-history' : 'codicon-output');
        var iconTitle = s.isActive ? vt('viewer.session.icon.recording') : (s.hasTimestamps ? vt('viewer.session.icon.completed') : vt('viewer.session.icon.logFile'));
        if (s.updatedInLastMinute) iconTitle = vt('viewer.session.icon.updatedMin');
        else if (s.updatedSinceViewed) iconTitle = vt('viewer.session.icon.updatedSince');
        /* selectedSessionUris is defined in session panel IIFE; multi-select state for Ctrl-click. Update dots only for non-active logs. */
        var groupRole = s._groupRole || '';
        var groupClass = groupRole === 'primary' ? ' session-item-primary'
            : groupRole === 'secondary' ? ' session-item-secondary'
            : groupRole === 'controller' ? ' session-item-controller' : '';
        var cls = 'session-item' + groupClass + (s.isActive ? ' session-item-active' : '') + (!s.isActive && s.updatedInLastMinute ? ' session-item-updated-recent' : '') + (!s.isActive && s.updatedSinceViewed && !s.updatedInLastMinute ? ' session-item-updated-since-viewed' : '') + (typeof selectedSessionUris !== 'undefined' && selectedSessionUris[s.uriString] ? ' session-item-selected' : '');
        var rawName = s.displayName || s.filename;
        var bn = getSessionBasename(rawName);
        /* Only show subfolder when basenames collide for disambiguation. */
        var displayInput = (bnCounts && bnCounts[bn] > 1) ? rawName : bn;
        var fileTime = sessionDisplayOptions.normalizeNames ? extractFilenameTime(bn) : null;
        var name = applySessionDisplayOptions(displayInput);
        var dots = renderSeverityDots(s);
        var meta = buildSessionMeta(s, dots, fileTime);
        var perfBadge = s.hasPerformanceData ? '<span class="session-item-perf" title="' + vt('viewer.session.perfAvailable') + '"><span class="codicon codicon-graph-line"></span></span>' : '';
        /* Dot: red = updated in last minute, orange = new since last viewed; only for non-active logs. */
        var updateDot = !s.isActive && (s.updatedInLastMinute || s.updatedSinceViewed) ? '<span class="session-item-update-dot" title="' + (s.updatedInLastMinute ? vt('viewer.session.dot.updatedMin') : vt('viewer.session.dot.updatedSince')) + '"></span>' : '';
        /* Per-row unread dot (blue). Gated so it never doubles up with the red/orange update
           dot above — those signals already convey "this row changed recently"; the unread
           dot is for logs the user has never seen since their last panel focus. The
           newerLogDotEnabled setting lets users turn off this cue entirely. Plan: 001. */
        var unreadDot = '';
        if (s.unreadSinceFocus && !s.isActive && !s.updatedInLastMinute && !s.updatedSinceViewed
            && sessionDisplayOptions.newerLogDotEnabled !== false) {
            unreadDot = '<span class="session-item-unread-dot" title="' + vt('viewer.session.dot.unread') + '"></span>';
        }
        /* Group primary: leading chevron (flips on collapse) and a "+N" badge after the name. */
        var groupChevron = '', groupCount = '';
        if (groupRole === 'primary') {
            var chev = s._groupCollapsed ? 'codicon-chevron-right' : 'codicon-chevron-down';
            var chevTitle = s._groupCollapsed ? vt('viewer.session.group.expand') : vt('viewer.session.group.collapse');
            groupChevron = '<span class="session-group-chevron" role="button" tabindex="0" title="' + chevTitle + '" aria-label="' + chevTitle + '"><span class="codicon ' + chev + '"></span></span>';
            var secCount = Math.max(0, (s.groupSize || 1) - 1);
            if (secCount > 0) groupCount = ' <span class="session-group-count">+' + secCount + '</span>';
        } else if (groupRole === 'controller') {
            /* Controller row: distinct chevron class (.session-controller-chevron) + collapse map so
               its closest() target never collides with a peripheral that is itself a real
               session-group nested in the children container. The "+N" badge counts attached
               peripherals (children), not session-group siblings. */
            var cChev = s._ctrlCollapsed ? 'codicon-chevron-right' : 'codicon-chevron-down';
            var cTitle = s._ctrlCollapsed ? vt('viewer.session.group.expand') : vt('viewer.session.group.collapse');
            groupChevron = '<span class="session-controller-chevron" role="button" tabindex="0" title="' + cTitle + '" aria-label="' + cTitle + '"><span class="codicon ' + cChev + '"></span></span>';
            var childCount = Math.max(0, s._ctrlChildCount || 0);
            if (childCount > 0) groupCount = ' <span class="session-group-count">+' + childCount + '</span>';
        }
        /* "+N older" badge (Latest-only mode): keeps hidden older namesakes discoverable. */
        var olderBadge = (typeof renderOlderBadge === 'function') ? renderOlderBadge(s) : '';
        return '<div class="' + cls + '" data-uri="' + escapeAttr(s.uriString || '') + '" data-filename="' + escapeAttr(s.filename || '') + '">'
            + groupChevron
            + '<span class="session-item-icon" title="' + iconTitle + '"><span class="codicon ' + icon + '"></span>' + updateDot + unreadDot + '</span>'
            + '<div class="session-item-info">'
            /* "(latest)" badge only appears when more than one session shares
               this normalised basename. For a single entry it would be visual
               noise — though isLatestOfName itself stays set on the lone entry
               so the "Latest only" filter keeps it (a singleton IS, trivially,
               the latest of its name). */
            + '<span class="session-item-name">' + escapeHtmlText(name) + ((s.isLatestOfName && s.hasNamesakes) ? ' <span class="session-latest">' + vt('viewer.session.latest') + '</span>' : '') + groupCount + olderBadge + perfBadge + '</span>'
            /* Skeleton rows (mtime-only, from the stat pass) carry _preview until their
               metadata loads — render the shimmer bar so the grouped structure is visible
               immediately while bodies are still being read. updateSessionBatchItems swaps
               in the real meta in place once each file resolves. */
            + (s._preview
                ? '<span class="session-item-meta session-shimmer-meta"></span>'
                : (meta ? '<span class="session-item-meta">' + meta + '</span>' : ''))
            + '</div>'
            + renderSessionRowActions()
            + '</div>';
    }

    /* Hover-revealed action buttons on a session row. Currently: reveal the log file
       in the OS file explorer. Uses data-session-action so the parent click handler
       can dispatch without duplicating logic from the context menu. */
    function renderSessionRowActions() {
        var label = typeof getRevealInOSLabel === 'function' ? getRevealInOSLabel() : vt('viewer.session.revealInOS');
        var labelAttr = escapeAttr(label);
        return '<span class="session-item-actions">'
            + '<button type="button" class="session-item-action" data-session-action="revealInOS" '
            + 'title="' + labelAttr + '" aria-label="' + labelAttr + '">'
            + '<span class="codicon codicon-folder-opened"></span></button>'
            + '</span>';
    }

    function renderDayHeading(dateKey, collapsed, count) {
        var chevron = collapsed ? 'codicon-chevron-right' : 'codicon-chevron-down';
        /* Show file count dimmed in parentheses after the date label. */
        var countText = typeof count === 'number' && count > 0
            ? ' <span class="session-day-count">(' + count + ')</span>' : '';
        return '<div class="session-day-heading" role="button" tabindex="0" aria-expanded="' + (!collapsed) + '">'
            + '<span class="session-day-chevron codicon ' + chevron + '"></span>'
            + escapeHtmlText(formatDayHeading(dateKeyToEpoch(dateKey)))
            + countText
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

    /* renderSessionListPreview and updateSessionBatchItems are now provided by
       getSessionStreamingScript() — see viewer-session-panel-rendering-stream.ts. They live
       in a sibling fragment so this file stays under the 300-line code limit while the
       Reports-bucket + newer-log additions landed inline. */
`;
}
