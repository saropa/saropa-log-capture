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
    /** Pending auto-close countdown started when a file is opened from the panel.
        The panel lingers briefly so a follow-up selection (viewing another file)
        doesn't require reopening it. null = no countdown in flight. */
    var sessionAutoCloseTimer = null;

    var sessionDisplayOptions = {
        stripDatetime: true, normalizeNames: true, showDayHeadings: true,
        reverseSort: false, showLatestOnly: false, panelWidth: 0, dateRange: 'all',
    };
    /* Match the CSS .session-panel min-width (viewer-styles-session-panel.ts).
       Earlier the CSS dropped to 420 but this JS gate stayed at 560, so the
       drag handle and slot width still refused to shrink — keep them in lock-step. */
    var MIN_PANEL_WIDTH = 420;
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
        /* Hide any peer panel still .visible — #panel-slot stacks every panel in one grid cell,
           so two simultaneous .visible siblings overlap and the earlier one bleeds through. */
        if (typeof hideOtherPanelsInSlot === 'function') { hideOtherPanelsInSlot(sessionPanelEl); }
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
        /* A manual/explicit close cancels any pending auto-close so the timer
           can't fire later and re-close an already-reopened panel. */
        if (sessionAutoCloseTimer) { clearTimeout(sessionAutoCloseTimer); sessionAutoCloseTimer = null; }
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

    ${getSessionRenderingScript()}

    ${getSessionPanelEventsScript()}

    syncToggleButtons();
})();
`;
}
