/**
 * Injected **before** `getSearchScript()` body so `positionSearchFloatingPanels` exists when search runs.
 *
 * **Floating panels:** History (`#search-history`) and the highlight/filter popover use `position: fixed` so
 * `session-nav` / `overflow` does not clip them. Coordinates come from `.session-search-input-shell`.
 *
 * **Visibility:** An `IntersectionObserver` hides the history node when the shell is not intersecting the
 * viewport (e.g. smart header collapsed with `max-height: 0` — fixed descendants would otherwise stay
 * on screen). `#log-content` scroll and `resize` still reposition when visible.
 *
 * **Order:** `viewer-session-header` calls `positionSearchFloatingPanels` after toggling `smart-header-hidden`
 * so listener order vs the log scroll handler does not leave one frame stale.
 */
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
        /* When hidden by IntersectionObserver (header collapsed / off-screen), skip coords until visible again. */
        if (hist.style.visibility !== 'hidden') {
            hist.style.position = 'fixed';
            hist.style.left = r.left + 'px';
            hist.style.top = (r.bottom + 2) + 'px';
            hist.style.width = w + 'px';
            hist.style.zIndex = '20000';
            hist.style.maxHeight = 'min(240px, 40vh)';
        }
    } else if (hist) {
        hist.style.position = '';
        hist.style.left = '';
        hist.style.top = '';
        hist.style.width = '';
        hist.style.zIndex = '';
        hist.style.maxHeight = '';
        hist.style.visibility = '';
        hist.style.pointerEvents = '';
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

/** Hide the fixed history list when the search field is not on screen (e.g. smart header collapsed). Fixed children ignore parent overflow, so they would otherwise float orphaned. */
(function setupSearchShellIntersection() {
    var shell = document.querySelector('.session-search-input-shell');
    if (!shell || typeof IntersectionObserver === 'undefined') return;
    var obs = new IntersectionObserver(function(entries) {
        var e = entries[0];
        var hist = document.getElementById('search-history');
        if (!hist || !hist.innerHTML.trim()) return;
        if (!e || !e.isIntersecting) {
            hist.style.visibility = 'hidden';
            hist.style.pointerEvents = 'none';
        } else {
            hist.style.visibility = '';
            hist.style.pointerEvents = '';
            positionSearchFloatingPanels();
        }
    }, { root: null, threshold: 0 });
    obs.observe(shell);
})();
`;
}
