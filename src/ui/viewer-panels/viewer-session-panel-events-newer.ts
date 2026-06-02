/**
 * Event handlers for the Reports bucket and newer-log banner. Returns a JS
 * fragment intended to run inside the session panel IIFE so it shares the
 * IIFE's `sessionListEl`, `sessionDisplayOptions`, `expandedReportBuckets`,
 * `cachedSessions`, `renderSessionList`, and `vscodeApi`.
 *
 * Extracted from viewer-session-panel-events.ts to keep that file under the
 * 300-line limit. See [plans/history/2026.06/2026.06.02/001_plan-newer-alert-and-reports-grouping.md].
 */

export function getNewerLogEventsScript(): string {
    return /* javascript */ `
    /* Reports bucket heading click: toggle the per-day expansion override. The override
       wins over sessionDisplayOptions.reportsBucketState — same pattern as collapsedDays
       for day headings. Capture phase so the click resolves before the day-heading
       handler that also lives on sessionListEl. */
    if (sessionListEl) {
        sessionListEl.addEventListener('click', function(e) {
            var bucketHead = e.target.closest('.session-reports-bucket-heading');
            if (!bucketHead) return;
            var bucket = bucketHead.closest('.session-reports-bucket');
            if (!bucket) return;
            var bdk = bucket.getAttribute('data-bucket-day');
            if (!bdk) return;
            e.preventDefault();
            e.stopPropagation();
            expandedReportBuckets[bdk] = !expandedReportBuckets[bdk];
            if (!expandedReportBuckets[bdk]) delete expandedReportBuckets[bdk];
            var optsCopy = {};
            for (var ck in sessionDisplayOptions) optsCopy[ck] = sessionDisplayOptions[ck];
            optsCopy.expandedReportBuckets = expandedReportBuckets;
            sessionDisplayOptions = optsCopy;
            vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
            /* Full re-render so per-row classes (bucket expanded/collapsed) update —
               a DOM-only toggle would leave a stale chevron + aria-expanded on the heading. */
            if (cachedSessions) renderSessionList(cachedSessions);
        }, true);
    }

    /* Newer-log banner buttons (Open / Dismiss). Event delegation because the banner content
       is rebuilt from scratch by renderNewerLogBanner on every list render.
       Open: post openSessionFromPanel with the data-newer-uri attribute; the host loads
         the file and updateLastViewed fires through the existing open path, so this row
         clears updatedSinceViewed naturally — no separate ack is needed for Open.
       Dismiss: post acknowledgeUnreadLogs; the host advances LOGS_PANEL_DISMISSED_AT_KEY
         and re-sends the session list with unreadSinceFocus:false across the board. */
    var newerBannerEl = document.getElementById('session-newer-banner');
    if (newerBannerEl) {
        newerBannerEl.addEventListener('click', function(e) {
            var btn = e.target.closest('.session-newer-banner-action');
            if (!btn) return;
            var action = btn.getAttribute('data-newer-action') || '';
            if (action === 'open') {
                var uri = btn.getAttribute('data-newer-uri') || '';
                if (uri) vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: uri });
            } else if (action === 'dismiss') {
                vscodeApi.postMessage({ type: 'acknowledgeUnreadLogs' });
            }
            e.stopPropagation();
        });
    }
    `;
}
