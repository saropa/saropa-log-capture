/**
 * Unified log status bar (plan 109 — bugs/109_plan-unified-log-banner.md).
 *
 * One inline, non-modal surface (#viewer-newer-banner, in viewer-content-body.ts) with two modes:
 *
 *  - STATUS (the resting state): a persistent bar shown for as long as a log is open. Carries the
 *    open log's name + lifespan ("Started <ago> · ran <dur>"), the session context/metadata line
 *    (#session-details-inline, filled by viewer-session-header.ts — it lived in the toolbar until
 *    the bar became permanent), and the file actions Open in Editor · Copy Full Path · a kebab for
 *    the rest. Only the × collapses it; every other click leaves it up. Re-opened by clicking the
 *    toolbar filename or the staleness chip.
 *  - AUTO: temporarily replaces the status content when the host reports the open log is behind a
 *    newer main-project (controller) log. Shows "Newer · <name> · <ago>" with Open (loads that
 *    newer log) / Dismiss. Auto-surfacing must never steal focus or block input — hence inline,
 *    not a modal/popover. Dismissing an AUTO alert returns to STATUS, it does not blank the bar.
 *
 * Bar chrome (icon, text, details, action slot, kebab menu) is built ONCE and then mutated in
 * place. Rebuilding it via innerHTML would destroy #session-details-inline, whose content arrives
 * on a separate host message (sessionInfo) that never replays.
 *
 * Runs at top-level webview scope (NOT the session-panel IIFE) so the logContextInfo message
 * handler and the filename/staleness click handlers can all reach it. Uses window._vscodeApi and
 * the global `vt` (l10n) + `formatDuration` (defined in viewer-run-nav.ts, same concatenated scope).
 */

/** Overflow (kebab) actions: [data-banner-action, outbound message type, l10n key]. */
const KEBAB_ACTIONS: ReadonlyArray<readonly [string, string, string]> = [
    ["copy-name", "copyCurrentFileName", "viewer.logFile.copyFilename"],
    ["copy-rel", "copyCurrentFileRelativePath", "viewer.logFile.copyRelativePath"],
    ["open-beside", "openLogFileBeside", "viewer.logFile.openBeside"],
    ["open-folder", "openCurrentFileFolder", "viewer.logFile.openFolder"],
    ["reveal-explorer", "revealLogFileInExplorer", "viewer.logFile.revealInExplorer"],
    ["open-terminal", "openLogFileFolderInTerminal", "viewer.logFile.openInTerminal"],
];

