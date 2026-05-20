/**
 * English strings for the WEBVIEW (log viewer) — keyed by symbolic ID.
 *
 * These differ from strings-a/strings-b (extension-host UI shown via
 * `vscode.l10n.t()` directly). Webview strings are built CLIENT-SIDE in the
 * iframe, where `vscode.l10n.t()` cannot run, so they take a two-step path:
 *
 *   1. The host resolves every key here through `t()` (→ vscode.l10n + the
 *      `l10n/bundle.l10n.*.json` translations) into a map.
 *   2. `getWebviewL10nScript()` serializes that map as `__VT` and ships it into
 *      the page; the client-side `vt(key, ...args)` helper looks up the
 *      (already-translated) template and substitutes `{0}`, `{1}`, … at render
 *      time with runtime values (frame counts, etc.).
 *
 * Keep templates as FULL sentences with `{n}` placeholders — never concatenate
 * translated fragments, because word order differs across languages. Add the
 * matching translations to each `l10n/bundle.l10n.<locale>.json` keyed by the
 * ENGLISH string (same convention as strings-a/b); until then `vt()` falls back
 * to English, identical to today's behavior.
 */
export const stringsWebview: Record<string, string> = {
    // Collapsible stack-trace header tooltips (multi-frame Dart/JS/Python traces).
    'viewer.stackHeader.single': 'Stack trace',
    'viewer.stackHeader.singleDup': 'Stack trace · appeared {0} times',
    'viewer.stackHeader.collapsed': 'Stack trace collapsed · {0} frames · click to expand',
    'viewer.stackHeader.expanded': 'Stack trace expanded · click to collapse',
    'viewer.stackHeader.preview': 'Stack trace · preview mode · click to expand all',

    // Collapsible render-tree descendant-dump header tooltips (plan 052).
    'viewer.treeHeader.single': 'Render tree',
    'viewer.treeHeader.collapsed': 'Render tree collapsed · {0} nodes · click to expand',
    'viewer.treeHeader.expanded': 'Render tree expanded · click to collapse',
    'viewer.treeHeader.preview': 'Render tree · preview mode · click to expand all',
};
