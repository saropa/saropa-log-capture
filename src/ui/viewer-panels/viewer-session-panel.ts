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
    /** Set when openSessionPanel runs; renderSessionList consumes it once to scroll
        the panel to the file currently open in the viewer (so the user lands on the
        row they care about instead of the previous scroll position, which after a
        rerender stayed at the bottom of the previous content). Cleared after one use
        so subsequent rerenders (filter toggles, pagination) don't fight the user's scroll. */
    var pendingScrollOnOpen = false;

    var sessionDisplayOptions = {
        stripDatetime: true, normalizeNames: true, showDayHeadings: true,
        /* showLatestOnly defaults ON: the list shows the newest log per name with a "+N older"
           badge for the rest, so a busy reports folder stays scannable without burying older runs
           (they expand on click). Matches defaultDisplayOptions on the host so the first paint —
           before the setSessionDisplayOptions round-trip — already collapses correctly. */
        reverseSort: false, showLatestOnly: true, panelWidth: 0, dateRange: 'all',
        newerLogBannerEnabled: true, newerLogDotEnabled: true,
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
    /** Track which Controller blocks are collapsed (keyed by "ctrl:<uriString>"). Persists through
        setSessionDisplayOptions like collapsedGroups so a folded controller stays folded across
        re-renders and reloads. */
    var collapsedControllers = Object.create(null);
    /** Canonical names whose hidden older logs the user expanded via the "+N older" badge while
        "Latest only" is on. Transient (not persisted) — a re-open of the panel starts collapsed,
        matching how a fresh "Latest only" view should read. */
    var expandedOlderNames = Object.create(null);
    window.__sharedPanelWidth = MIN_PANEL_WIDTH;

    /**
     * Name-based filter for the session list.
     * mode 'hide' = hide every session matching ANY canonical name in the list.
     * mode 'only' = show only sessions matching ANY canonical name in the list.
     * names is a cumulative array of pre-transform basenames so a user can hide
     * (or show-only) several names at once; each renders as a removable pill.
     * Storing the raw basenames keeps the filter correct when display options
     * (stripDatetime, normalizeNames) change after the filter was set.
     * null = no name filter active.
     */
    var sessionNameFilter = null; /* { mode: 'hide'|'only', names: string[] } */

    /** Get the raw (pre-transform) basename for a session record. */
    function getSessionRawBasename(s) {
        return getSessionBasename(s.displayName || s.filename);
    }

    /**
     * Add a name to the filter from the context menu and re-render.
     * Accepts the raw basename (before display-option transforms) so the
     * filter stays correct when the user toggles Dates/Tidy after filtering.
     * Cumulative within a mode: repeated calls stack names into one filter.
     * Switching mode (hide <-> only) starts a fresh list — the two modes are
     * mutually exclusive, so mixing their names would be ambiguous.
     */
    window.setSessionNameFilter = function(mode, rawBasename) {
        if (!sessionNameFilter || sessionNameFilter.mode !== mode) {
            sessionNameFilter = { mode: mode, names: [rawBasename] };
        } else if (sessionNameFilter.names.indexOf(rawBasename) === -1) {
            sessionNameFilter.names.push(rawBasename);
        }
        sessionListPage = 0;
        if (cachedSessions) renderSessionList(cachedSessions);
    };

    /**
     * Remove one name (a pill's [x]) from the active filter and re-render.
     * Dropping the last name clears the filter entirely so the bar disappears.
     */
    window.removeSessionNameFilter = function(rawBasename) {
        if (!sessionNameFilter) return;
        var idx = sessionNameFilter.names.indexOf(rawBasename);
        if (idx !== -1) sessionNameFilter.names.splice(idx, 1);
        if (sessionNameFilter.names.length === 0) sessionNameFilter = null;
        sessionListPage = 0;
        if (cachedSessions) renderSessionList(cachedSessions);
    };

    /** Clear the whole name filter ("Show All") and re-render. */
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
        /* Request a scroll-to-current after the next full list render. The panel may
           already be populated from a prior open and a fresh sessionList may not change
           anything; setting the flag here covers both the populated and refetch cases. */
        pendingScrollOnOpen = true;
        /* Instant re-open: the panel lives in a retainContextWhenHidden webview, so cachedSessions
           survives hide/show. Re-render the already-loaded list immediately instead of clearing it
           and re-scanning the whole reports tree on every open — that re-scan is what made a
           months-deep archive (thousands of files) stall for seconds on EVERY open. Only call the
           host when there is nothing cached (first open). The refresh button and the active-session
           poll still pull fresh data on demand. */
        if (Array.isArray(cachedSessions) && cachedSessions.length > 0) {
            renderSessionList(cachedSessions);
        } else {
            requestSessionList();
        }
        requestAnimationFrame(function() {
            var first = sessionPanelEl.querySelector('button[id="session-close"], #session-date-range, button.session-panel-action');
            if (first) first.focus();
        });
    };

    /** Extract the basename from a path that may contain forward or backward slashes.
        currentFilename is workspace-relative (forward slashes from asRelativePath); session
        rows' data-filename may carry a subfolder prefix from disambiguation. Comparing by
        basename keeps the match working regardless of which form either side uses. */
    function getLogBasename(path) {
        if (!path) return '';
        /* Double-backslash inside this TS template literal collapses to a single backslash
           in the emitted JS, which is what we need to look up Windows path separators. */
        var i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\\\'));
        return i >= 0 ? path.substring(i + 1) : path;
    }

    /** Scroll the session list to the row matching the file currently loaded in the
        viewer. If no file is loaded, or no row matches (filtered out, on another page,
        in trash), scroll to the top — which holds the newest entry under the default
        descending sort and is the right landing spot when there's nothing to anchor to. */
    function scrollSessionListToCurrentOrTop() {
        var content = sessionPanelEl ? sessionPanelEl.querySelector('.session-panel-content') : null;
        if (!content) return;
        var currentBn = getLogBasename(typeof currentFilename !== 'undefined' ? currentFilename : '');
        if (currentBn && sessionListEl) {
            var items = sessionListEl.querySelectorAll('.session-item');
            for (var i = 0; i < items.length; i++) {
                if (getLogBasename(items[i].getAttribute('data-filename') || '') === currentBn) {
                    /* block:'center' so the row lands mid-panel; behavior:'auto' to avoid
                       a smooth-scroll animation on open (jarring when the user expects
                       the panel to appear pre-positioned). */
                    items[i].scrollIntoView({ block: 'center', behavior: 'auto' });
                    return;
                }
            }
        }
        content.scrollTop = 0;
    }

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

    ${getSessionRenderingScript()}

    ${getSessionPanelEventsScript()}

    syncToggleButtons();
})();
`;
}
