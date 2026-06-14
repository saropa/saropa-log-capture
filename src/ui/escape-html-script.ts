/**
 * Single source of the webview HTML text-escaper.
 *
 * Each isolated webview (the main viewer, the timeline panel, the session panel, the context
 * popover, the bookmark / find / trash panels, and the session-info modal) runs its own
 * concatenated script bundle with no shared JS scope, so every bundle needs its own copy of the
 * escaper function. Hand-writing that copy in each bundle let the implementations drift: several
 * escaped only `& < >` and omitted the quote characters, which is the attribute-context XSS gap
 * fixed under audit L4. This factory emits the one correct definition into each bundle under
 * whatever local name that bundle's call sites already use, so the escaping rules can no longer
 * diverge per panel and a future fix lands everywhere at once.
 *
 * Escapes `& < > " '`, which is safe for both element-text and quoted-attribute contexts, and
 * coerces null / undefined to an empty string so a missing field can never throw inside a render
 * path (several call sites pass possibly-absent values through a `typeof fn === 'function'` guard).
 *
 * @param fnName the function identifier to declare; defaults to `escapeHtml`. Pass the bundle's
 *   existing name (`escapeHtmlText`, `escapeHtmlBasic`, …) so its call sites keep resolving without
 *   edits.
 * @returns a `/* javascript *\/`-tagged source fragment to interpolate into a webview script string.
 */
export function escapeHtmlScript(fnName = 'escapeHtml'): string {
    return /* javascript */ `
function ${fnName}(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}`;
}
