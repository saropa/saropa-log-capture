/**
 * Trouble Mode severity chart — finding the app's launch instant.
 *
 * A phone drains its logcat backlog while an app starts: dozens of ActivityManager /
 * WindowManager warnings that belong to the device, not to the app under debug. Charted
 * naively, that one leading window scales the entire strip and every real spike after it
 * collapses into an unreadable sliver. The chart therefore keeps pre-launch windows out
 * of its peak — it still draws them, muted, because hiding data is never the answer.
 *
 * This module owns the one thing that rule needs: the timestamp of the launch line. Split
 * out of viewer-trouble-chart.ts purely to hold the 300-line file limit; its script text is
 * concatenated ahead of the chart's, so both share the same webview page scope.
 */

/** Embedded webview JavaScript: locate the app's launch line and resolve its timestamp. */
export function getTroubleChartLaunchScript(): string {
    return /* javascript */ `
/* Mirror of the 'launch' run-start pattern in src/modules/session/run-boundaries.ts. It is
   copied rather than imported because the run-boundary detector lives in the extension host
   and its results only ever feed run summaries — they are never sent to the page. Keep the
   two in lockstep; a drift here silently disables the pre-launch rule. The leading
   [time][category] strip mirrors that file's getMessagePart(): most lines reach the page
   already stripped, but the no-timestamp loader path passes the raw line through. */
var TROUBLE_CHART_LAUNCH_RE = /^Launching\\s.+\\s+in\\s+(?:debug|profile|release)\\s+mode/i;
var TROUBLE_CHART_PREFIX_RE = /^\\[[\\d:.]+\\]\\s*\\[\\w+\\]\\s?/;
/* Resumable scan. allLines only ever appends, so each line is tested at most once across
   the session — a per-render rescan would run this regex over every line five times a
   second. scanIdx is the next line to test for the launch text; once found, resolveIdx
   walks forward for the first real timestamp. */
var troubleChartLaunch = { scanIdx: 0, resolveIdx: -1, ts: 0 };

/* Called when a new log replaces allLines (viewer-script-messages.ts clears it). Without
   this the resumed scan would start part-way into the new log and miss its launch line.
   The length guard in troubleChartLaunchTs is only a backstop for a SHORTER new log; a
   longer one looks like an append and needs this explicit reset. */
function resetTroubleChartLaunchScan() {
    troubleChartLaunch = { scanIdx: 0, resolveIdx: -1, ts: 0 };
}

/* Timestamp of the app's launch, or 0 when the log has none (a pure logcat capture, or a
   session attached after the app was already running).

   The launch line itself usually carries NO timestamp: Flutter's tool prints "Launching
   lib/main.dart on <device> in debug mode..." to stdout with no clock prefix, so
   extractTimestamp leaves it at 0. Requiring a timestamp ON that line would silently
   disable the rule for exactly the logs it exists to fix. The launch instant is therefore
   taken from the first timestamped line at or after it — and stays 0 while a live capture
   has printed the launch line but nothing timestamped has followed it yet. */
function troubleChartLaunchTs() {
    if (troubleChartLaunch.scanIdx > allLines.length) { resetTroubleChartLaunchScan(); }
    if (troubleChartLaunch.ts > 0) { return troubleChartLaunch.ts; }
    while (troubleChartLaunch.resolveIdx < 0 && troubleChartLaunch.scanIdx < allLines.length) {
        var item = allLines[troubleChartLaunch.scanIdx];
        if (item && item.rawText && TROUBLE_CHART_LAUNCH_RE.test(String(item.rawText).replace(TROUBLE_CHART_PREFIX_RE, ''))) {
            troubleChartLaunch.resolveIdx = troubleChartLaunch.scanIdx;
        }
        troubleChartLaunch.scanIdx++;
    }
    if (troubleChartLaunch.resolveIdx < 0) { return 0; }
    for (var j = troubleChartLaunch.resolveIdx; j < allLines.length; j++) {
        var at = allLines[j];
        if (at && at.timestamp > 0) {
            troubleChartLaunch.ts = at.timestamp;
            return troubleChartLaunch.ts;
        }
    }
    return 0;
}
`;
}
