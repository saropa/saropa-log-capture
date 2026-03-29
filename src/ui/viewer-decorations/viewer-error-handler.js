"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorHandlerScript = getErrorHandlerScript;
/**
 * Global error handler for the webview.
 *
 * Loaded as the FIRST script block — catches SyntaxErrors from later
 * blocks and runtime errors, shows a visible banner, and reports to
 * the extension once vscodeApi is available.
 */
function getErrorHandlerScript() {
    return /* javascript */ `
window._scriptErrors = [];
window._vscodeApi = null;

window.onerror = function(msg, source, line, col) {
    var entry = { message: String(msg), source: String(source || ''), line: line || 0, col: col || 0 };
    window._scriptErrors.push(entry);
    var banner = document.getElementById('script-error-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'script-error-banner';
        banner.style.cssText = 'background:#d32f2f;color:#fff;padding:4px 8px;font:12px monospace;white-space:pre-wrap;z-index:9999;position:relative;user-select:text;cursor:text;display:flex;align-items:flex-start;gap:8px;';
        var textEl = document.createElement('span');
        textEl.id = 'script-error-text';
        textEl.style.cssText = 'flex:1;user-select:text;';
        banner.appendChild(textEl);
        var copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.style.cssText = 'background:#fff;color:#d32f2f;border:none;padding:2px 8px;font:12px monospace;cursor:pointer;border-radius:3px;flex-shrink:0;';
        copyBtn.addEventListener('click', function() {
            var t = document.getElementById('script-error-text');
            if (t) navigator.clipboard.writeText(t.textContent || '').then(function() { copyBtn.textContent = 'Copied!'; setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500); });
        });
        banner.appendChild(copyBtn);
        document.body.prepend(banner);
    }
    var textSpan = document.getElementById('script-error-text');
    var errorText = 'Script error (line ' + line + ', col ' + col + '): ' + msg + (source ? '\\nSource: ' + source : '');
    if (textSpan) textSpan.textContent = errorText;
    else banner.textContent = errorText;
    banner.style.display = 'flex';
    if (window._vscodeApi) {
        window._vscodeApi.postMessage({ type: 'scriptError', errors: window._scriptErrors });
    }
};
`;
}
//# sourceMappingURL=viewer-error-handler.js.map