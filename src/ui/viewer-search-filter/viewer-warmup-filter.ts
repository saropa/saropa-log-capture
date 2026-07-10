/**
 * Warm-up log filter for the log viewer webview (opt-in, default off).
 *
 * "Warm-up" lines are everything captured at or before the app-ready boundary: the device's
 * own logcat backlog plus the build tool's output, produced before the app itself could log
 * anything. They are the noise the severity chart already trims (troubleChartLaunchTs owns the
 * boundary — the build-complete line, or the launch-start line when there is no build). This
 * filter lets the user hide that span from the FEED too, so the data is filterable rather than
 * lost — the opt-in answer to "hiding data is never the answer".
 *
 * Follows the standard viewer-filter pattern: sets `warmupFiltered` on line items, which
 * calcItemHeight() gates on; never touches markers or heights directly.
 *
 * The boundary resolves as the launch/build line streams in, AFTER the warm-up lines it
 * governs are already on screen, so a one-time re-apply on boundary change is what actually
 * hides them during a load (maybeReapplyWarmupOnBoundaryChange, called per batch).
 */

/** Returns the JavaScript code for the warm-up filter. */
export function getWarmupFilterScript(): string {
    return /* javascript */ `
var excludeWarmupLogs = false;
/* The boundary the last applyWarmupFilter() ran against; -1 = never applied. Lets the per-batch
   hook re-apply exactly once when the boundary moves, not on every batch. */
var warmupAppliedBoundary = -1;

/* The app-ready instant, or 0 when unknown (no launch/build line yet, attach, pure logcat).
   Guarded: troubleChartLaunchTs lives in the chart-launch script, absent in some test harnesses. */
function warmupBoundary() {
    return (typeof troubleChartLaunchTs === 'function') ? troubleChartLaunchTs() : 0;
}

/* True when a line was captured at or before the boundary — device backlog + build output. A
   line with no timestamp is never warm-up (it cannot be placed on the timeline); with the
   filter off, or the boundary unresolved, nothing is warm-up and the feed shows everything. */
function calcWarmupFiltered(ts) {
    if (!excludeWarmupLogs) { return false; }
    if (typeof ts !== 'number' || !(ts > 0)) { return false; }
    var b = warmupBoundary();
    return b > 0 && ts <= b;
}

function applyWarmupFilter() {
    warmupAppliedBoundary = warmupBoundary();
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') { continue; }
        item.warmupFiltered = calcWarmupFiltered(item.timestamp);
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else if (typeof recalcHeights === 'function') { recalcHeights(); renderViewport(true); }
}

/* Re-apply once the boundary changes (it resolves after the warm-up lines are already rendered,
   and can move again if the launch scan self-heals). Cheap: one O(n) pass only on a real change,
   not per batch. No-op while the filter is off. */
function maybeReapplyWarmupOnBoundaryChange() {
    if (!excludeWarmupLogs) { return; }
    if (warmupBoundary() !== warmupAppliedBoundary) { applyWarmupFilter(); }
}

/* Called from the 'clear' handler when a new log loads — drop the toggle and the applied
   boundary so the next log starts unfiltered and re-resolves its own boundary. */
function resetWarmupFilter() {
    excludeWarmupLogs = false;
    warmupAppliedBoundary = -1;
    if (typeof document === 'undefined') { return; }
    var cb = document.getElementById('warmup-exclude');
    if (cb) { cb.checked = false; }
}

(function() {
    if (typeof document === 'undefined') { return; }
    var cb = document.getElementById('warmup-exclude');
    if (!cb) { return; }
    cb.addEventListener('change', function(e) {
        excludeWarmupLogs = !!e.target.checked;
        applyWarmupFilter();
    });
})();
`;
}
