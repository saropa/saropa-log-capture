/**
 * Embedded DB detector framework (plan **DB_15**).
 *
 * **Load order:** This script is concatenated after `getNPlusOneDetectorScript` so globals such as
 * `detectNPlusOneInsight`, `parseSqlFingerprint`, and `updateDbInsightRollup` already exist. Detector
 * registration order is by `priority`; results are merged by `stableKey` like the TypeScript
 * `runDbDetectors` / `mergeDbDetectorResultsByStableKey` helpers in `db-detector-framework.ts`.
 *
 * **Built-in detectors:** Slow-query burst (DB_08), optional baseline volume hint when the host sets
 * `dbBaselineFingerprintSummary` / `dbBaselineFingerprintSummaryMap` and live rollup count exceeds
 * baseline (min baseline count 3), N+1 synthetic rows (DB_07). Each can be gated via
 * `viewerDbDetector*` toggles baked from extension config.
 *
 * **Session rollup patches:** Each qualifying Drift ingest applies a primary `db.ingest-rollup` patch first
 * (in `emitDbLineDetectors`), then registered detectors; `applyDbSessionRollupPatches` calls
 * `updateDbInsightRollup` up to 1000 repeats per payload. Detector results apply in **phases** (rollup patches,
 * then `annotate-line`, synthetic, marker), sorted by `priority` within each phase.
 *
 * **State:** `resetDbInsightDetectorSession` clears disabled flags, N+1/slow-burst accumulators, rollup
 * map, and baseline hint dedupe; it does not clear the host-provided baseline object/map (host sends null
 * to clear).
 */
import { normalizeViewerSlowBurstThresholds } from "../../modules/db/drift-db-slow-burst-thresholds";
import { SLOW_QUERY_BURST_DETECTOR_ID } from "../../modules/db/drift-db-slow-burst-detector";
import type { ViewerSlowBurstThresholds } from "../../modules/db/drift-db-slow-burst-thresholds";
import type { ViewerDbDetectorToggles } from "../../modules/config/config-types";

const BASELINE_VOLUME_HINT_ID = "db.baseline-volume-hint";

export function getViewerDbDetectorFrameworkScript(
  dbInsightsEnabled: boolean,
  slowBurstThresholds?: Partial<ViewerSlowBurstThresholds>,
  detectorToggles?: Partial<ViewerDbDetectorToggles>,
): string {
  const enabledJs = dbInsightsEnabled ? "true" : "false";
  const sb = normalizeViewerSlowBurstThresholds(slowBurstThresholds);
  const burstJson = JSON.stringify({
    slowQueryMs: sb.slowQueryMs,
    burstMinCount: sb.burstMinCount,
    burstWindowMs: sb.burstWindowMs,
    cooldownMs: sb.cooldownMs,
  });
  const nPlusOneJs = detectorToggles?.nPlusOneEnabled !== false ? "true" : "false";
  const slowBurstEnJs = detectorToggles?.slowBurstEnabled !== false ? "true" : "false";
  const baselineHintsJs = detectorToggles?.baselineHintsEnabled !== false ? "true" : "false";
  return /* javascript */ `
var viewerDbInsightsEnabled = ${enabledJs};
var viewerSlowBurstThresholds = ${burstJson};
var viewerDbDetectorNPlusOneEnabled = ${nPlusOneJs};
var viewerDbDetectorSlowBurstEnabled = ${slowBurstEnJs};
var viewerDbDetectorBaselineHintsEnabled = ${baselineHintsJs};
var dbDetectorRegistry = [];
var dbDetectorSessionDisabled = Object.create(null);
var dbDetectorErrorLogged = Object.create(null);
/** One marker per fingerprint when session count exceeds SQL baseline (DB_10 optional follow-up). */
var baselineVolumeHintEmitted = Object.create(null);
/** Optional compare baseline from host (setDbBaselineFingerprintSummary); fingerprint → entry object. */
var dbBaselineFingerprintSummary = null;
/** Map mirror built when the host sets the baseline — avoids rebuilding from the object on every DB line. */
var dbBaselineFingerprintSummaryMap = null;
function setDbBaselineFingerprintSummaryFromHost(fingerprints) {
    if (!fingerprints || typeof fingerprints !== 'object') {
        dbBaselineFingerprintSummary = null;
        dbBaselineFingerprintSummaryMap = null;
    } else {
        dbBaselineFingerprintSummary = fingerprints;
        var m = new Map();
        for (var bk in fingerprints) {
            if (Object.prototype.hasOwnProperty.call(fingerprints, bk)) {
                m.set(bk, fingerprints[bk]);
            }
        }
        dbBaselineFingerprintSummaryMap = m;
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
/** Apply session-rollup-patch results into dbInsightSessionRollup (same math as live Drift lines). */
function applyDbSessionRollupPatches(results) {
    if (!results || !results.length) return;
    if (typeof updateDbInsightRollup !== 'function') return;
    var i, r, p, k, reps, j;
    for (i = 0; i < results.length; i++) {
        r = results[i];
        if (!r || r.kind !== 'session-rollup-patch' || !r.payload) continue;
        p = r.payload;
        if (!p.fingerprint) continue;
        reps = (typeof p.repeatCount === 'number' && p.repeatCount > 0) ? Math.min(p.repeatCount, 1000) : 1;
        for (j = 0; j < reps; j++) {
            updateDbInsightRollup(p.fingerprint, p.elapsedMs);
        }
    }
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
    baselineVolumeHintEmitted = Object.create(null);
}
function registerBuiltinDbDetectors() {
    registerDbDetector({
        id: '${SLOW_QUERY_BURST_DETECTOR_ID}',
        priority: 85,
        feed: function(ctx) {
            if (typeof viewerDbDetectorSlowBurstEnabled !== 'undefined' && !viewerDbDetectorSlowBurstEnabled) return [];
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
        id: '${BASELINE_VOLUME_HINT_ID}',
        priority: 92,
        feed: function(ctx) {
            if (typeof viewerDbDetectorBaselineHintsEnabled !== 'undefined' && !viewerDbDetectorBaselineHintsEnabled) return [];
            if (!ctx || !ctx.sql || !ctx.sql.fingerprint) return [];
            if (!ctx.baselineFingerprintSummary || typeof ctx.baselineFingerprintSummary.get !== 'function') return [];
            var fp = ctx.sql.fingerprint;
            var bEnt = ctx.baselineFingerprintSummary.get(fp);
            if (!bEnt || typeof bEnt.count !== 'number' || bEnt.count < 3) return [];
            if (baselineVolumeHintEmitted[fp]) return [];
            var roll = typeof dbInsightSessionRollup !== 'undefined' ? dbInsightSessionRollup[fp] : null;
            var cur = roll && typeof roll.count === 'number' ? roll.count : 0;
            if (cur <= bEnt.count) return [];
            baselineVolumeHintEmitted[fp] = true;
            var anc = ctx.anchorSeq;
            return [{
                kind: 'marker',
                detectorId: '${BASELINE_VOLUME_HINT_ID}',
                stableKey: '${BASELINE_VOLUME_HINT_ID}::' + fp,
                priority: 92,
                payload: {
                    category: 'db-insight',
                    label: 'SQL count above baseline (' + cur + ' vs ' + bEnt.count + ')',
                    anchorSeq: anc
                }
            }];
        }
    });
    registerDbDetector({
        id: 'db.n-plus-one',
        priority: 100,
        feed: function(ctx) {
            if (typeof viewerDbDetectorNPlusOneEnabled !== 'undefined' && !viewerDbDetectorNPlusOneEnabled) return [];
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
