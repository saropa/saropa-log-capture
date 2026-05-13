/**
 * Hypothesis generators for burst/escalation signals (plan 052 Group 1).
 *
 * Three signals derived from existing log data — no SDK or HAR dependency:
 *   1. Severity escalation chain (F10): warnings preceding an error within a window.
 *   2. Silence-then-burst (F9): quiet period followed by a flood of lines.
 *   3. Frame-budget cluster (F14): clusters of slow operations within a window.
 *
 * Each function takes a `RootCauseHintBundle` and returns `WorkingHypothesis[]`.
 * Texts are actionable — they include concrete counts and durations, not generic templates.
 */

import type { RootCauseHintBundle } from './root-cause-hint-types';
import { truncateText } from './build-hypotheses-text';
import type { Tier, WorkingHypothesis } from './build-hypotheses-general';

/**
 * Severity escalation chains — warnings preceding an error within a tight window.
 * Confidence is **medium** because the relationship is correlational, not causal: warnings
 * within 5s of an error are *usually* related, but not always (e.g. unrelated background
 * subsystems logging at the same time). Tier 1 (normal priority) — it's a context signal,
 * not a smoking gun.
 */
export function severityEscalationHypotheses(
  bundle: RootCauseHintBundle,
  maxLen: number,
): WorkingHypothesis[] {
  const chains = bundle.severityEscalations;
  if (!chains || chains.length === 0) { return []; }
  const out: WorkingHypothesis[] = [];
  for (const c of chains.slice(0, 2)) {
    const sec = (c.windowMs / 1000).toFixed(1);
    const count = c.precedingWarningLineIds.length;
    const word = count === 1 ? 'warning' : 'warnings';
    /* Evidence is the error line first (the user clicks to navigate to the failure)
       followed by warnings in chronological order so they read as a timeline. */
    const evidence = [c.errorLineIndex, ...c.precedingWarningLineIds].slice(0, 8);
    out.push({
      templateId: 'severity-escalation',
      text: truncateText(
        `Severity escalation: ${count} ${word} preceded the error within ${sec}s — ${c.errorExcerpt}`,
        maxLen,
      ),
      evidenceLineIds: evidence,
      confidence: 'medium',
      confidenceReason: `${count} ${word} within ${sec}s window`,
      hypothesisKey: `esc::${c.errorLineIndex}`,
      tier: 1 as Tier,
    });
  }
  return out;
}

/**
 * Silence-then-burst — extended quiet followed by a flood. Catches frozen-UI unwinds
 * and watchdog events that are otherwise invisible because the *gap* is the signal.
 * Confidence is **medium** by default: the pattern is meaningful but doesn't always
 * indicate a problem (e.g. user genuinely idle, then resumed). Promotes to **high**
 * when silence ≥30s — that range is hard to explain as user idle.
 */
export function silenceBurstHypotheses(
  bundle: RootCauseHintBundle,
  maxLen: number,
): WorkingHypothesis[] {
  const bursts = bundle.silenceBursts;
  if (!bursts || bursts.length === 0) { return []; }
  const out: WorkingHypothesis[] = [];
  for (const b of bursts.slice(0, 2)) {
    const silenceSec = (b.silenceMs / 1000).toFixed(1);
    const confidence = b.silenceMs >= 30_000 ? 'high' : 'medium';
    out.push({
      templateId: 'silence-burst',
      text: truncateText(
        `Log silence (${silenceSec}s) followed by burst of ${b.burstSize} lines in ${b.burstWindowMs}ms — possible UI freeze or watchdog event`,
        maxLen,
      ),
      evidenceLineIds: [b.lineIndex],
      confidence,
      confidenceReason: `${silenceSec}s silence, ${b.burstSize}-line burst`,
      hypothesisKey: `sb::${b.lineIndex}`,
      tier: 1 as Tier,
    });
  }
  return out;
}

/**
 * Frame-budget cluster — multiple slow operations within a window. Builds on the
 * existing slow-op signal (plan 048): a single 500ms op is a slow-op hint, but
 * five within 10s is jank visible to the user. Confidence is **medium** because
 * cluster detection itself is reliable, but the *cause* of the jank still requires
 * investigation of the underlying operations. Tier 1 — user-visible degradation.
 */
export function frameBudgetClusterHypotheses(
  bundle: RootCauseHintBundle,
  maxLen: number,
): WorkingHypothesis[] {
  const clusters = bundle.frameBudgetClusters;
  if (!clusters || clusters.length === 0) { return []; }
  const out: WorkingHypothesis[] = [];
  for (const c of clusters.slice(0, 2)) {
    const sec = (c.windowMs / 1000).toFixed(1);
    const count = c.lineIndices.length;
    out.push({
      templateId: 'frame-budget-cluster',
      text: truncateText(
        `Frame budget cluster: ${count} slow operations in ${sec}s — UI jank likely visible`,
        maxLen,
      ),
      evidenceLineIds: c.lineIndices.slice(0, 8),
      confidence: 'medium',
      confidenceReason: `${count} slow ops within ${sec}s window`,
      hypothesisKey: `fbc::${c.lineIndices[0] ?? 0}`,
      tier: 1 as Tier,
    });
  }
  return out;
}
