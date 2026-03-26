"use strict";
/**
 * On-disk shape for Drift SQL fingerprint summaries (plan **DB_10**).
 * Stored under `SessionMeta.driftSqlFingerprintSummary`; validate `schemaVersion` on read.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION = void 0;
exports.isPersistedDriftSqlFingerprintSummaryV1 = isPersistedDriftSqlFingerprintSummaryV1;
exports.summaryMapToPersistedV1 = summaryMapToPersistedV1;
exports.persistedSummaryToMap = persistedSummaryToMap;
exports.persistedSummaryToBaselineRecord = persistedSummaryToBaselineRecord;
exports.fingerprintSummaryMapToBaselineRecord = fingerprintSummaryMapToBaselineRecord;
exports.trimSummaryForPersistence = trimSummaryForPersistence;
exports.DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION = 1;
function isPersistedDriftSqlFingerprintSummaryV1(v) {
    if (!v || typeof v !== "object") {
        return false;
    }
    const o = v;
    if (o.schemaVersion !== exports.DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION) {
        return false;
    }
    const fp = o.fingerprints;
    // Arrays are typeof "object" in JS; reject them so malformed JSON does not pass as a record map.
    if (!fp || typeof fp !== "object" || Array.isArray(fp)) {
        return false;
    }
    return true;
}
function summaryMapToPersistedV1(summary, firstLineByFingerprint) {
    const fingerprints = Object.create(null);
    for (const [k, e] of summary) {
        fingerprints[k] = {
            count: e.count,
            ...(e.avgDurationMs !== undefined ? { avgDurationMs: e.avgDurationMs } : {}),
            ...(e.maxDurationMs !== undefined ? { maxDurationMs: e.maxDurationMs } : {}),
            ...(e.durationSampleCount !== undefined ? { durationSampleCount: e.durationSampleCount } : {}),
            ...(e.slowQueryCount !== undefined && e.slowQueryCount > 0 ? { slowQueryCount: e.slowQueryCount } : {}),
        };
    }
    const firstOccurrenceLineByFingerprint = firstLineByFingerprint && firstLineByFingerprint.size > 0
        ? Object.fromEntries(firstLineByFingerprint)
        : undefined;
    return {
        schemaVersion: exports.DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
        fingerprints,
        ...(firstOccurrenceLineByFingerprint ? { firstOccurrenceLineByFingerprint } : {}),
    };
}
/** Convert persisted fingerprints to a Map for `runDbDetectorsCompare` / viewer baseline. */
function persistedSummaryToMap(p) {
    const out = new Map();
    for (const [k, e] of Object.entries(p.fingerprints)) {
        out.set(k, {
            count: e.count,
            ...(e.avgDurationMs !== undefined ? { avgDurationMs: e.avgDurationMs } : {}),
            ...(e.maxDurationMs !== undefined ? { maxDurationMs: e.maxDurationMs } : {}),
            ...(e.durationSampleCount !== undefined ? { durationSampleCount: e.durationSampleCount } : {}),
            ...(e.slowQueryCount !== undefined && e.slowQueryCount > 0 ? { slowQueryCount: e.slowQueryCount } : {}),
        });
    }
    return out;
}
/** Plain object for webview postMessage (JSON-safe) baseline payload. */
function persistedSummaryToBaselineRecord(p) {
    return { ...p.fingerprints };
}
/** Payload for `setDbBaselineFingerprintSummary` webview message (fingerprint → entry). */
function fingerprintSummaryMapToBaselineRecord(m) {
    return summaryMapToPersistedV1(m, undefined).fingerprints;
}
const MAX_PERSISTED_FINGERPRINTS = 500;
/** Keep the heaviest hitters so metadata stays bounded. */
function trimSummaryForPersistence(summary, firstLineByFingerprint, maxKeys = MAX_PERSISTED_FINGERPRINTS) {
    if (summary.size <= maxKeys) {
        return {
            summary: new Map(summary),
            firstLineByFingerprint: new Map(firstLineByFingerprint),
        };
    }
    const sorted = [...summary.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, maxKeys);
    const nextSummary = new Map(sorted);
    const nextLines = new Map();
    for (const [k] of sorted) {
        const line = firstLineByFingerprint.get(k);
        if (line !== undefined) {
            nextLines.set(k, line);
        }
    }
    return { summary: nextSummary, firstLineByFingerprint: nextLines };
}
//# sourceMappingURL=drift-sql-fingerprint-summary-persist.js.map