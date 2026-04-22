"use strict";
/**
 * Drift / SQL N+1 burst heuristic (canonical TypeScript).
 *
 * **Purpose:** Unit-test the same rules the log viewer webview applies when it scans
 * `Drift: Sent … with args …` lines. The viewer still runs an embedded JavaScript copy
 * (see `viewer-data-n-plus-one-script.ts`); **keep algorithms in sync** when changing
 * thresholds or fingerprint normalization (see `drift-sql-fingerprint-normalize.ts`).
 *
 * **Heuristic (v1):** Within a short sliding time window, many executions of the same
 * normalized SQL shape with *different* bound-arg payloads suggest a possible N+1 (or
 * chatty query loop). Same args repeated (retries, logging duplicates) should not pass
 * the distinct-args gate. Confidence is coarse (low/medium/high) for UI labeling only.
 *
 * **Not:** Static ORM analysis or guaranteed N+1 proof — logs are best-effort signals.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPlusOneDetector = exports.DRIFT_SQL_HEAD = exports.DRIFT_SQL_VERB_COLON = exports.DRIFT_SQL_SENT = exports.N_PLUS_ONE_EMBED_CONFIG = void 0;
exports.parseDriftSqlFingerprint = parseDriftSqlFingerprint;
const drift_sql_fingerprint_normalize_1 = require("./drift-sql-fingerprint-normalize");
/** Default thresholds (plan DB_07: window up to 2s, min repeats 8+). */
exports.N_PLUS_ONE_EMBED_CONFIG = {
    /** Sliding window for burst detection (ms). */
    windowMs: 2000,
    minRepeats: 8,
    /** Minimum distinct `with args` payloads in the window (not merely repeat count). */
    minDistinctArgs: 4,
    /** distinctArgs / repeats — dampens “same few args cycling” false positives. */
    minDistinctRatio: 0.5,
    /** Suppress duplicate signal rows for the same fingerprint (ms). */
    cooldownMs: 8000,
    /** Cap map entries so long sessions do not grow `byFingerprint` without bound. */
    maxFingerprintsTracked: 64,
    /** Drop tracked fingerprints idle longer than this (ms) when over cap. */
    pruneIdleMs: 30_000,
};
/** Standard LogInterceptor: `Drift: Sent SELECT …`. */
exports.DRIFT_SQL_SENT = /\bDrift:\s+Sent\s+(SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i;
/** DriftDebugInterceptor: `Drift SELECT: SELECT …`. */
exports.DRIFT_SQL_VERB_COLON = /\bDrift\s+(SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\s*:/i;
/**
 * Combined head pattern: matches either format.
 * Align with `source-tag-parser` / viewer `driftStatementPattern`.
 */
exports.DRIFT_SQL_HEAD = /\bDrift(?::\s+Sent|\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\s*:)\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i;
/**
 * Parse plain log text: extract normalized SQL fingerprint and args key.
 * Handles both standard (`Drift: Sent SELECT …`) and
 * DriftDebugInterceptor (`Drift SELECT: SELECT …`) formats.
 */
function parseDriftSqlFingerprint(plainText) {
    if (!plainText) {
        return null;
    }
    let body;
    let argsIdx;
    let argsLen;
    /* Try standard format: "Drift: Sent <SQL> with args [...]" */
    const sentIdx = plainText.indexOf('Drift: Sent ');
    if (sentIdx >= 0 && exports.DRIFT_SQL_SENT.test(plainText)) {
        body = plainText.slice(sentIdx + 12).trim();
        argsIdx = body.lastIndexOf(' with args ');
        argsLen = 11;
    }
    else {
        /* Try DriftDebugInterceptor: "Drift SELECT: <SQL> | args: [...]" */
        const vcMatch = exports.DRIFT_SQL_VERB_COLON.exec(plainText);
        if (!vcMatch) {
            return null;
        }
        const afterColon = plainText.indexOf(':', vcMatch.index + 5);
        if (afterColon < 0) {
            return null;
        }
        body = plainText.slice(afterColon + 1).trim();
        /* Primary delimiter is " | args: "; fall back to " with args " */
        argsIdx = body.lastIndexOf(' | args: ');
        argsLen = 9;
        if (argsIdx < 0) {
            argsIdx = body.lastIndexOf(' with args ');
            argsLen = 11;
        }
    }
    if (!body) {
        return null;
    }
    const sqlPart = argsIdx >= 0 ? body.slice(0, argsIdx) : body;
    const argsPart = argsIdx >= 0 ? body.slice(argsIdx + argsLen).trim() : '';
    /* Strip trailing semicolons — DriftDebugInterceptor appends them before args. */
    const sql = sqlPart.trim().replace(/;\s*$/, '');
    if (!sql) {
        return null;
    }
    const fp = (0, drift_sql_fingerprint_normalize_1.normalizeDriftSqlFingerprintSql)(sql);
    if (!fp) {
        return null;
    }
    return { fingerprint: fp, argsKey: argsPart || '[]', sqlSnippet: sql };
}
function confidenceFor(distinctRatio, repeats) {
    if (distinctRatio >= 0.7 && repeats >= 12) {
        return 'high';
    }
    if (distinctRatio >= 0.6 && repeats >= 10) {
        return 'medium';
    }
    return 'low';
}
function lastHitTs(entry) {
    const { hits } = entry;
    return hits.length ? hits[hits.length - 1].ts : 0;
}
/**
 * Stateful detector for tests and documentation of the webview algorithm.
 */
class NPlusOneDetector {
    cfg;
    byFingerprint = new Map();
    constructor(cfg = exports.N_PLUS_ONE_EMBED_CONFIG) {
        this.cfg = cfg;
    }
    /** @param ts - Epoch ms (log line timestamp or synthetic test clock). */
    feed(ts, fingerprint, argsKey) {
        if (!fingerprint) {
            return null;
        }
        const now = ts;
        let entry = this.byFingerprint.get(fingerprint);
        if (!entry) {
            entry = { hits: [], lastSignalTs: 0 };
            this.byFingerprint.set(fingerprint, entry);
        }
        entry.hits.push({ ts: now, argsKey: argsKey || '[]' });
        const cutoff = now - this.cfg.windowMs;
        while (entry.hits.length > 0 && entry.hits[0].ts < cutoff) {
            entry.hits.shift();
        }
        const repeats = entry.hits.length;
        if (repeats < this.cfg.minRepeats) {
            this.pruneFingerprints(now);
            return null;
        }
        const distinctArgsMap = new Set();
        for (const h of entry.hits) {
            distinctArgsMap.add(h.argsKey);
        }
        const distinctArgs = distinctArgsMap.size;
        const distinctRatio = repeats > 0 ? distinctArgs / repeats : 0;
        if (distinctArgs < this.cfg.minDistinctArgs || distinctRatio < this.cfg.minDistinctRatio) {
            this.pruneFingerprints(now);
            return null;
        }
        /* Cooldown only after at least one signal (0 means "never fired"). */
        if (entry.lastSignalTs > 0 && now - entry.lastSignalTs < this.cfg.cooldownMs) {
            this.pruneFingerprints(now);
            return null;
        }
        entry.lastSignalTs = now;
        const windowSpanMs = entry.hits[entry.hits.length - 1].ts - entry.hits[0].ts;
        const signal = {
            repeats,
            distinctArgs,
            windowSpanMs,
            confidence: confidenceFor(distinctRatio, repeats),
        };
        this.pruneFingerprints(now);
        return signal;
    }
    /** Visible for tests that assert pruning behavior. */
    fingerprintCount() {
        return this.byFingerprint.size;
    }
    pruneFingerprints(now) {
        const { maxFingerprintsTracked, pruneIdleMs } = this.cfg;
        if (this.byFingerprint.size <= maxFingerprintsTracked) {
            return;
        }
        for (const [k, ent] of [...this.byFingerprint.entries()]) {
            if (!ent.hits.length || now - lastHitTs(ent) > pruneIdleMs) {
                this.byFingerprint.delete(k);
            }
        }
        while (this.byFingerprint.size > maxFingerprintsTracked) {
            let worstK = null;
            let worstTs = Infinity;
            for (const [k, ent] of this.byFingerprint.entries()) {
                const t = lastHitTs(ent);
                if (t < worstTs) {
                    worstTs = t;
                    worstK = k;
                }
            }
            if (worstK === null) {
                break;
            }
            this.byFingerprint.delete(worstK);
        }
    }
}
exports.NPlusOneDetector = NPlusOneDetector;
//# sourceMappingURL=drift-n-plus-one-detector.js.map