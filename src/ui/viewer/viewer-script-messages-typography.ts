/**
 * Typography message handlers for the log viewer webview.
 *
 * Applies `setLogFontSize` and `setLogLineHeight` host messages that seed the webview from the
 * `saropaLogCapture.logFontSize` / `saropaLogCapture.logLineHeight` user settings and keep it in
 * sync with live config changes. Extracted from viewer-script-messages.ts to keep that file
 * under the line-count limit and to mirror the `handleDbMessages` pre-handler pattern.
 *
 * Invariants:
 * - Updates `logFontSizeDefault` / `logLineHeightDefault` BEFORE calling setFontSize/setLineHeight,
 *   so a subsequent reset (Ctrl+0 / Ctrl+Shift+0) returns to the *settings-driven* value, not the
 *   hard-coded fallback in viewer-layout.ts.
 * - Guards typeof + Number.isFinite so a malformed host message cannot corrupt state.
 */

export function getViewerScriptTypographyMessageHandler(): string {
    return /* javascript */ `
function handleTypographyMessages(msg) {
    switch (msg.type) {
        case 'setLogFontSize':
            if (typeof msg.size === 'number' && Number.isFinite(msg.size)) {
                logFontSizeDefault = msg.size;
                if (typeof setFontSize === 'function') setFontSize(msg.size);
            }
            return true;
        case 'setLogLineHeight':
            if (typeof msg.height === 'number' && Number.isFinite(msg.height)) {
                logLineHeightDefault = msg.height;
                if (typeof setLineHeight === 'function') setLineHeight(msg.height);
            }
            return true;
    }
    return false;
}
`;
}
