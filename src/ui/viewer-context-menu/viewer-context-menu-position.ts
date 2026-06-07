/**
 * Viewport-aware placement for the log viewer context menu and its submenu flyouts.
 *
 * Concatenated into the single webview script (shared global scope) by
 * `getContextMenuScript()`. The functions here reference globals declared elsewhere in
 * that script (`contextMenuEl`, `scrollChromeContextMenuEl`, `syncContextMenuToggles`,
 * `contextMenuLineIdx`, `window.isContextMenuOpen`); function declarations are hoisted
 * across the combined script, so declaration order between modules does not matter.
 *
 * ## Why submenus are positioned per-trigger, not via global flip classes
 * The previous model toggled `flip-submenu*` classes ONCE from the root menu's rect and
 * applied them to every flyout uniformly. A mid-screen trigger and a near-bottom trigger
 * got the same direction, a tall flyout forced upward clipped at the top, and nothing
 * capped flyout height — so tall submenus (Copy & Export) ran off-screen on short panels.
 * `positionSubmenu()` now decides from each trigger's OWN rect and caps height with scroll.
 */
export function getContextMenuPositionScript(): string {
    return /* javascript */ `
/** Place the root menu at (x,y) and clamp it inside the viewport. Submenu flyouts are
    positioned independently in positionSubmenu() on hover. */
function positionContextMenu(x, y) {
    contextMenuEl.style.left = x + 'px';
    contextMenuEl.style.top = y + 'px';
    contextMenuEl.classList.add('visible');
    var rect = contextMenuEl.getBoundingClientRect();
    var newX = x;
    var newY = y;
    if (rect.right > window.innerWidth) newX = Math.max(0, window.innerWidth - rect.width);
    if (rect.bottom > window.innerHeight) newY = Math.max(0, window.innerHeight - rect.height);
    contextMenuEl.style.left = newX + 'px';
    contextMenuEl.style.top = newY + 'px';
}

/** Position one submenu flyout against the live viewport, run on the trigger's mouseenter.
    Each flyout decides from its OWN trigger rect and caps its height with a scroll so it
    can never exceed the viewport regardless of item count or panel size. */
function positionSubmenu(submenuEl) {
    var flyout = submenuEl.querySelector('.context-menu-submenu-content');
    if (!flyout) return;
    var marginPx = 8; /* keep a small gap from the viewport edge */
    /* Clear any prior placement so measurements reflect the natural panel, not last hover. */
    flyout.style.cssText = '';
    flyout.style.display = 'block'; /* force layout for measurement even before :hover settles */
    var tr = submenuEl.getBoundingClientRect();
    var flyoutWidth = flyout.offsetWidth;
    var flyoutHeight = flyout.scrollHeight;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    /* Horizontal: open right unless it would overflow the right edge, then open left. */
    if (tr.right + flyoutWidth + marginPx <= vw) {
        flyout.style.left = '100%';
    } else {
        flyout.style.right = '100%';
    }
    /* Vertical: a flyout anchored top:0 aligns to the trigger top and grows DOWN;
       anchored bottom:0 aligns to the trigger bottom and grows UP. */
    var spaceBelow = vh - tr.top - marginPx;
    var spaceAbove = tr.bottom - marginPx;
    if (flyoutHeight <= spaceBelow) {
        flyout.style.top = '0';
    } else if (flyoutHeight <= spaceAbove) {
        flyout.style.bottom = '0';
    } else if (spaceBelow >= spaceAbove) {
        flyout.style.top = '0';
        flyout.style.maxHeight = spaceBelow + 'px'; /* taller than the viewport: cap + scroll */
    } else {
        flyout.style.bottom = '0';
        flyout.style.maxHeight = spaceAbove + 'px';
    }
    flyout.style.removeProperty('display'); /* hand visibility back to the CSS :hover rule */
}

function hideContextMenu() {
    if (contextMenuEl) contextMenuEl.classList.remove('visible');
    if (scrollChromeContextMenuEl) scrollChromeContextMenuEl.classList.remove('visible');
    contextMenuLineIdx = -1;
    window.isContextMenuOpen = false;
}

/** Right-click on minimap strip / native scrollbar: compact menu for scroll map + scrollbar settings. */
function showScrollChromeContextMenu(x, y) {
    if (!scrollChromeContextMenuEl) return;
    if (contextMenuEl) contextMenuEl.classList.remove('visible');
    syncContextMenuToggles();
    scrollChromeContextMenuEl.style.left = x + 'px';
    scrollChromeContextMenuEl.style.top = y + 'px';
    scrollChromeContextMenuEl.classList.add('visible');
    var rect = scrollChromeContextMenuEl.getBoundingClientRect();
    var newX = x;
    var newY = y;
    if (rect.right > window.innerWidth) newX = Math.max(0, window.innerWidth - rect.width);
    if (rect.bottom > window.innerHeight) newY = Math.max(0, window.innerHeight - rect.height);
    scrollChromeContextMenuEl.style.left = newX + 'px';
    scrollChromeContextMenuEl.style.top = newY + 'px';
    window.isContextMenuOpen = true;
}
`;
}
