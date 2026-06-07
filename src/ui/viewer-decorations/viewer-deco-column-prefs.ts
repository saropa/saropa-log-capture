/**
 * Column-visibility persistence for the log viewer.
 *
 * Persists the four Columns toggles (line numbers, timestamp, session elapsed, tag)
 * to view-local webview state (vscodeApi.getState/setState) so the user's choice
 * survives a viewer reload / VS Code restart. View-local — not a workspace setting —
 * matches how icon-bar and filter-tab label visibility persist: these are per-view
 * display choices, not project config, and a workspace setting would add four
 * saropaLogCapture.* keys plus NLS across every locale for throwaway UI state.
 *
 * The toggle vars (decoShowCounter, decoShowTimestamp, decoShowSessionElapsed,
 * decoShowParsedTag) are declared in viewer-deco-settings.ts and shared via the
 * concatenated webview script scope. This script MUST load after it so restore can
 * override the compiled-in defaults. Extracted from viewer-deco-settings.ts to keep
 * that file under the max-lines cap.
 */

/** Returns the JavaScript that persists and restores the Columns toggles. */
export function getColumnPrefsScript(): string {
    return /* javascript */ `
function persistColumnPrefs() {
    var api = (typeof vscodeApi !== 'undefined') ? vscodeApi : null;
    if (!api || !api.getState) return;
    var st = api.getState() || {};
    st.columnPrefs = {
        lineNumbers: decoShowCounter, timestamp: decoShowTimestamp,
        sessionElapsed: decoShowSessionElapsed, parsedTag: decoShowParsedTag,
    };
    api.setState(st);
}
/* Runs at init (top-level call below), before the first renderViewport, so the opening
   paint reflects the saved choice rather than flashing defaults. Only booleans override;
   a missing/partial columnPrefs leaves the compiled-in defaults intact. */
function restoreColumnPrefs() {
    var api = (typeof vscodeApi !== 'undefined') ? vscodeApi : null;
    if (!api || !api.getState) return;
    var st = api.getState();
    var cp = st && st.columnPrefs;
    if (!cp) return;
    if (typeof cp.lineNumbers === 'boolean') decoShowCounter = cp.lineNumbers;
    if (typeof cp.timestamp === 'boolean') decoShowTimestamp = cp.timestamp;
    if (typeof cp.sessionElapsed === 'boolean') decoShowSessionElapsed = cp.sessionElapsed;
    if (typeof cp.parsedTag === 'boolean') decoShowParsedTag = cp.parsedTag;
}
restoreColumnPrefs();
`;
}
