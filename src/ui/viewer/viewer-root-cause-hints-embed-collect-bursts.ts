/**
 * Embedded JS collection for burst/escalation signals (plan 052 Group 1).
 *
 * Three signals derived from a single forward pass over `allLines`:
 *   1. Severity escalation (F10): warnings preceding errors within a tight window.
 *   2. Silence-then-burst (F9): quiet period followed by a flood of lines.
 *   3. Frame-budget cluster (F14): slow operations clustered within a window.
 *
 * Why one pass instead of three: each signal type is O(n) on its own. Bundling them
 * into a single loop keeps the cost amortized and avoids re-reading line text three
 * times for the slow-op regex check. The signals are independent — they share only
 * the iteration order.
 *
 * Output is appended to the bundle by `collectRootCauseHintBundleEmbedded`.
 */

import {
  ROOT_CAUSE_FRAME_BUDGET_CLUSTER_MIN_COUNT,
  ROOT_CAUSE_FRAME_BUDGET_CLUSTER_WINDOW_MS,
  ROOT_CAUSE_SEVERITY_ESCALATION_MIN_WARNINGS,
  ROOT_CAUSE_SEVERITY_ESCALATION_WINDOW_MS,
  ROOT_CAUSE_SILENCE_BURST_MIN_LINES,
  ROOT_CAUSE_SILENCE_BURST_MIN_SILENCE_MS,
  ROOT_CAUSE_SILENCE_BURST_WINDOW_MS,
} from '../../modules/root-cause-hints/root-cause-hint-eligibility';

