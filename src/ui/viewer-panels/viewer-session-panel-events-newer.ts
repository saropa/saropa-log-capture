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
    /* Newer-log banner buttons (Open / Dismiss). Two banner surfaces share this wiring:
       the in-panel banner (#session-newer-banner) and the always-visible log-viewer banner
       (#viewer-newer-banner). Both carry identical action buttons, so one delegated handler
       per element covers them. Event delegation because the banner content is rebuilt from
       scratch by renderNewerLogBanner on every list render.
       Open: open the newest unread log AND acknowledge — opening a single log does not advance
         the dismiss cursor, so without the ack the banner would linger (the reported bug) while
         the other unread rows still flag it. So Open is "open the newest + clear them all".
       Dismiss: acknowledge only — advances LOGS_PANEL_DISMISSED_AT_KEY host-side and re-sends
         the session list with unreadSinceFocus:false across the board. */

    /* Hide BOTH banner surfaces at once. The host round-trip (advance dismiss cursor, re-send
       list) re-renders them hidden anyway, but doing it inline keeps the button from feeling
       dead, and the re-sent list (nothing unread) keeps them hidden so this never flickers back. */
    function hideAllNewerBanners() {
        ['session-newer-banner', 'viewer-newer-banner'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { el.style.display = 'none'; el.innerHTML = ''; }
        });
    }

    function wireNewerBanner(bannerEl) {
        if (!bannerEl) return;
        bannerEl.addEventListener('click', function(e) {
            var btn = e.target.closest('.session-newer-banner-action');
            if (!btn) return;
            var action = btn.getAttribute('data-newer-action') || '';
            if (action === 'open') {
                var uri = btn.getAttribute('data-newer-uri') || '';
                hideAllNewerBanners();
                if (uri) vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: uri });
                vscodeApi.postMessage({ type: 'acknowledgeUnreadLogs' });
            } else if (action === 'dismiss') {
                hideAllNewerBanners();
                vscodeApi.postMessage({ type: 'acknowledgeUnreadLogs' });
            }
            e.stopPropagation();
        });
    }

    wireNewerBanner(document.getElementById('session-newer-banner'));
    wireNewerBanner(document.getElementById('viewer-newer-banner'));
    `;
}
