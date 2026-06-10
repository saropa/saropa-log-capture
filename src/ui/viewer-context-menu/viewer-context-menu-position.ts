/**
 * Viewport-aware placement for the log viewer context menu and its submenu flyouts.
 *
 * Concatenated into the single webview script (shared global scope) by
 * `getContextMenuScript()`. The functions here reference globals declared elsewhere in
 * that script (`contextMenuEl`, `scrollChromeContextMenuEl`, `syncContextMenuToggles`,
 * `contextMenuLineIdx`, `window.isContextMenuOpen`); function declarations are hoisted
 * across the combined script, so declaration order between modules does not matter.
 *
 * ## Why submenus are positioned per-trigger against the viewport (position:fixed)
 * The first model toggled `flip-submenu*` classes ONCE from the root menu's rect and applied
 * them to every flyout uniformly — a tall flyout clipped at the top. The second model anchored
 * each flyout to its trigger box (top:0 / bottom:0) and capped to the room on ONE side, so a
 * tall flyout or a near-bottom trigger got a tiny scrollable strip with empty screen beside it.
 * `positionSubmenu()` now positions each flyout in viewport coordinates (position:fixed): it
 * spans the FULL viewport height AND width, slides fully on-screen, and scrolls only when it cannot
 * fit — the width cap closes the "off the right edge in a narrow split" symptom the height cap missed.
 * `repositionOpenContextMenu()` re-runs placement on window resize so the open menu and its
 * flyout stay correct and re-maximize their height when the panel is resized while open.
 */
export function getContextMenuPositionScript(): string {
    return /* javascript */ `
/** Place the root menu at (x,y) and clamp it inside the viewport. Submenu flyouts are
    positioned independently in positionSubmenu() on hover. */
function positionContextMenu(x, y) {
    /* Cap the root menu to the viewport (minus a small margin) so a long menu on a short
       panel scrolls via overflow-y:auto instead of running off the bottom edge with no scroll. */
    contextMenuEl.style.maxHeight = (window.innerHeight - 16) + 'px';
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
    Uses position:fixed so placement is computed in viewport coordinates (not the trigger box),
    spans the FULL available height, and slides fully on-screen instead of clipping. */
function positionSubmenu(submenuEl) {
    var flyout = submenuEl.querySelector('.context-menu-submenu-content');
    if (!flyout) return;
    var marginPx = 8; /* keep a small gap from the viewport edge */
    /* Clear any prior placement so measurements reflect the natural panel, not last hover. */
    flyout.style.cssText = '';
    flyout.style.position = 'fixed'; /* place against the live viewport, not the trigger's box */
    flyout.style.display = 'block'; /* force layout for measurement even before :hover settles */
    var tr = submenuEl.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    /* Height and width are each maximized to the FULL viewport (minus margins), not the room on one
       side of the trigger. The prior model anchored to the trigger and capped to the room above OR
       below it, so a tall flyout (Copy & Export) or a near-bottom trigger (Columns) got a tiny strip
       even with ample screen. We use the whole viewport and scroll only when content cannot fit. */
    var availableHeight = vh - marginPx * 2;
    var availableWidth = vw - marginPx * 2;
    /* Cap height BEFORE measuring width: a scrolling flyout grows by its scrollbar width, and we
       must include that in flyoutWidth so the horizontal flip/clamp below never runs off the edge. */
    if (flyout.scrollHeight > availableHeight) flyout.style.maxHeight = availableHeight + 'px';
    /* Width cap + horizontal scroll for a panel narrower than the flyout — the original
       "off the right edge, worst in a narrow split" symptom that the vertical cap never covered. */
    if (flyout.offsetWidth > availableWidth) { flyout.style.maxWidth = availableWidth + 'px'; flyout.style.overflowX = 'auto'; }
    var flyoutWidth = Math.min(flyout.offsetWidth, availableWidth);
    var usedHeight = Math.min(flyout.scrollHeight, availableHeight);
    /* Horizontal: open to the right of the trigger; flip left if it would overflow the right edge. */
    var left = tr.right;
    if (left + flyoutWidth + marginPx > vw) left = tr.left - flyoutWidth;
    if (left < marginPx) left = marginPx;
    /* Vertical: align the flyout top to the trigger, then slide it fully on-screen so a
       near-bottom trigger never clips — cap + scroll only when it truly exceeds the viewport. */
    var top = tr.top;
    if (top + usedHeight > vh - marginPx) top = vh - marginPx - usedHeight;
    if (top < marginPx) top = marginPx;
    flyout.style.left = left + 'px';
    flyout.style.top = top + 'px';
    flyout.style.removeProperty('display'); /* hand visibility back to the CSS :hover rule */
}

/** Re-clamp the open root menu and reposition its open submenu after a viewport resize, so
    the menu stays fully on-screen and re-maximizes its height when the panel is resized while open.
    Responsive: dragging the panel taller widens a previously-scrolled flyout to use the new room. */
function repositionOpenContextMenu() {
    if (!window.isContextMenuOpen || !contextMenuEl) return;
    if (contextMenuEl.classList.contains('visible')) {
        var r = contextMenuEl.getBoundingClientRect();
        positionContextMenu(r.left, r.top);
    }
    /* :hover still matches the entered trigger because the pointer has not moved on resize. */
    var openSub = contextMenuEl.querySelector('.context-menu-submenu:hover');
    if (openSub) positionSubmenu(openSub);
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
