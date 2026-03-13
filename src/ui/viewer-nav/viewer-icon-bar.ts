/**
 * Icon bar HTML and script for the vertical activity bar.
 *
 * Provides toggle buttons (sessions, search, options, etc.) that open
 * their corresponding slide-out panels with mutual exclusion.
 * Optional text labels: click the bar background or separator (not a button) to toggle;
 * preference is persisted in webview state (iconBarLabelsVisible).
 */

/** Generate the icon bar HTML with codicon-based buttons and optional labels. */
export function getIconBarHtml(): string {
    return /* html */ `
<div id="icon-bar" role="toolbar" aria-label="Log viewer tools" title="Click bar to show or hide icon labels">
    <button id="ib-sessions" class="ib-icon" tabindex="0" title="Project Logs" aria-label="Project Logs">
        <span class="codicon codicon-files"></span><span class="ib-label">Project Logs</span>
    </button>
    <button id="ib-search" class="ib-icon" tabindex="0" title="Search (Ctrl+F)" aria-label="Search (Ctrl+F)">
        <span class="codicon codicon-search"></span><span class="ib-label">Search</span>
    </button>
    <button id="ib-find" class="ib-icon" tabindex="0" title="Find in Files (Ctrl+Shift+F)" aria-label="Find in Files (Ctrl+Shift+F)">
        <span class="codicon codicon-list-filter"></span><span class="ib-label">Find</span>
    </button>
    <button id="ib-bookmarks" class="ib-icon" tabindex="0" title="Bookmarks" aria-label="Bookmarks">
        <span class="codicon codicon-bookmark"></span><span id="ib-bookmarks-badge" class="ib-badge"></span><span class="ib-label">Bookmarks</span>
    </button>
    <button id="ib-filters" class="ib-icon" tabindex="0" title="Filters" aria-label="Filters">
        <span class="codicon codicon-filter"></span><span class="ib-label">Filters</span>
    </button>
    <button id="ib-trash" class="ib-icon" tabindex="0" title="Trash" aria-label="Trash">
        <span class="codicon codicon-trash"></span><span id="ib-trash-badge" class="ib-badge"></span><span class="ib-label">Trash</span>
    </button>
    <button id="ib-options" class="ib-icon" tabindex="0" title="Options" aria-label="Options">
        <span class="codicon codicon-settings-gear"></span><span class="ib-label">Options</span>
    </button>
    <div class="ib-separator"></div>
    <button id="ib-replay" class="ib-icon" tabindex="0" title="Replay controls" aria-label="Replay controls">
        <span class="codicon codicon-debug-start"></span><span class="ib-label">Replay</span>
    </button>
    <button id="ib-crashlytics" class="ib-icon" tabindex="0" title="Crashlytics" aria-label="Crashlytics">
        <span class="codicon codicon-flame"></span><span class="ib-label">Crashlytics</span>
    </button>
    <button id="ib-recurring" class="ib-icon" tabindex="0" title="Recurring Errors" aria-label="Recurring Errors">
        <span class="codicon codicon-bug"></span><span class="ib-label">Recurring</span>
    </button>
    <button id="ib-performance" class="ib-icon" tabindex="0" title="Performance" aria-label="Performance">
        <span class="codicon codicon-graph-line"></span><span class="ib-label">Performance</span>
    </button>
    <button id="ib-about" class="ib-icon" tabindex="0" title="About Saropa" aria-label="About Saropa">
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
        search: document.getElementById('ib-search'),
        find: document.getElementById('ib-find'),
        bookmarks: document.getElementById('ib-bookmarks'),
        filters: document.getElementById('ib-filters'),
        trash: document.getElementById('ib-trash'),
        options: document.getElementById('ib-options'),
        crashlytics: document.getElementById('ib-crashlytics'),
        recurring: document.getElementById('ib-recurring'),
        performance: document.getElementById('ib-performance'),
        about: document.getElementById('ib-about'),
    };

    function closeAllPanels() {
        if (typeof closeSearch === 'function') closeSearch();
        if (typeof closeFindPanel === 'function') closeFindPanel();
        if (typeof closeBookmarkPanel === 'function') closeBookmarkPanel();
        if (typeof closeFiltersPanel === 'function') closeFiltersPanel();
        if (typeof closeOptionsPanel === 'function') closeOptionsPanel();
        if (typeof closeTrashPanel === 'function') closeTrashPanel();
        if (typeof closeCrashlyticsPanel === 'function') closeCrashlyticsPanel();
        if (typeof closeRecurringPanel === 'function') closeRecurringPanel();
        if (typeof closePerformancePanel === 'function') closePerformancePanel();
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
        } else if (name === 'search' && typeof openSearch === 'function') {
            openSearch();
        } else if (name === 'find' && typeof openFindPanel === 'function') {
            openFindPanel();
        } else if (name === 'bookmarks' && typeof openBookmarkPanel === 'function') {
            openBookmarkPanel();
        } else if (name === 'filters' && typeof openFiltersPanel === 'function') {
            openFiltersPanel();
        } else if (name === 'trash' && typeof openTrashPanel === 'function') {
            openTrashPanel();
        } else if (name === 'options' && typeof openOptionsPanel === 'function') {
            openOptionsPanel();
        } else if (name === 'crashlytics' && typeof openCrashlyticsPanel === 'function') {
            openCrashlyticsPanel();
        } else if (name === 'recurring' && typeof openRecurringPanel === 'function') {
            openRecurringPanel();
        } else if (name === 'performance' && typeof openPerformancePanel === 'function') {
            openPerformancePanel();
        } else if (name === 'about' && typeof openAboutPanel === 'function') {
            openAboutPanel();
        }
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
    if (iconButtons.search) {
        iconButtons.search.addEventListener('click', function() { setActivePanel('search'); });
    }
    if (iconButtons.find) {
        iconButtons.find.addEventListener('click', function() { setActivePanel('find'); });
    }
    if (iconButtons.bookmarks) {
        iconButtons.bookmarks.addEventListener('click', function() { setActivePanel('bookmarks'); });
    }
    if (iconButtons.filters) {
        iconButtons.filters.addEventListener('click', function() { setActivePanel('filters'); });
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
    if (iconButtons.recurring) {
        iconButtons.recurring.addEventListener('click', function() { setActivePanel('recurring'); });
    }
    if (iconButtons.performance) {
        iconButtons.performance.addEventListener('click', function() { setActivePanel('performance'); });
    }
    if (iconButtons.about) {
        iconButtons.about.addEventListener('click', function() { setActivePanel('about'); });
    }

    var replayBtn = document.getElementById('ib-replay');
    if (replayBtn) {
        replayBtn.addEventListener('click', function() {
            if (typeof window.toggleReplayBar === 'function') window.toggleReplayBar();
        });
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

    setActivePanel('sessions');
})();
`;
}
