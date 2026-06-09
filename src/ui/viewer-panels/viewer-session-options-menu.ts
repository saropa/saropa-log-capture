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
