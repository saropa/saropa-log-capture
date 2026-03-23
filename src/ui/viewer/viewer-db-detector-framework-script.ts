/**
 * Embedded DB detector framework (plan **DB_15**). Loaded after `getNPlusOneDetectorScript`
 * so `detectNPlusOneInsight` / `parseSqlFingerprint` exist. Keep merge/run semantics aligned
 * with `src/modules/db/db-detector-framework.ts`.
 */
import { normalizeViewerSlowBurstThresholds } from "../../modules/db/drift-db-slow-burst-thresholds";
import { SLOW_QUERY_BURST_DETECTOR_ID } from "../../modules/db/drift-db-slow-burst-detector";
import type { ViewerSlowBurstThresholds } from "../../modules/db/drift-db-slow-burst-thresholds";

export function getViewerDbDetectorFrameworkScript(
  dbInsightsEnabled: boolean,
  slowBurstThresholds?: Partial<ViewerSlowBurstThresholds>,
): string {
  const enabledJs = dbInsightsEnabled ? "true" : "false";
  const sb = normalizeViewerSlowBurstThresholds(slowBurstThresholds);
  const burstJson = JSON.stringify({
    slowQueryMs: sb.slowQueryMs,
    burstMinCount: sb.burstMinCount,
    burstWindowMs: sb.burstWindowMs,
    cooldownMs: sb.cooldownMs,
  });
  return /* javascript */ `
var viewerDbInsightsEnabled = ${enabledJs};
var viewerSlowBurstThresholds = ${burstJson};
var dbDetectorRegistry = [];
var dbDetectorSessionDisabled = Object.create(null);
var dbDetectorErrorLogged = Object.create(null);
/** Optional compare baseline from host (setDbBaselineFingerprintSummary); fingerprint → entry object. */
var dbBaselineFingerprintSummary = null;
function setDbBaselineFingerprintSummaryFromHost(fingerprints) {
    if (!fingerprints || typeof fingerprints !== 'object') {
        dbBaselineFingerprintSummary = null;
    } else {
        dbBaselineFingerprintSummary = fingerprints;
    }
}
/** Per-session slow-burst sliding window (plan DB_08). */
var slowBurstBySession = Object.create(null);
function registerDbDetector(detector) {
    if (!detector || !detector.id || typeof detector.feed !== 'function') return;
    dbDetectorRegistry.push(detector);
}
function mergeDbDetectorResultsByStableKey(results) {
    var order = [];
    var map = Object.create(null);
    var i, r, k;
    for (i = 0; i < results.length; i++) {
        r = results[i];
        if (!r || !r.stableKey) continue;
        k = r.stableKey;
        if (map[k] === undefined) order.push(k);
        map[k] = r;
    }
    var out = [];
    for (i = 0; i < order.length; i++) out.push(map[order[i]]);
    return out;
}
function runDbDetectors(ctx) {
    if (typeof viewerDbInsightsEnabled !== 'undefined' && !viewerDbInsightsEnabled) return [];
    var all = [];
    var list = dbDetectorRegistry.slice().sort(function(a, b) { return (a.priority || 0) - (b.priority || 0); });
    var i, d, j, chunk;
    for (i = 0; i < list.length; i++) {
        d = list[i];
        if (dbDetectorSessionDisabled[d.id]) continue;
        try {
            chunk = d.feed(ctx);
            if (chunk && chunk.length) {
                for (j = 0; j < chunk.length; j++) all.push(chunk[j]);
            }
        } catch (ex) {
            if (!dbDetectorErrorLogged[d.id]) {
                dbDetectorErrorLogged[d.id] = true;
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[saropa] db detector disabled:', d.id, ex);
                }
            }
            dbDetectorSessionDisabled[d.id] = true;
        }
    }
    return mergeDbDetectorResultsByStableKey(all);
}
/** Drop sliding-window hits older than the oldest retained log line (after head trim). */
function pruneDbDetectorStateAfterTrim(oldestKeptTs) {
    if (typeof oldestKeptTs !== 'number' || !isFinite(oldestKeptTs)) return;
    if (typeof nPlusOneDetector !== 'undefined' && nPlusOneDetector.byFingerprint) {
        var keys = Object.keys(nPlusOneDetector.byFingerprint);
        var i, k, ent;
        for (i = 0; i < keys.length; i++) {
            k = keys[i];
            ent = nPlusOneDetector.byFingerprint[k];
            if (!ent || !ent.hits || !ent.hits.length) {
                delete nPlusOneDetector.byFingerprint[k];
                continue;
            }
            while (ent.hits.length > 0 && ent.hits[0].ts < oldestKeptTs) {
                ent.hits.shift();
            }
            if (ent.hits.length === 0) delete nPlusOneDetector.byFingerprint[k];
        }
    }
    if (typeof slowBurstBySession !== 'undefined' && slowBurstBySession) {
        var sbKeys = Object.keys(slowBurstBySession);
        var si, st;
        for (si = 0; si < sbKeys.length; si++) {
            st = slowBurstBySession[sbKeys[si]];
            if (!st || !st.hits) continue;
            while (st.hits.length > 0 && st.hits[0].ts < oldestKeptTs) {
                st.hits.shift();
            }
        }
    }
}
/** Reset detector session flags and DB-specific accumulators when the log is cleared. */
function resetDbInsightDetectorSession() {
    var k;
    for (k in dbDetectorSessionDisabled) {
        if (Object.prototype.hasOwnProperty.call(dbDetectorSessionDisabled, k)) delete dbDetectorSessionDisabled[k];
    }
    for (k in dbDetectorErrorLogged) {
        if (Object.prototype.hasOwnProperty.call(dbDetectorErrorLogged, k)) delete dbDetectorErrorLogged[k];
    }
    if (typeof nPlusOneDetector !== 'undefined' && nPlusOneDetector.byFingerprint) {
        nPlusOneDetector.byFingerprint = Object.create(null);
    }
    if (typeof slowBurstBySession !== 'undefined') {
        slowBurstBySession = Object.create(null);
    }
    if (typeof dbInsightSessionRollup !== 'undefined') {
        dbInsightSessionRollup = Object.create(null);
    }
}
function registerBuiltinDbDetectors() {
    registerDbDetector({
        id: '${SLOW_QUERY_BURST_DETECTOR_ID}',
        priority: 85,
        feed: function(ctx) {
            if (!ctx || !viewerSlowBurstThresholds) return [];
            var sid = (ctx.sessionId != null && ctx.sessionId !== '') ? String(ctx.sessionId) : 'default';
            var st = slowBurstBySession[sid];
            if (!st) { st = { hits: [], lastEmitTs: 0 }; slowBurstBySession[sid] = st; }
            var now = ctx.timestampMs;
            if (typeof now !== 'number' || !isFinite(now)) return [];
            var win = viewerSlowBurstThresholds.burstWindowMs;
            var slowMs = viewerSlowBurstThresholds.slowQueryMs;
            var burstN = viewerSlowBurstThresholds.burstMinCount;
            var cooldown = viewerSlowBurstThresholds.cooldownMs;
            while (st.hits.length > 0 && st.hits[0].ts < now - win) {
                st.hits.shift();
            }
            var dur = ctx.durationMs;
            if (typeof dur !== 'number' || !isFinite(dur)) return [];
            if (dur < slowMs) return [];
            var anc = ctx.anchorSeq;
            if (typeof anc !== 'number' || !isFinite(anc)) return [];
            st.hits.push({ ts: now, seq: anc });
            if (st.hits.length < burstN) return [];
            if (cooldown > 0 && st.lastEmitTs > 0 && now - st.lastEmitTs < cooldown) return [];
            var windowStartMs = st.hits[0].ts;
            st.lastEmitTs = now;
            return [{
                kind: 'marker',
                detectorId: '${SLOW_QUERY_BURST_DETECTOR_ID}',
                stableKey: '${SLOW_QUERY_BURST_DETECTOR_ID}::' + sid + '::' + windowStartMs,
                priority: 85,
                payload: {
                    category: 'db-insight',
                    label: 'Slow query burst',
                    anchorSeq: anc
                }
            }];
        }
    });
    registerDbDetector({
        id: 'db.n-plus-one',
        priority: 100,
        feed: function(ctx) {
            if (!ctx || !ctx.sql || !ctx.sql.fingerprint) return [];
            if (typeof detectNPlusOneInsight !== 'function') return [];
            var insight = detectNPlusOneInsight(ctx.timestampMs, ctx.sql.fingerprint, ctx.sql.argsKey);
            if (!insight) return [];
            var stableKey = 'db.n-plus-one::' + ctx.sql.fingerprint + '::' + ctx.timestampMs;
            return [{
                kind: 'synthetic-line',
                detectorId: 'db.n-plus-one',
                stableKey: stableKey,
                priority: 100,
                payload: {
                    syntheticType: 'n-plus-one-insight',
                    insight: {
                        repeats: insight.repeats,
                        distinctArgs: insight.distinctArgs,
                        windowSpanMs: insight.windowSpanMs,
                        confidence: insight.confidence
                    },
                    sqlMeta: {
                        fingerprint: ctx.sql.fingerprint,
                        argsKey: ctx.sql.argsKey,
                        sqlSnippet: ctx.sql.sqlSnippet,
                        verb: ctx.sql.verb
                    }
                }
            }];
        }
    });
}
registerBuiltinDbDetectors();
`;
}
