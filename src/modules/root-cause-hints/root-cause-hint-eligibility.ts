import type { RootCauseHintBundle } from './root-cause-hint-types';

/** Minimum session hits before a fingerprint-only hypothesis is considered (no N+1 row). */
export const ROOT_CAUSE_FP_LEADER_MIN_COUNT = 12;

/** Minimum burst count when only sqlBursts drive eligibility. */
export const ROOT_CAUSE_SQL_BURST_MIN_COUNT = 4;

/** Minimum non-whitespace chars in an error excerpt to count as a signal. */
export const ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN = 4;

/** Minimum occurrences for a recurring warning to qualify. */
export const ROOT_CAUSE_WARNING_MIN_COUNT = 3;

/** Minimum duration (ms) for a slow operation to qualify. */
export const ROOT_CAUSE_SLOW_OP_MIN_MS = 2000;

/** Minimum ANR risk score to surface as a signal. */
export const ROOT_CAUSE_ANR_MIN_SCORE = 20;

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

function hasQualifyingSlowOps(bundle: RootCauseHintBundle): boolean {
  const ops = bundle.slowOperations;
  if (!ops) { return false; }
  for (const op of ops) {
    if (op && op.durationMs >= ROOT_CAUSE_SLOW_OP_MIN_MS) { return true; }
  }
  return false;
}
