/**
 * Toolbar interaction script: flyout open/close, Signals mutual exclusion,
 * actions dropdown, filter panel toggle, and tab bar wiring.
 *
 * The filter panel is a slide-out in #panel-slot (like Sessions, Bookmarks).
 * The toolbar filter button toggles it via setActivePanel('filters').
 *
 * Filter tab bar logic lives in viewer-toolbar-filter-tabs-script.ts; it is
 * appended below the main IIFE so tab click handlers wire up during page load.
 */
import { getFilterTabsScript } from './viewer-toolbar-filter-tabs-script';

/** Returns the toolbar interaction JavaScript. */
export function getToolbarScript(): string {
    return /* javascript */ `
(function() {
    var searchFlyout = document.getElementById('search-flyout');
    var signalsHost = document.getElementById('root-cause-hypotheses');
    var searchBtn = document.getElementById('toolbar-search-btn');
    var filterBtn = document.getElementById('toolbar-filter-btn');
    var signalsBtn = document.getElementById('toolbar-signals-btn');
    var actionsBtn = document.getElementById('toolbar-actions-btn');
    var actionsPopover = document.getElementById('footer-actions-popover');
    var levelMenuBtn = document.getElementById('level-menu-btn');
    var signalsWasVisible = false;
    var signalsUserVisible = false;
    var actionsOpen = false;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* ---- Animation helpers ---- */

    function animatedShow(el, animClass) {
        if (!el) return;
        el.classList.remove('anim-flyout-close', 'anim-dropdown-close');
        if (reduceMotion.matches) { el.classList.remove('u-hidden'); return; }
        el.classList.add(animClass);
        el.classList.remove('u-hidden');
    }

    function animatedHide(el, animClass) {
        if (!el || el.classList.contains('u-hidden')) return;
        if (reduceMotion.matches) { el.classList.add('u-hidden'); return; }
        el.classList.remove('anim-flyout-open', 'anim-dropdown-open');
        el.classList.add(animClass);
    }

    function initAnimEnd(el) {
        if (!el) return;
        el.addEventListener('animationend', function() {
            if (el.classList.contains('anim-flyout-close') ||
                el.classList.contains('anim-dropdown-close')) {
                el.classList.add('u-hidden');
            }
            el.classList.remove('anim-flyout-open', 'anim-flyout-close',
                                'anim-dropdown-open', 'anim-dropdown-close');
        });
    }

    /* ---- Search flyout ---- */

    function openSearchFlyout() {
        if (!searchFlyout) return;
        closeActionsDropdown();
        animatedShow(searchFlyout, 'anim-flyout-open');
        if (searchBtn) searchBtn.setAttribute('aria-expanded', 'true');
        var input = document.getElementById('search-input');
        if (input) input.focus();
    }

    function closeSearchFlyout() {
        if (!searchFlyout) return;
        animatedHide(searchFlyout, 'anim-flyout-close');
        if (searchBtn) searchBtn.setAttribute('aria-expanded', 'false');
    }

    function toggleSearchFlyout() {
        if (!searchFlyout) return;
        var closing = searchFlyout.classList.contains('anim-flyout-close');
        if (searchFlyout.classList.contains('u-hidden') || closing) {
            openSearchFlyout();
        } else {
            closeSearchFlyout();
        }
    }

    /* ---- Filter panel (slide-out in panel-slot) ---- */

    function toggleFilterPanel() {
        if (typeof setActivePanel === 'function') {
            setActivePanel('filters');
        }
    }

    /* ---- Actions dropdown ---- */

    function openActionsDropdown() {
        if (!actionsPopover) return;
        closeSearchFlyout();
        var menu = document.getElementById('footer-actions-menu');
        if (menu && actionsBtn) {
            var btnRect = actionsBtn.getBoundingClientRect();
            menu.classList.add('toolbar-actions-visible');
            menu.style.top = btnRect.bottom + 'px';
            menu.style.left = '';
            menu.style.right = '';
            var rightOffset = window.innerWidth - btnRect.right;
            menu.style.right = rightOffset + 'px';
        }
        actionsPopover.classList.remove('anim-dropdown-close');
        actionsPopover.classList.add('toolbar-actions-open');
        if (!reduceMotion.matches) actionsPopover.classList.add('anim-dropdown-open');
        if (actionsBtn) actionsBtn.setAttribute('aria-expanded', 'true');
        actionsOpen = true;
    }

    function closeActionsDropdown() {
        if (!actionsPopover) return;
        if (actionsBtn) actionsBtn.setAttribute('aria-expanded', 'false');
        var wasOpen = actionsOpen;
        actionsOpen = false;
        if (!wasOpen) return;
        var menu = document.getElementById('footer-actions-menu');
        if (reduceMotion.matches) {
            actionsPopover.classList.remove('toolbar-actions-open');
            if (menu) menu.classList.remove('toolbar-actions-visible');
        } else {
            actionsPopover.classList.remove('anim-dropdown-open');
            actionsPopover.classList.add('anim-dropdown-close');
        }
    }

    function toggleActionsDropdown() {
        if (actionsOpen) closeActionsDropdown();
        else openActionsDropdown();
    }

    /* ---- Signals panel toggle ---- */

    function showSignalsPanel() {
        if (!signalsHost) return;
        signalsUserVisible = true;
        signalsHost.classList.remove('u-hidden');
        signalsHost.classList.remove('signals-drawer-hidden');
        if (signalsBtn) signalsBtn.setAttribute('aria-expanded', 'true');
    }

    function hideSignalsPanel() {
        if (!signalsHost) return;
        signalsUserVisible = false;
        signalsHost.classList.add('u-hidden');
        if (signalsBtn) signalsBtn.setAttribute('aria-expanded', 'false');
    }

    function toggleSignalsPanel() {
        if (!signalsHost) return;
        if (signalsHost.classList.contains('u-hidden')) {
            showSignalsPanel();
        } else {
            hideSignalsPanel();
        }
    }

    /* ---- Button wiring ---- */

    if (searchBtn) searchBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleSearchFlyout(); });
    if (filterBtn) filterBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleFilterPanel(); });
    if (signalsBtn) signalsBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleSignalsPanel(); });
    if (actionsBtn) actionsBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleActionsDropdown(); });

    /* ---- Escape key ---- */

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (actionsOpen) { closeActionsDropdown(); e.preventDefault(); return; }
    });

    /* ---- Outside click dismiss (actions only) ---- */

    document.addEventListener('click', function(e) {
        if (!actionsOpen) return;
        var menu = document.getElementById('footer-actions-menu');
        if (menu && !menu.contains(e.target) && e.target !== actionsBtn) {
            closeActionsDropdown();
        }
    });

    /* ---- Close actions dropdown when an action item is clicked ---- */

    var actionItems = document.querySelectorAll('.footer-actions-item');
    for (var ai = 0; ai < actionItems.length; ai++) {
        actionItems[ai].addEventListener('click', closeActionsDropdown);
    }

    /* ---- Sync closeSearch → close flyout ---- */

    var _origCloseSearch = typeof closeSearch === 'function' ? closeSearch : null;
    if (_origCloseSearch) {
        closeSearch = function() { _origCloseSearch(); closeSearchFlyout(); };
    }

    /* ---- Backward-compat aliases ---- */

    window.openFiltersPanel = function() { if (typeof setActivePanel === 'function') setActivePanel('filters'); };
    window.closeFiltersPanel = function() { if (typeof closeFiltersSlideout === 'function') closeFiltersSlideout(); };
    window.openFilterDrawer = window.openFiltersPanel;
    window.closeFilterDrawer = window.closeFiltersPanel;
    window.toggleSearchFlyout = toggleSearchFlyout;
    window.openSearchFlyout = openSearchFlyout;
    window.closeSearchFlyout = closeSearchFlyout;
    window.toggleFilterDrawer = toggleFilterPanel;
    window.toggleSignalsPanel = toggleSignalsPanel;
    window.hideSignalsPanel = hideSignalsPanel;
    window.closeActionsDropdown = closeActionsDropdown;
    window.setFooterActionsOpen = function(open) {
        if (open) openActionsDropdown(); else closeActionsDropdown();
    };

    /* ---- Format toggle (plan 051) ---- */

    var formatBtn = document.getElementById('toolbar-format-btn');

    /** Show/hide the format toggle based on the current file mode. */
    window.updateFormatToggleVisibility = function() {
        if (formatBtn) {
            formatBtn.style.display = (fileMode === 'log') ? 'none' : '';
            formatBtn.classList.toggle('toolbar-icon-btn-active', formatEnabled);
        }
    };

    function toggleFormat() {
        formatEnabled = !formatEnabled;
        if (formatBtn) formatBtn.classList.toggle('toolbar-icon-btn-active', formatEnabled);
        /* Build or clear the mode-specific layout data. */
        if (formatEnabled) {
            if (fileMode === 'markdown' && typeof buildMdSections === 'function') buildMdSections();
            if (fileMode === 'json' && typeof buildJsonBracePairs === 'function') buildJsonBracePairs();
            if (fileMode === 'csv' && typeof buildCsvLayout === 'function') buildCsvLayout();
        }
        if (typeof recalcHeights === 'function') recalcHeights();
        if (typeof buildPrefixSums === 'function') buildPrefixSums();
        if (typeof renderViewport === 'function') renderViewport(true);
    }

    if (formatBtn) formatBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleFormat(); });

    initAnimEnd(searchFlyout);
    if (actionsPopover) {
        actionsPopover.addEventListener('animationend', function() {
            if (actionsPopover.classList.contains('anim-dropdown-close')) {
                actionsPopover.classList.remove('toolbar-actions-open', 'anim-dropdown-close');
                var menu = document.getElementById('footer-actions-menu');
                if (menu) menu.classList.remove('toolbar-actions-visible');
            }
            actionsPopover.classList.remove('anim-dropdown-open');
        });
    }
})();
` + getFilterTabsScript();
}
