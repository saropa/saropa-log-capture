/**
 * Embedded bundle collection for DB_14 (host fields, slow bursts, baseline diff).
 *
 * Collects raw signal data from the webview's `allLines` and posts the bundle to
 * the extension host for hypothesis building. The host runs `buildHypotheses()`
 * (single TypeScript source of truth) and posts results back.
 *
 * Threshold constants are injected as simple numeric vars so the webview does not
 * need to duplicate the full algorithm.
 */

import { ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN, ROOT_CAUSE_FP_LEADER_MIN_COUNT, ROOT_CAUSE_SQL_BURST_MIN_COUNT } from '../../modules/root-cause-hints/root-cause-hint-eligibility';
import { ROOT_CAUSE_HINT_BUNDLE_VERSION } from '../../modules/root-cause-hints/root-cause-hint-types';
import { getViewerRootCauseHintsGeneralCollectChunk } from './viewer-root-cause-hints-embed-collect-general';

export function getViewerRootCauseHintsEmbedCollectChunk(slowOpThresholdMs: number): string {
  const BV = ROOT_CAUSE_HINT_BUNDLE_VERSION;
  const MIN_ERR = ROOT_CAUSE_ERROR_EXCERPT_MIN_LEN;
  const MIN_FP = ROOT_CAUSE_FP_LEADER_MIN_COUNT;
  const MIN_BURST = ROOT_CAUSE_SQL_BURST_MIN_COUNT;

  return getViewerRootCauseHintsGeneralCollectChunk(slowOpThresholdMs) + /* javascript */ `
var rchHostDriftAdvisorSummary = null;
var rchHostSessionDiffSummary = null;
var rootCauseHintSessionEpoch = 0;
var rootCauseHypothesesRaf = null;

function clearRootCauseHintHostFields() {
    rchHostDriftAdvisorSummary = null;
    rchHostSessionDiffSummary = null;
}

function collectSessionDiffRegressionFpsEmbedded() {
    var out = [];
    if (typeof dbBaselineFingerprintSummary === 'undefined' || !dbBaselineFingerprintSummary) return out;
    if (typeof dbSignalSessionRollup === 'undefined' || !dbSignalSessionRollup) return out;
    var fp, cur, baseEnt, baseC, curC, delta;
    for (fp in dbSignalSessionRollup) {
        if (!Object.prototype.hasOwnProperty.call(dbSignalSessionRollup, fp)) continue;
        cur = dbSignalSessionRollup[fp];
        if (!cur || typeof cur.count !== 'number') continue;
        curC = cur.count;
        if (curC < ${MIN_FP}) continue;
        baseEnt = dbBaselineFingerprintSummary[fp];
        baseC = (baseEnt && typeof baseEnt.count === 'number') ? baseEnt.count : 0;
        if (baseC <= 0) continue;
        delta = curC - baseC;
        if (delta >= Math.max(3, Math.floor(baseC * 0.25))) {
            out.push(fp);
        }
    }
    out.sort(function(a, b) {
        return dbSignalSessionRollup[b].count - dbSignalSessionRollup[a].count;
    });
    if (out.length > 8) out = out.slice(0, 8);
    return out;
}

function collectRootCauseHintBundleEmbedded() {
    var sid = String(rootCauseHintSessionEpoch || 0) + '|' + (typeof currentFilename !== 'undefined' ? currentFilename : '');
    var errors = [];
    var nPlusOneHints = [];
    var leaders = [];
    var sqlBursts = [];
    var i, row, plain, excerpt, im, keys, eEnt, j, line, fp, sampleIdx, sbk, sbi, sbSid, sbSt, h0, hL, wMs, sessionDiffSummary, regFps;

    if (typeof allLines !== 'undefined' && allLines.length) {
        for (i = allLines.length - 1; i >= 0 && errors.length < 50; i--) {
            row = allLines[i];
            if (!row || row.type !== 'line') continue;
            if (row.level !== 'error' || row.errorSuppressed || row.isSeparator || row.recentErrorContext) continue;
            plain = stripTags(row.html || '');
            excerpt = plain.replace(/\\s+/g, ' ').trim();
            if (excerpt.length < ${MIN_ERR}) continue;
            if (!/[a-zA-Z0-9]/.test(excerpt)) continue;
            if (excerpt.length > 400) excerpt = excerpt.substring(0, 397) + '...';
            errors.push({ lineIndex: i, excerpt: excerpt });
        }

        for (i = 0; i < allLines.length; i++) {
            row = allLines[i];
            if (!row || row.type !== 'n-plus-one-signal' || !row.signalMeta) continue;
            im = row.signalMeta;
            nPlusOneHints.push({
                lineIndex: i,
                fingerprint: im.fingerprint,
                repeats: im.repeats,
                distinctArgs: im.distinctArgs,
                windowSpanMs: im.windowSpanMs,
                confidence: im.confidence || 'low'
            });
        }
    }

    if (typeof dbSignalSessionRollup !== 'undefined' && dbSignalSessionRollup && typeof allLines !== 'undefined') {
        keys = Object.keys(dbSignalSessionRollup);
        for (i = 0; i < keys.length; i++) {
            fp = keys[i];
            eEnt = dbSignalSessionRollup[fp];
            if (!eEnt || eEnt.count < ${MIN_FP}) continue;
            sampleIdx = -1;
            for (j = allLines.length - 1; j >= 0; j--) {
                line = allLines[j];
                if (!line || line.type !== 'line' || !line.dbSignal || line.dbSignal.fingerprint !== fp) continue;
                sampleIdx = j;
                break;
            }
            leaders.push({ fingerprint: fp, count: eEnt.count, sampleLineIndex: sampleIdx });
        }
        leaders.sort(function(a, b) { return b.count - a.count; });
        if (leaders.length > 8) leaders = leaders.slice(0, 8);
    }

    if (typeof slowBurstBySession !== 'undefined' && slowBurstBySession) {
        sbk = Object.keys(slowBurstBySession);
        for (sbi = 0; sbi < sbk.length; sbi++) {
            sbSid = sbk[sbi];
            sbSt = slowBurstBySession[sbSid];
            if (!sbSt || !sbSt.hits || sbSt.hits.length < ${MIN_BURST}) continue;
            h0 = sbSt.hits[0];
            hL = sbSt.hits[sbSt.hits.length - 1];
            wMs = (hL && h0 && typeof hL.ts === 'number' && typeof h0.ts === 'number')
                ? Math.max(0, Math.round(hL.ts - h0.ts)) : undefined;
            sqlBursts.push({
                fingerprint: 'slow-burst::' + sbSid + '::' + String(h0.ts),
                count: sbSt.hits.length,
                windowMs: wMs
            });
        }
        if (sqlBursts.length > 4) sqlBursts = sqlBursts.slice(0, 4);
    }

    sessionDiffSummary = null;
    if (rchHostSessionDiffSummary && rchHostSessionDiffSummary.regressionFingerprints && rchHostSessionDiffSummary.regressionFingerprints.length) {
        sessionDiffSummary = { regressionFingerprints: rchHostSessionDiffSummary.regressionFingerprints.slice(0, 8) };
    } else {
        regFps = collectSessionDiffRegressionFpsEmbedded();
        if (regFps.length) sessionDiffSummary = { regressionFingerprints: regFps };
    }

    var general = collectGeneralSignals();

    return {
        bundleVersion: ${BV},
        sessionId: sid,
        errors: errors,
        nPlusOneHints: nPlusOneHints,
        fingerprintLeaders: leaders,
        sqlBursts: sqlBursts.length ? sqlBursts : undefined,
        driftAdvisorSummary: rchHostDriftAdvisorSummary || undefined,
        sessionDiffSummary: sessionDiffSummary || undefined,
        warningGroups: general.warnings.length ? general.warnings : undefined,
        networkFailures: general.networkFailures.length ? general.networkFailures : undefined,
        memoryEvents: general.memoryEvents.length ? general.memoryEvents : undefined,
        slowOperations: general.slowOperations.length ? general.slowOperations : undefined,
        permissionDenials: general.permissionDenials.length ? general.permissionDenials : undefined,
        classifiedErrors: general.classifiedErrors.length ? general.classifiedErrors : undefined
    };
}
`;
}
