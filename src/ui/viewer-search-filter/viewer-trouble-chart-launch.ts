/**
 * Trouble Mode severity chart — finding the instant the app becomes ready.
 *
 * A phone drains its logcat backlog while an app starts: dozens of ActivityManager /
 * WindowManager warnings (and, on a fresh run, a whole build's worth of tool output) that
 * belong to the device, not to the app under debug. Charted naively, that one leading span
 * scales the entire strip and every real spike after it collapses into an unreadable sliver.
 * The chart therefore keeps those windows out of its peak — it still draws them, muted,
 * because hiding data is never the answer.
 *
 * This module owns the one thing that rule needs: the timestamp of the app-ready boundary.
 * Everything BEFORE it is device backlog plus build-tool output. Two markers define it:
 *   - the launch-start line ("Launching … in debug mode") — mirror of run-boundaries.ts, and
 *   - the build-complete line ("√ Built …apk", "Xcode build done") — the STRONGER boundary,
 *     because nothing the app emits can precede its own built artifact, so it excludes the
 *     whole compile phase's device noise, not just the pre-launch burst.
 * run-boundaries.ts deliberately treats only "Launching…" as a run START; the chart wants a
 * LATER cut than a run start, so "Built" is a chart-specific addition, NOT mirrored there.
 *
 * Split out of viewer-trouble-chart.ts purely to hold the 300-line file limit; its script text
 * is concatenated ahead of the chart's, so both share the same webview page scope.
 */

/** Embedded webview JavaScript: locate the app-ready boundary and resolve its timestamp. */
export function getTroubleChartLaunchScript(): string {
    return /* javascript */ `
/* Launch-start line. Mirror of the 'launch' run-start pattern in run-boundaries.ts (copied,
   not imported: that detector lives in the extension host and its results never reach the
   page). Keep the two in lockstep; a drift here silently disables the fallback boundary. */
var TROUBLE_CHART_LAUNCH_RE = /^Launching\\s.+\\s+in\\s+(?:debug|profile|release)\\s+mode/i;
/* Build-complete line, across platforms:
     √/✓ Built build\\app\\outputs\\flutter-apk\\app-debug.apk   (Android)
     Xcode build done.                                          (iOS)
   Matched on the artifact keyword, NOT the leading check glyph, whose encoding varies by
   terminal. This has no run-boundaries.ts counterpart on purpose (see the module header). */
var TROUBLE_CHART_BUILT_RE = /\\bBuilt\\s+.+\\.(?:apk|aab|ipa)\\b|\\bXcode build done\\b/i;
/* The leading [time][category] strip mirrors run-boundaries.ts getMessagePart(): most lines
   reach the page already stripped, but the no-timestamp loader path passes the raw line through. */
var TROUBLE_CHART_PREFIX_RE = /^\\[[\\d:.]+\\]\\s*\\[\\w+\\]\\s?/;
/* Resumable scan. allLines only ever appends, so each line is tested at most once across the
   session — a per-render rescan would run these regexes over every line five times a second.
   scanIdx is the next line to test; startIdx / builtIdx are the FIRST launch-start and FIRST
   build-complete markers found (-1 until seen). */
var troubleChartLaunch = { scanIdx: 0, startIdx: -1, builtIdx: -1 };

/* Called when a new log replaces allLines (viewer-script-messages.ts clears it). Without this
   the resumed scan would start part-way into the new log and miss its markers. The self-heal
   in troubleChartLaunchTs is a backstop for load paths that skip the clear; this is the
   primary reset. */
function resetTroubleChartLaunchScan() {
    troubleChartLaunch = { scanIdx: 0, startIdx: -1, builtIdx: -1 };
}

/* Line text at idx with the saved-log [time][category] prefix stripped, or '' when the item
   has no rawText (markers, synthetic rows). */
function troubleChartMarkerTextAt(idx) {
    var it = (idx >= 0 && idx < allLines.length) ? allLines[idx] : null;
    if (!it || !it.rawText) { return ''; }
    return String(it.rawText).replace(TROUBLE_CHART_PREFIX_RE, '');
}

/* 'built' | 'start' | null for already-prefix-stripped text. Build-complete wins the test so a
   single line is never both. */
function troubleChartMarkerKind(text) {
    if (TROUBLE_CHART_BUILT_RE.test(text)) { return 'built'; }
    if (TROUBLE_CHART_LAUNCH_RE.test(text)) { return 'start'; }
    return null;
}

/* First timestamped line at or after idx, or 0. The marker line usually carries the timestamp;
   the forward walk only matters for the live-capture launch line, which Flutter prints to
   stdout with no clock prefix (extractTimestamp leaves it 0). Requiring a timestamp ON that
   line would silently disable the rule for exactly the logs it exists to fix. */
function troubleChartResolveFwd(idx) {
    if (idx < 0) { return 0; }
    for (var j = idx; j < allLines.length; j++) {
        var at = allLines[j];
        if (at && at.timestamp > 0) { return at.timestamp; }
    }
    return 0;
}

/* True when a cached marker index no longer points at a marker line — proof the array was
   REPLACED (a new log loaded) rather than appended, so the resumable scan must restart. */
function troubleChartIndexStale(idx) {
    return idx >= 0 && !troubleChartMarkerKind(troubleChartMarkerTextAt(idx));
}

/* Timestamp of the app-ready boundary, or 0 when the log has none (a pure logcat capture, or a
   session attached after the app was already running). Windows ending at or before it are the
   device's own pre-app backlog. */
function troubleChartLaunchTs() {
    /* Self-heal the resumable scan. It caches indices into allLines, which is REPLACED (not
       appended) when a different log loads — normally fired through resetTroubleChartLaunchScan
       by the 'clear' message, but if any load path skips that, a stale scanIdx sits past the
       new log's markers so they are never found and the device burst keeps scaling the peak
       (the 9.2.0 field report). A shrunk array, or a cached marker index that no longer holds a
       marker, both mean the array was swapped underneath us. */
    if (troubleChartLaunch.scanIdx > allLines.length
        || troubleChartIndexStale(troubleChartLaunch.builtIdx)
        || troubleChartIndexStale(troubleChartLaunch.startIdx)) {
        resetTroubleChartLaunchScan();
    }
    while (troubleChartLaunch.scanIdx < allLines.length) {
        var idx = troubleChartLaunch.scanIdx;
        troubleChartLaunch.scanIdx++;
        var kind = troubleChartMarkerKind(troubleChartMarkerTextAt(idx));
        if (kind === 'built' && troubleChartLaunch.builtIdx < 0) { troubleChartLaunch.builtIdx = idx; }
        else if (kind === 'start' && troubleChartLaunch.startIdx < 0) { troubleChartLaunch.startIdx = idx; }
    }
    /* Prefer the build-complete boundary; fall back to the launch-start line when the build
       line is absent (attach) or has not streamed in yet. Returns 0 = no exclusion. */
    var built = troubleChartResolveFwd(troubleChartLaunch.builtIdx);
    return built > 0 ? built : troubleChartResolveFwd(troubleChartLaunch.startIdx);
}
`;
}
