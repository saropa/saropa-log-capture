"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOT_CAUSE_MAX_EVIDENCE_IDS = exports.ROOT_CAUSE_MAX_TEXT_LEN = exports.ROOT_CAUSE_MAX_HYPOTHESES = void 0;
exports.buildHypotheses = buildHypotheses;
const root_cause_hint_eligibility_1 = require("./root-cause-hint-eligibility");
const build_hypotheses_general_1 = require("./build-hypotheses-general");
const build_hypotheses_sql_1 = require("./build-hypotheses-sql");
const error_fingerprint_pure_1 = require("../analysis/error-fingerprint-pure");
const build_hypotheses_text_1 = require("./build-hypotheses-text");
/**
 * Deterministic, template-only root-cause **hypotheses** for the log viewer (plan **DB_14**).
 *
 * **Why this module exists:** This is the single source of truth for hypothesis generation. The
 * webview collects raw signal data and posts the bundle to the host, which calls `buildHypotheses`
 * here. No algorithm duplication — changes only need to be made in this file.
 *
 * **Safety:** `buildHypotheses` is pure (no I/O). It returns an empty array for unknown
 * `bundleVersion` or ineligible bundles so the UI stays silent rather than guessing.
 *
 * **Caps:** {@link ROOT_CAUSE_MAX_HYPOTHESES} bullets, {@link ROOT_CAUSE_MAX_TEXT_LEN} characters per
 * bullet (excluding link chrome in the viewer), {@link ROOT_CAUSE_MAX_EVIDENCE_IDS} line indices per
 * hypothesis after dedup.
 */
