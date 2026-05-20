/**
 * Webview localization bridge.
 *
 * The viewer iframe builds many strings CLIENT-SIDE (tooltips with runtime
 * counts, dynamic labels) where `vscode.l10n.t()` — an extension-host API —
 * cannot run. This module bridges the gap: the host resolves every webview
 * string key (see strings-webview.ts) into translated templates via
 * `getWebviewL10nMap()`, and `getWebviewL10nScript()` ships that map plus a
 * `vt()` lookup helper into the page as the first script.
 *
 * Host-built HTML (the toolbar / panel shells assembled during buildViewerHtml)
 * does NOT use this — it calls `t()` directly because it runs in the host. Only
 * strings produced by the webview's own `/* javascript *​/` render code need
 * `vt()`.
 */
import { getWebviewL10nMap } from '../../l10n';

/**
 * Emit `var __VT = {…}; function vt(key, …args) {…}` for injection as the first
 * webview script, so every later script can resolve localized templates.
 *
 * `vt()` returns the key itself when a template is missing (fail-soft: a never
 * blank tooltip beats a crash), and substitutes `{0}`, `{1}`, … positionally
 * via split/join so argument values containing regex metacharacters are safe.
 */
export function getWebviewL10nScript(): string {
    const map = getWebviewL10nMap();
    return /* javascript */ `
var __VT = ${JSON.stringify(map)};
function vt(key) {
    var s = (__VT && __VT[key] != null) ? __VT[key] : key;
    for (var i = 1; i < arguments.length; i++) {
        s = s.split('{' + (i - 1) + '}').join(String(arguments[i]));
    }
    return s;
}
`;
}
