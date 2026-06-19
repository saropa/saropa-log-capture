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
    /* Newer-log banner buttons (Open / Dismiss) on the log-viewer surface (#viewer-newer-banner).
       Event delegation because the banner content is rebuilt from scratch by renderNewerLogBanner
       on every list render.
       Open: open the newest unread log AND acknowledge — opening a single log does not advance
         the dismiss cursor, so without the ack the banner would linger (the reported bug) while
         the other unread rows still flag it. So Open is "open the newest + clear them all".
       Dismiss: acknowledge only — advances LOGS_PANEL_DISMISSED_AT_KEY host-side and re-sends
         the session list with unreadSinceFocus:false across the board. */

    /* Hide the banner immediately. The host round-trip (advance dismiss cursor, re-send list)
       re-renders it hidden anyway, but doing it inline keeps the button from feeling dead, and
       the re-sent list (nothing unread) keeps it hidden so this never flickers back. */
    function hideNewerBanner() {
        var el = document.getElementById('viewer-newer-banner');
        if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    }

    var newerBannerEl = document.getElementById('viewer-newer-banner');
    if (newerBannerEl) {
        newerBannerEl.addEventListener('click', function(e) {
            var btn = e.target.closest('.session-newer-banner-action');
            if (!btn) return;
            var action = btn.getAttribute('data-newer-action') || '';
            if (action === 'open') {
                var uri = btn.getAttribute('data-newer-uri') || '';
                hideNewerBanner();
                if (uri) vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: uri });
                vscodeApi.postMessage({ type: 'acknowledgeUnreadLogs' });
            } else if (action === 'dismiss') {
                hideNewerBanner();
                vscodeApi.postMessage({ type: 'acknowledgeUnreadLogs' });
            }
            e.stopPropagation();
        });
    }
    `;
}
