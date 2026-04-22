"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionPanelHtml = void 0;
exports.getSessionPanelScript = getSessionPanelScript;
/**
 * Session history panel HTML and script for the webview.
 * Displays a list of past log sessions loaded from the extension host.
 */
var viewer_session_panel_html_1 = require("./viewer-session-panel-html");
Object.defineProperty(exports, "getSessionPanelHtml", { enumerable: true, get: function () { return viewer_session_panel_html_1.getSessionPanelHtml; } });
const viewer_session_panel_events_1 = require("./viewer-session-panel-events");
const viewer_session_panel_rendering_1 = require("./viewer-session-panel-rendering");
/** Generate the session panel script. */
function getSessionPanelScript() {
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
    /** Track which day groups are collapsed (keyed by YYYY-MM-DD). */
    var collapsedDays = Object.create(null);
    /** Track which session groups are collapsed (keyed by groupId). */
    var collapsedGroups = Object.create(null);
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
        /* Clear stale items so streaming preview batches don't append after old content. */
        if (sessionListEl) sessionListEl.innerHTML = '';
        vscodeApi.postMessage({ type: 'requestSessionList' });
    }

    ${(0, viewer_session_panel_rendering_1.getSessionRenderingScript)()}

    ${(0, viewer_session_panel_events_1.getSessionPanelEventsScript)()}

    syncToggleButtons();
})();
`;
}
//# sourceMappingURL=viewer-session-panel.js.map