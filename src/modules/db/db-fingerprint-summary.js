"use strict";
/**
 * Shared fingerprint summary and diff math for DB_15 session compare / DB_10 (batch only).
 * Extension host and tests; webview compare entry point can mirror or call host later.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.accumulateDbDetectorContextForFingerprintSummary = accumulateDbDetectorContextForFingerprintSummary;
exports.finalizeDbFingerprintSummaryMap = finalizeDbFingerprintSummaryMap;
exports.buildDbFingerprintSummaryFromDetectorContexts = buildDbFingerprintSummaryFromDetectorContexts;
exports.mergeDbFingerprintSummaryEntries = mergeDbFingerprintSummaryEntries;
exports.mergeDbFingerprintSummaryMaps = mergeDbFingerprintSummaryMaps;
exports.buildDbFingerprintSummaryDiff = buildDbFingerprintSummaryDiff;
function finalizeAcc(acc) {
    const base = acc.durationSamples <= 0
        ? { count: acc.count }
        : {
            count: acc.count,
            avgDurationMs: acc.sumMs / acc.durationSamples,
            maxDurationMs: acc.maxMs,
            durationSampleCount: acc.durationSamples,
        };
    if (acc.slowQueryCount > 0) {
        return { ...base, slowQueryCount: acc.slowQueryCount };
    }
    return base;
}
/** Fold one ingest context into a mutable accumulator (Drift SQL rows only). */
function accumulateDbDetectorContextForFingerprintSummary(acc, ctx, opts) {
    const fp = ctx.sql?.fingerprint;
    if (!fp) {
        return;
    }
    let e = acc.get(fp);
    if (!e) {
        e = { count: 0, sumMs: 0, durationSamples: 0, maxMs: 0, slowQueryCount: 0 };
        acc.set(fp, e);
    }
    e.count++;
    const ms = ctx.durationMs;
    const slowTh = opts?.slowQueryMsThreshold;
    if (typeof ms === "number" && ms >= 0 && Number.isFinite(ms)) {
        e.sumMs += ms;
        e.durationSamples++;
        if (ms > e.maxMs) {
            e.maxMs = ms;
        }
        if (typeof slowTh === "number" && slowTh > 0 && ms >= slowTh) {
            e.slowQueryCount++;
        }
    }
}
function finalizeDbFingerprintSummaryMap(acc) {
    const out = new Map();
    for (const [k, v] of acc) {
        out.set(k, finalizeAcc(v));
    }
    return out;
}
/** Build a summary map from a batch of detector contexts (e.g. one session tail). */
function buildDbFingerprintSummaryFromDetectorContexts(contexts, opts) {
    const acc = new Map();
    for (const ctx of contexts) {
        accumulateDbDetectorContextForFingerprintSummary(acc, ctx, opts);
    }
    return finalizeDbFingerprintSummaryMap(acc);
}
/**
 * Merge two summaries (e.g. chunked loads). Weighted avg uses `durationSampleCount` when present;
 * entries without samples merge by count and max only.
 */
function mergeDbFingerprintSummaryEntries(a, b) {
    const count = a.count + b.count;
    const n1 = a.durationSampleCount ?? 0;
    const n2 = b.durationSampleCount ?? 0;
    const sum1 = n1 > 0 && a.avgDurationMs !== undefined ? a.avgDurationMs * n1 : 0;
    const sum2 = n2 > 0 && b.avgDurationMs !== undefined ? b.avgDurationMs * n2 : 0;
    const n = n1 + n2;
    let maxMs = 0;
    let hasMax = false;
    if (a.maxDurationMs !== undefined) {
        maxMs = a.maxDurationMs;
        hasMax = true;
    }
    if (b.maxDurationMs !== undefined) {
        maxMs = hasMax ? Math.max(maxMs, b.maxDurationMs) : b.maxDurationMs;
        hasMax = true;
    }
    const s1 = a.slowQueryCount ?? 0;
    const s2 = b.slowQueryCount ?? 0;
    const slowSum = s1 + s2;
    if (n <= 0) {
        const base = hasMax ? { count, maxDurationMs: maxMs } : { count };
        return slowSum > 0 ? { ...base, slowQueryCount: slowSum } : base;
    }
    const merged = {
        count,
        avgDurationMs: (sum1 + sum2) / n,
        maxDurationMs: hasMax ? maxMs : undefined,
        durationSampleCount: n,
    };
    return slowSum > 0 ? { ...merged, slowQueryCount: slowSum } : merged;
}
function mergeDbFingerprintSummaryMaps(a, b) {
    const out = new Map();
    for (const [k, v] of a) {
        out.set(k, v);
    }
    for (const [k, v] of b) {
        const ex = out.get(k);
        out.set(k, ex ? mergeDbFingerprintSummaryEntries(ex, v) : v);
    }
    return out;
}
/** Stable-sorted union of keys with optional baseline/target sides. */
function buildDbFingerprintSummaryDiff(baseline, target) {
    const keys = new Set();
    for (const k of baseline.keys()) {
        keys.add(k);
    }
    for (const k of target.keys()) {
        keys.add(k);
    }
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));
    return sorted.map((fingerprint) => ({
        fingerprint,
        baseline: baseline.get(fingerprint),
        target: target.get(fingerprint),
    }));
}
//# sourceMappingURL=db-fingerprint-summary.js.map