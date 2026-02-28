/**
 * Visibility change handler: refresh viewport when user returns to the tab.
 * Reduces CPU when document is hidden; restores view when visible again.
 */
export function getViewerVisibilityScript(): string {
    return /* javascript */ `
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState !== 'visible' || allLines.length === 0) return;
    if (typeof buildPrefixSums === 'function' && (!prefixSums || prefixSums.length !== allLines.length + 1)) buildPrefixSums();
    renderViewport(true); if (typeof scheduleMinimap === 'function') scheduleMinimap(); updateFooterText();
});
`;
}
