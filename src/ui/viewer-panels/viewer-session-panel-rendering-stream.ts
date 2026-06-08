/**
 * Streaming list helpers — `renderSessionListPreview` (day-grouped skeleton from the
 * host's cheap stat pass) and `updateSessionBatchItems` (in-place hydration as each
 * file's metadata resolves).
 *
 * Returns a JS fragment intended to run inside the session panel IIFE so it shares
 * `sessionListEl`, `sessionEmptyEl`, `sessionLoadingEl`, `cachedSessions`,
 * `sessionListPage`, `sessionDisplayOptions`, `renderSessionList`, `vt`,
 * `renderSeverityDots`, and `buildSessionMeta`.
 *
 * Why the skeleton is grouped: the previous flat filename-only preview reflowed into a
 * day-grouped list when the final payload arrived — two structurally different lists
 * flashing in sequence. The stat pass now carries mtime (all renderSessionList needs to
 * day-group), so the skeleton paints in the SAME structure as the final list. The only
 * remaining settle is report rows collapsing into the per-day Reports bucket, which needs
 * the header-derived `kind` and so can only happen once bodies are read.
 *
 * See [plans/history/2026.06/2026.06.02/001_plan-newer-alert-and-reports-grouping.md].
 */

export function getSessionStreamingScript(): string {
    return /* javascript */ `
    /** Replace a streaming record in cachedSessions by uriString so a mid-load re-render
     *  (e.g. the user toggles a display option while files are still loading) keeps the
     *  already-hydrated rows instead of reverting them to the skeleton. No-op if the row
     *  isn't in the current list (e.g. a deferred-scan update for a filtered-out file). */
    function mergeStreamingRecord(rec) {
        if (!rec || !rec.uriString || !Array.isArray(cachedSessions)) return;
        for (var i = 0; i < cachedSessions.length; i++) {
            if (cachedSessions[i] && cachedSessions[i].uriString === rec.uriString) {
                cachedSessions[i] = rec;
                return;
            }
        }
    }

    /** Render the day-grouped skeleton from the host's stat pass. Each preview carries
     *  mtime, so renderSessionList day-groups it exactly like the final list — no
     *  flat-to-grouped reflow. Arrives as a single message (the stat pass completes before
     *  any file body is read), so one synchronous grouped render is enough; no debounce. */
    function renderSessionListPreview(previews) {
        if (sessionLoadingEl) sessionLoadingEl.style.display = 'none';
        if (!sessionListEl || !previews || previews.length === 0) return;
        if (sessionEmptyEl) sessionEmptyEl.style.display = 'none';
        /* _preview flags the row as a skeleton so renderItem draws the shimmer meta bar
           until updateSessionBatchItems swaps in real metadata. */
        cachedSessions = previews.map(function(p) {
            return { uriString: p.uriString, filename: p.filename, mtime: p.mtime, _preview: true };
        });
        sessionListPage = 0;
        renderSessionList(cachedSessions);
    }

    /** Hydrate skeleton rows as each file's metadata resolves. Patches the DOM in place
     *  (no full re-render — avoids churn while 8 workers stream updates) and mirrors the
     *  record into cachedSessions so a later re-render stays correct. Also used by the
     *  post-final deferred severity scan to fill in dots. */
    function updateSessionBatchItems(items) {
        if (!sessionListEl || !items) return;
        for (var i = 0; i < items.length; i++) {
            var s = items[i];
            mergeStreamingRecord(s);
            var el = sessionListEl.querySelector('.session-item[data-uri="' + CSS.escape(s.uriString || '') + '"]');
            if (el) patchSessionRow(el, s);
        }
    }

    /** Patch a rendered row's icon + meta in place with resolved metadata. */
    function patchSessionRow(el, s) {
        var icon = s.isActive ? 'codicon-record' : (s.hasTimestamps ? 'codicon-history' : 'codicon-output');
        var iconTitle = s.isActive ? vt('viewer.session.icon.recording') : (s.hasTimestamps ? vt('viewer.session.icon.completed') : vt('viewer.session.icon.logFile'));
        var iconEl = el.querySelector('.session-item-icon');
        if (iconEl) {
            var dot = !s.isActive && (s.updatedInLastMinute || s.updatedSinceViewed)
                ? '<span class="session-item-update-dot" title="' + (s.updatedInLastMinute ? vt('viewer.session.dot.updatedMin') : vt('viewer.session.dot.updatedSince')) + '"></span>' : '';
            /* Per-row unread dot mirrors renderItem's gating so streaming hydration matches a
               full re-render — without this, preview to full would briefly drop the blue dot
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
    `;
}
