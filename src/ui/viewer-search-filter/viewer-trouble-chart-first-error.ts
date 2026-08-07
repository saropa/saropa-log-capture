/**
 * Trouble chart "First error" button — finds and jumps to the first error-level
 * line after the app-start boundary.
 *
 * Extracted from viewer-trouble-chart.ts to stay under the 300-line file limit.
 * Concatenated into the same webview page scope, so it reads troubleChartLaunchTs,
 * allLines, and scrollToLineNumber directly.
 */

/** Embedded webview JavaScript: cached first-error scan + button sync. */
export function getTroubleChartFirstErrorScript(): string {
    return /* javascript */ `
/* Cached first-error line. Invalidated when allLines.length or launchTs changes.
   Assumption: same-length content replacement (clear + reload with identical line count)
   is not a real scenario — clear sets length to 0 first, which invalidates. */
var tcFirstErrorCache = { len: -1, launchTs: -1, line: 0 };

/* Find the 1-based viewer line number of the first error-level line after the app-start
   boundary (or from line 0 when no boundary exists). Returns 0 when no error is found.
   Cached: the O(n) scan only re-runs when allLines grows or the launch boundary changes. */
function findFirstErrorLineAfterLaunch() {
    var launchTs = troubleChartLaunchTs();
    var len = allLines.length;
    if (tcFirstErrorCache.len === len && tcFirstErrorCache.launchTs === launchTs) {
        return tcFirstErrorCache.line;
    }
    var result = 0;
    for (var i = 0; i < len; i++) {
        var item = allLines[i];
        if (!item || item.type !== 'line' || item.level !== 'error') { continue; }
        /* Skip pre-launch lines: require a real timestamp on both the boundary and the line
           so a line with timestamp 0 (no clock prefix) is never wrongly skipped. */
        if (launchTs > 0 && item.timestamp > 0 && item.timestamp < launchTs) { continue; }
        if (typeof item.viewerLineIndex === 'number') { result = item.viewerLineIndex + 1; break; }
    }
    tcFirstErrorCache = { len: len, launchTs: launchTs, line: result };
    return result;
}

/* Show/hide the "First error" button based on whether a post-launch error exists.
   Called from renderTroubleChart so the button stays in sync with the chart data. */
function syncJumpFirstErrorButton() {
    var btn = document.getElementById('tc-jump-first-error');
    if (!btn) { return; }
    btn.classList.toggle('u-hidden', findFirstErrorLineAfterLaunch() <= 0);
}
`;
}
