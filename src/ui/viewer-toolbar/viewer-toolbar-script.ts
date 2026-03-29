/**
 * Toolbar interaction script: flyout open/close, Signals mutual exclusion,
 * actions dropdown, and session nav wiring.
 *
 * Loaded after the icon bar script so it can override `openFiltersPanel` /
 * `closeFiltersPanel` with drawer equivalents for backward compatibility.
 */

/** Returns the toolbar interaction JavaScript. */
export function getToolbarScript(): string {
    return /* javascript */ `
(function() {
    var searchFlyout = document.getElementById('search-flyout');
    var filterDrawer = document.getElementById('filter-drawer');
    var signalsHost = document.getElementById('root-cause-hypotheses');
    var searchBtn = document.getElementById('toolbar-search-btn');
    var filterBtn = document.getElementById('toolbar-filter-btn');
    var actionsBtn = document.getElementById('toolbar-actions-btn');
    var actionsPopover = document.getElementById('footer-actions-popover');
    var signalsWasVisible = false;
    var actionsOpen = false;

    /* ---- Search flyout ---- */

    function openSearchFlyout() {
        if (!searchFlyout) return;
        closeActionsDropdown();
        searchFlyout.classList.remove('u-hidden');
        if (searchBtn) searchBtn.setAttribute('aria-expanded', 'true');
        var input = document.getElementById('search-input');
        if (input) input.focus();
    }

    function closeSearchFlyout() {
        if (!searchFlyout) return;
        searchFlyout.classList.add('u-hidden');
        if (searchBtn) searchBtn.setAttribute('aria-expanded', 'false');
    }

    function toggleSearchFlyout() {
        if (!searchFlyout) return;
        if (searchFlyout.classList.contains('u-hidden')) {
            openSearchFlyout();
        } else {
            closeSearchFlyout();
        }
    }

    /* ---- Filter drawer ---- */

    function openFilterDrawer() {
        if (!filterDrawer) return;
        closeActionsDropdown();
        if (signalsHost && !signalsHost.classList.contains('u-hidden')) {
            signalsWasVisible = true;
            signalsHost.classList.add('u-hidden');
        }
        filterDrawer.classList.remove('u-hidden');
        if (filterBtn) filterBtn.setAttribute('aria-expanded', 'true');
        if (typeof syncFiltersPanelUi === 'function') syncFiltersPanelUi();
    }

    function closeFilterDrawer() {
        if (!filterDrawer) return;
        filterDrawer.classList.add('u-hidden');
        if (filterBtn) filterBtn.setAttribute('aria-expanded', 'false');
        if (signalsWasVisible && signalsHost) {
            signalsHost.classList.remove('u-hidden');
            signalsWasVisible = false;
        }
    }

    function toggleFilterDrawer() {
        if (!filterDrawer) return;
        if (filterDrawer.classList.contains('u-hidden')) {
            openFilterDrawer();
        } else {
            closeFilterDrawer();
        }
    }

    /* ---- Actions dropdown ---- */

    function openActionsDropdown() {
        if (!actionsPopover) return;
        closeSearchFlyout();
        closeFilterDrawer();
        actionsPopover.classList.add('toolbar-actions-open');
        if (actionsBtn) actionsBtn.setAttribute('aria-expanded', 'true');
        actionsOpen = true;
    }

    function closeActionsDropdown() {
        if (!actionsPopover) return;
        actionsPopover.classList.remove('toolbar-actions-open');
        if (actionsBtn) actionsBtn.setAttribute('aria-expanded', 'false');
        actionsOpen = false;
    }

    function toggleActionsDropdown() {
        if (actionsOpen) closeActionsDropdown();
        else openActionsDropdown();
    }

    /* ---- Accordion sections ---- */

    function initAccordions() {
        var headers = document.querySelectorAll('.filter-accordion-header');
        for (var i = 0; i < headers.length; i++) {
            headers[i].addEventListener('click', handleAccordionClick);
        }
    }

    function handleAccordionClick(e) {
        var header = e.currentTarget;
        var section = header.parentElement;
        var body = header.nextElementSibling;
        if (!body) return;
        var wasOpen = !body.hidden;
        collapseAllAccordions();
        if (!wasOpen) {
            body.hidden = false;
            if (section) section.classList.add('expanded');
            header.setAttribute('aria-expanded', 'true');
        }
    }

    function collapseAllAccordions() {
        var sections = document.querySelectorAll('.filter-accordion');
        for (var i = 0; i < sections.length; i++) {
            sections[i].classList.remove('expanded');
            var hdr = sections[i].querySelector('.filter-accordion-header');
            var body = sections[i].querySelector('.filter-accordion-body');
            if (body) body.hidden = true;
            if (hdr) hdr.setAttribute('aria-expanded', 'false');
        }
    }

    /* ---- Button wiring ---- */

    if (searchBtn) searchBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleSearchFlyout(); });
    if (filterBtn) filterBtn.addEventListener('click', toggleFilterDrawer);
    if (actionsBtn) actionsBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleActionsDropdown(); });

    /* ---- Escape key ---- */

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (actionsOpen) { closeActionsDropdown(); e.preventDefault(); return; }
        if (filterDrawer && !filterDrawer.classList.contains('u-hidden')) {
            closeFilterDrawer();
            e.preventDefault();
            return;
        }
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

    window.openFiltersPanel = openFilterDrawer;
    window.closeFiltersPanel = closeFilterDrawer;
    window.openFilterDrawer = openFilterDrawer;
    window.closeFilterDrawer = closeFilterDrawer;
    window.toggleSearchFlyout = toggleSearchFlyout;
    window.openSearchFlyout = openSearchFlyout;
    window.closeSearchFlyout = closeSearchFlyout;
    window.toggleFilterDrawer = toggleFilterDrawer;
    window.closeActionsDropdown = closeActionsDropdown;
    /** Backward compat for replay script's action toggle. */
    window.setFooterActionsOpen = function(open) {
        if (open) openActionsDropdown(); else closeActionsDropdown();
    };

    initAccordions();
})();
`;
}
