"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOT_CAUSE_ANR_MIN_SCORE = exports.ROOT_CAUSE_SLOW_OP_MIN_MS_DEFAULT = exports.ROOT_CAUSE_WARNING_MIN_COUNT = exports.ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN = exports.ROOT_CAUSE_SQL_BURST_MIN_COUNT = exports.ROOT_CAUSE_FP_LEADER_MIN_COUNT = void 0;
exports.isRootCauseHintsEligible = isRootCauseHintsEligible;
/** Minimum session hits before a fingerprint-only hypothesis is considered (no N+1 row). */
exports.ROOT_CAUSE_FP_LEADER_MIN_COUNT = 12;
/** Minimum burst count when only sqlBursts drive eligibility. */
exports.ROOT_CAUSE_SQL_BURST_MIN_COUNT = 4;
/** Minimum non-whitespace chars in an error excerpt to count as a signal. */
exports.ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN = 4;
/** Minimum occurrences for a recurring warning to qualify. */
exports.ROOT_CAUSE_WARNING_MIN_COUNT = 3;
/**
 * Default minimum duration (ms) for a slow operation to qualify as a signal.
 * The actual threshold is user-configurable via `saropaLogCapture.signalSlowOpThresholdMs`
 * and applied in the webview collector — the host treats any item in the bundle as qualifying.
 */
exports.ROOT_CAUSE_SLOW_OP_MIN_MS_DEFAULT = 500;
/** Minimum ANR risk score to surface as a signal. */
exports.ROOT_CAUSE_ANR_MIN_SCORE = 20;
/**
 * True when the bundle has enough correlated signal to show the Hypotheses strip.
 * Template-specific floors also apply inside `buildHypotheses` (e.g. cap-only fingerprints).
 */
function isRootCauseHintsEligible(bundle) {
    if (!bundle || (bundle.bundleVersion !== 1 && bundle.bundleVersion !== 2) || !bundle.sessionId) {
        return false;
    }
    if (hasQualifyingErrors(bundle)) {
        return true;
    }
    if (bundle.nPlusOneHints && bundle.nPlusOneHints.length > 0) {
        return true;
    }
    if (hasQualifyingFingerprints(bundle)) {
        return true;
    }
    if (hasQualifyingSqlBursts(bundle)) {
        return true;
    }
    if (bundle.driftAdvisorSummary && bundle.driftAdvisorSummary.issueCount > 0) {
        return true;
    }
    if (hasQualifyingSessionDiff(bundle)) {
        return true;
    }
    // v2 signal types
    if (hasQualifyingWarnings(bundle)) {
        return true;
    }
    if (bundle.networkFailures && bundle.networkFailures.length > 0) {
        return true;
    }
    if (bundle.memoryEvents && bundle.memoryEvents.length > 0) {
        return true;
    }
    if (hasQualifyingSlowOps(bundle)) {
        return true;
    }
    if (bundle.permissionDenials && bundle.permissionDenials.length > 0) {
        return true;
    }
    if (bundle.classifiedErrors && bundle.classifiedErrors.length > 0) {
        return true;
    }
    if (bundle.anrRisk && bundle.anrRisk.score >= exports.ROOT_CAUSE_ANR_MIN_SCORE) {
        return true;
    }
    return false;
}
function hasQualifyingErrors(bundle) {
    const errs = bundle.errors;
    if (!errs || errs.length === 0) {
        return false;
    }
    for (const e of errs) {
        if (e && typeof e.excerpt === 'string' && e.excerpt.trim().length >= exports.ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN) {
            return true;
        }
    }
    return false;
}
function hasQualifyingFingerprints(bundle) {
    const leaders = bundle.fingerprintLeaders;
    if (!leaders) {
        return false;
    }
    for (const L of leaders) {
        if (L && L.count >= exports.ROOT_CAUSE_FP_LEADER_MIN_COUNT) {
            return true;
        }
    }
    return false;
}
function hasQualifyingSqlBursts(bundle) {
    const bursts = bundle.sqlBursts;
    if (!bursts) {
        return false;
    }
    for (const b of bursts) {
        if (b && b.count >= exports.ROOT_CAUSE_SQL_BURST_MIN_COUNT) {
            return true;
        }
    }
    return false;
}
function hasQualifyingSessionDiff(bundle) {
    const diff = bundle.sessionDiffSummary;
    return !!diff && !!diff.regressionFingerprints && diff.regressionFingerprints.length > 0;
}
function hasQualifyingWarnings(bundle) {
    const groups = bundle.warningGroups;
    if (!groups) {
        return false;
    }
    for (const g of groups) {
        if (g && g.count >= exports.ROOT_CAUSE_WARNING_MIN_COUNT) {
            return true;
        }
    }
    return false;
}
/** Webview collector already applied the user's threshold — any item present qualifies. */
function hasQualifyingSlowOps(bundle) {
    const ops = bundle.slowOperations;
    return !!ops && ops.length > 0;
}
//# sourceMappingURL=root-cause-hint-eligibility.js.map