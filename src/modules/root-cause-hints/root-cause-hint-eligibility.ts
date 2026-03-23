import type { RootCauseHintBundle } from './root-cause-hint-types';

/** Minimum session hits before a fingerprint-only hypothesis is considered (no N+1 row). */
export const ROOT_CAUSE_FP_LEADER_MIN_COUNT = 12;

/** Minimum burst count when only sqlBursts drive eligibility. */
export const ROOT_CAUSE_SQL_BURST_MIN_COUNT = 4;

/** Minimum non-whitespace chars in an error excerpt to count as a signal. */
export const ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN = 4;

/**
 * True when the bundle has enough correlated signal to show the Hypotheses strip.
 * Template-specific floors also apply inside `buildHypotheses` (e.g. cap-only fingerprints).
 */
export function isRootCauseHintsEligible(bundle: RootCauseHintBundle): boolean {
  if (!bundle || bundle.bundleVersion !== 1 || !bundle.sessionId) {
    return false;
  }

  const errs = bundle.errors;
  if (errs && errs.length > 0) {
    for (const e of errs) {
      if (e && typeof e.excerpt === 'string' && e.excerpt.trim().length >= ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN) {
        return true;
      }
    }
  }

  if (bundle.nPlusOneHints && bundle.nPlusOneHints.length > 0) {
    return true;
  }

  const leaders = bundle.fingerprintLeaders;
  if (leaders) {
    for (const L of leaders) {
      if (L && L.count >= ROOT_CAUSE_FP_LEADER_MIN_COUNT) {
        return true;
      }
    }
  }

  const bursts = bundle.sqlBursts;
  if (bursts) {
    for (const b of bursts) {
      if (b && b.count >= ROOT_CAUSE_SQL_BURST_MIN_COUNT) {return true;}
    }
  }

  const drift = bundle.driftAdvisorSummary;
  if (drift && drift.issueCount > 0) {
    return true;
  }

  const diff = bundle.sessionDiffSummary;
  if (diff && diff.regressionFingerprints && diff.regressionFingerprints.length > 0) {
    return true;
  }

  return false;
}
