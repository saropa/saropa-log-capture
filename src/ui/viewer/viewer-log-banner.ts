/**
 * Unified log banner (plan 109 — bugs/109_plan-unified-log-banner.md).
 *
 * One inline, non-modal surface (#viewer-newer-banner, in viewer-content-body.ts) with two modes:
 *
 *  - AUTO: surfaces on its own when the host reports the open log is behind a newer main-project
 *    (controller) log. Shows "Newer · <name> · <ago>" with Open (loads that newer log) / Dismiss.
 *    Auto-surfacing must never steal focus or block input — hence inline, not a modal/popover.
 *  - CLICK: opened by clicking the filename or the toolbar staleness chip. Shows the OPEN log's
 *    name + lifespan ("Started <ago> · ran <dur>") with Open in editor · Copy path · a kebab for
 *    the remaining file actions. Targets the open file.
 *
 * The two modes never co-exist: a user-opened CLICK banner takes precedence over AUTO until
 * dismissed. Dismiss = tap the banner body (not a button), the × icon, or Escape; AUTO dismiss also
 * advances the host dismiss cursor (acknowledgeUnreadLogs) so the same newer log will not re-nag.
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
    var bannerMode = '';            // '' (hidden) | 'auto' | 'click'
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

    function makeButton(action, label, primary) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'session-newer-banner-action' + (primary ? ' primary' : '');
        b.setAttribute('data-banner-action', action);
        b.textContent = label;
        return b;
    }

    function makeIcon(name) {
        var s = document.createElement('span');
        s.className = 'session-newer-banner-icon codicon codicon-' + name;
        return s;
    }

    function makeText(text) {
        var s = document.createElement('span');
        s.className = 'session-newer-banner-text';
        s.textContent = text;
        return s;
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

    function clickActions() {
        var wrap = document.createElement('span');
        wrap.className = 'session-newer-banner-actions';
        wrap.appendChild(makeButton('open-editor', tr('viewer.logFile.openEditor'), true));
        wrap.appendChild(makeButton('copy-path', tr('viewer.logFile.copyFullPath'), false));
        var kebab = makeButton('kebab', '', false);
        kebab.classList.add('log-banner-kebab-btn');
        kebab.setAttribute('aria-haspopup', 'true');
        kebab.setAttribute('aria-label', tr('viewer.logBanner.more'));
        kebab.innerHTML = '<span class="codicon codicon-kebab-vertical" aria-hidden="true"></span>';
        wrap.appendChild(kebab);
        var close = makeButton('dismiss', '', false);
        close.classList.add('session-newer-banner-close');
        close.setAttribute('aria-label', tr('viewer.popover.close'));
        close.textContent = '\\u00d7';
        wrap.appendChild(close);
        return wrap;
    }

    function autoActions() {
        var wrap = document.createElement('span');
        wrap.className = 'session-newer-banner-actions';
        wrap.appendChild(makeButton('open-newer', tr('viewer.session.newerBanner.open'), true));
        wrap.appendChild(makeButton('dismiss', tr('viewer.session.newerBanner.dismiss'), false));
        return wrap;
    }

    /* Lifespan suffix for CLICK mode: " · Started 10 min ago · ran 7m 45s". Each clause is dropped
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
        banner.innerHTML = '';
        banner.appendChild(makeIcon('bell'));
        var name = ctx.latestName || tr('viewer.logBanner.unnamed');
        var ago = formatAgo(ctx.latestMtime);
        banner.appendChild(makeText(tr('viewer.logBanner.newer', name) + (ago ? (' \\u00b7 ' + ago) : '')));
        banner.appendChild(autoActions());
        banner.style.display = '';
    }

    function renderClick() {
        bannerMode = 'click';
        banner.innerHTML = '';
        banner.appendChild(makeIcon('file'));
        var name = currentFilenameForBanner();
        banner.appendChild(makeText(name + lifespanSuffix()));
        banner.appendChild(clickActions());
        banner.appendChild(buildKebabMenu());
        banner.style.display = '';
    }

    /* Open-log name: prefer the live footer filename (always current), else the host's latest ctx. */
    function currentFilenameForBanner() {
        var fnEl = document.querySelector('#footer-text .footer-filename');
        var name = fnEl && fnEl.textContent ? fnEl.textContent.trim() : '';
        return name || ctx.latestName || tr('viewer.logBanner.unnamed');
    }

    function hideBanner() {
        bannerMode = '';
        banner.style.display = 'none';
        banner.innerHTML = '';
    }

    function dismiss() {
        var wasAuto = bannerMode === 'auto';
        hideBanner();
        /* AUTO dismiss advances the host dismiss cursor so this newer log stops nagging until an
           even newer controller log arrives. CLICK dismiss is a pure local hide. */
        if (wasAuto) { vscodeApi.postMessage({ type: 'acknowledgeUnreadLogs' }); }
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

    function handleAction(action, el) {
        if (action === 'dismiss') { dismiss(); return; }
        if (action === 'kebab') { toggleKebab(); return; }
        if (action === 'open-newer') {
            if (ctx.latestUri) { vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: ctx.latestUri }); }
            vscodeApi.postMessage({ type: 'acknowledgeUnreadLogs' });
            hideBanner();
            return;
        }
        if (action === 'open-editor') { postCurrentFileAction('openLogFileInEditor'); hideBanner(); return; }
        if (action === 'copy-path') { postCurrentFileAction('copyCurrentFilePath'); hideBanner(); return; }
    }

    banner.addEventListener('click', function(e) {
        var menuItem = e.target.closest ? e.target.closest('.log-banner-kebab-item') : null;
        if (menuItem) {
            e.stopPropagation();
            postCurrentFileAction(menuItem.getAttribute('data-banner-msg') || '');
            hideBanner();
            return;
        }
        var actionEl = e.target.closest ? e.target.closest('[data-banner-action]') : null;
        if (actionEl) {
            e.stopPropagation();
            handleAction(actionEl.getAttribute('data-banner-action') || '', actionEl);
            return;
        }
        /* Tapping the banner body (not a button or menu) dismisses — the whole surface is a tap
           target. Clicking the log content outside the banner is left alone (normal interaction). */
        toggleKebab(false);
        dismiss();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && bannerMode) { e.preventDefault(); toggleKebab(false); dismiss(); }
    });

    /* Toolbar staleness chip + footer filename both open the CLICK banner. */
    function openClickBanner() { renderClick(); }
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
        /* A user-opened CLICK banner is not clobbered by host refreshes. */
        if (bannerMode === 'click') { return; }
        if (ctx.autoShow) { renderAuto(); } else if (bannerMode === 'auto') { hideBanner(); }
    };
})();
`;
}
