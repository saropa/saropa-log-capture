/**
 * Icon bar HTML and script for the right-side vertical activity bar.
 *
 * Provides three toggle buttons (sessions, search, options) that open
 * their corresponding slide-out panels with mutual exclusion.
 */

/** Generate the icon bar HTML with codicon-based buttons. */
export function getIconBarHtml(): string {
    return /* html */ `
<div id="icon-bar">
    <button id="ib-sessions" class="ib-icon" title="Session History">
        <span class="codicon codicon-history"></span>
    </button>
    <button id="ib-search" class="ib-icon" title="Search (Ctrl+F)">
        <span class="codicon codicon-search"></span>
    </button>
    <button id="ib-options" class="ib-icon" title="Options">
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
        options: document.getElementById('ib-options'),
    };

    function closeAllPanels() {
        if (typeof closeSearch === 'function') closeSearch();
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
    if (iconButtons.options) {
        iconButtons.options.addEventListener('click', function() { setActivePanel('options'); });
    }
})();
`;
}
