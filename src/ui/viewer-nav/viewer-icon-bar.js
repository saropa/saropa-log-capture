"use strict";
/**
 * Icon bar interaction script for the vertical activity bar.
 *
 * Tools open a slide-out panel in `#panel-slot` with mutual exclusion. In-log search lives only
 * in the session-nav field (top bar); use Ctrl+F / focus the search input — not an icon here.
 *
 * HTML markup lives in viewer-icon-bar-html.ts; re-exported here so callers can
 * continue importing both from this module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIconBarHtml = void 0;
exports.getIconBarScript = getIconBarScript;
var viewer_icon_bar_html_1 = require("./viewer-icon-bar-html");
Object.defineProperty(exports, "getIconBarHtml", { enumerable: true, get: function () { return viewer_icon_bar_html_1.getIconBarHtml; } });
/** Generate the icon bar toggle script. */
function getIconBarScript() {
    return /* js */ `
(function() {
    var activePanel = null;
    var panelSlot = document.getElementById('panel-slot');
    var iconBar = document.getElementById('icon-bar');
    var MIN_PANEL_WIDTH = 560;

    /**
     * Update both the overlay badge (icons-only mode) and inline count label
     * (labels-visible mode) for an icon bar button.
     * Badge ID convention: ib-{name}-badge, count ID: ib-{name}-count.
     * Caps display at 99; shows "99+" for counts above 99.
     */
    window.updateIconBadge = function(badgeId, countId, count) {
        var text = count > 99 ? '99+' : String(count);
        var badge = document.getElementById(badgeId);
        if (badge) {
            badge.textContent = text;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        var countEl = document.getElementById(countId);
        if (countEl) {
            countEl.textContent = count > 0 ? ' (' + text + ')' : '';
        }
    };

    /** Restore and persist icon bar label visibility (uses same webview state as other viewer UI). */
    var api = typeof vscodeApi !== 'undefined' ? vscodeApi : (window._vscodeApi || null);
    function getLabelsVisible() {
        if (!api) return false;
        var st = api.getState();
        return st && st.iconBarLabelsVisible === true;
    }
    function setLabelsVisible(visible) {
        if (!api) return;
        var st = api.getState() || {};
        st.iconBarLabelsVisible = !!visible;
        api.setState(st);
    }
    function applyLabelsVisible() {
        var visible = getLabelsVisible();
        if (iconBar) iconBar.classList.toggle('ib-labels-visible', visible);
    }
    applyLabelsVisible();

    /** Pending transitionend handler so we can remove it if user switches panel before transition ends (avoids listener accumulation). */
    var pendingOpenHandler = null;

    /** Shared width for all slide-out panels so the sidebar does not resize when switching; source: session display options panelWidth. */
    function getSharedPanelWidth() {
        return Math.max(MIN_PANEL_WIDTH, window.__sharedPanelWidth || 0);
    }

    /** Set panel-slot width to show/hide the active panel with animation. Open: keep overflow hidden until transition ends so panel slides in without overlapping. */
    function updatePanelSlotWidth(name) {
        if (!panelSlot) return;
        /* In-log search lives in the session nav; never reserve slide-out width for it. */
        if (!name) {
            panelSlot.classList.remove('open');
            panelSlot.style.width = '0';
            if (pendingOpenHandler) {
                panelSlot.removeEventListener('transitionend', pendingOpenHandler);
                pendingOpenHandler = null;
            }
            return;
        }
        if (pendingOpenHandler) {
            panelSlot.removeEventListener('transitionend', pendingOpenHandler);
            pendingOpenHandler = null;
        }
        var maxW = document.documentElement.clientWidth * 0.7;
        var w = Math.min(getSharedPanelWidth(), maxW);
        panelSlot.classList.remove('open');
        panelSlot.style.width = '0px';
        panelSlot.offsetHeight;
        panelSlot.style.width = w + 'px';
        function addOpenAfterTransition(e) {
            if (e.propertyName !== 'width') return;
            panelSlot.removeEventListener('transitionend', pendingOpenHandler);
            pendingOpenHandler = null;
            if (panelSlot.style.width !== '0px') { panelSlot.classList.add('open'); }
        }
        pendingOpenHandler = addOpenAfterTransition;
        panelSlot.addEventListener('transitionend', addOpenAfterTransition);
    }

    /** Update panel-slot width externally (e.g. during resize drag). */
    window.setPanelSlotWidth = function(w) {
        if (!panelSlot) return;
        panelSlot.style.width = w + 'px';
    };

    var iconButtons = {
        sessions: document.getElementById('ib-sessions'),
        find: document.getElementById('ib-find'),
        bookmarks: document.getElementById('ib-bookmarks'),
        sqlHistory: document.getElementById('ib-sql-query-history'),
        trash: document.getElementById('ib-trash'),
        options: document.getElementById('ib-options'),

        collections: document.getElementById('ib-collections'),
        crashlytics: document.getElementById('ib-crashlytics'),
        signal: document.getElementById('ib-signal'),
        about: document.getElementById('ib-about'),
    };

    function closeAllPanels() {
        if (typeof closeSearch === 'function') closeSearch();
        if (typeof closeFindPanel === 'function') closeFindPanel();
        if (typeof closeBookmarkPanel === 'function') closeBookmarkPanel();
        if (typeof closeFiltersSlideout === 'function') closeFiltersSlideout();
        if (typeof closeSqlQueryHistoryPanel === 'function') closeSqlQueryHistoryPanel();
        if (typeof closeOptionsPanel === 'function') closeOptionsPanel();
        if (typeof closeTrashPanel === 'function') closeTrashPanel();
        if (typeof closeCollectionsPanel === 'function') closeCollectionsPanel();
        if (typeof closeCrashlyticsPanel === 'function') closeCrashlyticsPanel();
        if (typeof closeSignalPanel === 'function') closeSignalPanel();
        if (typeof closeAboutPanel === 'function') closeAboutPanel();
        if (typeof closeSessionPanel === 'function') closeSessionPanel();
    }

    function updateIconStates() {
        for (var key in iconButtons) {
            if (iconButtons[key]) {
                iconButtons[key].classList.toggle('ib-active', key === activePanel);
            }
        }
    }

    /** Central panel toggle — enforces mutual exclusion. */
    window.setActivePanel = function(name) {
        if (name === activePanel) {
            closeAllPanels();
            activePanel = null;
            updateIconStates();
            updatePanelSlotWidth(null);
            return;
        }
        closeAllPanels();
        activePanel = name;
        updateIconStates();
        updatePanelSlotWidth(name);
        if (name === 'sessions' && typeof openSessionPanel === 'function') {
            openSessionPanel();
        } else if (name === 'find' && typeof openFindPanel === 'function') {
            openFindPanel();
        } else if (name === 'bookmarks' && typeof openBookmarkPanel === 'function') {
            openBookmarkPanel();
        } else if (name === 'sqlHistory' && typeof openSqlQueryHistoryPanel === 'function') {
            openSqlQueryHistoryPanel();
        } else if (name === 'trash' && typeof openTrashPanel === 'function') {
            openTrashPanel();
        } else if (name === 'options' && typeof openOptionsPanel === 'function') {
            openOptionsPanel();
        } else if (name === 'collections' && typeof openCollectionsPanel === 'function') {
            openCollectionsPanel();
        } else if (name === 'crashlytics' && typeof openCrashlyticsPanel === 'function') {
            openCrashlyticsPanel();
        } else if (name === 'signal' && typeof openSignalPanel === 'function') {
            openSignalPanel();
        } else if (name === 'about' && typeof openAboutPanel === 'function') {
            openAboutPanel();
        } else if (name === 'filters' && typeof openFiltersSlideout === 'function') {
            openFiltersSlideout();
        }
    };

    /**
     * Open the Signal slide-out without treating a second request as "close".
     * The header Performance chip uses this: setActivePanel('signal') alone toggles off when
     * Signal is already active, leaving panel-slot width 0 so nothing appears.
     */
    window.ensureSignalSlideoutOpen = function() {
        if (activePanel === 'signal') {
            if (typeof openSignalPanel === 'function') openSignalPanel();
            return;
        }
        setActivePanel('signal');
    };

    /** Allow panels to clear their icon state when closed externally. */
    window.clearActivePanel = function(name) {
        if (activePanel === name) {
            activePanel = null;
            updateIconStates();
            updatePanelSlotWidth(null);
        }
    };

    if (iconButtons.sessions) {
        iconButtons.sessions.addEventListener('click', function() { setActivePanel('sessions'); });
    }
    if (iconButtons.find) {
        iconButtons.find.addEventListener('click', function() { setActivePanel('find'); });
    }
    if (iconButtons.bookmarks) {
        iconButtons.bookmarks.addEventListener('click', function() { setActivePanel('bookmarks'); });
    }
    if (iconButtons.sqlHistory) {
        iconButtons.sqlHistory.addEventListener('click', function() { setActivePanel('sqlHistory'); });
    }
    if (iconButtons.trash) {
        iconButtons.trash.addEventListener('click', function() { setActivePanel('trash'); });
    }
    if (iconButtons.options) {
        iconButtons.options.addEventListener('click', function() { setActivePanel('options'); });
    }
    if (iconButtons.collections) {
        iconButtons.collections.addEventListener('click', function() { setActivePanel('collections'); });
    }
    if (iconButtons.crashlytics) {
        iconButtons.crashlytics.addEventListener('click', function() { setActivePanel('crashlytics'); });
    }
    if (iconButtons.signal) {
        iconButtons.signal.addEventListener('click', function() { setActivePanel('signal'); });
    }
    if (iconButtons.about) {
        iconButtons.about.addEventListener('click', function() { setActivePanel('about'); });
    }

    /** Click on bar background or separator (not on an icon button) toggles label visibility. */
    if (iconBar) {
        iconBar.addEventListener('click', function(e) {
            var t = e.target;
            if (!t) return;
            while (t && t !== iconBar) {
                if (t.classList && t.classList.contains('ib-icon')) return;
                t = t.parentElement;
            }
            setLabelsVisible(!getLabelsVisible());
            applyLabelsVisible();
        });
    }

    /* ---- Focus trap + Escape ---- */
    var FOCUSABLE = 'button:not([disabled]):not([style*="display:none"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    document.addEventListener('keydown', function(e) {
        if (!activePanel || !panelSlot) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            setActivePanel(activePanel);
            return;
        }

        if (e.key !== 'Tab') return;

        var children = panelSlot.children;
        var panel = null;
        for (var i = 0; i < children.length; i++) {
            if (children[i].classList.contains('visible')) { panel = children[i]; break; }
        }
        if (!panel) return;

        var focusable = Array.prototype.filter.call(
            panel.querySelectorAll(FOCUSABLE),
            function(el) { return el.offsetParent !== null; }
        );
        if (focusable.length === 0) return;

        var first = focusable[0];
        var last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });

    setActivePanel('sessions');
})();
`;
}
//# sourceMappingURL=viewer-icon-bar.js.map