"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStackFilterScript = getStackFilterScript;
/**
 * Client-side JavaScript for the app-only filter.
 * When enabled, framework/system log lines and stack frames are hidden.
 * Uses recalcHeights() so the filter composes with all other filters.
 */
function getStackFilterScript() {
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

/* Key "A" for toggleAppOnly is handled by viewer-script-keyboard (configurable keybindings). */

`;
}
//# sourceMappingURL=viewer-stack-filter.js.map