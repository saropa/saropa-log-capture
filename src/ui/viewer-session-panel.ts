/**
 * Session history panel HTML and script for the webview.
 *
 * Displays a list of past log sessions loaded from the extension host.
 * Follows the same slide-out pattern as the search and options panels.
 */

/** Generate the session panel HTML. */
export function getSessionPanelHtml(): string {
    return /* html */ `
<div id="session-panel" class="session-panel">
    <div class="session-panel-header">
        <span>Project Logs</span>
        <div class="session-panel-actions">
            <button id="session-refresh" class="session-panel-action" title="Refresh">
                <span class="codicon codicon-refresh"></span>
            </button>
            <button id="session-close" class="session-panel-close" title="Close">&times;</button>
        </div>
    </div>
    <div class="session-panel-toggles">
        <button id="session-toggle-strip" class="session-toggle-btn" title="Show date/time in filenames">
            <span class="codicon codicon-calendar"></span> Dates
        </button>
        <button id="session-toggle-normalize" class="session-toggle-btn" title="Tidy names (Title Case, no underscores)">
            <span class="codicon codicon-edit"></span> Tidy
        </button>
        <button id="session-toggle-headings" class="session-toggle-btn" title="Group by day">
            <span class="codicon codicon-list-tree"></span> Days
        </button>
        <button id="session-toggle-reverse" class="session-toggle-btn" title="Reverse sort order (oldest first)">
            <span class="codicon codicon-arrow-down"></span> Sort
        </button>
        <button id="session-toggle-trash" class="session-toggle-btn active" title="Show/hide trashed sessions">
            <span class="codicon codicon-trash"></span> Trash <span id="session-trash-badge" class="session-toggle-badge"></span>
        </button>
    </div>
    <div class="session-panel-content">
        <div id="session-list"></div>
        <div id="session-empty" class="session-empty">No sessions found</div>
        <div id="session-loading" class="session-loading" style="display:none">Loading...</div>
    </div>
</div>`;
}

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
        stripDatetime: true, normalizeNames: true,
        showDayHeadings: true, reverseSort: false, showTrash: true,
    };

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
            updateTrashBadge(0);
            return;
        }
        if (sessionEmptyEl) sessionEmptyEl.style.display = 'none';
        var active = sessions.filter(function(s) { return !s.trashed; });
        var trashed = sessions.filter(function(s) { return !!s.trashed; });
        updateTrashBadge(trashed.length);
        var sorted = sortSessions(active);
        var html = sessionDisplayOptions.showDayHeadings ? renderGrouped(sorted) : renderFlat(sorted);
        if (sessionDisplayOptions.showTrash && trashed.length > 0) {
            html += renderTrashSection(sortSessions(trashed));
        }
        sessionListEl.innerHTML = html;
    }

    function updateTrashBadge(count) {
        var badge = document.getElementById('session-trash-badge');
        if (badge) badge.textContent = count > 0 ? String(count) : '';
    }

    function sortSessions(sessions) {
        var list = sessions.slice();
        list.sort(function(a, b) {
            return sessionDisplayOptions.reverseSort
                ? (a.mtime || 0) - (b.mtime || 0) : (b.mtime || 0) - (a.mtime || 0);
        });
        return list;
    }

    function renderFlat(sessions) { return sessions.map(function(s) { return renderItem(s, false); }).join(''); }

    function renderGrouped(sessions) {
        var groups = [], currentKey = '';
        for (var i = 0; i < sessions.length; i++) {
            var key = toDateKey(sessions[i].mtime || 0);
            if (key !== currentKey) { currentKey = key; groups.push(renderDayHeading(sessions[i].mtime || 0)); }
            groups.push(renderItem(sessions[i], false));
        }
        return groups.join('');
    }

    function renderItem(s, isTrashed) {
        var icon = isTrashed ? 'codicon-trash' : (s.isActive ? 'codicon-record' : (s.hasTimestamps ? 'codicon-history' : 'codicon-output'));
        var cls = 'session-item' + (s.isActive ? ' session-item-active' : '') + (isTrashed ? ' session-item-trashed' : '');
        var name = applySessionDisplayOptions(s.displayName || s.filename);
        var meta = buildSessionMeta(s);
        return '<div class="' + cls + '" data-uri="' + escapeAttr(s.uriString || '') + '" data-filename="' + escapeAttr(s.filename || '') + '" data-trashed="' + (isTrashed ? '1' : '') + '">'
            + '<span class="session-item-icon"><span class="codicon ' + icon + '"></span></span>'
            + '<div class="session-item-info">'
            + '<span class="session-item-name">' + escapeHtmlText(name) + '</span>'
            + (meta ? '<span class="session-item-meta">' + escapeHtmlText(meta) + '</span>' : '')
            + '</div></div>';
    }

    function renderTrashSection(trashed) {
        var html = '<div class="session-trash-heading">'
            + '<span class="session-trash-heading-label"><span class="codicon codicon-trash"></span> Trash <span class="session-trash-badge">(' + trashed.length + ')</span></span>'
            + '<button class="session-trash-empty-btn" id="session-empty-trash">Empty Trash</button>'
            + '</div>';
        html += trashed.map(function(s) { return renderItem(s, true); }).join('');
        return html;
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
        if (timeLabel) parts.push(timeLabel);
        if (s.lineCount > 0) parts.push(s.lineCount.toLocaleString('en-US') + ' lines');
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
            'session-toggle-trash': sessionDisplayOptions.showTrash,
        };
        for (var id in ids) {
            var el = document.getElementById(id);
            if (el) el.classList.toggle('active', ids[id]);
        }
        var sortBtn = document.getElementById('session-toggle-reverse');
        if (sortBtn) {
            var icon = sortBtn.querySelector('.codicon');
            if (icon) icon.className = sessionDisplayOptions.reverseSort ? 'codicon codicon-arrow-up' : 'codicon codicon-arrow-down';
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
    bindToggle('session-toggle-trash', 'showTrash');

    /* ---- Escaping helpers ---- */
    function escapeAttr(str) { return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    function escapeHtmlText(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    /* Handle clicks on session items + empty trash button. */
    if (sessionListEl) {
        sessionListEl.addEventListener('click', function(e) {
            if (e.target.closest('#session-empty-trash')) {
                vscodeApi.postMessage({ type: 'sessionAction', action: 'emptyTrash' });
                return;
            }
            var item = e.target.closest('.session-item');
            if (!item) return;
            vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: item.getAttribute('data-uri') || '' });
        });
        sessionListEl.addEventListener('contextmenu', function(e) {
            var item = e.target.closest('.session-item');
            if (!item) return;
            e.preventDefault();
            if (typeof showSessionContextMenu === 'function') {
                showSessionContextMenu(e.clientX, e.clientY, item.getAttribute('data-uri') || '', item.getAttribute('data-filename') || '', item.getAttribute('data-trashed') === '1');
            }
        });
    }

    /* Close + refresh buttons. */
    var closeBtn = document.getElementById('session-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSessionPanel);
    var refreshBtn = document.getElementById('session-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', requestSessionList);

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

    /* Listen for messages from the extension. */
    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'sessionList') {
            cachedSessions = e.data.sessions;
            renderSessionList(e.data.sessions);
        }
        if (e.data.type === 'sessionDisplayOptions') {
            sessionDisplayOptions = e.data.options || sessionDisplayOptions;
            syncToggleButtons();
            if (cachedSessions) renderSessionList(cachedSessions);
        }
    });

    syncToggleButtons();
})();
`;
}
