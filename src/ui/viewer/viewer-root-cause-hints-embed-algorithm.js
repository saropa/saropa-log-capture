"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerRootCauseHintsEmbedAlgorithmChunk = getViewerRootCauseHintsEmbedAlgorithmChunk;
/**
 * Embedded **DB_14** bundle assembly + `buildHypotheses` (JavaScript for the webview).
 *
 * **Sync contract:** Numeric literals are injected from `root-cause-hint-eligibility.ts` and
 * `build-hypotheses.ts` at HTML build time. If you change tier order, dedup keys, template strings,
 * or thresholds in TypeScript, update this chunk in the same PR so the viewer cannot drift from tests.
 *
 * **Performance:** Only runs when `scheduleRootCauseHypothesesRefresh` fires (after `addLines` /
 * `loadComplete`, coalesced with `requestAnimationFrame`). Work is O(lines) for error scan + O(n) for
 * N+1 rows + O(fingerprints) for rollup leaders — acceptable for typical session sizes.
 */
const build_hypotheses_1 = require("../../modules/root-cause-hints/build-hypotheses");
const root_cause_hint_eligibility_1 = require("../../modules/root-cause-hints/root-cause-hint-eligibility");
const root_cause_hint_types_1 = require("../../modules/root-cause-hints/root-cause-hint-types");
const viewer_root_cause_hints_embed_collect_1 = require("./viewer-root-cause-hints-embed-collect");
function getViewerRootCauseHintsEmbedAlgorithmChunk() {
    const BV = root_cause_hint_types_1.ROOT_CAUSE_HINT_BUNDLE_VERSION;
    const MAX_H = build_hypotheses_1.ROOT_CAUSE_MAX_HYPOTHESES;
    const MAX_T = build_hypotheses_1.ROOT_CAUSE_MAX_TEXT_LEN;
    const MAX_E = build_hypotheses_1.ROOT_CAUSE_MAX_EVIDENCE_IDS;
    const MIN_FP = root_cause_hint_eligibility_1.ROOT_CAUSE_FP_LEADER_MIN_COUNT;
    const MIN_BURST = root_cause_hint_eligibility_1.ROOT_CAUSE_SQL_BURST_MIN_COUNT;
    const MIN_ERR = root_cause_hint_eligibility_1.ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN;
    return (
    /* javascript */ `
var rootCauseHintSessionEpoch = 0;
var rootCauseHypothesesRaf = null;

function rootCauseHintsEligibilityEmbedded(b) {
    if (!b || b.bundleVersion !== ${BV} || !b.sessionId) return false;
    var i, e, L, br, d, df;
    if (b.errors && b.errors.length) {
        for (i = 0; i < b.errors.length; i++) {
            e = b.errors[i];
            if (e && typeof e.excerpt === 'string' && e.excerpt.trim().length >= ${MIN_ERR}) return true;
        }
    }
    if (b.nPlusOneHints && b.nPlusOneHints.length) return true;
    if (b.fingerprintLeaders) {
        for (i = 0; i < b.fingerprintLeaders.length; i++) {
            L = b.fingerprintLeaders[i];
            if (L && L.count >= ${MIN_FP}) return true;
        }
    }
    if (b.sqlBursts) {
        for (i = 0; i < b.sqlBursts.length; i++) {
            br = b.sqlBursts[i];
            if (br && br.count >= ${MIN_BURST}) return true;
        }
    }
    d = b.driftAdvisorSummary;
    if (d && d.issueCount > 0) return true;
    df = b.sessionDiffSummary;
    if (df && df.regressionFingerprints && df.regressionFingerprints.length) return true;
    return false;
}

function truncateRchText(s, max) {
    var t = String(s || '').replace(/\\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return t.substring(0, max - 1) + '\\u2026';
}

function mapRchN1Conf(c) {
    var x = String(c || '').toLowerCase();
    if (x === 'high' || x === 'medium') return 'medium';
    return 'low';
}

function capRchEvidence(ids) {
    var u = [];
    var seen = Object.create(null);
    var i, n;
    for (i = 0; i < ids.length; i++) {
        n = ids[i];
        if (typeof n !== 'number' || !isFinite(n) || n < 0) continue;
        if (seen[n]) continue;
        seen[n] = true;
        u.push(n);
        if (u.length >= ${MAX_E}) break;
    }
    return u;
}

function buildHypothesesEmbedded(bundle) {
    if (!bundle || bundle.bundleVersion !== ${BV}) return [];
    if (!rootCauseHintsEligibilityEmbedded(bundle)) return [];

    var n1List = bundle.nPlusOneHints;
    var n1Fp = Object.create(null);
    var hi, h, parts, i, j, k, text, sec, w, fp, L, b, da, rule, d0, e, d;

    if (n1List) {
        for (hi = 0; hi < n1List.length; hi++) {
            h = n1List[hi];
            if (h && h.fingerprint) n1Fp[h.fingerprint] = true;
        }
    }

    parts = [];

    if (bundle.errors) {
        var seenErr = Object.create(null);
        var errCount = 0;
        for (i = 0; i < bundle.errors.length && errCount < 2; i++) {
            e = bundle.errors[i];
            if (!e || seenErr[e.lineIndex]) continue;
            var ex = String(e.excerpt || '').trim();
            if (ex.length < ${MIN_ERR}) continue;
            seenErr[e.lineIndex] = true;
            errCount++;
            parts.push({
                templateId: 'error-recent',
                text: truncateRchText('Recent error: ' + ex, ${MAX_T}),
                evidenceLineIds: [e.lineIndex],
                confidence: 'medium',
                hypothesisKey: 'err::' + e.lineIndex,
                tier: 0
            });
        }
    }

    d = bundle.sessionDiffSummary;
    if (d && d.regressionFingerprints && d.regressionFingerprints.length) {
        d0 = d.regressionFingerprints[0];
        parts.push({
            templateId: 'session-diff-regression',
            text: truncateRchText('Session compare: increased activity for a SQL fingerprint vs baseline — regression hypothesis.', ${MAX_T}),
            evidenceLineIds: [],
            confidence: 'low',
            hypothesisKey: 'diff::' + d0,
            tier: 0
        });
    }

    if (n1List) {
        for (hi = 0; hi < n1List.length; hi++) {
            h = n1List[hi];
            if (!h || !h.fingerprint) continue;
            sec = (h.windowSpanMs / 1000).toFixed(1);
            text = truncateRchText(
                'Possible N+1: ' + h.repeats + ' similar DB calls (' + h.distinctArgs + ' arg variants) in ' + sec + 's — not certain.',
                ${MAX_T}
            );
            parts.push({
                templateId: 'n-plus-one',
                text: text,
                evidenceLineIds: [h.lineIndex],
                confidence: mapRchN1Conf(h.confidence),
                hypothesisKey: 'n1::' + h.fingerprint,
                tier: 1
            });
        }
    }

    if (bundle.sqlBursts) {
        for (i = 0; i < bundle.sqlBursts.length; i++) {
            b = bundle.sqlBursts[i];
            if (!b || !b.fingerprint || b.count < ${MIN_BURST}) continue;
            w = typeof b.windowMs === 'number' ? ' in ~' + Math.round(b.windowMs) + 'ms' : '';
            parts.push({
                templateId: 'sql-burst',
                text: truncateRchText('SQL burst: ' + b.count + ' similar queries' + w + ' — may be normal traffic or a loop.', ${MAX_T}),
                evidenceLineIds: [],
                confidence: 'low',
                hypothesisKey: 'burst::' + b.fingerprint,
                tier: 1
            });
        }
    }

    da = bundle.driftAdvisorSummary;
    if (da && da.issueCount > 0) {
        rule = da.topRuleId ? ' (' + da.topRuleId + ')' : '';
        parts.push({
            templateId: 'drift-advisor',
            text: truncateRchText('Drift Advisor reports ' + da.issueCount + ' issue(s)' + rule + ' in the workspace — may relate to DB noise here.', ${MAX_T}),
            evidenceLineIds: [],
            confidence: 'low',
            hypothesisKey: 'drift::summary',
            tier: 1
        });
    }

    if (bundle.fingerprintLeaders) {
        for (i = 0; i < bundle.fingerprintLeaders.length; i++) {
            L = bundle.fingerprintLeaders[i];
            if (!L || !L.fingerprint || L.count < ${MIN_FP}) continue;
            if (n1Fp[L.fingerprint]) continue;
            parts.push({
                templateId: 'fingerprint-leader',
                text: truncateRchText(
                    'Repeated SQL fingerprint (' + L.count + ' hits this session) — possible hot path or missing batching.',
                    ${MAX_T}
                ),
                evidenceLineIds: L.sampleLineIndex >= 0 ? [L.sampleLineIndex] : [],
                confidence: 'low',
                hypothesisKey: 'fp::' + L.fingerprint,
                tier: 2
            });
        }
    }

    var byKey = Object.create(null);
    for (i = 0; i < parts.length; i++) {
        h = parts[i];
        k = h.hypothesisKey;
        var prev = byKey[k];
        if (!prev) {
            byKey[k] = h;
            continue;
        }
        var idSet = Object.create(null);
        var merged = [];
        for (j = 0; j < prev.evidenceLineIds.length; j++) { idSet[prev.evidenceLineIds[j]] = true; }
        for (j = 0; j < h.evidenceLineIds.length; j++) { idSet[h.evidenceLineIds[j]] = true; }
        var nk;
        for (nk in idSet) {
            if (!Object.prototype.hasOwnProperty.call(idSet, nk)) continue;
            merged.push(parseInt(nk, 10));
        }
        merged.sort(function(a, b) { return a - b; });
        if (merged.length > ${MAX_E}) merged = merged.slice(0, ${MAX_E});
        var tierM = prev.tier < h.tier ? prev.tier : h.tier;
        var confM = (prev.confidence === 'medium' || h.confidence === 'medium') ? 'medium' : (prev.confidence || h.confidence);
        byKey[k] = {
            templateId: prev.templateId,
            text: prev.text,
            evidenceLineIds: merged,
            confidence: confM,
            hypothesisKey: k,
            tier: tierM
        };
    }

    var mergedList = [];
    for (k in byKey) {
        if (Object.prototype.hasOwnProperty.call(byKey, k)) mergedList.push(byKey[k]);
    }
    mergedList.sort(function(a, b) {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.hypothesisKey < b.hypothesisKey ? -1 : a.hypothesisKey > b.hypothesisKey ? 1 : 0;
    });

    var out = [];
    for (i = 0; i < mergedList.length && i < ${MAX_H}; i++) {
        h = mergedList[i];
        out.push({
            templateId: h.templateId,
            text: h.text,
            evidenceLineIds: capRchEvidence(h.evidenceLineIds || []),
            confidence: h.confidence,
            hypothesisKey: h.hypothesisKey
        });
    }
    return out;
}
` +
        (0, viewer_root_cause_hints_embed_collect_1.getViewerRootCauseHintsEmbedCollectChunk)(BV, MIN_ERR, MIN_FP, MIN_BURST));
}
//# sourceMappingURL=viewer-root-cause-hints-embed-algorithm.js.map