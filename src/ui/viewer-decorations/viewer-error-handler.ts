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

window.addEventListener('error', function(ev) {
    var msg = ev.message || 'Unknown error';
    var source = ev.filename || '';
    var line = ev.lineno || 0;
    var col = ev.colno || 0;
    var stack = (ev.error && ev.error.stack) ? ev.error.stack : '';
    var entry = { message: String(msg), source: source, line: line, col: col, stack: stack };
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
    var errorText = msg + '\\n(line ' + line + ', col ' + col + ')' + (stack ? '\\n' + stack : '');
    if (textSpan) textSpan.textContent = errorText;
    else banner.textContent = errorText;
    banner.style.display = 'flex';
    if (window._vscodeApi) {
        window._vscodeApi.postMessage({ type: 'scriptError', errors: window._scriptErrors });
    }
});
`;
}
