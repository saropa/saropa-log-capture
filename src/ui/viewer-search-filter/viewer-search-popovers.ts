/** Returns script chunk for search options/history popovers and positioning. */
export function getSearchPopoversScript(): string {
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
        requestAnimationFrame(positionSearchFloatingPanels);
    } else {
        closeSearchOptionsPopover();
    }
}

/** Place history and options popovers under the compact search field (fixed; avoids session-nav overflow clip). */
function positionSearchFloatingPanels() {
    var shell = document.querySelector('.session-search-input-shell');
    var hist = document.getElementById('search-history');
    var opt = document.getElementById('search-options-popover');
    if (!shell) return;
    var r = shell.getBoundingClientRect();
    var w = Math.max(220, r.width);
    if (hist && hist.innerHTML.trim() !== '') {
        hist.style.position = 'fixed';
        hist.style.left = r.left + 'px';
        hist.style.top = (r.bottom + 2) + 'px';
        hist.style.width = w + 'px';
        hist.style.zIndex = '20000';
        hist.style.maxHeight = 'min(240px, 40vh)';
    } else if (hist) {
        hist.style.position = '';
        hist.style.left = '';
        hist.style.top = '';
        hist.style.width = '';
        hist.style.zIndex = '';
        hist.style.maxHeight = '';
    }
    if (opt && !opt.hidden) {
        opt.style.position = 'fixed';
        opt.style.left = r.left + 'px';
        opt.style.top = (r.bottom + 2) + 'px';
        opt.style.width = Math.max(260, w) + 'px';
        opt.style.zIndex = '20001';
    } else if (opt) {
        opt.style.position = '';
        opt.style.left = '';
        opt.style.top = '';
        opt.style.width = '';
        opt.style.zIndex = '';
    }
}
window.positionSearchFloatingPanels = positionSearchFloatingPanels;

var logContentForSearchPanels = document.getElementById('log-content');
if (logContentForSearchPanels) {
    logContentForSearchPanels.addEventListener('scroll', function() { positionSearchFloatingPanels(); }, { passive: true });
}
window.addEventListener('resize', function() { positionSearchFloatingPanels(); });
`;
}
