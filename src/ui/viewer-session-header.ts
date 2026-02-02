/**
 * Session info panel for the log viewer webview.
 *
 * Provides a slide-out panel (toggled via the icon bar) that shows full
 * session metadata, and inserts a compact one-line prefix at the top
 * of the log content showing adapter, project, and date.
 */

/** Returns the HTML for the session info slide-out panel. */
export function getSessionInfoPanelHtml(): string {
    return /* html */ `
<div id="info-panel" class="info-panel">
    <div class="info-panel-header">
        <span>Session Info</span>
        <button id="info-panel-close" class="info-panel-close" title="Close">&times;</button>
    </div>
    <div class="info-panel-content">
        <div id="session-info-grid" class="session-info-grid"></div>
        <div id="info-panel-empty" class="info-panel-empty">No session info available</div>
    </div>
</div>`;
}

/** Returns the JavaScript for session info handling. */
export function getSessionHeaderScript(): string {
    return /* javascript */ `
/** Stored session metadata from the extension. */
var sessionInfoData = null;

/** Build a compact one-line summary from session metadata fields. */
function buildSessionPrefix(info) {
    var parts = [];
    if (info['Debug Adapter']) parts.push(info['Debug Adapter']);
    if (info['Project']) parts.push(info['Project']);
    if (info['launch.json']) parts.push(info['launch.json']);
    if (info['Date']) {
        var d = info['Date'];
        var idx = d.indexOf('T');
        if (idx > 0) d = d.substring(0, idx);
        parts.push(d);
    }
    return parts.join(' \\u00b7 ');
}

/** Show or hide the info icon and update the prefix line. */
function applySessionInfo(info) {
    sessionInfoData = info;
    var ibBtn = document.getElementById('ib-info');
    var prefix = document.getElementById('session-info-prefix');

    if (!info) {
        if (ibBtn) ibBtn.style.display = 'none';
        if (prefix) prefix.remove();
        return;
    }

    if (ibBtn) ibBtn.style.display = '';

    // Insert or update compact prefix line
    var logContent = document.getElementById('log-content');
    if (!logContent) return;
    var spacerTop = document.getElementById('spacer-top');
    if (!prefix) {
        prefix = document.createElement('div');
        prefix.id = 'session-info-prefix';
        prefix.className = 'session-info-prefix';
        if (spacerTop) {
            logContent.insertBefore(prefix, spacerTop);
        } else {
            logContent.insertBefore(prefix, logContent.firstChild);
        }
    }
    prefix.textContent = buildSessionPrefix(info);
}

/** Open the session info slide-out panel. */
window.openInfoPanel = function() {
    var panel = document.getElementById('info-panel');
    var emptyEl = document.getElementById('info-panel-empty');
    var grid = document.getElementById('session-info-grid');
    if (!panel) return;

    if (!sessionInfoData) {
        if (grid) grid.innerHTML = '';
        if (emptyEl) emptyEl.style.display = '';
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        if (grid) {
            var html = '';
            var keys = Object.keys(sessionInfoData);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var val = sessionInfoData[key];
                html += '<div class="session-info-row">';
                html += '<span class="session-info-key">' + escapeHtml(key) + '</span>';
                html += '<span class="session-info-value">' + escapeHtml(val) + '</span>';
                html += '</div>';
            }
            grid.innerHTML = html;
        }
    }
    panel.classList.add('visible');
};

/** Close the session info slide-out panel. */
window.closeInfoPanel = function() {
    var panel = document.getElementById('info-panel');
    if (panel) panel.classList.remove('visible');
    if (typeof clearActivePanel === 'function') clearActivePanel('info');
};

// Close button
var _infoClose = document.getElementById('info-panel-close');
if (_infoClose) _infoClose.addEventListener('click', closeInfoPanel);

// Click outside → close
document.addEventListener('click', function(e) {
    var panel = document.getElementById('info-panel');
    if (!panel || !panel.classList.contains('visible')) return;
    if (panel.contains(e.target)) return;
    var ibBtn = document.getElementById('ib-info');
    if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
    closeInfoPanel();
});
`;
}