export function getViewerRootCauseHintsBurstsCollectChunk(slowOpThresholdMs: number): string {
  const ESC_MIN_WARN = ROOT_CAUSE_SEVERITY_ESCALATION_MIN_WARNINGS;
  const ESC_WIN_MS = ROOT_CAUSE_SEVERITY_ESCALATION_WINDOW_MS;
  const SB_MIN_SILENCE_MS = ROOT_CAUSE_SILENCE_BURST_MIN_SILENCE_MS;
  const SB_MIN_LINES = ROOT_CAUSE_SILENCE_BURST_MIN_LINES;
  const SB_WIN_MS = ROOT_CAUSE_SILENCE_BURST_WINDOW_MS;
  const FBC_MIN_COUNT = ROOT_CAUSE_FRAME_BUDGET_CLUSTER_MIN_COUNT;
  const FBC_WIN_MS = ROOT_CAUSE_FRAME_BUDGET_CLUSTER_WINDOW_MS;
  const SLOW_MS = slowOpThresholdMs;

  return /* javascript */ `
/* bug_022: collectBurstSignals() used to re-run its single forward pass over the
   ENTIRE allLines array on every batch (O(n) per batch, O(n^2) over a session). The
   sliding-window state (warnWindow/slowWindow/pendingBurst) and the emitted signal
   arrays now persist at module scope (this file's chunk is concatenated into the
   general collector's chunk, sharing one long-lived webview script scope) so a batch
   only walks the lines appended since the previous call. */
var rchBurstsLastScannedIndex = 0;
var rchBurstsEscalations = [];
var rchBurstsSilenceBursts = [];
var rchBurstsFrameBudgetClusters = [];
var rchBurstsWarnWindow = [];
var rchBurstsSlowWindow = [];
var rchBurstsPrevTs = null;
var rchBurstsPendingBurst = null;

/* bug_030 (sub-issue 2): every Gradle/Xcode cold-start produces 30-90s of silence
   (the native build) followed by a flood of app-boot log lines — that flood was
   indistinguishable from a real "possible UI freeze" burst, so it fired HIGH
   confidence on every single build (and again on every idle-then-tap, which is a
   separate false positive but shares the same root cause: bursts have no content
   awareness). These are the concrete, stable markers Flutter/Gradle/Xcode print
   around a build+launch cycle; a burst that starts on or contains one of them is
   build/launch noise, not a UI freeze, and gets suppressed. */
var rchBuildNoiseRe = /\\b(BUILD SUCCESSFUL|BUILD FAILED|Running Gradle task|Gradle build|Xcode build done|Launching lib\\/main\\.dart|Installing build[\\\\/]|Syncing files to device|> Task :|CocoaPods|Signing app bundle|Debug service listening on)\\b/i;

/** Reset burst-signal accumulator state. Called on session change/clear so a new
 *  session never inherits sliding-window state or line indices from the previous one. */
function resetBurstSignalsAccumulator() {
    rchBurstsLastScannedIndex = 0;
    rchBurstsEscalations = [];
    rchBurstsSilenceBursts = [];
    rchBurstsFrameBudgetClusters = [];
    rchBurstsWarnWindow = [];
    rchBurstsSlowWindow = [];
    rchBurstsPrevTs = null;
    rchBurstsPendingBurst = null;
}

/**
 * Collect severity escalation, silence-then-burst, and frame-budget cluster signals.
 * Incremental forward pass over allLines — only scans lines appended since the last
 * call (bug_022). Returns {} fields when allLines unavailable.
 * Caps per signal type to keep bundle payload bounded.
 *
 * Depends on rchExtractDuration / stripTags from collect-general (shared webview scope).
 */
function collectBurstSignals() {
    if (typeof allLines === 'undefined' || !allLines.length) {
        return { escalations: rchBurstsEscalations, silenceBursts: rchBurstsSilenceBursts, frameBudgetClusters: rchBurstsFrameBudgetClusters };
    }

    /* trimData() splices lines off the front of allLines once the buffer exceeds MAX_LINES,
       shifting every stored lineIndex out from under us. A shrink is the only signal we
       have of that (see collect-general.js's identical guard) — treat it as "start over". */
    if (rchBurstsLastScannedIndex > allLines.length) {
        resetBurstSignalsAccumulator();
    }

    /* Local aliases so the pass body below (unchanged logic) reads/writes the
       persisted module-scope state without a wall of rchBursts-prefixed names. */
    var escalations = rchBurstsEscalations;
    var silenceBursts = rchBurstsSilenceBursts;
    var frameBudgetClusters = rchBurstsFrameBudgetClusters;
    var warnWindow = rchBurstsWarnWindow;
    var slowWindow = rchBurstsSlowWindow;
    var prevTs = rchBurstsPrevTs;
    var pendingBurst = rchBurstsPendingBurst;

    var i, row, ts, plain, signalLevel, durResult;

    for (i = rchBurstsLastScannedIndex; i < allLines.length; i++) {
        row = allLines[i];
        if (!row || row.type !== 'line') continue;
        if (row.isSeparator || row.errorSuppressed) continue;

        ts = (typeof row.timestamp === 'number' && isFinite(row.timestamp)) ? row.timestamp : null;

        /* Computed once per line (was previously computed lazily per-signal) — the
           build-noise check (F9) now needs the plain text on every line, not just
           the ones that already needed it for F10/F14, so there is no longer a
           cheaper lazy path. */
        plain = stripTags(row.html || '').replace(/\\s+/g, ' ').trim();
        var isBuildNoiseLine = plain.length >= 4 && rchBuildNoiseRe.test(plain);

        /* --- F9 silence-then-burst -------------------------------------------------
           Track gaps in the timestamp stream. A burst starts when a gap >= MIN_SILENCE_MS
           opens; subsequent lines whose ts is within BURST_WIN_MS of the gap-end count
           toward the burst. We finalize when ts moves outside the burst window or when
           a new larger silence opens. Lines with no ts break the chain (can't reason
           about gaps without timestamps) — reset prevTs to null.
           buildNoise on the accumulating pendingBurst suppresses emission entirely
           (bug_030 sub-issue 2) once ANY line in the burst matches a build/launch marker. */
        if (ts !== null) {
            if (prevTs !== null) {
                var gap = ts - prevTs;
                if (gap >= ${SB_MIN_SILENCE_MS}) {
                    /* Finalize any pending burst (the new silence ends it).
                       This emit path catches bursts where the trailing line is also separated
                       by another silence — rare but real. */
                    if (pendingBurst && !pendingBurst.buildNoise && pendingBurst.count >= ${SB_MIN_LINES} && silenceBursts.length < 4) {
                        silenceBursts.push({
                            lineIndex: pendingBurst.startIdx,
                            silenceMs: Math.round(pendingBurst.silenceMs),
                            burstSize: pendingBurst.count,
                            burstWindowMs: Math.round(pendingBurst.spanMs)
                        });
                    }
                    pendingBurst = { startIdx: i, startTs: ts, silenceMs: gap, count: 1, spanMs: 0, buildNoise: isBuildNoiseLine };
                } else if (pendingBurst) {
                    var burstAge = ts - pendingBurst.startTs;
                    if (burstAge <= ${SB_WIN_MS}) {
                        pendingBurst.count++;
                        pendingBurst.spanMs = burstAge;
                        if (isBuildNoiseLine) pendingBurst.buildNoise = true;
                    } else {
                        if (!pendingBurst.buildNoise && pendingBurst.count >= ${SB_MIN_LINES} && silenceBursts.length < 4) {
                            silenceBursts.push({
                                lineIndex: pendingBurst.startIdx,
                                silenceMs: Math.round(pendingBurst.silenceMs),
                                burstSize: pendingBurst.count,
                                burstWindowMs: Math.round(pendingBurst.spanMs)
                            });
                        }
                        pendingBurst = null;
                    }
                }
            }
            prevTs = ts;
        } else {
            prevTs = null;
        }

        signalLevel = row.originalLevel || row.level;

        /* --- F10 severity escalation ---------------------------------------------
           Maintain a window of recent warnings. Trim from the front while the head's
           ts is older than (current ts - WIN_MS). When we hit an error, count warnings
           in the window — emit if >= MIN. Without timestamps we can't reliably trim
           the window, so we skip lines with no ts for this signal (warnings still get
           recorded for next ts'd error, but trimming relies on ts). */
        if (ts !== null) {
            while (warnWindow.length > 0 && (ts - warnWindow[0].ts) > ${ESC_WIN_MS}) {
                warnWindow.shift();
            }
        }
        if (signalLevel === 'warning' && ts !== null) {
            warnWindow.push({ lineIndex: i, ts: ts });
            /* Hard cap so the window doesn't grow unboundedly if MIN never triggers
               (e.g. dozens of warnings without an error). 32 is plenty for the
               2-warning minimum and bounds memory. */
            if (warnWindow.length > 32) warnWindow.shift();
        }
        if (signalLevel === 'error' && ts !== null && warnWindow.length >= ${ESC_MIN_WARN} && escalations.length < 5) {
            if (plain.length >= 4) {
                var earliestTs = warnWindow[0].ts;
                /* Use the shared rchExcerpt helper from collect-general — keeps truncation
                   logic in one place and satisfies the no-inline-200-char-truncation guard test. */
                escalations.push({
                    errorLineIndex: i,
                    errorExcerpt: rchExcerpt(plain),
                    precedingWarningLineIds: warnWindow.map(function(w) { return w.lineIndex; }),
                    windowMs: Math.round(ts - earliestTs)
                });
            }
            /* Clear so the same warning set doesn't fire on the next error in the same
               window. Subsequent errors need fresh warnings to escalate.
               In-place clear (not reassignment) — warnWindow aliases the persisted
               rchBurstsWarnWindow array; a plain "= []" would only rebind this local
               var and leave the persisted array stale for the next incremental call. */
            warnWindow.length = 0;
        }

        /* --- F14 frame-budget cluster --------------------------------------------
           Re-detect slow ops here using rchExtractDuration (shared scope from
           collect-general). Maintain a sliding window keyed by ts. When the window
           hits MIN_COUNT slow ops, emit a cluster and clear the window so we don't
           re-emit overlapping clusters for one continuous jank period. */
        if (ts !== null && typeof rchExtractDuration === 'function' && plain.length >= 4) {
            durResult = rchExtractDuration(plain);
            if (durResult && durResult.durationMs >= ${SLOW_MS}) {
                while (slowWindow.length > 0 && (ts - slowWindow[0].ts) > ${FBC_WIN_MS}) {
                    slowWindow.shift();
                }
                slowWindow.push({ lineIndex: i, ts: ts });
                if (slowWindow.length >= ${FBC_MIN_COUNT} && frameBudgetClusters.length < 4) {
                    var firstTs = slowWindow[0].ts;
                    frameBudgetClusters.push({
                        lineIndices: slowWindow.map(function(s) { return s.lineIndex; }),
                        windowMs: Math.round(ts - firstTs)
                    });
                    /* In-place clear — see warnWindow.length = 0 comment above. */
                    slowWindow.length = 0;
                }
            }
        }
    }

    rchBurstsLastScannedIndex = allLines.length;
    /* Persist the sliding-window/pendingBurst state back to module scope for the next
       incremental call (warnWindow/slowWindow were mutated in place above, but prevTs
       and pendingBurst are reassigned by value inside the loop, so they need writing
       back explicitly). */
    rchBurstsPrevTs = prevTs;
    rchBurstsPendingBurst = pendingBurst;

    /* Finalize trailing pending burst against the lines seen SO FAR. This is a
       best-effort snapshot, not a true end-of-stream finalize (there is no such thing
       once scanning is incremental — more lines may extend this same burst next
       batch). Null it out after emitting so we never push the same burst twice; a
       burst that keeps growing across batches is under-reported (its window looks
       shorter than it eventually is) rather than duplicated, which is the safer
       failure mode for a signal panel. */
    if (pendingBurst && !pendingBurst.buildNoise && pendingBurst.count >= ${SB_MIN_LINES} && silenceBursts.length < 4) {
        silenceBursts.push({
            lineIndex: pendingBurst.startIdx,
            silenceMs: Math.round(pendingBurst.silenceMs),
            burstSize: pendingBurst.count,
            burstWindowMs: Math.round(pendingBurst.spanMs)
        });
        rchBurstsPendingBurst = null;
    }

    return { escalations: escalations, silenceBursts: silenceBursts, frameBudgetClusters: frameBudgetClusters };
}
`;
}
