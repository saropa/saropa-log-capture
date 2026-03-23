/**
 * Embedded webview script: Drift SQL N+1 burst detector.
 *
 * Emits `parseSqlFingerprint` / `detectNPlusOneInsight` into the same scope as
 * `addToData` (see `viewer-data-helpers.ts` load order). Thresholds are interpolated
 * from `N_PLUS_ONE_EMBED_CONFIG` in `modules/db/drift-n-plus-one-detector.ts` so the
 * extension and unit tests agree on numbers; **function bodies must stay aligned**
 * with that module’s documented behavior.
 *
 * Fingerprint normalization must match `normalizeDriftSqlFingerprintSql` in
 * `modules/db/drift-sql-fingerprint-normalize.ts` (uses `DRIFT_SQL_KEYWORD_ALT`).
 */
import { N_PLUS_ONE_EMBED_CONFIG as N1 } from '../../modules/db/drift-n-plus-one-detector';
import {
    getDriftRepeatMinNJsSource,
    normalizeViewerRepeatThresholds,
    type ViewerRepeatThresholds,
} from '../../modules/db/drift-db-repeat-thresholds';
import { DRIFT_SQL_KEYWORD_ALT } from '../../modules/db/drift-sql-fingerprint-normalize';

/** @param embedThresholds - Initial viewer thresholds (usually from workspace config at HTML build). */
export function getNPlusOneDetectorScript(embedThresholds?: Partial<ViewerRepeatThresholds>): string {
    const rt = normalizeViewerRepeatThresholds(embedThresholds);
    const driftRepeatMinNJs = getDriftRepeatMinNJsSource();
    return /* javascript */ `
var driftSqlPattern = /\\bDrift:\\s+Sent\\s+(SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\b/i;
var driftSqlKwRe = new RegExp('\\\\b(?:${DRIFT_SQL_KEYWORD_ALT})\\\\b', 'gi');
function normalizeDriftSqlFingerprintSql(sql) {
    if (!sql) return '';
    var s = sql;
    s = s.replace(/\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b/gi, '?');
    s = s.replace(/x'[0-9a-f]*'/gi, '?');
    s = s.replace(/'(?:[^']|'')*'/g, '?');
    s = s.replace(/\\"[^\\"]*\\"/g, '?');
    s = s.replace(/\\b\\d+\\b/g, '?');
    s = s.replace(/\\s+/g, ' ').trim();
    if (!s) return '';
    s = s.toLowerCase();
    s = s.replace(driftSqlKwRe, function(m) { return m.toUpperCase(); });
    return s;
}
var dbRepeatThresholds = {
    global: ${rt.globalMinCount},
    read: ${rt.readMinCount},
    transaction: ${rt.transactionMinCount},
    dml: ${rt.dmlMinCount}
};
${driftRepeatMinNJs}
var nPlusOneDetector = {
    windowMs: ${N1.windowMs},
    minRepeats: ${N1.minRepeats},
    minDistinctArgs: ${N1.minDistinctArgs},
    minDistinctRatio: ${N1.minDistinctRatio},
    cooldownMs: ${N1.cooldownMs},
    maxFingerprintsTracked: ${N1.maxFingerprintsTracked},
    pruneIdleMs: ${N1.pruneIdleMs},
    byFingerprint: Object.create(null)
};
function parseSqlFingerprint(plainText) {
    if (!plainText) return null;
    var verbMatch = driftSqlPattern.exec(plainText);
    if (!verbMatch) return null;
    var sentIdx = plainText.indexOf('Drift: Sent ');
    if (sentIdx < 0) return null;
    var body = plainText.substring(sentIdx + 12).trim();
    if (!body) return null;
    var argsIdx = body.lastIndexOf(' with args ');
    var sqlPart = argsIdx >= 0 ? body.substring(0, argsIdx) : body;
    var argsPart = argsIdx >= 0 ? body.substring(argsIdx + 11).trim() : '';
    var sql = sqlPart.trim();
    if (!sql) return null;
    var fp = normalizeDriftSqlFingerprintSql(sql);
    if (!fp) return null;
    return { fingerprint: fp, argsKey: argsPart || '[]', sqlSnippet: sqlPart, verb: verbMatch[1].toUpperCase() };
}
var dbInsightSessionRollup = Object.create(null);
/** Per normalized SQL fingerprint: session-wide seen count and duration stats (elapsedMs when present on lines). */
function updateDbInsightRollup(fingerprint, elapsedMs) {
    if (!fingerprint) return null;
    var e = dbInsightSessionRollup[fingerprint];
    if (!e) {
        e = { count: 0, sumMs: 0, maxMs: 0, countWithMs: 0 };
        dbInsightSessionRollup[fingerprint] = e;
    }
    e.count++;
    if (typeof elapsedMs === 'number' && elapsedMs >= 0 && isFinite(elapsedMs)) {
        e.sumMs += elapsedMs;
        e.countWithMs++;
        if (elapsedMs > e.maxMs) e.maxMs = elapsedMs;
    }
    return {
        seenCount: e.count,
        avgDurationMs: e.countWithMs > 0 ? e.sumMs / e.countWithMs : undefined,
        maxDurationMs: e.countWithMs > 0 ? e.maxMs : undefined
    };
}
function pruneNPlusOneFingerprints(now) {
    var keys = Object.keys(nPlusOneDetector.byFingerprint);
    if (keys.length <= nPlusOneDetector.maxFingerprintsTracked) return;
    var idle = nPlusOneDetector.pruneIdleMs;
    var i, k, ent, lastTs;
    for (i = 0; i < keys.length; i++) {
        k = keys[i];
        ent = nPlusOneDetector.byFingerprint[k];
        if (!ent || !ent.hits.length) {
            delete nPlusOneDetector.byFingerprint[k];
            continue;
        }
        lastTs = ent.hits[ent.hits.length - 1].ts;
        if (now - lastTs > idle) delete nPlusOneDetector.byFingerprint[k];
    }
    keys = Object.keys(nPlusOneDetector.byFingerprint);
    while (keys.length > nPlusOneDetector.maxFingerprintsTracked) {
        var worstK = null;
        var worstTs = Infinity;
        for (i = 0; i < keys.length; i++) {
            k = keys[i];
            ent = nPlusOneDetector.byFingerprint[k];
            if (!ent || !ent.hits.length) continue;
            lastTs = ent.hits[ent.hits.length - 1].ts;
            if (lastTs < worstTs) {
                worstTs = lastTs;
                worstK = k;
            }
        }
        if (worstK == null) break;
        delete nPlusOneDetector.byFingerprint[worstK];
        keys = Object.keys(nPlusOneDetector.byFingerprint);
    }
}
function detectNPlusOneInsight(ts, fingerprint, argsKey) {
    if (!fingerprint) return null;
    var now = ts || Date.now();
    var entry = nPlusOneDetector.byFingerprint[fingerprint];
    if (!entry) {
        entry = { hits: [], lastInsightTs: 0 };
        nPlusOneDetector.byFingerprint[fingerprint] = entry;
    }
    entry.hits.push({ ts: now, argsKey: argsKey || '[]' });
    var cutoff = now - nPlusOneDetector.windowMs;
    while (entry.hits.length > 0 && entry.hits[0].ts < cutoff) {
        entry.hits.shift();
    }
    var repeats = entry.hits.length;
    if (repeats < nPlusOneDetector.minRepeats) {
        pruneNPlusOneFingerprints(now);
        return null;
    }
    var distinctArgsMap = Object.create(null);
    for (var j = 0; j < entry.hits.length; j++) distinctArgsMap[entry.hits[j].argsKey] = true;
    var distinctArgs = Object.keys(distinctArgsMap).length;
    var distinctRatio = repeats > 0 ? (distinctArgs / repeats) : 0;
    if (distinctArgs < nPlusOneDetector.minDistinctArgs || distinctRatio < nPlusOneDetector.minDistinctRatio) {
        pruneNPlusOneFingerprints(now);
        return null;
    }
    if (entry.lastInsightTs > 0 && (now - entry.lastInsightTs) < nPlusOneDetector.cooldownMs) {
        pruneNPlusOneFingerprints(now);
        return null;
    }
    entry.lastInsightTs = now;
    var windowSpanMs = entry.hits[entry.hits.length - 1].ts - entry.hits[0].ts;
    var confidence = 'low';
    if (distinctRatio >= 0.7 && repeats >= 12) confidence = 'high';
    else if (distinctRatio >= 0.6 && repeats >= 10) confidence = 'medium';
    pruneNPlusOneFingerprints(now);
    return {
        repeats: repeats,
        distinctArgs: distinctArgs,
        windowSpanMs: windowSpanMs,
        confidence: confidence
    };
}
`;
}
