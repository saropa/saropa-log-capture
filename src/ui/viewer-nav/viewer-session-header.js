"use strict";
/**
 * Session info tooltip and smart sticky header for the log viewer webview.
 *
 * Session metadata is shown as a tooltip on the session count label
 * and can be copied to clipboard via long-press. A compact one-line
 * summary (adapter, project, date) is shown in the session nav bar
 * and hides on scroll down, reveals on scroll up (smart sticky header).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionHeaderScript = getSessionHeaderScript;
/** Returns the JavaScript for session info handling. */
function getSessionHeaderScript() {
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

/** Build a multi-line text from session info for tooltip and clipboard. */
function buildSessionInfoText(info) {
    if (!info) return '';
    var lines = [];
    var keys = Object.keys(info);
    for (var i = 0; i < keys.length; i++) {
        lines.push(keys[i] + ': ' + info[keys[i]]);
    }
    return lines.join('\\n');
}

/** Update the session-details line and tooltip from session metadata. */
function applySessionInfo(info) {
    sessionInfoData = info;
    var detailsEl = document.getElementById('session-details-inline');

    if (!info) {
        if (detailsEl) detailsEl.textContent = '';
        updateSessionInfoTooltip();
        if (typeof updateSessionNavWrapperVisibility === 'function') updateSessionNavWrapperVisibility();
        return;
    }

    if (detailsEl) detailsEl.textContent = buildSessionPrefix(info);
    updateSessionInfoTooltip();
    if (typeof updateSessionNavWrapperVisibility === 'function') updateSessionNavWrapperVisibility();
}

/** Set the tooltip on the session count label from stored session info. */
function updateSessionInfoTooltip() {
    var label = document.querySelector('.nav-bar-label');
    if (!label) return;
    var text = buildSessionInfoText(sessionInfoData);
    label.title = text || '';
}

/** No-op — toolbar is always visible; kept for backward compat. */
window.updateSessionNavWrapperVisibility = function() {};

/** Long-press on session count label copies session info to clipboard. */
(function setupSessionInfoLongPress() {
    var label = document.querySelector('.nav-bar-label');
    if (!label) return;
    var timer = null;
    var longPressMs = 500;

    function cancelTimer() {
        if (timer) { clearTimeout(timer); timer = null; }
    }

    function onLongPress() {
        timer = null;
        var text = buildSessionInfoText(sessionInfoData);
        if (!text) return;
        vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
        if (typeof showCopyToast === 'function') { showCopyToast(); }
    }

    label.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        cancelTimer();
        timer = setTimeout(onLongPress, longPressMs);
    });
    label.addEventListener('mouseup', cancelTimer);
    label.addEventListener('mouseleave', cancelTimer);
    label.addEventListener('touchstart', function(e) {
        cancelTimer();
        timer = setTimeout(onLongPress, longPressMs);
    }, { passive: true });
    label.addEventListener('touchend', cancelTimer);
    label.addEventListener('touchmove', cancelTimer);
    label.addEventListener('touchcancel', cancelTimer);

    label.style.cursor = 'default';
})();

/* Smart sticky header removed — toolbar is always visible. */
`;
}
//# sourceMappingURL=viewer-session-header.js.map