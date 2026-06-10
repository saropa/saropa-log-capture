/**
 * Webview JS fragment: the header kebab options menu that replaced the old
 * toolbar row in the Logs panel. The fragment runs inside the same IIFE as
 * viewer-session-panel.ts and relies on its shared scope (sessionDisplayOptions,
 * setOptionsMenuOpen, isOptionsMenuOpen, vscodeApi).
 *
 * Why a separate module: the toolbar replacement added ~40 LoC to the events
 * file, pushing it past the 300-line house limit. The menu has a single
 * responsibility (open/close + outside-click + export action), so extracting
 * it keeps the events file scoped to row/heading/pagination wiring.
 */

/** Returns the JS fragment that wires the kebab options menu. */
export function getSessionOptionsMenuScript(): string {
    return /* javascript */ `
    /* Header kebab opens the consolidated options menu. CSS positions the menu
       under the header, so this only toggles the .open class + the toggle's
       aria-expanded state. Outside-click dismissal is wired below in the same
       module so all menu lifecycle lives in one place.
       Class-based instead of style.display: the previous inline-style approach
       had the menu rendering open on initial panel load — any code path that
       cleared the element's style attribute (or a CSS rule with display:flex
       cascading in) would expose it. The CSS rule defaults to display:none and
       .open switches to display:flex, so nothing short of adding .open shows
       the menu. */
    function setOptionsMenuOpen(open) {
        var menu = document.getElementById('session-options-menu');
        var btn = document.getElementById('session-options-toggle');
        if (!menu || !btn) return;
        menu.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.classList.toggle('active', open);
    }
    function isOptionsMenuOpen() {
        var menu = document.getElementById('session-options-menu');
        return !!(menu && menu.classList.contains('open'));
    }

    var optionsToggleBtn = document.getElementById('session-options-toggle');
    if (optionsToggleBtn) optionsToggleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        setOptionsMenuOpen(!isOptionsMenuOpen());
    });

    /* Place a grouped submenu's flyout in viewport coordinates (position:fixed) so it is NEVER
       cropped by a short or narrow panel: open to the right of the trigger, flip left near the
       right edge, slide up so the bottom never runs off-screen, and cap height + scroll only when
       the flyout truly exceeds the viewport. Mirrors positionSubmenu() for the log-viewer context
       menu; kept local so the options menu does not depend on that script's globals. */
    function positionSessionOptionsSubmenu(trigger) {
        var flyout = trigger.querySelector('.session-options-submenu-content');
        if (!flyout) return;
        var margin = 8;
        flyout.style.cssText = '';
        flyout.style.position = 'fixed';
        flyout.style.display = 'block'; /* force layout for measurement before :hover settles */
        var tr = trigger.getBoundingClientRect();
        var vw = window.innerWidth, vh = window.innerHeight;
        var w = flyout.offsetWidth;
        var natural = flyout.scrollHeight;
        var avail = vh - margin * 2;
        var used = Math.min(natural, avail);
        var left = tr.right;
        if (left + w + margin > vw) left = tr.left - w; /* flip left when it would overflow right */
        if (left < margin) left = margin;
        var top = tr.top;
        if (top + used > vh - margin) top = vh - margin - used; /* slide up so the bottom never clips */
        if (top < margin) top = margin;
        flyout.style.left = left + 'px';
        flyout.style.top = top + 'px';
        if (natural > avail) flyout.style.maxHeight = avail + 'px';
        flyout.style.removeProperty('display'); /* hand visibility back to the CSS :hover rule */
    }

    /* Position each submenu flyout on hover/focus. Hover-reveal matches the session context menu's
       Export/Copy flyouts; focusin covers keyboard users tabbing into a group. */
    var optionsMenuEl = document.getElementById('session-options-menu');
    if (optionsMenuEl) {
        var optionsSubmenus = optionsMenuEl.querySelectorAll('.session-options-submenu');
        for (var oi = 0; oi < optionsSubmenus.length; oi++) {
            (function(sub) {
                sub.addEventListener('mouseenter', function() { positionSessionOptionsSubmenu(sub); });
                sub.addEventListener('focusin', function() { positionSessionOptionsSubmenu(sub); });
            })(optionsSubmenus[oi]);
        }
    }
    var exportListBtn = document.getElementById('session-export-list');
    if (exportListBtn) exportListBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'exportSessionListJson' });
        setOptionsMenuOpen(false);
    });
    var openFileBtn = document.getElementById('session-open-file');
    if (openFileBtn) openFileBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'openLogFile' });
        setOptionsMenuOpen(false);
    });
    var openUrlBtn = document.getElementById('session-open-url');
    if (openUrlBtn) openUrlBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        vscodeApi.postMessage({ type: 'openLogFromUrl' });
        setOptionsMenuOpen(false);
    });

    /* Turn a file:// URI into a readable absolute path for the row tooltip. The webview only
       receives uriString (not fsPath), so strip the scheme, decode percent-escapes, and drop the
       leading slash VS Code prepends before a Windows drive letter (file:///d:/… → d:/…). */
    function decodeLoadedFilePath(uriStr) {
        if (!uriStr) return '';
        try {
            var p = decodeURIComponent(String(uriStr).replace(/^file:\\/\\//i, ''));
            if (/^\\/[a-zA-Z]:/.test(p)) p = p.slice(1);
            return p;
        } catch (err) { return String(uriStr); }
    }

    /* Render the "recently opened files" shortcut list under the kebab menu's last separator from
       the session records flagged loadedManually (manual Open Log File / URL loads that the reports
       directory scan never lists). Sorted most-recent-first by load time (their mtime IS loadedAt)
       and capped at 10. Hoisted (function declaration) so the message-listener fragment can call it
       on every sessionList without an init-order dependency. */
    function renderLoadedFilesMenu(sessions) {
        var listEl = document.getElementById('session-loaded-files-list');
        var emptyEl = document.getElementById('session-loaded-files-empty');
        if (!listEl || !emptyEl) return;
        var loaded = [];
        if (sessions && sessions.length) {
            for (var i = 0; i < sessions.length; i++) {
                if (sessions[i] && sessions[i].loadedManually) loaded.push(sessions[i]);
            }
        }
        loaded.sort(function(a, b) { return (b.mtime || 0) - (a.mtime || 0); });
        loaded = loaded.slice(0, 10);
        if (loaded.length === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = '';
            return;
        }
        emptyEl.style.display = 'none';
        var html = '';
        for (var j = 0; j < loaded.length; j++) {
            var s = loaded[j];
            var uri = escapeAttr(s.uriString || '');
            var name = escapeHtmlText(s.displayName || s.filename || s.uriString || '');
            var path = escapeAttr(decodeLoadedFilePath(s.uriString || ''));
            html += '<button type="button" class="session-loaded-file-item" role="menuitem" data-uri="' + uri + '" title="' + path + '">'
                + '<span class="codicon codicon-file"></span>'
                + '<span class="session-loaded-file-name">' + name + '</span>'
                + '</button>';
        }
        listEl.innerHTML = html;
    }

    /* Delegate clicks for the dynamically-rendered rows: open the file via the same
       openSessionFromPanel path the main list uses (works for out-of-folder URIs), then close. */
    var loadedFilesListEl = document.getElementById('session-loaded-files-list');
    if (loadedFilesListEl) loadedFilesListEl.addEventListener('click', function(e) {
        var item = e.target.closest('.session-loaded-file-item');
        if (!item) return;
        e.stopPropagation();
        var uri = item.getAttribute('data-uri') || '';
        if (uri) vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: uri });
        setOptionsMenuOpen(false);
    });
    /* Outside-click dismissal of the menu. Registered here (not in events.ts)
       so all menu wiring is colocated; the events file's panel-wide
       outside-click handler still runs separately to close the panel itself. */
    document.addEventListener('click', function(e) {
        if (!isOptionsMenuOpen()) return;
        var menuEl = document.getElementById('session-options-menu');
        var menuBtn = document.getElementById('session-options-toggle');
        var inMenu = menuEl && menuEl.contains(e.target);
        var inToggle = menuBtn && (menuBtn === e.target || menuBtn.contains(e.target));
        if (!inMenu && !inToggle) setOptionsMenuOpen(false);
    });
`;
}
