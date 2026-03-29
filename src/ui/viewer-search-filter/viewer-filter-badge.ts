/**
 * Filter badge script for the log viewer footer.
 *
 * Shows a count of active filters in the footer. Clicking the badge
 * opens the filters panel so the user can see what's filtering.
 *
 * Hooks into recalcHeights() and toggleAppOnly() to auto-update.
 */

/** Returns the JavaScript code for the filter badge. */
export function getFilterBadgeScript(): string {
    return /* javascript */ `
/**
 * Count active filters and update the footer badge.
 * Called automatically after filter changes via recalcHeights hook.
 */
function updateFilterBadge() {
    var badge = document.getElementById('filter-badge');
    if (!badge) return;

    var count = 0;

    // Level filters (any level disabled)
    if (typeof enabledLevels !== 'undefined' && enabledLevels.size < 7) count++;

    // Exclusions active with rules
    if (typeof exclusionsEnabled !== 'undefined' && exclusionsEnabled
        && typeof exclusionRules !== 'undefined' && exclusionRules.length > 0) count++;

    // App-only mode
    if (typeof appOnlyMode !== 'undefined' && appOnlyMode) count++;

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

    if (count > 0) {
        badge.textContent = count + (count === 1 ? ' filter' : ' filters');
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
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

// Hook into toggleAppOnly (doesn't call recalcHeights)
var _origAppOnlyForBadge = typeof toggleAppOnly === 'function' ? toggleAppOnly : null;
if (_origAppOnlyForBadge) {
    toggleAppOnly = function() {
        _origAppOnlyForBadge();
        updateFilterBadge();
        if (typeof updateLineCount === 'function') updateLineCount();
    };
}

// Click badge: open filter drawer to show all active filters
var filterBadgeEl = document.getElementById('filter-badge');
if (filterBadgeEl) {
    filterBadgeEl.addEventListener('click', function() {
        if (typeof openFilterDrawer === 'function') openFilterDrawer();
    });
}
`;
}
