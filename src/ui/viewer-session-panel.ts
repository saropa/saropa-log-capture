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
        <span>Sessions</span>
        <div class="session-panel-actions">
            <button id="session-refresh" class="session-panel-action" title="Refresh">
                <span class="codicon codicon-refresh"></span>
            </button>
            <button id="session-close" class="session-panel-close" title="Close">&times;</button>
        </div>
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

    function renderSessionList(sessions) {
        if (sessionLoadingEl) sessionLoadingEl.style.display = 'none';
        if (!sessionListEl) return;
        if (!sessions || sessions.length === 0) {
            sessionListEl.innerHTML = '';
            if (sessionEmptyEl) sessionEmptyEl.style.display = '';
            return;
        }
        if (sessionEmptyEl) sessionEmptyEl.style.display = 'none';
        sessionListEl.innerHTML = sessions.map(function(s) {
            var icon = s.isActive ? 'codicon-record' : (s.hasTimestamps ? 'codicon-history' : 'codicon-output');
            var activeClass = s.isActive ? ' session-item-active' : '';
            var meta = buildSessionMeta(s);
            return '<div class="session-item' + activeClass + '" data-uri="' + escapeAttr(s.uriString || '') + '">'
                + '<span class="session-item-icon"><span class="codicon ' + icon + '"></span></span>'
                + '<div class="session-item-info">'
                + '<span class="session-item-name">' + escapeHtmlText(s.displayName || s.filename) + '</span>'
                + (meta ? '<span class="session-item-meta">' + escapeHtmlText(meta) + '</span>' : '')
                + '</div></div>';
        }).join('');
    }

    function buildSessionMeta(s) {
        var parts = [];
        if (s.adapter) parts.push(s.adapter);
        if (s.size) parts.push(formatSessionSize(s.size));
        if (s.date) parts.push(s.date);
        return parts.join(' · ');
    }

    function formatSessionSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

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
                closeSessionPanel();
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

    /* Listen for session list data from the extension. */
    window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'sessionList') {
            renderSessionList(e.data.sessions);
        }
    });
})();
`;
}
