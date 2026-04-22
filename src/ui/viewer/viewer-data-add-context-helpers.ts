/**
 * Embedded JavaScript helpers used by addToData for context lookups:
 *
 * - `proximityInheritAnchor()` — locates the nearest earlier non-marker line that is
 *   eligible as the anchor for the 2-second recent-error-context tint window. Skips
 *   Drift SQL rows so a single database call between an error and its follow-on
 *   output doesn't break the error band.
 * - `previousLineLevel()` — returns the severity level of the most recent non-marker
 *   line, used to inherit a level onto a new stack-header (where the first frame
 *   lands on a header row that otherwise has no classifier signal).
 *
 * Extracted from viewer-data-add.ts purely to keep that file under the 300-code-line
 * limit — the logic is unchanged.
 */

/** Get the embedded JavaScript for addToData context lookup helpers. */
export function getDataAddContextHelpersScript(): string {
    return /* javascript */ `
/** Nearest earlier line used for the "recent error context" window (skips Drift SQL rows). */
function proximityInheritAnchor() {
    var j = allLines.length - 1;
    while (j >= 0) {
        var it = allLines[j];
        if (it.type === 'marker' || it.type === 'run-separator') { return null; }
        var p = stripTags(it.html);
        if (typeof isDriftSqlStatementLine === 'function' && isDriftSqlStatementLine(p)) {
            j--;
            continue;
        }
        return it;
    }
    return null;
}

/** Level of the most recent non-marker line, for stack-header inheritance. */
function previousLineLevel() {
    for (var i = allLines.length - 1; i >= 0; i--) {
        var it = allLines[i];
        if (it.type === 'marker' || it.type === 'run-separator') return 'error';
        if (it.level) return it.level;
    }
    return 'error';
}

/* Bug: streaming lines (Drift SELECT + stack frames, N × SQL repeated: rows, plus any line
   that arrived after the user toggled a level off) were visible despite the filter.
   Reason: applyLevelFilter() only runs on user interactions (toggle clicks, preset changes,
   persisted-state restore); it does not run per appended item. addToData and the repeat-
   collapse branch never consulted enabledLevels, so new items entered with levelFiltered
   unset (falsy) and calcItemHeight treated them as visible.
   Fix: each item-creation site calls this helper and stamps item.levelFiltered at birth so
   the first render already honors the current filter state. Keep the 'everything on' short-
   circuit — that is the hot path and must not allocate or scan. */
function calcLevelFiltered(lvl) {
    if (typeof enabledLevels === 'undefined' || typeof allLevelNames === 'undefined') return false;
    if (enabledLevels.size >= allLevelNames.length) return false;
    return !enabledLevels.has(lvl);
}
`;
}
