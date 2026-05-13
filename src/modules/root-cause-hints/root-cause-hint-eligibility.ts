import type { RootCauseHintBundle } from './root-cause-hint-types';

/** Minimum session hits before a fingerprint-only hypothesis is considered (no N+1 row). */
export const ROOT_CAUSE_FP_LEADER_MIN_COUNT = 12;

/** Minimum burst count when only sqlBursts drive eligibility. */
export const ROOT_CAUSE_SQL_BURST_MIN_COUNT = 4;

/** Minimum non-whitespace chars in an error excerpt to count as a signal. */
export const ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN = 4;

/** Minimum occurrences for a recurring warning to qualify. */
export const ROOT_CAUSE_WARNING_MIN_COUNT = 3;

/**
 * Default minimum duration (ms) for a slow operation to qualify as a signal.
 * The actual threshold is user-configurable via `saropaLogCapture.signalSlowOpThresholdMs`
 * and applied in the webview collector — the host treats any item in the bundle as qualifying.
 */
export const ROOT_CAUSE_SLOW_OP_MIN_MS_DEFAULT = 500;

/** Minimum ANR risk score to surface as a signal. */
export const ROOT_CAUSE_ANR_MIN_SCORE = 20;

/* --- Severity escalation chain (plan 052 F10) ---
 * Why a 5s window: tight enough that the warnings feel causally related to the error,
 * loose enough to cover async cleanup paths and retry-then-fail sequences. Tuning later
 * if too noisy. Minimum of 2 warnings prevents "one warning before an unrelated error"
 * from firing — that's too common to be useful. */
export const ROOT_CAUSE_SEVERITY_ESCALATION_MIN_WARNINGS = 2;
export const ROOT_CAUSE_SEVERITY_ESCALATION_WINDOW_MS = 5000;

/* --- Silence-then-burst (plan 052 F9) ---
 * Why 10s silence + 20 lines: smaller silences are common (user idle, between requests).
 * 10s with no output is unusual enough that the following burst is likely the unwinding
 * of something blocked. Burst window of 1s separates "queue drain" from "normal logging". */
export const ROOT_CAUSE_SILENCE_BURST_MIN_SILENCE_MS = 10000;
export const ROOT_CAUSE_SILENCE_BURST_MIN_LINES = 20;
export const ROOT_CAUSE_SILENCE_BURST_WINDOW_MS = 1000;

/* --- Frame-budget cluster (plan 052 F14) ---
 * Why 5 slow ops in 10s: a single slow op is forgivable, but 5 in 10s correlates with
 * user-visible jank or stutter. Builds on the existing slow-operation detector — counts
 * cluster severity, not individual op severity. */
export const ROOT_CAUSE_FRAME_BUDGET_CLUSTER_MIN_COUNT = 5;
export const ROOT_CAUSE_FRAME_BUDGET_CLUSTER_WINDOW_MS = 10000;

/**
 * True when the bundle has enough correlated signal to show the Hypotheses strip.
 * Template-specific floors also apply inside `buildHypotheses` (e.g. cap-only fingerprints).
 */
export function isRootCauseHintsEligible(bundle: RootCauseHintBundle): boolean {
  if (!bundle || (bundle.bundleVersion !== 1 && bundle.bundleVersion !== 2) || !bundle.sessionId) {
    return false;
  }

  if (hasQualifyingErrors(bundle)) { return true; }
  if (bundle.nPlusOneHints && bundle.nPlusOneHints.length > 0) { return true; }
  if (hasQualifyingFingerprints(bundle)) { return true; }
  if (hasQualifyingSqlBursts(bundle)) { return true; }
  if (bundle.driftAdvisorSummary && bundle.driftAdvisorSummary.issueCount > 0) { return true; }
  if (hasQualifyingSessionDiff(bundle)) { return true; }

  // v2 signal types
  if (hasQualifyingWarnings(bundle)) { return true; }
  if (bundle.networkFailures && bundle.networkFailures.length > 0) { return true; }
  if (bundle.memoryEvents && bundle.memoryEvents.length > 0) { return true; }
  if (hasQualifyingSlowOps(bundle)) { return true; }
  if (bundle.permissionDenials && bundle.permissionDenials.length > 0) { return true; }
  if (bundle.classifiedErrors && bundle.classifiedErrors.length > 0) { return true; }
  if (bundle.anrRisk && bundle.anrRisk.score >= ROOT_CAUSE_ANR_MIN_SCORE) { return true; }

  // v2 burst/escalation signals (plan 052 Group 1)
  if (bundle.severityEscalations && bundle.severityEscalations.length > 0) { return true; }
  if (bundle.silenceBursts && bundle.silenceBursts.length > 0) { return true; }
  if (bundle.frameBudgetClusters && bundle.frameBudgetClusters.length > 0) { return true; }

  return false;
}

function hasQualifyingErrors(bundle: RootCauseHintBundle): boolean {
  const errs = bundle.errors;
  if (!errs || errs.length === 0) { return false; }
  for (const e of errs) {
    if (e && typeof e.excerpt === 'string' && e.excerpt.trim().length >= ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN) {
      return true;
    }
  }
  return false;
}

function hasQualifyingFingerprints(bundle: RootCauseHintBundle): boolean {
  const leaders = bundle.fingerprintLeaders;
  if (!leaders) { return false; }
  for (const L of leaders) {
    if (L && L.count >= ROOT_CAUSE_FP_LEADER_MIN_COUNT) { return true; }
  }
  return false;
}

function hasQualifyingSqlBursts(bundle: RootCauseHintBundle): boolean {
  const bursts = bundle.sqlBursts;
  if (!bursts) { return false; }
  for (const b of bursts) {
    if (b && b.count >= ROOT_CAUSE_SQL_BURST_MIN_COUNT) { return true; }
  }
  return false;
}

function hasQualifyingSessionDiff(bundle: RootCauseHintBundle): boolean {
  const diff = bundle.sessionDiffSummary;
  return !!diff && !!diff.regressionFingerprints && diff.regressionFingerprints.length > 0;
}

function hasQualifyingWarnings(bundle: RootCauseHintBundle): boolean {
  const groups = bundle.warningGroups;
  if (!groups) { return false; }
  for (const g of groups) {
    if (g && g.count >= ROOT_CAUSE_WARNING_MIN_COUNT) { return true; }
  }
  return false;
}

/** Webview collector already applied the user's threshold — any item present qualifies. */
function hasQualifyingSlowOps(bundle: RootCauseHintBundle): boolean {
  const ops = bundle.slowOperations;
  return !!ops && ops.length > 0;
}
