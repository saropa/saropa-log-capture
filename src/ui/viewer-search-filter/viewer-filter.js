"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFilterScript = getFilterScript;
/**
 * Client-side JavaScript for the category filter in the log viewer webview.
 *
 * Categories (DAP output channels like stdout, stderr, console) are no longer
 * shown as individual checkboxes — the tier radios (Flutter DAP / Device /
 * External) handle all visibility. This file retains activeFilters and
 * applyFilter() because presets and other code reference them.
 */
function getFilterScript() {
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
 * No-op — Log Sources tab is always visible; tab switching controls
 * panel display. Kept as a stub because message handlers still call it.
 */
function handleSetCategories(msg) {
    void msg;
}
`;
}
//# sourceMappingURL=viewer-filter.js.map