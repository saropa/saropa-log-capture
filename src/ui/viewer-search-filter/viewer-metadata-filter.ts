/**
 * Metadata filter for PID, TID, and parsed tag toggle-filtering.
 *
 * Clicking a PID/TID/tag value in the viewer toggles an inclusive filter:
 * only lines matching that value are shown. Click again to clear.
 * Multiple active filters use AND logic.
 *
 * Follows the same composable filter pattern as other viewer filters:
 * set `metadataFiltered` flag on items → `calcItemHeight()` checks it.
 *
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getMetadataFilterScript(): string {
    return /* javascript */ `
/** Active metadata filters: { pid: Set|null, tid: Set|null, tag: Set|null }. */
var activeMetadataFilters = { pid: null, tid: null, tag: null };

/**
 * Toggle a metadata filter value. If the value is already active, remove it.
 * If a different value is active, switch to the new one. If nothing is active, set it.
 */
function toggleMetadataFilter(key, value) {
    if (!key || value == null) return;
    var vs = String(value);
    var current = activeMetadataFilters[key];
    if (current && current.has(vs)) {
        current.delete(vs);
        if (current.size === 0) activeMetadataFilters[key] = null;
    } else {
        activeMetadataFilters[key] = new Set([vs]);
    }
    applyMetadataFilter();
    if (typeof recalcHeights === 'function') recalcHeights();
    if (typeof renderViewport === 'function') renderViewport(true);
    if (typeof updateFilterBadge === 'function') updateFilterBadge();
}

/** Clear all metadata filters. */
function clearMetadataFilters() {
    activeMetadataFilters.pid = null;
    activeMetadataFilters.tid = null;
    activeMetadataFilters.tag = null;
}

/** Apply metadata filter flags to all lines. Markers are never filtered. */
function applyMetadataFilter() {
    var hasPid = activeMetadataFilters.pid !== null;
    var hasTid = activeMetadataFilters.tid !== null;
    var hasTag = activeMetadataFilters.tag !== null;
    var anyActive = hasPid || hasTid || hasTag;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker' || item.type === 'run-separator') {
            item.metadataFiltered = false;
            continue;
        }
        if (!anyActive) { item.metadataFiltered = false; continue; }
        var pass = true;
        if (hasPid && (item.parsedPid == null || !activeMetadataFilters.pid.has(String(item.parsedPid)))) pass = false;
        if (hasTid && (item.parsedTid == null || !activeMetadataFilters.tid.has(String(item.parsedTid)))) pass = false;
        if (hasTag) {
            var lineTag = item.parsedTag || item.logcatTag || null;
            if (!lineTag || !activeMetadataFilters.tag.has(lineTag)) pass = false;
        }
        item.metadataFiltered = !pass;
    }
}

/** Whether any metadata filter is active (for filter badge). */
function hasActiveMetadataFilter() {
    return activeMetadataFilters.pid !== null || activeMetadataFilters.tid !== null || activeMetadataFilters.tag !== null;
}
`;
}
