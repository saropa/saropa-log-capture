"use strict";
/**
 * Filter badge script for the log viewer toolbar.
 *
 * Shows a count of active filters on the toolbar filter icon badge.
 *
 * Hooks into recalcHeights() to auto-update.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFilterBadgeScript = getFilterBadgeScript;
/** Returns the JavaScript code for the filter badge. */
function getFilterBadgeScript() {
    return /* javascript */ `
/**
 * Count active filters and update the toolbar filter icon badge.
 * Called automatically after filter changes via recalcHeights hook.
 */
function updateFilterBadge() {
    var badge = document.getElementById('toolbar-filter-count');
    if (!badge) return;

    var count = 0;

    // Level filters (any level disabled)
    if (typeof enabledLevels !== 'undefined' && enabledLevels.size < allLevelNames.length) count++;

    // Exclusions active with rules
    if (typeof exclusionsEnabled !== 'undefined' && exclusionsEnabled
        && typeof exclusionRules !== 'undefined' && exclusionRules.length > 0) count++;

    // Tier filters (Flutter or Device changed from default: Flutter='all', Device='none')
    if (typeof showFlutter !== 'undefined' && showFlutter !== 'all') count++;
    if (typeof showDevice !== 'undefined' && showDevice !== 'none') count++;

    // Source tags hidden
    if (typeof hiddenSourceTags !== 'undefined'
        && Object.keys(hiddenSourceTags).length > 0) count++;

    // Class tags hidden
    if (typeof hiddenClassTags !== 'undefined'
        && Object.keys(hiddenClassTags).length > 0) count++;

    // SQL verb chips hidden
    if (typeof hiddenSqlVerbs !== 'undefined'
        && Object.keys(hiddenSqlVerbs).length > 0) count++;

    // Category filter active
    if (typeof activeFilters !== 'undefined' && activeFilters !== null) count++;

    // Search in filter mode
    if (typeof searchFilterMode !== 'undefined' && searchFilterMode
        && typeof searchRegex !== 'undefined' && searchRegex) count++;

    // Source scope filter
    if (typeof scopeLevel !== 'undefined' && scopeLevel !== 'all') count++;

    // DB Performance tab time brush (DB_13)
    if (typeof dbTimeFilterActive !== 'undefined' && dbTimeFilterActive) count++;

    badge.textContent = count > 0 ? String(count) : '';
}

// Hook into recalcHeights to auto-update after most filter changes
var _origRecalcForBadge = typeof recalcHeights === 'function' ? recalcHeights : null;
if (_origRecalcForBadge) {
    recalcHeights = function() {
        _origRecalcForBadge();
        updateFilterBadge();
        if (typeof updateLineCount === 'function') updateLineCount();
    };
}
`;
}
//# sourceMappingURL=viewer-filter-badge.js.map