/**
 * Icon bar HTML and script for the right-side vertical activity bar.
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
    <button id="ib-info" class="ib-icon" tabindex="0" title="Session Info">
        <span class="codicon codicon-info"></span>
    </button>
    <button id="ib-options" class="ib-icon" tabindex="0" title="Options">
        <span class="codicon codicon-settings-gear"></span>
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
        info: document.getElementById('ib-info'),
        options: document.getElementById('ib-options'),
    };

    function closeAllPanels() {
        if (typeof closeSearch === 'function') closeSearch();
        if (typeof closeFindPanel === 'function') closeFindPanel();
        if (typeof closeInfoPanel === 'function') closeInfoPanel();
        if (typeof closeOptionsPanel === 'function') closeOptionsPanel();
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
        } else if (name === 'info' && typeof openInfoPanel === 'function') {
            openInfoPanel();
        } else if (name === 'options' && typeof openOptionsPanel === 'function') {
            openOptionsPanel();
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
    if (iconButtons.info) {
        iconButtons.info.addEventListener('click', function() { setActivePanel('info'); });
    }
    if (iconButtons.options) {
        iconButtons.options.addEventListener('click', function() { setActivePanel('options'); });
    }

})();
`;
}
