/**
 * Client-side JavaScript for the category filter in the log viewer webview.
 *
 * Categories (DAP output channels like stdout, stderr, console) are no longer
 * shown as individual checkboxes — the tier radios (Flutter App / Device /
 * External) handle all visibility. This file retains activeFilters and
 * applyFilter() because presets and other code reference them.
 */
export function getFilterScript(): string {
    return /* javascript */ `
/** Set of allowed categories, or null to show all.
 * Kept for preset compatibility — tier radios handle filtering now. */
var activeFilters = null;

/**
 * Set filteredOut flag on each line based on category membership.
 * Delegates height recalculation to the shared recalcHeights() so that
 * exclusion and level filters are also respected.
 */
function applyFilter() {
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        item.filteredOut = !!(activeFilters && !activeFilters.has(item.category) && item.type !== 'marker');
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

/**
 * Handle setCategories message from extension.
 * Shows the Log Inputs section when categories arrive so the tier
 * radios become visible. No longer creates per-category checkboxes.
 */
function handleSetCategories(msg) {
    var section = document.getElementById('log-inputs-section');
    if (section && msg.categories && msg.categories.length > 0) {
        section.style.display = '';
    }
}
`;
}
