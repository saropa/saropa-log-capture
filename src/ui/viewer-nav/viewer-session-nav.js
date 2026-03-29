"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionNavScript = getSessionNavScript;
/**
 * Client-side JavaScript for session navigation bar.
 * Follows the same pattern as viewer-split-nav.ts.
 */
function getSessionNavScript() {
    return /* javascript */ `
var sessionNav = document.getElementById('session-nav');
var sessionPrevBtn = document.getElementById('session-prev');
var sessionNextBtn = document.getElementById('session-next');
var sessionNavCurrentEl = document.getElementById('session-nav-current');
var sessionNavTotalEl = document.getElementById('session-nav-total');

function updateSessionNav(hasPrev, hasNext, index, total) {
    /* Suppress CSS transition to avoid visible jump when switching files. */
    var wrapper = document.getElementById('session-nav-wrapper');
    if (wrapper) { wrapper.style.transition = 'none'; }
    /* Always show session count — default to "Session 1 of 1" when no navigation info. */
    if (sessionNav) sessionNav.classList.add('visible');
    if (sessionNavCurrentEl) sessionNavCurrentEl.textContent = (index > 0 ? index : 1);
    if (sessionNavTotalEl) sessionNavTotalEl.textContent = (total > 0 ? total : 1);
    if (sessionPrevBtn) sessionPrevBtn.disabled = !hasPrev;
    if (sessionNextBtn) sessionNextBtn.disabled = !hasNext;
    if (typeof updateSessionNavWrapperVisibility === 'function') updateSessionNavWrapperVisibility();
    if (wrapper) requestAnimationFrame(function() { wrapper.style.transition = ''; });
}

if (sessionPrevBtn) sessionPrevBtn.addEventListener('click', function() {
    if (!sessionPrevBtn.disabled) {
        vscodeApi.postMessage({ type: 'navigateSession', direction: -1 });
    }
});

if (sessionNextBtn) sessionNextBtn.addEventListener('click', function() {
    if (!sessionNextBtn.disabled) {
        vscodeApi.postMessage({ type: 'navigateSession', direction: 1 });
    }
});

function handleSessionNavInfo(msg) {
    updateSessionNav(msg.hasPrev, msg.hasNext, msg.index || 0, msg.total || 0);
}
`;
}
//# sourceMappingURL=viewer-session-nav.js.map