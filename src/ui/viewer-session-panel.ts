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
        showDayHeadings: true, reverseSort: false,
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
            return;
        }
        if (sessionEmptyEl) sessionEmptyEl.style.display = 'none';
        var sorted = sortSessions(sessions);
        var html = sessionDisplayOptions.showDayHeadings
            ? renderGrouped(sorted) : renderFlat(sorted);
        sessionListEl.innerHTML = html;
    }

    function sortSessions(sessions) {
        var list = sessions.slice();
        list.sort(function(a, b) {
            return sessionDisplayOptions.reverseSort
                ? (a.mtime || 0) - (b.mtime || 0)
                : (b.mtime || 0) - (a.mtime || 0);
        });
        return list;
    }

    function renderFlat(sessions) {
        return sessions.map(renderItem).join('');
    }

    function renderGrouped(sessions) {
        var groups = [];
        var currentKey = '';
        for (var i = 0; i < sessions.length; i++) {
            var key = toDateKey(sessions[i].mtime || 0);
            if (key !== currentKey) {
                currentKey = key;
                groups.push(renderDayHeading(sessions[i].mtime || 0));
            }
            groups.push(renderItem(sessions[i]));
        }
        return groups.join('');
    }

    function renderItem(s) {
        var icon = s.isActive ? 'codicon-record' : (s.hasTimestamps ? 'codicon-history' : 'codicon-output');
        var activeClass = s.isActive ? ' session-item-active' : '';
        var name = applySessionDisplayOptions(s.displayName || s.filename);
        var meta = buildSessionMeta(s);
        return '<div class="session-item' + activeClass + '" data-uri="' + escapeAttr(s.uriString || '') + '">'
            + '<span class="session-item-icon"><span class="codicon ' + icon + '"></span></span>'
            + '<div class="session-item-info">'
            + '<span class="session-item-name">' + escapeHtmlText(name) + '</span>'
            + (meta ? '<span class="session-item-meta">' + escapeHtmlText(meta) + '</span>' : '')
            + '</div></div>';
    }

    function renderDayHeading(epochMs) {
        return '<div class="session-day-heading">' + escapeHtmlText(formatDayHeading(epochMs)) + '</div>';
    }

    /* ---- Day heading formatting ---- */

    var shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    function ordinalSuffix(n) {
        var s = ['th','st','nd','rd'];
        var v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    function formatDayHeading(epochMs) {
        var d = new Date(epochMs);
        return dayNames[d.getDay()] + ', ' + ordinalSuffix(d.getDate()) + ' '
            + shortMonths[d.getMonth()] + ' ' + d.getFullYear();
    }

    function toDateKey(epochMs) {
        var d = new Date(epochMs);
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    /* ---- Meta line ---- */

    function buildSessionMeta(s) {
        var parts = [];
        if (s.adapter) parts.push(s.adapter);
        /* When day headings are visible the date is redundant — show time only. */
        var timeLabel = sessionDisplayOptions.showDayHeadings
            ? (s.formattedTime || s.formattedMtime)
            : s.formattedMtime;
        if (timeLabel) parts.push(timeLabel);
        if (s.size) parts.push(formatSessionSize(s.size));
        return parts.join(' \\u00b7 ');
    }

    function formatSessionSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /* Transform functions (stripSessionDatetime, normalizeSessionName)
       are loaded from viewer-session-transforms.ts as a separate script. */

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
        };
        for (var id in ids) {
            var el = document.getElementById(id);
            if (el) el.classList.toggle('active', ids[id]);
        }
        /* Update sort arrow direction icon. */
        var sortBtn = document.getElementById('session-toggle-reverse');
        if (sortBtn) {
            var icon = sortBtn.querySelector('.codicon');
            if (icon) {
                icon.className = sessionDisplayOptions.reverseSort
                    ? 'codicon codicon-arrow-up' : 'codicon codicon-arrow-down';
            }
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
        if (btn) btn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleOption(key);
        });
    }

    bindToggle('session-toggle-strip', 'stripDatetime');
    bindToggle('session-toggle-normalize', 'normalizeNames');
    bindToggle('session-toggle-headings', 'showDayHeadings');
    bindToggle('session-toggle-reverse', 'reverseSort');

    /* ---- Escaping helpers ---- */

    function escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    function escapeHtmlText(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* Handle clicks on session items. */
    if (sessionListEl) {
        sessionListEl.addEventListener('click', function(e) {
            var item = e.target.closest('.session-item');
            if (!item) return;
            var uri = item.getAttribute('data-uri');
            if (uri) {
                vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: uri });
            }
        });
    }

    /* Close + refresh buttons. */
    var closeBtn = document.getElementById('session-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSessionPanel);
    var refreshBtn = document.getElementById('session-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', requestSessionList);

    /* Close on outside click. */
    document.addEventListener('click', function(e) {
        if (!sessionPanelOpen) return;
        if (sessionPanelEl && sessionPanelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-sessions');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
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
