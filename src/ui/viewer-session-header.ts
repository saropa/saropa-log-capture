/**
 * Session info for the log viewer webview.
 *
 * Provides an icon button in the header bar that opens a modal with
 * full session metadata, and inserts a compact one-line prefix at
 * the top of the log content showing adapter, project, and date.
 */

/** Returns the HTML for the session info icon button (placed in header bar). */
export function getSessionInfoButtonHtml(): string {
    return /* html */ `<button id="session-info-btn" class="emoji-toggle" style="display:none" title="Session info">&#x2139;&#xFE0F;</button>`;
}

/** Returns the HTML for the session info modal overlay. */
export function getSessionInfoModalHtml(): string {
    return /* html */ `<div id="session-info-modal" class="session-info-modal" style="display:none">
    <div class="session-info-modal-content">
        <div class="session-info-modal-header">
            <span>Session Info</span>
            <button id="session-info-close" title="Close">&#x2715;</button>
        </div>
        <div id="session-info-grid" class="session-info-grid"></div>
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

/** Show or hide the session info icon and update the prefix line. */
function applySessionInfo(info) {
    sessionInfoData = info;
    var btn = document.getElementById('session-info-btn');
    var prefix = document.getElementById('session-info-prefix');

    if (!info) {
        if (btn) btn.style.display = 'none';
        if (prefix) prefix.remove();
        return;
    }

    if (btn) btn.style.display = '';

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

/** Populate and show the session info modal. */
function showSessionInfoModal() {
    if (!sessionInfoData) return;
    var modal = document.getElementById('session-info-modal');
    var grid = document.getElementById('session-info-grid');
    if (!modal || !grid) return;

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
    modal.style.display = '';
}

/** Hide the session info modal. */
function hideSessionInfoModal() {
    var modal = document.getElementById('session-info-modal');
    if (modal) modal.style.display = 'none';
}

// Icon click → open modal
var _sInfoBtn = document.getElementById('session-info-btn');
if (_sInfoBtn) {
    _sInfoBtn.addEventListener('click', showSessionInfoModal);
}

// Close button and backdrop click → close modal
var _sInfoClose = document.getElementById('session-info-close');
if (_sInfoClose) {
    _sInfoClose.addEventListener('click', hideSessionInfoModal);
}
var _sInfoModal = document.getElementById('session-info-modal');
if (_sInfoModal) {
    _sInfoModal.addEventListener('click', function(e) {
        if (e.target === _sInfoModal) hideSessionInfoModal();
    });
}
`;
}
