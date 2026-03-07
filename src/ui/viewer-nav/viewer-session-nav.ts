/**
 * Client-side JavaScript for session navigation bar.
 * Follows the same pattern as viewer-split-nav.ts.
 */
export function getSessionNavScript(): string {
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
    if (!hasPrev && !hasNext) {
        sessionNav.classList.remove('visible');
        if (typeof updateSessionNavWrapperVisibility === 'function') updateSessionNavWrapperVisibility();
        if (wrapper) requestAnimationFrame(function() { wrapper.style.transition = ''; });
        return;
    }
    sessionNav.classList.add('visible');
    sessionNavCurrentEl.textContent = index;
    sessionNavTotalEl.textContent = total;
    sessionPrevBtn.disabled = !hasPrev;
    sessionNextBtn.disabled = !hasNext;
    if (typeof updateSessionNavWrapperVisibility === 'function') updateSessionNavWrapperVisibility();
    if (wrapper) requestAnimationFrame(function() { wrapper.style.transition = ''; });
}

sessionPrevBtn.addEventListener('click', function() {
    if (!sessionPrevBtn.disabled) {
        vscodeApi.postMessage({ type: 'navigateSession', direction: -1 });
    }
});

sessionNextBtn.addEventListener('click', function() {
    if (!sessionNextBtn.disabled) {
        vscodeApi.postMessage({ type: 'navigateSession', direction: 1 });
    }
});

function handleSessionNavInfo(msg) {
    updateSessionNav(msg.hasPrev, msg.hasNext, msg.index || 0, msg.total || 0);
}
`;
}
