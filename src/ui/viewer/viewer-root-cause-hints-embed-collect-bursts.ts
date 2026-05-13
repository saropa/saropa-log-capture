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
/**
 * Collect severity escalation, silence-then-burst, and frame-budget cluster signals.
 * Single forward pass over allLines. Returns {} fields when allLines unavailable.
 * Caps per signal type to keep bundle payload bounded.
 *
 * Depends on rchExtractDuration / stripTags from collect-general (shared webview scope).
 */
function collectBurstSignals() {
    var escalations = [];
    var silenceBursts = [];
    var frameBudgetClusters = [];

    if (typeof allLines === 'undefined' || !allLines.length) {
        return { escalations: escalations, silenceBursts: silenceBursts, frameBudgetClusters: frameBudgetClusters };
    }

    /* Sliding warning window for F10 — trimmed by ts on each iteration. Each entry is
       { lineIndex, ts } so we can both count and emit evidence line IDs. */
    var warnWindow = [];
    /* Sliding slow-op window for F14 — same shape. Emitting a cluster clears the window
       to avoid overlapping cluster reports for one extended jank period. */
    var slowWindow = [];
    /* Silence-burst state for F9: when we detect a >=MIN_SILENCE gap, we start counting
       lines whose ts falls within BURST_WIN_MS of the burst start. We emit at most one
       burst per gap to avoid double-reporting nested bursts. */
    var prevTs = null;
    var pendingBurst = null;

    var i, row, ts, plain, signalLevel, durResult, j;

    for (i = 0; i < allLines.length; i++) {
        row = allLines[i];
        if (!row || row.type !== 'line') continue;
        if (row.isSeparator || row.errorSuppressed) continue;

        ts = (typeof row.timestamp === 'number' && isFinite(row.timestamp)) ? row.timestamp : null;

        /* --- F9 silence-then-burst -------------------------------------------------
           Track gaps in the timestamp stream. A burst starts when a gap >= MIN_SILENCE_MS
           opens; subsequent lines whose ts is within BURST_WIN_MS of the gap-end count
           toward the burst. We finalize when ts moves outside the burst window or when
           a new larger silence opens. Lines with no ts break the chain (can't reason
           about gaps without timestamps) — reset prevTs to null. */
        if (ts !== null) {
            if (prevTs !== null) {
                var gap = ts - prevTs;
                if (gap >= ${SB_MIN_SILENCE_MS}) {
                    /* Finalize any pending burst (the new silence ends it).
                       This emit path catches bursts where the trailing line is also separated
                       by another silence — rare but real. */
                    if (pendingBurst && pendingBurst.count >= ${SB_MIN_LINES} && silenceBursts.length < 4) {
                        silenceBursts.push({
                            lineIndex: pendingBurst.startIdx,
                            silenceMs: Math.round(pendingBurst.silenceMs),
                            burstSize: pendingBurst.count,
                            burstWindowMs: Math.round(pendingBurst.spanMs)
                        });
                    }
                    pendingBurst = { startIdx: i, startTs: ts, silenceMs: gap, count: 1, spanMs: 0 };
                } else if (pendingBurst) {
                    var burstAge = ts - pendingBurst.startTs;
                    if (burstAge <= ${SB_WIN_MS}) {
                        pendingBurst.count++;
                        pendingBurst.spanMs = burstAge;
                    } else {
                        if (pendingBurst.count >= ${SB_MIN_LINES} && silenceBursts.length < 4) {
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
            plain = stripTags(row.html || '').replace(/\\s+/g, ' ').trim();
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
               window. Subsequent errors need fresh warnings to escalate. */
            warnWindow = [];
        }

        /* --- F14 frame-budget cluster --------------------------------------------
           Re-detect slow ops here using rchExtractDuration (shared scope from
           collect-general). Maintain a sliding window keyed by ts. When the window
           hits MIN_COUNT slow ops, emit a cluster and clear the window so we don't
           re-emit overlapping clusters for one continuous jank period. */
        if (ts !== null && typeof rchExtractDuration === 'function') {
            plain = plain || stripTags(row.html || '').replace(/\\s+/g, ' ').trim();
            if (plain && plain.length >= 4) {
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
                        slowWindow = [];
                    }
                }
            }
        }
        /* Reset plain so the next iteration doesn't reuse it. */
        plain = null;
    }

    /* Finalize trailing pending burst at end of stream. */
    if (pendingBurst && pendingBurst.count >= ${SB_MIN_LINES} && silenceBursts.length < 4) {
        silenceBursts.push({
            lineIndex: pendingBurst.startIdx,
            silenceMs: Math.round(pendingBurst.silenceMs),
            burstSize: pendingBurst.count,
            burstWindowMs: Math.round(pendingBurst.spanMs)
        });
    }

    return { escalations: escalations, silenceBursts: silenceBursts, frameBudgetClusters: frameBudgetClusters };
}
`;
}
