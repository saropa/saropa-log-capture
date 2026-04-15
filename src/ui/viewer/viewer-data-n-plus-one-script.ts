/**
 * Embedded webview script: Drift SQL N+1 burst detector.
 *
 * Emits `parseSqlFingerprint` / `detectNPlusOneSignal` into the same scope as
 * `addToData` (see `viewer-data-helpers.ts` load order). Thresholds are interpolated
 * from `N_PLUS_ONE_EMBED_CONFIG` in `modules/db/drift-n-plus-one-detector.ts` so the
 * extension and unit tests agree on numbers; **function bodies must stay aligned**
 * with that module’s documented behavior.
 *
 * Fingerprint normalization must match `normalizeDriftSqlFingerprintSql` in
 * `modules/db/drift-sql-fingerprint-normalize.ts` (uses `DRIFT_SQL_KEYWORD_ALT`).
 *
 * Also emits `driftSqlSnippetFromPlain` for dbSignal fallback text (kept in sync with
 * `viewer-data-add-db-detectors.ts`).
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
/* Standard LogInterceptor: "Drift: Sent SELECT …" */
var driftSqlSentPattern = /\\bDrift:\\s+Sent\\s+(SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\b/i;
/* DriftDebugInterceptor: "Drift SELECT: SELECT …" */
var driftSqlVerbColonPattern = /\\bDrift\\s+(SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\s*:/i;
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
/**
 * Parse a Drift SQL fingerprint from plain text.
 * Handles two formats:
 *   Standard:  "Drift: Sent SELECT ... with args [...]"
 *   Custom:    "Drift SELECT: SELECT ...; | args: [...]"
 */
function parseSqlFingerprint(plainText) {
    if (!plainText) return null;
    /* Try standard format first: "Drift: Sent <VERB>" */
    var verbMatch = driftSqlSentPattern.exec(plainText);
    var body, argsIdx, argsLen;
    if (verbMatch) {
        var sentIdx = plainText.indexOf('Drift: Sent ');
        if (sentIdx < 0) return null;
        body = plainText.substring(sentIdx + 12).trim();
        argsIdx = body.lastIndexOf(' with args ');
        argsLen = 11;
    } else {
        /* Try DriftDebugInterceptor format: "Drift SELECT: SELECT ..." */
        verbMatch = driftSqlVerbColonPattern.exec(plainText);
        if (!verbMatch) return null;
        /* Body starts after "Drift SELECT: " (the full match plus colon/space). */
        var afterColon = plainText.indexOf(':', verbMatch.index + 5);
        if (afterColon < 0) return null;
        body = plainText.substring(afterColon + 1).trim();
        /* Args delimiter is " | args: " (pipe-separated) for this format. */
        argsIdx = body.lastIndexOf(' | args: ');
        argsLen = 9;
        /* Also accept " with args " if the interceptor uses that. */
        if (argsIdx < 0) {
            argsIdx = body.lastIndexOf(' with args ');
            argsLen = 11;
        }
    }
    if (!body) return null;
    var sqlPart = argsIdx >= 0 ? body.substring(0, argsIdx) : body;
    var argsPart = argsIdx >= 0 ? body.substring(argsIdx + argsLen).trim() : '';
    /* Strip trailing semicolons — DriftDebugInterceptor appends them before args.
       Done here (not in normalizeDriftSqlFingerprintSql) to stay in sync with the
       extension-side mirror in drift-sql-fingerprint-normalize.ts. */
    var sql = sqlPart.trim().replace(/;\\s*$/, '');
    if (!sql) return null;
    var fp = normalizeDriftSqlFingerprintSql(sql);
    if (!fp) return null;
    return { fingerprint: fp, argsKey: argsPart || '[]', sqlSnippet: sqlPart, verb: verbMatch[1].toUpperCase() };
}
/* Fallback dbSignal snippet from plain text: substring from first Drift prefix onward, max 500 chars (shared with emitDbLineDetectors). */
function driftSqlSnippetFromPlain(plain) {
    if (!plain) return '';
    /* Try "Drift:" first, then bare "Drift " for DriftDebugInterceptor lines like "Drift SELECT:". */
    var di = plain.indexOf('Drift:');
    if (di < 0) di = plain.indexOf('Drift ');
    var raw = di >= 0 ? plain.substring(di).trim() : plain.trim();
    return raw.length > 500 ? raw.substring(0, 497) + '...' : raw;
}
var dbSignalSessionRollup = Object.create(null);
/** Per normalized SQL fingerprint: session-wide seen count and duration stats (elapsedMs when present on lines). */
function updateDbSignalRollup(fingerprint, elapsedMs) {
    if (!fingerprint) return null;
    var e = dbSignalSessionRollup[fingerprint];
    if (!e) {
        e = { count: 0, sumMs: 0, maxMs: 0, countWithMs: 0 };
        dbSignalSessionRollup[fingerprint] = e;
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
/** Read rollup stats without mutating (after updateDbSignalRollup / session-rollup-patch). */
function peekDbSignalRollup(fingerprint) {
    if (!fingerprint) return null;
    var e = dbSignalSessionRollup[fingerprint];
    if (!e) return null;
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
function detectNPlusOneSignal(ts, fingerprint, argsKey) {
    if (!fingerprint) return null;
    var now = ts || Date.now();
    var entry = nPlusOneDetector.byFingerprint[fingerprint];
    if (!entry) {
        entry = { hits: [], lastSignalTs: 0 };
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
    if (entry.lastSignalTs > 0 && (now - entry.lastSignalTs) < nPlusOneDetector.cooldownMs) {
        pruneNPlusOneFingerprints(now);
        return null;
    }
    entry.lastSignalTs = now;
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
