/**
 * Session history panel HTML and script for the webview.
 * Displays a list of past log sessions loaded from the extension host.
 */
export { getSessionPanelHtml } from './viewer-session-panel-html';
import { getSessionPanelEventsScript } from './viewer-session-panel-events';
import { getSessionRenderingScript } from './viewer-session-panel-rendering';

/** Generate the session panel script. */
export function getSessionPanelScript(): string {
  return /* js */ `
(function() {
    var sessionPanelOpen = false;
    var sessionPanelEl = document.getElementById('session-panel');
    var sessionListEl = document.getElementById('session-list');
    var sessionListPaginationEl = document.getElementById('session-list-pagination');
    var sessionEmptyEl = document.getElementById('session-empty');
    var sessionLoadingEl = document.getElementById('session-loading');
    var cachedSessions = null;
    var sessionListPage = 0;

    var sessionDisplayOptions = {
        stripDatetime: true, normalizeNames: true, showDayHeadings: true,
        reverseSort: false, showLatestOnly: false, panelWidth: 0, dateRange: 'all',
    };
    var MIN_PANEL_WIDTH = 560;
    var selectedSessionUris = Object.create(null);
    window.__sharedPanelWidth = MIN_PANEL_WIDTH;

    window.openSessionPanel = function() {
        if (!sessionPanelEl) return;
        sessionPanelOpen = true;
        sessionPanelEl.classList.add('visible');
        requestSessionList();
    };

    window.closeSessionPanel = function() {
        if (!sessionPanelEl) return;
        sessionPanelEl.classList.remove('visible');
        sessionPanelOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('sessions');
    };
    window.rerenderSessionList = function() { if (cachedSessions) renderSessionList(cachedSessions); };

    function requestSessionList() {
        if (sessionLoadingEl) sessionLoadingEl.style.display = '';
        if (sessionEmptyEl) sessionEmptyEl.style.display = 'none';
        vscodeApi.postMessage({ type: 'requestSessionList' });
    }

    ${getSessionRenderingScript()}

    ${getSessionPanelEventsScript()}

    syncToggleButtons();
})();
`;
}
