/**
 * Webview-side script for the newer-log sticky banner. Inlined into the same IIFE as
 * viewer-session-panel so it shares the IIFE's `sessionDisplayOptions`, `vt`, `escapeAttr`,
 * `escapeHtmlText`, and helpers like `applySessionDisplayOptions` / `getSessionBasename`.
 *
 * The per-day Reports bucket that used to live here was superseded by the Controller-rooted
 * tree (viewer-session-panel-controllers.ts) — reports now nest under their Controller as
 * peripherals instead of in a separate bucket. See
 * [plans/history/2026.06/2026.06.09/controller-rooted-session-tree.md].
 */

export function getNewerLogBannerScript(): string {
    return /* javascript */ `
    /** Apply banner state to every newer-log surface at once. Two elements share the
     *  markup: the in-panel banner (#session-newer-banner) and the always-visible
     *  log-viewer banner (#viewer-newer-banner) — so the user sees the alert without
     *  opening the Logs panel. An empty html string + visible=false hides the surface. */
    function applyNewerBanner(html, visible) {
        ['session-newer-banner', 'viewer-newer-banner'].forEach(function(id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = html;
            el.style.display = visible ? '' : 'none';
        });
    }

    /** Newer-log sticky banner. Shown when ANY rendered record has unreadSinceFocus:true.
     *  The banner offers two actions: Open (opens the newest unread log and clears all) and
     *  Dismiss (advances LOGS_PANEL_DISMISSED_AT_KEY host-side so unreadSinceFocus flips off).
     *  Rendered into both the panel and the log-viewer surfaces via applyNewerBanner. */
    function renderNewerLogBanner(sorted) {
        if (!sessionDisplayOptions || sessionDisplayOptions.newerLogBannerEnabled === false) {
            applyNewerBanner('', false);
            return;
        }
        var unread = (sorted || []).filter(function(s) { return !!(s && s.unreadSinceFocus); });
        if (unread.length === 0) {
            applyNewerBanner('', false);
            return;
        }
        /* Newest unread = highest mtime among the unread set. Used by both the
           visible label and the Open button's target URI. */
        var newest = unread[0];
        for (var i = 1; i < unread.length; i++) {
            if ((unread[i].mtime || 0) > (newest.mtime || 0)) newest = unread[i];
        }
        var nameRaw = newest.displayName || newest.filename || '';
        var nameDisplay = applySessionDisplayOptions(getSessionBasename(nameRaw));
        var when = newest.relativeTime || newest.formattedTime || newest.formattedMtime || '';
        var text = (unread.length === 1)
            ? (typeof vt === 'function' ? vt('viewer.session.newerBanner.singular', nameDisplay, when) : ('New log · ' + nameDisplay + ' · ' + when))
            : (typeof vt === 'function' ? vt('viewer.session.newerBanner.plural', nameDisplay, when, unread.length - 1) : ('New logs · ' + nameDisplay + ' · ' + when + ' (+' + (unread.length - 1) + ' more)'));
        var openLabel = typeof vt === 'function' ? vt('viewer.session.newerBanner.open') : 'Open';
        var dismissLabel = typeof vt === 'function' ? vt('viewer.session.newerBanner.dismiss') : 'Dismiss';
        var html = '<span class="session-newer-banner-icon codicon codicon-bell"></span>'
            + '<span class="session-newer-banner-text">' + escapeHtmlText(text) + '</span>'
            + '<span class="session-newer-banner-actions">'
            +   '<button type="button" class="session-newer-banner-action primary" data-newer-action="open" data-newer-uri="' + escapeAttr(newest.uriString || '') + '">' + escapeHtmlText(openLabel) + '</button>'
            +   '<button type="button" class="session-newer-banner-action" data-newer-action="dismiss">' + escapeHtmlText(dismissLabel) + '</button>'
            + '</span>';
        applyNewerBanner(html, true);
    }
    `;
}