exports.ROOT_CAUSE_MAX_HYPOTHESES = 5;
exports.ROOT_CAUSE_MAX_TEXT_LEN = 240;
exports.ROOT_CAUSE_MAX_EVIDENCE_IDS = 8;
const MAX_BULLETS = exports.ROOT_CAUSE_MAX_HYPOTHESES;
const MAX_TEXT_LEN = exports.ROOT_CAUSE_MAX_TEXT_LEN;
const MAX_EVIDENCE_IDS = exports.ROOT_CAUSE_MAX_EVIDENCE_IDS;
/** True when the excerpt is a decorative separator with no letters or digits (e.g. `═══════`). */
function isDecorativeExcerpt(s) {
    return !/[a-zA-Z0-9]/.test(s);
}
/** Map crash category to confidence level. */
function categoryConfidence(cat) {
    if (cat === 'fatal' || cat === 'anr' || cat === 'oom' || cat === 'native') {
        return 'high';
    }
    return 'medium';
}
function errorHypotheses(bundle) {
    const errs = bundle.errors;
    if (!errs || errs.length === 0) {
        return [];
    }
    const groups = new Map();
    for (const e of errs) {
        if (!e) {
            continue;
        }
        const ex = (e.excerpt || '').trim();
        if (ex.length < root_cause_hint_eligibility_1.ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN) {
            continue;
        }
        if (isDecorativeExcerpt(ex)) {
            continue;
        }
        const key = e.fingerprint ?? (0, error_fingerprint_pure_1.hashFingerprint)((0, error_fingerprint_pure_1.normalizeLine)(ex));
        const cat = e.category ?? (0, error_fingerprint_pure_1.classifyCategory)(ex);
        const group = groups.get(key);
        if (group) {
            group.lineIds.push(e.lineIndex);
        }
        else {
            groups.set(key, { excerpt: ex, lineIds: [e.lineIndex], cat });
        }
    }
    const ranked = Array.from(groups.entries())
        .sort((a, b) => b[1].lineIds.length - a[1].lineIds.length)
        .slice(0, 2);
    return ranked.map(([key, { excerpt, lineIds, cat }]) => ({
        templateId: 'error-recent',
        text: (0, build_hypotheses_text_1.truncateText)(`Error: ${excerpt}`, MAX_TEXT_LEN),
        evidenceLineIds: lineIds.slice().sort((a, b) => a - b),
        confidence: categoryConfidence(cat),
        hypothesisKey: `err::${key}`,
        tier: 0,
    }));
}
const confRank = { high: 3, medium: 2, low: 1 };
function pickHigherConfidence(a, b) {
    return (confRank[a ?? ''] ?? 0) >= (confRank[b ?? ''] ?? 0) ? a : b;
}
function dedupeAndMerge(work) {
    const byKey = new Map();
    for (const h of work) {
        const prev = byKey.get(h.hypothesisKey);
        if (!prev) {
            byKey.set(h.hypothesisKey, h);
            continue;
        }
        const ids = new Set([...prev.evidenceLineIds, ...h.evidenceLineIds]);
        const merged = Array.from(ids).filter((n) => n >= 0).slice(0, MAX_EVIDENCE_IDS);
        const tier = Math.min(prev.tier, h.tier);
        byKey.set(h.hypothesisKey, {
            ...prev,
            evidenceLineIds: merged,
            tier,
            confidence: pickHigherConfidence(prev.confidence, h.confidence),
        });
    }
    return Array.from(byKey.values());
}
function capEvidence(ids) {
    const u = Array.from(new Set(ids.filter((n) => {
        return Number.isFinite(n) && n >= 0;
    })));
    return u.slice(0, MAX_EVIDENCE_IDS);
}
function stripWorking(h) {
    return {
        templateId: h.templateId,
        text: h.text,
        evidenceLineIds: capEvidence(h.evidenceLineIds),
        confidence: h.confidence,
        hypothesisKey: h.hypothesisKey,
    };
}
/** Single source of truth for hypothesis generation. */
function buildHypotheses(bundle) {
    if (!bundle || (bundle.bundleVersion !== 1 && bundle.bundleVersion !== 2)) {
        return [];
    }
    if (!(0, root_cause_hint_eligibility_1.isRootCauseHintsEligible)(bundle)) {
        return [];
    }
    const n1List = bundle.nPlusOneHints;
    const n1Fingerprints = new Set();
    if (n1List) {
        for (const h of n1List) {
            if (h?.fingerprint) {
                n1Fingerprints.add(h.fingerprint);
            }
        }
    }
    const parts = [
        ...errorHypotheses(bundle),
        ...(0, build_hypotheses_sql_1.diffHypotheses)(bundle, MAX_TEXT_LEN),
        ...(0, build_hypotheses_sql_1.nPlusOneHypotheses)(n1List, MAX_TEXT_LEN),
        ...(0, build_hypotheses_sql_1.sqlBurstHypotheses)(bundle, MAX_TEXT_LEN),
        ...(0, build_hypotheses_sql_1.driftHypotheses)(bundle, MAX_TEXT_LEN),
        ...(0, build_hypotheses_sql_1.fingerprintLeaderHypotheses)(bundle.fingerprintLeaders, n1Fingerprints, MAX_TEXT_LEN),
        // v2 general signals
        ...(0, build_hypotheses_general_1.warningHypotheses)(bundle, MAX_TEXT_LEN),
        ...(0, build_hypotheses_general_1.networkHypotheses)(bundle, MAX_TEXT_LEN),
        ...(0, build_hypotheses_general_1.memoryHypotheses)(bundle, MAX_TEXT_LEN),
        ...(0, build_hypotheses_general_1.slowOpHypotheses)(bundle, MAX_TEXT_LEN),
        ...(0, build_hypotheses_general_1.permissionHypotheses)(bundle, MAX_TEXT_LEN),
        ...(0, build_hypotheses_general_1.classifiedErrorHypotheses)(bundle, MAX_TEXT_LEN),
        ...(0, build_hypotheses_general_1.anrHypotheses)(bundle, MAX_TEXT_LEN),
    ];
    const merged = dedupeAndMerge(parts);
    merged.sort((a, b) => {
        if (a.tier !== b.tier) {
            return a.tier - b.tier;
        }
        return a.hypothesisKey.localeCompare(b.hypothesisKey);
    });
    return merged.slice(0, MAX_BULLETS).map(stripWorking);
}
//# sourceMappingURL=build-hypotheses.js.map