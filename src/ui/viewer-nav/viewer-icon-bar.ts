/**
 * Icon bar HTML and script for the vertical activity bar.
 *
 * Tools open a slide-out panel in `#panel-slot` with mutual exclusion. In-log search lives only
 * in the session-nav field (top bar); use Ctrl+F / focus the search input — not an icon here.
 *
 * Optional text labels: click the bar background or separator (not a button) to toggle;
 * preference is persisted in webview state (iconBarLabelsVisible).
 */

/** Generate the icon bar HTML with codicon-based buttons and optional labels. */
export function getIconBarHtml(): string {
    return /* html */ `
<div id="icon-bar" role="toolbar" aria-label="Log viewer tools" title="Click bar to show or hide icon labels">
    <button id="ib-sessions" class="ib-icon" tabindex="0" title="Click to open/close — browse and switch between log sessions in this project" aria-label="Project Logs">
        <span class="codicon codicon-files"></span><span class="ib-label">Project Logs</span>
    </button>
    <button id="ib-find" class="ib-icon" tabindex="0" title="Click to open/close — search across all log files in this project (Ctrl+Shift+F)" aria-label="Find in Files (Ctrl+Shift+F)">
        <span class="codicon codicon-list-filter"></span><span class="ib-label">Find</span>
    </button>
    <button id="ib-bookmarks" class="ib-icon" tabindex="0" title="Click to open/close — view and manage bookmarked log lines" aria-label="Bookmarks">
        <span class="codicon codicon-bookmark"></span><span id="ib-bookmarks-badge" class="ib-badge"></span><span class="ib-label">Bookmarks</span>
    </button>
    <button id="ib-sql-query-history" class="ib-icon" tabindex="0" title="Click to open/close — browse SQL queries captured during this session" aria-label="SQL Query History">
        <span class="codicon codicon-database"></span><span class="ib-label">SQL History</span>
    </button>
    <button id="ib-trash" class="ib-icon" tabindex="0" title="Click to open/close — view and restore deleted log sessions" aria-label="Trash">
        <span class="codicon codicon-trash"></span><span id="ib-trash-badge" class="ib-badge"></span><span class="ib-label">Trash</span>
    </button>
    <button id="ib-options" class="ib-icon" tabindex="0" title="Click to open/close — display, layout, and audio settings" aria-label="Options">
        <span class="codicon codicon-settings-gear"></span><span class="ib-label">Options</span>
    </button>
    <div class="ib-separator"></div>
    <button id="ib-crashlytics" class="ib-icon" tabindex="0" title="Click to open/close — Firebase Crashlytics crash reports" aria-label="Crashlytics">
        <span class="codicon codicon-flame"></span><span class="ib-label">Crashlytics</span>
    </button>
    <button id="ib-signal" class="ib-icon" tabindex="0" title="Click to open/close — signals, errors, warnings, and performance analysis" aria-label="Signals">
        <span class="codicon codicon-pulse"></span><span class="ib-label">Signals</span>
    </button>
    <button id="ib-about" class="ib-icon" tabindex="0" title="Click to open/close — version info, links, and help" aria-label="About Saropa">
        <span class="codicon codicon-home"></span><span class="ib-label">About</span>
    </button>
</div>`;
}

/** Generate the icon bar toggle script. */
export function getIconBarScript(): string {
    return /* js */ `
(function() {
    var activePanel = null;
    var panelSlot = document.getElementById('panel-slot');
    var iconBar = document.getElementById('icon-bar');
    var MIN_PANEL_WIDTH = 560;

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
        crashlytics: document.getElementById('ib-crashlytics'),
        signal: document.getElementById('ib-signal'),
        about: document.getElementById('ib-about'),
    };

    function closeAllPanels() {
        if (typeof closeSearch === 'function') closeSearch();
        if (typeof closeFindPanel === 'function') closeFindPanel();
        if (typeof closeBookmarkPanel === 'function') closeBookmarkPanel();
        if (typeof closeFiltersPanel === 'function') closeFiltersPanel();
        if (typeof closeSqlQueryHistoryPanel === 'function') closeSqlQueryHistoryPanel();
        if (typeof closeOptionsPanel === 'function') closeOptionsPanel();
        if (typeof closeTrashPanel === 'function') closeTrashPanel();
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
        } else if (name === 'crashlytics' && typeof openCrashlyticsPanel === 'function') {
            openCrashlyticsPanel();
        } else if (name === 'signal' && typeof openSignalPanel === 'function') {
            openSignalPanel();
        } else if (name === 'about' && typeof openAboutPanel === 'function') {
            openAboutPanel();
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
