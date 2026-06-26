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
 * Open all three Log Sources tiers to 'all' and sync the drawer radios + summary.
 * Used when the user isolates a single severity level (double-click a level dot to
 * solo): the Device/External tiers default to 'warnplus', which independently hides
 * every non-error/warning line regardless of the level filter. Without relaxing them,
 * soloing 'debug' or 'database' showed nothing even though the count badge said 81/202
 * — the two filter axes silently ANDed. Returns true if any tier actually changed so
 * the caller can avoid a redundant re-render. Does NOT call recalcHeights/renderViewport
 * itself; the caller's applyLevelFilter() re-renders once for both axes.
 */
function resetTiersToAll() {
    var changed = false;
    if (showFlutter !== 'all') { showFlutter = 'all'; changed = true; }
    if (showDevice !== 'all') { showDevice = 'all'; changed = true; }
    if (showExternal !== 'all') { showExternal = 'all'; changed = true; }
    /* Make the state change visible: move the drawer radios and refresh the tab summary
       so the user sees the tiers were opened (a clear UI, not a silent override). */
    if (typeof syncFiltersPanelUi === 'function') syncFiltersPanelUi();
    if (typeof updateLogSourcesSummary === 'function') updateLogSourcesSummary();
    return changed;
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
