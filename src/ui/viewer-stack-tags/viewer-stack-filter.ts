/**
 * Client-side JavaScript for the app-only filter.
 * When enabled, framework/system log lines and stack frames are hidden.
 * Uses recalcHeights() so the filter composes with all other filters.
 */
export function getStackFilterScript(): string {
  return /* javascript */ `
var appOnlyMode = false;

function setAppOnlyMode(enabled) {
    if (appOnlyMode === enabled) return;
    toggleAppOnly();
}

function toggleAppOnly() {
    appOnlyMode = !appOnlyMode;
    recalcHeights();
    if (typeof vscodeApi !== 'undefined') {
        vscodeApi.postMessage({ type: 'setCaptureAll', value: !appOnlyMode });
    }
    renderViewport(true);
}

document.addEventListener('keydown', function(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'a' || e.key === 'A') toggleAppOnly();
});

`;
}
