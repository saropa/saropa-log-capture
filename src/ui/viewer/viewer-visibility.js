"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerVisibilityScript = getViewerVisibilityScript;
/**
 * Visibility change handler: refresh viewport when user returns to the tab.
 * Reduces CPU when document is hidden; restores view when visible again.
 */
function getViewerVisibilityScript() {
    return /* javascript */ `
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState !== 'visible' || allLines.length === 0) return;
    if (typeof buildPrefixSums === 'function' && (!prefixSums || prefixSums.length !== allLines.length + 1)) buildPrefixSums();
    renderViewport(true); if (typeof scheduleMinimap === 'function') scheduleMinimap(); updateFooterText();
});
`;
}
//# sourceMappingURL=viewer-visibility.js.map