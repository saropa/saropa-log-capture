"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSearchPopoversScript = getSearchPopoversScript;
/**
 * Search popover helpers (toggle, close, position).
 *
 * History and options popovers are now inline children of `#search-flyout`,
 * so the old `position: fixed` logic, IntersectionObserver, and scroll/resize
 * listeners are no longer needed. The toggle/close functions remain because
 * other scripts call them.
 */
function getSearchPopoversScript() {
    return /* javascript */ `
function closeSearchOptionsPopover() {
    searchOptionsOpen = false;
    if (searchOptionsPopover) searchOptionsPopover.hidden = true;
    if (searchFunnelBtn) searchFunnelBtn.setAttribute('aria-expanded', 'false');
}

function toggleSearchOptionsPopover() {
    if (!searchOptionsPopover || !searchFunnelBtn) return;
    searchOptionsOpen = !searchOptionsOpen;
    if (searchOptionsOpen) {
        searchOptionsPopover.hidden = false;
        searchFunnelBtn.setAttribute('aria-expanded', 'true');
    } else {
        closeSearchOptionsPopover();
    }
}

/** No-op — popovers are inline in the search flyout now. */
function positionSearchFloatingPanels() {}
window.positionSearchFloatingPanels = positionSearchFloatingPanels;
`;
}
//# sourceMappingURL=viewer-search-popovers.js.map