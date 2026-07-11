/**
 * The green "App started" divider inserted into the feed at the launch line — the feed
 * counterpart to the Trouble Mode chart's green app-start marker.
 *
 * Split out of viewer-run-nav.ts purely to hold the 300-line file limit; its script text is
 * concatenated ahead of the run-nav body, so both share the same webview page scope. These
 * functions read allLines / runStartIndices / totalHeight / MARKER_HEIGHT / buildPrefixSums / vt
 * from that shared scope and are called from handleRunBoundaries in viewer-run-nav.ts.
 */

/** Embedded webview JavaScript: locate the launch line and splice the app-start divider. */
export function getRunAppStartDividerScript(): string {
    return /* javascript */ `
/* Line index of the FIRST 'launch' run boundary — where the app began, after any device
   backlog. -1 when the log has no launch line (attached mid-session, or pure logcat). */
function firstLaunchLineIndex(boundaries) {
    if (!boundaries) return -1;
    for (var i = 0; i < boundaries.length; i++) {
        if (boundaries[i] && boundaries[i].kind === 'launch') return boundaries[i].lineIndex;
    }
    return -1;
}

/* Insert one green "App started" divider at the launch line — the feed's counterpart to the
   Trouble Mode chart's green app-start bar, marking where the app began after the device
   backlog. Reuses the marker row type so it is never filtered, breaks groups, and takes
   MARKER_HEIGHT for free. Idempotent (skips if the divider is already there). Runs BEFORE
   insertRunSeparators so the +1 index shift is already reflected in the runStartIndices the
   separators read. */
function insertAppStartMarker(atIdx) {
    if (atIdx == null || atIdx < 0 || !allLines || atIdx >= allLines.length) return;
    if (allLines[atIdx] && allLines[atIdx].appStart) return;
    var label = (typeof vt === 'function') ? vt('viewer.marker.appStart') : 'App started';
    allLines.splice(atIdx, 0, { type: 'marker', appStart: true, html: label, rawText: null, height: MARKER_HEIGHT, category: '', groupId: -1, timestamp: 0 });
    totalHeight += MARKER_HEIGHT;
    for (var j = 0; j < runStartIndices.length; j++) { if (runStartIndices[j] >= atIdx) runStartIndices[j] += 1; }
    if (typeof buildPrefixSums === 'function') buildPrefixSums();
}
`;
}
