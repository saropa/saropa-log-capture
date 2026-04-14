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
    /* Shared helpers for inlined fragments (rendering, events, etc.). Do not remove; fragments rely on these. */
    function escapeAttr(str) { return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    function escapeHtmlText(str) { return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

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

    /**
     * Name-based filter for the session list.
     * mode 'hide' = hide all sessions matching this canonical name.
     * mode 'only' = show only sessions matching this canonical name.
     * rawBasename stores the pre-transform basename so the filter adapts
     * when display options (stripDatetime, normalizeNames) change.
     * null = no name filter active.
     */
    var sessionNameFilter = null; /* { mode: 'hide'|'only', rawBasename: string } */

    /** Get the raw (pre-transform) basename for a session record. */
    function getSessionRawBasename(s) {
        return getSessionBasename(s.displayName || s.filename);
    }

    /**
     * Set name filter from context menu and re-render.
     * Accepts the raw basename (before display-option transforms) so the
     * filter stays correct when the user toggles Dates/Tidy after filtering.
     */
    window.setSessionNameFilter = function(mode, rawBasename) {
        sessionNameFilter = { mode: mode, rawBasename: rawBasename };
        sessionListPage = 0;
        if (cachedSessions) renderSessionList(cachedSessions);
    };

    /** Clear the name filter and re-render. */
    window.clearSessionNameFilter = function() {
        sessionNameFilter = null;
        sessionListPage = 0;
        if (cachedSessions) renderSessionList(cachedSessions);
    };

    /** Opens panel and moves focus into it for a11y (keyboard/screen-reader). */
    window.openSessionPanel = function() {
        if (!sessionPanelEl) return;
        sessionPanelOpen = true;
        sessionPanelEl.classList.add('visible');
        requestSessionList();
        requestAnimationFrame(function() {
            var first = sessionPanelEl.querySelector('button[id="session-close"], #session-date-range, button.session-panel-action');
            if (first) first.focus();
        });
    };

    /** Closes panel and returns focus to icon bar for a11y. */
    window.closeSessionPanel = function() {
        if (!sessionPanelEl) return;
        sessionPanelEl.classList.remove('visible');
        sessionPanelOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('sessions');
        var sessionsBtn = document.getElementById('ib-sessions');
        if (sessionsBtn) sessionsBtn.focus();
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
