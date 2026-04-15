/**
 * Client-side JavaScript for the Flutter DAP / Device / External log filter.
 *
 * Three radio groups in Log Sources control visibility with three states:
 *   - 'all':      show every line from that tier
 *   - 'warnplus': show only warnings and errors (checks originalLevel for
 *                 device-other lines whose level was demoted to info)
 *   - 'none':     hide every line from that tier
 *
 * Defaults: Flutter DAP = 'all', Device = 'warnplus', External = 'warnplus'.
 *
 * Device-critical lines (e.g. AndroidRuntime crashes) are always visible
 * regardless of the Device setting — they bypass this filter entirely.
 *
 * Uses recalcHeights() so the filter composes with all other filters.
 */
export function getStackFilterScript(): string {
  return /* javascript */ `
var showFlutter = 'all';
var showDevice = 'warnplus';
var showExternal = 'warnplus';

/** Update Flutter DAP tier filter mode ('all' | 'warnplus' | 'none') and refilter. */
function setShowFlutter(mode) {
    if (showFlutter === mode) return;
    showFlutter = mode;
    recalcHeights();
    renderViewport(true);
}

/** Update Device tier filter mode ('all' | 'warnplus' | 'none') and refilter. */
function setShowDevice(mode) {
    if (showDevice === mode) return;
    showDevice = mode;
    recalcHeights();
    renderViewport(true);
}

/** Update External tier filter mode ('all' | 'warnplus' | 'none') and refilter. */
function setShowExternal(mode) {
    if (showExternal === mode) return;
    showExternal = mode;
    recalcHeights();
    renderViewport(true);
}

/**
 * Check if an item is hidden by the Flutter DAP / Device / External tier filter.
 * Device-critical items always pass (never hidden by this filter).
 *
 * In 'warnplus' mode, checks originalLevel (pre-demotion) first, then
 * falls back to level — device-other lines demote error/warning to info
 * but preserve the original in originalLevel (plan 050).
 */
function isTierHidden(item) {
    if (!item.tier) return false;
    if (item.tier === 'device-critical') return false;
    var mode = (item.tier === 'flutter') ? showFlutter
        : (item.tier === 'device-other') ? showDevice
        : (item.tier === 'external') ? showExternal
        : 'all';
    if (mode === 'all') return false;
    if (mode === 'none') return true;
    /* 'warnplus': show only warnings and errors */
    var effectiveLevel = item.originalLevel || item.level || 'info';
    return effectiveLevel !== 'error' && effectiveLevel !== 'warning';
}

`;
}
