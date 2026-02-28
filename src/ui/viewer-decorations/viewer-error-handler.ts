/**
 * Global error handler for the webview.
 *
 * Loaded as the FIRST script block — catches SyntaxErrors from later
 * blocks and runtime errors, shows a visible banner, and reports to
 * the extension once vscodeApi is available.
 */
export function getErrorHandlerScript(): string {
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
        banner.style.cssText = 'background:#d32f2f;color:#fff;padding:4px 8px;font:12px monospace;white-space:pre-wrap;z-index:9999;';
        document.body.prepend(banner);
    }
    banner.textContent = 'Script error: ' + msg;
    banner.style.display = 'block';
    if (window._vscodeApi) {
        window._vscodeApi.postMessage({ type: 'scriptError', errors: window._scriptErrors });
    }
};
`;
}
