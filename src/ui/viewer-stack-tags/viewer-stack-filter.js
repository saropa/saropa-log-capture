"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStackFilterScript = getStackFilterScript;
/**
 * Client-side JavaScript for the Flutter/Device log filter.
 *
 * Two checkboxes in Log Inputs control visibility:
 *   - Flutter (checked by default): lines with tier === 'flutter'
 *   - Device (unchecked by default): lines with tier === 'device-other'
 *
 * Device-critical lines (e.g. AndroidRuntime crashes) are always visible
 * regardless of the Device checkbox — they bypass this filter entirely.
 *
 * Uses recalcHeights() so the filter composes with all other filters.
 */
function getStackFilterScript() {
    return /* javascript */ `
var showFlutter = true;
var showDevice = false;

/** Update Flutter checkbox state and refilter. */
function setShowFlutter(enabled) {
    if (showFlutter === enabled) return;
    showFlutter = enabled;
    recalcHeights();
    renderViewport(true);
}

/** Update Device checkbox state and refilter. */
function setShowDevice(enabled) {
    if (showDevice === enabled) return;
    showDevice = enabled;
    recalcHeights();
    renderViewport(true);
}

/**
 * Check if an item is hidden by the Flutter/Device tier filter.
 * Device-critical items always pass (never hidden by this filter).
 */
function isTierHidden(item) {
    if (!item.tier) return false;
    if (item.tier === 'device-critical') return false;
    if (item.tier === 'flutter') return !showFlutter;
    if (item.tier === 'device-other') return !showDevice;
    return false;
}

`;
}
//# sourceMappingURL=viewer-stack-filter.js.map