export function getLogBannerScript(): string {
    return /* javascript */ `
(function initLogBanner() {
    var banner = document.getElementById('viewer-newer-banner');
    var vscodeApi = window._vscodeApi;
    if (!banner || !vscodeApi) { return; }
    var KEBAB = ${JSON.stringify(KEBAB_ACTIONS)};
    var bannerMode = '';            // '' (never shown) | 'status' | 'auto'
    var collapsed = false;          // true once the user hits × — host refreshes must not re-open it
    var ctx = { currentUri: '', startedMs: 0, durationMs: 0, stale: false, newerCount: 0, autoShow: false, latestUri: '', latestName: '', latestMtime: 0 };

    function tr(key, a, b) { return (typeof vt === 'function') ? vt(key, a, b) : key; }

    /* Relative "N min ago" without the parens formatRelativeTime adds (host sends epoch ms so the
       webview controls phrasing). Empty for unknown (0) or >24h timestamps. */
    function formatAgo(ms) {
        if (!ms) { return ''; }
        var diff = Date.now() - ms;
        if (diff < 0 || diff >= 86400000) { return ''; }
        var mins = Math.floor(diff / 60000);
        if (mins < 1) { return tr('viewer.logBanner.justNow'); }
        if (mins < 60) { return tr('viewer.logBanner.minAgo', mins); }
        var hrs = Math.floor(mins / 60);
        return hrs === 1 ? tr('viewer.logBanner.hrAgo') : tr('viewer.logBanner.hrsAgo', hrs);
    }

    /* Every action button carries a leading codicon: the bar is dense and mixed-purpose, so a glyph
       is what makes "open" vs "copy" separable at a glance. Icon-only buttons pass an empty label. */
    function makeButton(action, label, icon, primary) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'session-newer-banner-action' + (primary ? ' primary' : '');
        b.setAttribute('data-banner-action', action);
        if (icon) { b.innerHTML = '<span class="codicon codicon-' + icon + '" aria-hidden="true"></span>'; }
        if (label) { b.appendChild(document.createTextNode(label)); }
        return b;
    }

    /* Kebab overflow: a hidden menu of the less-important file actions, toggled by the ⋮ button.
       Each item posts its existing message type for the OPEN file (host uses currentFileUri). */
    function buildKebabMenu() {
        var menu = document.createElement('div');
        menu.className = 'log-banner-kebab-menu';
        menu.setAttribute('hidden', '');
        for (var i = 0; i < KEBAB.length; i++) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'log-banner-kebab-item';
            item.setAttribute('data-banner-msg', KEBAB[i][1]);
            item.textContent = tr(KEBAB[i][2]);
            menu.appendChild(item);
        }
        return menu;
    }

    /* Persistent chrome. #session-details-inline is created here (not in the toolbar HTML) but keeps
       its id so viewer-session-header.ts:applySessionInfo keeps finding it by getElementById. */
    var iconEl = document.createElement('span');
    var textEl = document.createElement('span');
    textEl.className = 'session-newer-banner-text';
    var detailsEl = document.createElement('span');
    detailsEl.id = 'session-details-inline';
    detailsEl.className = 'session-details-inline';
    detailsEl.setAttribute('aria-label', tr('viewer.toolbar.sessionDetails.label'));
    var actionsEl = document.createElement('span');
    actionsEl.className = 'session-newer-banner-actions';
    banner.appendChild(iconEl);
    banner.appendChild(textEl);
    banner.appendChild(detailsEl);
    banner.appendChild(actionsEl);
    banner.appendChild(buildKebabMenu());

    function setIcon(name) { iconEl.className = 'session-newer-banner-icon codicon codicon-' + name; }

    function addCloseButton() {
        var close = makeButton('hide', '', '', false);
        close.classList.add('session-newer-banner-close');
        close.setAttribute('aria-label', tr('viewer.popover.close'));
        close.textContent = '\\u00d7';
        actionsEl.appendChild(close);
    }

    function statusActions() {
        actionsEl.innerHTML = '';
        actionsEl.appendChild(makeButton('open-editor', tr('viewer.logFile.openEditor'), 'go-to-file', true));
        actionsEl.appendChild(makeButton('copy-path', tr('viewer.logFile.copyFullPath'), 'copy', false));
        var kebab = makeButton('kebab', '', 'kebab-vertical', false);
        kebab.classList.add('log-banner-kebab-btn');
        kebab.setAttribute('aria-haspopup', 'true');
        kebab.setAttribute('aria-label', tr('viewer.logBanner.more'));
        actionsEl.appendChild(kebab);
        addCloseButton();
    }

    function autoActions() {
        actionsEl.innerHTML = '';
        actionsEl.appendChild(makeButton('open-newer', tr('viewer.session.newerBanner.open'), 'arrow-right', true));
        actionsEl.appendChild(makeButton('dismiss', tr('viewer.session.newerBanner.dismiss'), '', false));
    }

    /* Lifespan suffix for STATUS mode: " · Started 10 min ago · ran 7m 45s". Each clause is dropped
       when its data is unknown so a freshly-opened or duration-less log reads cleanly. */
    function lifespanSuffix() {
        var parts = [];
        var ago = formatAgo(ctx.startedMs);
        if (ago) { parts.push(tr('viewer.logBanner.started', ago)); }
        if (ctx.durationMs > 0 && typeof formatDuration === 'function') {
            parts.push(tr('viewer.logBanner.ran', formatDuration(ctx.durationMs)));
        }
        return parts.length ? (' \\u00b7 ' + parts.join(' \\u00b7 ')) : '';
    }

    function renderAuto() {
        bannerMode = 'auto';
        toggleKebab(false);
        setIcon('bell');
        var name = ctx.latestName || tr('viewer.logBanner.unnamed');
        var ago = formatAgo(ctx.latestMtime);
        textEl.textContent = tr('viewer.logBanner.newer', name) + (ago ? (' \\u00b7 ' + ago) : '');
        /* The session metadata belongs to the OPEN log, so it would misread beside a newer-log
           alert. Hidden for the duration of the alert, restored when it is dismissed. */
        detailsEl.classList.add('u-hidden');
        autoActions();
        banner.style.display = '';
    }

    function renderStatus() {
        bannerMode = 'status';
        collapsed = false;
        setIcon('file');
        textEl.textContent = currentFilenameForBanner() + lifespanSuffix();
        detailsEl.classList.remove('u-hidden');
        statusActions();
        banner.style.display = '';
    }

    /* Open-log name: prefer the live footer filename (always current), else the host's latest ctx. */
    function currentFilenameForBanner() {
        var fnEl = document.querySelector('#footer-text .footer-filename');
        var name = fnEl && fnEl.textContent ? fnEl.textContent.trim() : '';
        return name || ctx.latestName || tr('viewer.logBanner.unnamed');
    }

    /* Only the × collapses the bar. Actions (open, copy, kebab items) leave it standing so the user
       can copy a path and then open the file without re-summoning it. */
    function hideBanner() {
        bannerMode = '';
        collapsed = true;
        toggleKebab(false);
        banner.style.display = 'none';
    }

    /* AUTO dismiss advances the host dismiss cursor so this newer log stops nagging until an even
       newer controller log arrives, then falls back to the resting status bar. */
    function dismissAuto() {
        vscodeApi.postMessage({ type: 'acknowledgeUnreadLogs' });
        renderStatus();
    }

    function toggleKebab(open) {
        var menu = banner.querySelector('.log-banner-kebab-menu');
        if (!menu) { return; }
        var show = (open === undefined) ? menu.hasAttribute('hidden') : open;
        if (show) { menu.removeAttribute('hidden'); } else { menu.setAttribute('hidden', ''); }
    }

    /* Act on the URI the banner is DISPLAYING (ctx.currentUri, from logContextInfo), not the
       receiving target's host-side currentFileUri. They diverge: opening a report sets the
       provider's currentFileUri directly (log-viewer-provider.loadFromFile) but never broadcasts
       it, and broadcaster.setCurrentFile only fires for the live tail session — so in the pop-out
       target currentFileUri is unset/stale and a bare message silently no-op'd ("Open in editor
       did nothing"). The host handler prefers uriString over currentFileUri (plan 109), so passing
       the displayed URI makes every file action target the file the user is looking at. */
    function postCurrentFileAction(type) {
        var msg = { type: type };
        if (ctx.currentUri) { msg.uriString = ctx.currentUri; }
        vscodeApi.postMessage(msg);
    }

    function handleAction(action) {
        if (action === 'hide') { hideBanner(); return; }
        if (action === 'dismiss') { dismissAuto(); return; }
        if (action === 'kebab') { toggleKebab(); return; }
        if (action === 'open-newer') {
            if (ctx.latestUri) { vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: ctx.latestUri }); }
            vscodeApi.postMessage({ type: 'acknowledgeUnreadLogs' });
            renderStatus();
            return;
        }
        if (action === 'open-editor') { postCurrentFileAction('openLogFileInEditor'); return; }
        if (action === 'copy-path') { postCurrentFileAction('copyCurrentFilePath'); return; }
    }

    banner.addEventListener('click', function(e) {
        var menuItem = e.target.closest ? e.target.closest('.log-banner-kebab-item') : null;
        if (menuItem) {
            e.stopPropagation();
            postCurrentFileAction(menuItem.getAttribute('data-banner-msg') || '');
            toggleKebab(false);
            return;
        }
        var actionEl = e.target.closest ? e.target.closest('[data-banner-action]') : null;
        if (actionEl) {
            e.stopPropagation();
            handleAction(actionEl.getAttribute('data-banner-action') || '');
            return;
        }
        /* Body taps used to dismiss. They no longer do: the bar is persistent status, and losing it
           on a stray click (or on a text selection inside it) was the reported annoyance. */
        toggleKebab(false);
    });

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape' || !bannerMode) { return; }
        e.preventDefault();
        if (bannerMode === 'auto') { dismissAuto(); return; }
        toggleKebab(false);
    });

    /* Toolbar staleness chip + footer filename re-open a collapsed bar. */
    function openClickBanner() { renderStatus(); }
    window.openLogActionsBanner = openClickBanner;

    var staleEl = document.getElementById('log-staleness');
    if (staleEl) {
        staleEl.addEventListener('click', openClickBanner);
        staleEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openClickBanner(); }
        });
    }

    /* Toolbar staleness indicator: warning glyph + "N newer" when behind a newer controller log. */
    function updateStaleness() {
        if (!staleEl) { return; }
        var txt = staleEl.querySelector('.log-staleness-text');
        if (ctx.stale && ctx.newerCount > 0) {
            if (txt) { txt.textContent = tr('viewer.toolbar.staleness.newer', ctx.newerCount); }
            staleEl.classList.remove('u-hidden');
        } else {
            staleEl.classList.add('u-hidden');
        }
    }

    window.handleLogContextInfo = function(info) {
        ctx = info || ctx;
        updateStaleness();
        /* No open log (empty viewer) — nothing to status-report. */
        if (!ctx.currentUri && !bannerMode) { return; }
        if (ctx.autoShow) { renderAuto(); return; }
        /* A newer-log alert that stopped applying falls back to status; an explicitly collapsed bar
           stays collapsed, but its text is refreshed so re-opening it shows the current file. */
        if (collapsed) { return; }
        renderStatus();
    };
})();
`;
}
