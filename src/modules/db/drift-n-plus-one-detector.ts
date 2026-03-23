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

import { normalizeDriftSqlFingerprintSql } from './drift-sql-fingerprint-normalize';

/** Tunables injected into the webview script and used by `NPlusOneDetector` in tests. */
export interface NPlusOneDetectorConfig {
    windowMs: number;
    minRepeats: number;
    minDistinctArgs: number;
    minDistinctRatio: number;
    cooldownMs: number;
    maxFingerprintsTracked: number;
    pruneIdleMs: number;
}

/** Default thresholds (plan DB_07: window up to 2s, min repeats 8+). */
export const N_PLUS_ONE_EMBED_CONFIG: NPlusOneDetectorConfig = {
    /** Sliding window for burst detection (ms). */
    windowMs: 2000,
    minRepeats: 8,
    /** Minimum distinct `with args` payloads in the window (not merely repeat count). */
    minDistinctArgs: 4,
    /** distinctArgs / repeats — dampens “same few args cycling” false positives. */
    minDistinctRatio: 0.5,
    /** Suppress duplicate insight rows for the same fingerprint (ms). */
    cooldownMs: 8000,
    /** Cap map entries so long sessions do not grow `byFingerprint` without bound. */
    maxFingerprintsTracked: 64,
    /** Drop tracked fingerprints idle longer than this (ms) when over cap. */
    pruneIdleMs: 30_000,
};

/** Match Drift statement prefix (align with `source-tag-parser` / viewer `driftStatementPattern`). */
export const DRIFT_SQL_HEAD =
    /\bDrift:\s+Sent\s+(SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i;

export type NPlusOneConfidence = 'low' | 'medium' | 'high';

export interface DriftSqlFingerprint {
    readonly fingerprint: string;
    readonly argsKey: string;
    /** Raw SQL before ` with args ` (same field the webview embed exposes as `sqlSnippet`). */
    readonly sqlSnippet: string;
}

export interface NPlusOneInsight {
    readonly repeats: number;
    readonly distinctArgs: number;
    readonly windowSpanMs: number;
    readonly confidence: NPlusOneConfidence;
}

interface FingerprintEntry {
    hits: { ts: number; argsKey: string }[];
    lastInsightTs: number;
}

/**
 * Parse plain log text: extract normalized SQL fingerprint and args key.
 * Returns null if the line is not a Drift `Sent` statement we recognize.
 */
export function parseDriftSqlFingerprint(plainText: string): DriftSqlFingerprint | null {
    if (!plainText || !DRIFT_SQL_HEAD.test(plainText)) {
        return null;
    }
    const sentIdx = plainText.indexOf('Drift: Sent ');
    if (sentIdx < 0) {
        return null;
    }
    const body = plainText.slice(sentIdx + 12).trim();
    if (!body) {
        return null;
    }
    const argsIdx = body.lastIndexOf(' with args ');
    const sqlPart = argsIdx >= 0 ? body.slice(0, argsIdx) : body;
    const argsPart = argsIdx >= 0 ? body.slice(argsIdx + 11).trim() : '';
    const sql = sqlPart.trim();
    if (!sql) {
        return null;
    }
    const fp = normalizeDriftSqlFingerprintSql(sql);
    if (!fp) {
        return null;
    }
    return { fingerprint: fp, argsKey: argsPart || '[]', sqlSnippet: sql };
}

function confidenceFor(distinctRatio: number, repeats: number): NPlusOneConfidence {
    if (distinctRatio >= 0.7 && repeats >= 12) {
        return 'high';
    }
    if (distinctRatio >= 0.6 && repeats >= 10) {
        return 'medium';
    }
    return 'low';
}

function lastHitTs(entry: FingerprintEntry): number {
    const { hits } = entry;
    return hits.length ? hits[hits.length - 1].ts : 0;
}

/**
 * Stateful detector for tests and documentation of the webview algorithm.
 */
export class NPlusOneDetector {
    private readonly byFingerprint = new Map<string, FingerprintEntry>();

    constructor(private readonly cfg: NPlusOneDetectorConfig = N_PLUS_ONE_EMBED_CONFIG) {}

    /** @param ts - Epoch ms (log line timestamp or synthetic test clock). */
    feed(ts: number, fingerprint: string, argsKey: string): NPlusOneInsight | null {
        if (!fingerprint) {
            return null;
        }
        const now = ts;
        let entry = this.byFingerprint.get(fingerprint);
        if (!entry) {
            entry = { hits: [], lastInsightTs: 0 };
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
        const distinctArgsMap = new Set<string>();
        for (const h of entry.hits) {
            distinctArgsMap.add(h.argsKey);
        }
        const distinctArgs = distinctArgsMap.size;
        const distinctRatio = repeats > 0 ? distinctArgs / repeats : 0;
        if (distinctArgs < this.cfg.minDistinctArgs || distinctRatio < this.cfg.minDistinctRatio) {
            this.pruneFingerprints(now);
            return null;
        }
        /* Cooldown only after at least one insight (0 means "never fired"). */
        if (entry.lastInsightTs > 0 && now - entry.lastInsightTs < this.cfg.cooldownMs) {
            this.pruneFingerprints(now);
            return null;
        }
        entry.lastInsightTs = now;
        const windowSpanMs = entry.hits[entry.hits.length - 1].ts - entry.hits[0].ts;
        const insight: NPlusOneInsight = {
            repeats,
            distinctArgs,
            windowSpanMs,
            confidence: confidenceFor(distinctRatio, repeats),
        };
        this.pruneFingerprints(now);
        return insight;
    }

    /** Visible for tests that assert pruning behavior. */
    fingerprintCount(): number {
        return this.byFingerprint.size;
    }

    private pruneFingerprints(now: number): void {
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
            let worstK: string | null = null;
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
