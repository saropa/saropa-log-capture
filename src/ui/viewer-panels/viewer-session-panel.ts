/**
 * Session history panel HTML and script for the webview.
 * Displays a list of past log sessions loaded from the extension host.
 */
export { getSessionPanelHtml } from './viewer-session-panel-html';

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
        reverseSort: false, showLatestOnly: false, panelWidth: 0,
    };
    var MIN_PANEL_WIDTH = 560;
    /* Shared with icon bar: all slide-out panels use this width so the sidebar does not resize when switching (Options, Project Logs, etc.). */
    window.__sharedPanelWidth = MIN_PANEL_WIDTH;

    window.openSessionPanel = function() {
        if (!sessionPanelEl) return;
        sessionPanelOpen = true;
        if (sessionDisplayOptions.panelWidth >= MIN_PANEL_WIDTH) {
            var w = sessionDisplayOptions.panelWidth;
            sessionPanelEl.style.width = w + 'px';
            if (typeof setPanelSlotWidth === 'function') setPanelSlotWidth(w);
        }
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

    /* ---- Rendering ---- */

    function renderSessionList(sessions) {
        if (sessionLoadingEl) sessionLoadingEl.style.display = 'none';
        if (!sessionListEl) return;
        if (!sessions || sessions.length === 0) {
            sessionListEl.innerHTML = '';
            if (sessionEmptyEl) sessionEmptyEl.style.display = '';
            return;
        }
        if (sessionEmptyEl) sessionEmptyEl.style.display = 'none';
        if (typeof rebuildSessionTagChips === 'function') rebuildSessionTagChips(sessions);
        markLatestByName(sessions, applySessionDisplayOptions);
        var active = sessions.filter(function(s) { return !s.trashed; });
        if (sessionDisplayOptions.showLatestOnly) active = active.filter(function(s) { return !!s.isLatestOfName; });
        if (typeof filterSessionsByTags === 'function') active = filterSessionsByTags(active);
        var sorted = sortSessions(active);
        var html = sessionDisplayOptions.showDayHeadings ? renderGrouped(sorted) : renderFlat(sorted);
        sessionListEl.innerHTML = html;
    }

    function sortSessions(sessions) {
        var list = sessions.slice();
        list.sort(function(a, b) {
            return sessionDisplayOptions.reverseSort
                ? (a.mtime || 0) - (b.mtime || 0) : (b.mtime || 0) - (a.mtime || 0);
        });
        return list;
    }

    function renderFlat(sessions) { return sessions.map(renderItem).join(''); }

    function renderGrouped(sessions) {
        var groups = [], currentKey = '';
        for (var i = 0; i < sessions.length; i++) {
            var key = toDateKey(sessions[i].mtime || 0);
            if (key !== currentKey) { currentKey = key; groups.push(renderDayHeading(sessions[i].mtime || 0)); }
            groups.push(renderItem(sessions[i]));
        }
        return groups.join('');
    }

    function renderItem(s) {
        var icon = s.isActive ? 'codicon-record' : (s.hasTimestamps ? 'codicon-history' : 'codicon-output');
        var iconTitle = s.isActive ? 'Actively recording' : (s.hasTimestamps ? 'Completed session' : 'Log file');
        var cls = 'session-item' + (s.isActive ? ' session-item-active' : '');
        var name = applySessionDisplayOptions(s.displayName || s.filename);
        var meta = buildSessionMeta(s);
        var dots = renderSeverityDots(s);
        return '<div class="' + cls + '" data-uri="' + escapeAttr(s.uriString || '') + '" data-filename="' + escapeAttr(s.filename || '') + '">'
            + '<span class="session-item-icon" title="' + iconTitle + '"><span class="codicon ' + icon + '"></span></span>'
            + '<div class="session-item-info">'
            + '<span class="session-item-name">' + escapeHtmlText(name) + (s.isLatestOfName ? ' <span class="session-latest">(latest)</span>' : '') + '</span>'
            + (meta ? '<span class="session-item-meta">' + escapeHtmlText(meta) + '</span>' : '')
            + dots + '</div></div>';
    }

    function renderDayHeading(epochMs) {
        return '<div class="session-day-heading">' + escapeHtmlText(formatDayHeading(epochMs)) + '</div>';
    }

    /* Day heading/formatting helpers and formatSessionSize are loaded
       from viewer-session-transforms.ts as a separate script. */

    function buildSessionMeta(s) {
        var parts = [];
        if (s.adapter) parts.push(s.adapter);
        var timeLabel = sessionDisplayOptions.showDayHeadings ? (s.formattedTime || s.formattedMtime) : s.formattedMtime;
        if (timeLabel) parts.push(s.relativeTime ? timeLabel + ' ' + s.relativeTime : timeLabel);
        if (s.lineCount > 0) parts.push(s.lineCount.toLocaleString('en-US') + ' lines');
        if (s.durationMs > 0) parts.push(formatSessionDuration(s.durationMs));
        if (s.size) parts.push(formatSessionSize(s.size));
        var allTags = (s.tags || []).map(function(t) { return '#' + t; })
            .concat((s.autoTags || []).map(function(t) { return '~' + t; }))
            .concat((s.correlationTags || []).slice(0, 3).map(function(t) { return '@' + t; }));
        if (allTags.length > 0) parts.push(allTags.join(' '));
        return parts.join(' \\u00b7 ');
    }

    function applySessionDisplayOptions(name) {
        var result = trimSessionSeconds(name);
        if (sessionDisplayOptions.stripDatetime) result = stripSessionDatetime(result);
        if (sessionDisplayOptions.normalizeNames) result = normalizeSessionName(result);
        return result;
    }

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

    initSessionPanelResize(sessionPanelEl, function(w) {
        if (w > 0) {
            sessionDisplayOptions.panelWidth = w;
            window.__sharedPanelWidth = w;
            vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
        }
    });

    /* ---- Escaping helpers ---- */
    function escapeAttr(str) { return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    function escapeHtmlText(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    /* Handle clicks on session items. */
    if (sessionListEl) {
        sessionListEl.addEventListener('click', function(e) {
            var item = e.target.closest('.session-item');
            if (!item) return;
            vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: item.getAttribute('data-uri') || '' });
        });
        sessionListEl.addEventListener('contextmenu', function(e) {
            var item = e.target.closest('.session-item');
            if (!item) return;
            e.preventDefault();
            if (typeof showSessionContextMenu === 'function') {
                showSessionContextMenu(e.clientX, e.clientY, item.getAttribute('data-uri') || '', item.getAttribute('data-filename') || '', false);
            }
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
        if (e.data.type === 'sessionDisplayOptions') {
            sessionDisplayOptions = e.data.options || sessionDisplayOptions;
            window.__sharedPanelWidth = Math.max(MIN_PANEL_WIDTH, sessionDisplayOptions.panelWidth || 0);
            syncToggleButtons();
            if (cachedSessions) renderSessionList(cachedSessions);
        }
    });

    syncToggleButtons();
})();
`;
}
