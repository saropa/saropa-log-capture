/**
 * Event handlers for the newer-log banner. Returns a JS fragment intended to run inside the
 * session panel IIFE so it shares the IIFE's `vscodeApi`. (The per-day Reports-bucket click
 * handler that used to live here was removed with the bucket itself — reports now nest under
 * their Controller as peripherals; see viewer-session-panel-controllers.ts.)
 *
 * Extracted from viewer-session-panel-events.ts to keep that file under the
 * 300-line limit.
 */

export function getNewerLogEventsScript(): string {
    return /* javascript */ `
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
                /* Hide the banner immediately for instant feedback — the host round-trip
                   (advance dismiss cursor, re-send list) clears unreadSinceFocus on every
                   row, but waiting for it makes the button feel dead. The re-sent list keeps
                   the banner hidden because nothing is unread anymore, so this never flickers
                   back. */
                newerBannerEl.style.display = 'none';
                newerBannerEl.innerHTML = '';
                vscodeApi.postMessage({ type: 'acknowledgeUnreadLogs' });
            }
            e.stopPropagation();
        });
    }
    `;
}
