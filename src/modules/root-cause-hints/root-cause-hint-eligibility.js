"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN = exports.ROOT_CAUSE_SQL_BURST_MIN_COUNT = exports.ROOT_CAUSE_FP_LEADER_MIN_COUNT = void 0;
exports.isRootCauseHintsEligible = isRootCauseHintsEligible;
/** Minimum session hits before a fingerprint-only hypothesis is considered (no N+1 row). */
exports.ROOT_CAUSE_FP_LEADER_MIN_COUNT = 12;
/** Minimum burst count when only sqlBursts drive eligibility. */
exports.ROOT_CAUSE_SQL_BURST_MIN_COUNT = 4;
/** Minimum non-whitespace chars in an error excerpt to count as a signal. */
exports.ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN = 4;
/**
 * True when the bundle has enough correlated signal to show the Hypotheses strip.
 * Template-specific floors also apply inside `buildHypotheses` (e.g. cap-only fingerprints).
 */
function isRootCauseHintsEligible(bundle) {
    if (!bundle || bundle.bundleVersion !== 1 || !bundle.sessionId) {
        return false;
    }
    const errs = bundle.errors;
    if (errs && errs.length > 0) {
        for (const e of errs) {
            if (e && typeof e.excerpt === 'string' && e.excerpt.trim().length >= exports.ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN) {
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
            if (L && L.count >= exports.ROOT_CAUSE_FP_LEADER_MIN_COUNT) {
                return true;
            }
        }
    }
    const bursts = bundle.sqlBursts;
    if (bursts) {
        for (const b of bursts) {
            if (b && b.count >= exports.ROOT_CAUSE_SQL_BURST_MIN_COUNT) {
                return true;
            }
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
//# sourceMappingURL=root-cause-hint-eligibility.js.map