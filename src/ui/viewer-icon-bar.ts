/**
 * Icon bar HTML and script for the vertical activity bar.
 *
 * Provides toggle buttons (sessions, search, info, options) that open
 * their corresponding slide-out panels with mutual exclusion.
 */

/** Generate the icon bar HTML with codicon-based buttons. */
export function getIconBarHtml(): string {
    return /* html */ `
<div id="icon-bar">
    <button id="ib-sessions" class="ib-icon" tabindex="0" title="Project Logs">
        <span class="codicon codicon-files"></span>
    </button>
    <button id="ib-search" class="ib-icon" tabindex="0" title="Search (Ctrl+F)">
        <span class="codicon codicon-search"></span>
    </button>
    <button id="ib-find" class="ib-icon" tabindex="0" title="Find in Files (Ctrl+Shift+F)">
        <span class="codicon codicon-list-filter"></span>
    </button>
    <button id="ib-bookmarks" class="ib-icon" tabindex="0" title="Bookmarks">
        <span class="codicon codicon-bookmark"></span>
        <span id="ib-bookmarks-badge" class="ib-badge"></span>
    </button>
    <button id="ib-filters" class="ib-icon" tabindex="0" title="Filters">
        <span class="codicon codicon-filter"></span>
    </button>
    <button id="ib-info" class="ib-icon" tabindex="0" title="Session Info">
        <span class="codicon codicon-info"></span>
    </button>
    <button id="ib-trash" class="ib-icon" tabindex="0" title="Trash">
        <span class="codicon codicon-trash"></span>
        <span id="ib-trash-badge" class="ib-badge"></span>
    </button>
    <button id="ib-options" class="ib-icon" tabindex="0" title="Options">
        <span class="codicon codicon-settings-gear"></span>
    </button>
    <div class="ib-separator"></div>
    <button id="ib-crashlytics" class="ib-icon" tabindex="0" title="Crashlytics">
        <span class="codicon codicon-flame"></span>
    </button>
    <button id="ib-recurring" class="ib-icon" tabindex="0" title="Recurring Errors">
        <span class="codicon codicon-bug"></span>
    </button>
    <button id="ib-about" class="ib-icon" tabindex="0" title="About Saropa">
        <span class="codicon codicon-home"></span>
    </button>
</div>`;
}

/** Generate the icon bar toggle script. */
export function getIconBarScript(): string {
    return /* js */ `
(function() {
    var activePanel = null;
    var iconButtons = {
        sessions: document.getElementById('ib-sessions'),
        search: document.getElementById('ib-search'),
        find: document.getElementById('ib-find'),
        bookmarks: document.getElementById('ib-bookmarks'),
        filters: document.getElementById('ib-filters'),
        info: document.getElementById('ib-info'),
        trash: document.getElementById('ib-trash'),
        options: document.getElementById('ib-options'),
        crashlytics: document.getElementById('ib-crashlytics'),
        recurring: document.getElementById('ib-recurring'),
        about: document.getElementById('ib-about'),
    };

    function closeAllPanels() {
        if (typeof closeSearch === 'function') closeSearch();
        if (typeof closeFindPanel === 'function') closeFindPanel();
        if (typeof closeBookmarkPanel === 'function') closeBookmarkPanel();
        if (typeof closeFiltersPanel === 'function') closeFiltersPanel();
        if (typeof closeInfoPanel === 'function') closeInfoPanel();
        if (typeof closeOptionsPanel === 'function') closeOptionsPanel();
        if (typeof closeTrashPanel === 'function') closeTrashPanel();
        if (typeof closeCrashlyticsPanel === 'function') closeCrashlyticsPanel();
        if (typeof closeRecurringPanel === 'function') closeRecurringPanel();
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
            return;
        }
        closeAllPanels();
        activePanel = name;
        updateIconStates();
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
        } else if (name === 'info' && typeof openInfoPanel === 'function') {
            openInfoPanel();
        } else if (name === 'trash' && typeof openTrashPanel === 'function') {
            openTrashPanel();
        } else if (name === 'options' && typeof openOptionsPanel === 'function') {
            openOptionsPanel();
        } else if (name === 'crashlytics' && typeof openCrashlyticsPanel === 'function') {
            openCrashlyticsPanel();
        } else if (name === 'recurring' && typeof openRecurringPanel === 'function') {
            openRecurringPanel();
        } else if (name === 'about' && typeof openAboutPanel === 'function') {
            openAboutPanel();
        }
    };

    /** Allow panels to clear their icon state when closed externally. */
    window.clearActivePanel = function(name) {
        if (activePanel === name) {
            activePanel = null;
            updateIconStates();
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
    if (iconButtons.info) {
        iconButtons.info.addEventListener('click', function() { setActivePanel('info'); });
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
    if (iconButtons.about) {
        iconButtons.about.addEventListener('click', function() { setActivePanel('about'); });
    }

    setActivePanel('sessions');
})();
`;
}
