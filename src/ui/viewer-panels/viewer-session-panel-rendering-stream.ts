/**
 * Streaming list-preview helpers — `renderSessionListPreview` (filename-only
 * shimmer rows during directory scan) and `updateSessionBatchItems` (in-place
 * hydration as metadata resolves per-file).
 *
 * Returns a JS fragment intended to run inside the session panel IIFE so it
 * shares `sessionListEl`, `sessionLoadingEl`, `sessionEmptyEl`,
 * `sessionListPaginationEl`, `sessionDisplayOptions`, `vt`, `escapeAttr`,
 * `escapeHtmlText`, `getSessionBasename`, `applySessionDisplayOptions`,
 * `renderSessionRowActions`, `renderSeverityDots`, and `buildSessionMeta`.
 *
 * Extracted from viewer-session-panel-rendering.ts to keep that file under
 * the 300-line limit while the Reports-bucket + newer-log work landed inline.
 * See [plans/history/2026.06/2026.06.02/001_plan-newer-alert-and-reports-grouping.md].
 */

export function getSessionStreamingScript(): string {
    return /* javascript */ `
    /** Render a lightweight preview list (filenames only, shimmer on metadata).
     *  Called once per directory level during streaming scan — appends to existing
     *  items so the first filenames appear immediately while subdirectories
     *  continue loading. */
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
                + '<span class="session-item-icon" title="' + vt('viewer.session.icon.logFile') + '"><span class="codicon codicon-output"></span></span>'
                + '<div class="session-item-info">'
                + '<span class="session-item-name">' + escapeHtmlText(name) + '</span>'
                + '<span class="session-item-meta session-shimmer-meta"></span>'
                + '</div>'
                + renderSessionRowActions()
                + '</div>';
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
            var iconTitle = s.isActive ? vt('viewer.session.icon.recording') : (s.hasTimestamps ? vt('viewer.session.icon.completed') : vt('viewer.session.icon.logFile'));
            var iconEl = el.querySelector('.session-item-icon');
            if (iconEl) {
                var dot = !s.isActive && (s.updatedInLastMinute || s.updatedSinceViewed)
                    ? '<span class="session-item-update-dot" title="' + (s.updatedInLastMinute ? vt('viewer.session.dot.updatedMin') : vt('viewer.session.dot.updatedSince')) + '"></span>' : '';
                /* Per-row unread dot mirrors renderItem's gating so streaming hydration matches a
                   full re-render — without this, preview→full would briefly drop the blue dot
                   until the host re-sent the sessionList. */
                var batchUnread = '';
                if (s.unreadSinceFocus && !s.isActive && !s.updatedInLastMinute && !s.updatedSinceViewed
                    && sessionDisplayOptions.newerLogDotEnabled !== false) {
                    batchUnread = '<span class="session-item-unread-dot" title="' + vt('viewer.session.dot.unread') + '"></span>';
                }
                iconEl.innerHTML = '<span class="codicon ' + icon + '"></span>' + dot + batchUnread;
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
