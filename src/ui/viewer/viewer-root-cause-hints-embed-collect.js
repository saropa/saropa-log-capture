"use strict";
/**
 * Embedded bundle collection for DB_14 (host fields, slow bursts, baseline diff). Split from
 * `viewer-root-cause-hints-embed-algorithm.ts` for ESLint max-lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerRootCauseHintsEmbedCollectChunk = getViewerRootCauseHintsEmbedCollectChunk;
function getViewerRootCauseHintsEmbedCollectChunk(BV, MIN_ERR, MIN_FP, MIN_BURST) {
    return /* javascript */ `
var rchHostDriftAdvisorSummary = null;
var rchHostSessionDiffSummary = null;

function clearRootCauseHintHostFields() {
    rchHostDriftAdvisorSummary = null;
    rchHostSessionDiffSummary = null;
}

function collectSessionDiffRegressionFpsEmbedded() {
    var out = [];
    if (typeof dbBaselineFingerprintSummary === 'undefined' || !dbBaselineFingerprintSummary) return out;
    if (typeof dbInsightSessionRollup === 'undefined' || !dbInsightSessionRollup) return out;
    var fp, cur, baseEnt, baseC, curC, delta;
    for (fp in dbInsightSessionRollup) {
        if (!Object.prototype.hasOwnProperty.call(dbInsightSessionRollup, fp)) continue;
        cur = dbInsightSessionRollup[fp];
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
        return dbInsightSessionRollup[b].count - dbInsightSessionRollup[a].count;
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
        for (i = allLines.length - 1; i >= 0 && errors.length < 2; i--) {
            row = allLines[i];
            if (!row || row.type !== 'line') continue;
            if (row.level !== 'error' || row.errorSuppressed) continue;
            plain = stripTags(row.html || '');
            excerpt = plain.replace(/\\s+/g, ' ').trim();
            if (excerpt.length < ${MIN_ERR}) continue;
            if (excerpt.length > 400) excerpt = excerpt.substring(0, 397) + '...';
            errors.push({ lineIndex: i, excerpt: excerpt });
        }

        for (i = 0; i < allLines.length; i++) {
            row = allLines[i];
            if (!row || row.type !== 'n-plus-one-insight' || !row.insightMeta) continue;
            im = row.insightMeta;
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

    if (typeof dbInsightSessionRollup !== 'undefined' && dbInsightSessionRollup && typeof allLines !== 'undefined') {
        keys = Object.keys(dbInsightSessionRollup);
        for (i = 0; i < keys.length; i++) {
            fp = keys[i];
            eEnt = dbInsightSessionRollup[fp];
            if (!eEnt || eEnt.count < ${MIN_FP}) continue;
            sampleIdx = -1;
            for (j = allLines.length - 1; j >= 0; j--) {
                line = allLines[j];
                if (!line || line.type !== 'line' || !line.dbInsight || line.dbInsight.fingerprint !== fp) continue;
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

    return {
        bundleVersion: ${BV},
        sessionId: sid,
        errors: errors,
        nPlusOneHints: nPlusOneHints,
        fingerprintLeaders: leaders,
        sqlBursts: sqlBursts.length ? sqlBursts : undefined,
        driftAdvisorSummary: rchHostDriftAdvisorSummary || undefined,
        sessionDiffSummary: sessionDiffSummary || undefined
    };
}
`;
}
//# sourceMappingURL=viewer-root-cause-hints-embed-collect.js.map