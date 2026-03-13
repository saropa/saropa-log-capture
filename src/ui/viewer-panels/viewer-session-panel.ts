/**
 * Session history panel HTML and script for the webview.
 * Displays a list of past log sessions loaded from the extension host.
 */
export { getSessionPanelHtml } from './viewer-session-panel-html';
import { getSessionRenderingScript } from './viewer-session-panel-rendering';

/** Generate the session panel script. */
export function getSessionPanelScript(): string {
    return /* js */ `
(function() {
    var sessionPanelOpen = false;
    var sessionPanelEl = document.getElementById('session-panel');
    var sessionListEl = document.getElementById('session-list');
    var sessionEmptyEl = document.getElementById('session-empty');
    var sessionLoadingEl = document.getElementById('session-loading');
    var cachedSessions = null;

    var sessionDisplayOptions = {
        stripDatetime: true, normalizeNames: true, showDayHeadings: true,
        reverseSort: false, showLatestOnly: false, panelWidth: 0, dateRange: 'all',
    };
    var MIN_PANEL_WIDTH = 560;
    /** Ctrl/Cmd-click multi-select: uriString -> true */
    var selectedSessionUris = Object.create(null);
    /* Shared with icon bar: all slide-out panels use this width so the sidebar does not resize when switching (Options, Project Logs, etc.). */
    window.__sharedPanelWidth = MIN_PANEL_WIDTH;

    window.openSessionPanel = function() {
        if (!sessionPanelEl) return;
        sessionPanelOpen = true;
        sessionPanelEl.classList.add('visible');
        requestSessionList();
        requestInvestigations();
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
    function requestInvestigations() {
        vscodeApi.postMessage({ type: 'requestInvestigations' });
    }
    function renderInvestigationsList(data) {
        var listEl = document.getElementById('session-investigations-list');
        var createBtn = document.getElementById('session-investigations-create');
        if (!listEl) return;
        var invs = data.investigations || [];
        var activeId = data.activeId || '';
        if (invs.length === 0) {
            listEl.innerHTML = '';
        } else {
            listEl.innerHTML = invs.map(function(inv) {
                var active = inv.id === activeId ? ' session-investigation-active' : '';
                var label = inv.name + (inv.sourceCount ? ' (' + inv.sourceCount + ')' : '');
                var activeMark = inv.id === activeId ? ' <span class="session-investigation-check">&#10003;</span>' : '';
                return '<div class="session-investigation-item' + active + '" data-investigation-id="' + escapeAttr(inv.id) + '">' + escapeHtmlText(label) + activeMark + '</div>';
            }).join('');
        }
        if (createBtn) createBtn.onclick = function() { vscodeApi.postMessage({ type: 'runCommand', command: 'saropaLogCapture.createInvestigation' }); };
        listEl.querySelectorAll('.session-investigation-item').forEach(function(el) {
            el.addEventListener('click', function() {
                var id = el.getAttribute('data-investigation-id');
                if (id) vscodeApi.postMessage({ type: 'openInvestigationById', id: id });
            });
        });
    }

    /* ---- Escaping helpers ---- */
    function escapeAttr(str) { return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    function escapeHtmlText(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    /* ---- Rendering (from viewer-session-panel-rendering.ts) ---- */
    ${getSessionRenderingScript()}

    /* ---- Toggle buttons ---- */

    function syncToggleButtons() {
        var ids = {
            'session-toggle-strip': !sessionDisplayOptions.stripDatetime,
            'session-toggle-normalize': sessionDisplayOptions.normalizeNames,
            'session-toggle-headings': sessionDisplayOptions.showDayHeadings,
            'session-toggle-reverse': sessionDisplayOptions.reverseSort,
            'session-toggle-latest': sessionDisplayOptions.showLatestOnly,
        };
        for (var id in ids) {
            var el = document.getElementById(id);
            if (el) el.classList.toggle('active', ids[id]);
        }
        var sortBtn = document.getElementById('session-toggle-reverse');
        if (sortBtn) {
            var icon = sortBtn.querySelector('.codicon');
            if (icon) icon.style.transform = sessionDisplayOptions.reverseSort ? 'scaleY(-1)' : '';
        }
        var dateRangeEl = document.getElementById('session-date-range');
        if (dateRangeEl && dateRangeEl.value !== (sessionDisplayOptions.dateRange || 'all')) dateRangeEl.value = sessionDisplayOptions.dateRange || 'all';
    }

    function toggleOption(key) {
        var copy = {};
        for (var k in sessionDisplayOptions) copy[k] = sessionDisplayOptions[k];
        copy[key] = !copy[key];
        sessionDisplayOptions = copy;
        syncToggleButtons();
        vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
        if (cachedSessions) renderSessionList(cachedSessions);
    }

    function bindToggle(id, key) {
        var btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', function(e) { e.stopPropagation(); toggleOption(key); });
    }

    bindToggle('session-toggle-strip', 'stripDatetime');
    bindToggle('session-toggle-normalize', 'normalizeNames');
    bindToggle('session-toggle-headings', 'showDayHeadings');
    bindToggle('session-toggle-reverse', 'reverseSort');
    bindToggle('session-toggle-latest', 'showLatestOnly');

    /* Date range dropdown: persist choice via setSessionDisplayOptions and re-render list. */
    var dateRangeSelect = document.getElementById('session-date-range');
    if (dateRangeSelect) dateRangeSelect.addEventListener('change', function() {
        var copy = {};
        for (var k in sessionDisplayOptions) copy[k] = sessionDisplayOptions[k];
        copy.dateRange = dateRangeSelect.value;
        sessionDisplayOptions = copy;
        vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
        if (cachedSessions) renderSessionList(cachedSessions);
    });

    initSessionPanelResize(sessionPanelEl, function(w) {
        if (w > 0) {
            sessionDisplayOptions.panelWidth = w;
            window.__sharedPanelWidth = w;
            vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
        }
    });

    /* Handle clicks on session items. Ctrl/Cmd-click toggles multi-select; normal click opens. */
    if (sessionListEl) {
        sessionListEl.addEventListener('click', function(e) {
            var item = e.target.closest('.session-item');
            if (!item) return;
            var uri = item.getAttribute('data-uri') || '';
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                selectedSessionUris[uri] = !selectedSessionUris[uri];
                if (cachedSessions) renderSessionList(cachedSessions);
                return;
            }
            /* Clear multi-select and re-render so selection highlight does not persist after open. */
            selectedSessionUris = Object.create(null);
            if (cachedSessions) renderSessionList(cachedSessions);
            vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: uri });
        });
        sessionListEl.addEventListener('contextmenu', function(e) {
            var item = e.target.closest('.session-item');
            if (!item) return;
            e.preventDefault();
            if (typeof showSessionContextMenu !== 'function') return;
            var selected = sessionListEl.querySelectorAll('.session-item-selected');
            var useMulti = selected.length > 0 && Array.prototype.indexOf.call(selected, item) >= 0;
            var uris = useMulti
                ? Array.prototype.map.call(selected, function(el) { return el.getAttribute('data-uri') || ''; })
                : [item.getAttribute('data-uri') || ''];
            var filenames = useMulti
                ? Array.prototype.map.call(selected, function(el) { return el.getAttribute('data-filename') || ''; })
                : [item.getAttribute('data-filename') || ''];
            showSessionContextMenu(e.clientX, e.clientY, uris, filenames, false);
        });
    }

    /* Close, refresh, and tag filter buttons. */
    var closeBtn = document.getElementById('session-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSessionPanel);
    var refreshBtn = document.getElementById('session-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', requestSessionList);
    var tagsBtn = document.getElementById('session-filter-tags');
    if (tagsBtn) tagsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof toggleSessionTagsSection === 'function') toggleSessionTagsSection();
    });

    /* Close on outside click (skip context menu — it's a sibling element). */
    document.addEventListener('click', function(e) {
        if (!sessionPanelOpen) return;
        if (sessionPanelEl && sessionPanelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-sessions');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        var ctxMenu = document.getElementById('session-context-menu');
        if (ctxMenu && ctxMenu.contains(e.target)) return;
        closeSessionPanel();
    });

    /* Header: show suffix ( · path) only when non-default folder; whole title area clickable to browse. */
    function updateHeaderPath(rootLabel, isDefault) {
        var headerPathEl = document.getElementById('session-header-path');
        var pathText = document.getElementById('session-path-text');
        var resetBtn = document.getElementById('session-reset-root');
        if (headerPathEl) headerPathEl.style.display = isDefault ? 'none' : '';
        if (pathText) pathText.textContent = isDefault ? '' : (rootLabel || 'No workspace');
        if (resetBtn) resetBtn.style.display = isDefault ? 'none' : '';
    }

    var headerClickableEl = document.getElementById('session-header-clickable');
    if (headerClickableEl) headerClickableEl.addEventListener('click', function() { vscodeApi.postMessage({ type: 'browseSessionRoot' }); });
    var resetRootBtn = document.getElementById('session-reset-root');
    if (resetRootBtn) resetRootBtn.addEventListener('click', function(e) { e.stopPropagation(); vscodeApi.postMessage({ type: 'clearSessionRoot' }); });

    /* Listen for messages from the extension. */
    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'sessionListLoading') {
            var labelEl = document.getElementById('session-loading-label');
            if (labelEl) labelEl.textContent = (e.data.folderPath ? 'Loading ' + e.data.folderPath + '…' : 'Loading…');
        }
        if (e.data.type === 'sessionList') {
            cachedSessions = e.data.sessions;
            renderSessionList(e.data.sessions);
            if (typeof e.data.isDefault !== 'undefined') { updateHeaderPath(e.data.label, e.data.isDefault); }
        }
        if (e.data.type === 'investigationsList') {
            renderInvestigationsList(e.data);
        }
        if (e.data.type === 'sessionDisplayOptions') {
            var opts = e.data.options || sessionDisplayOptions;
            sessionDisplayOptions = opts.dateRange !== undefined ? opts : Object.assign({}, opts, { dateRange: 'all' });
            window.__sharedPanelWidth = Math.max(MIN_PANEL_WIDTH, sessionDisplayOptions.panelWidth || 0);
            /* Update slot width for any currently open panel. */
            var slot = document.getElementById('panel-slot');
            if (slot && parseInt(slot.style.width, 10) > 0) {
                slot.style.width = window.__sharedPanelWidth + 'px';
            }
            syncToggleButtons();
            if (cachedSessions) renderSessionList(cachedSessions);
        }
    });

    syncToggleButtons();
})();
`;
}
