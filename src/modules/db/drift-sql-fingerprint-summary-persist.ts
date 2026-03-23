/**
 * On-disk shape for Drift SQL fingerprint summaries (plan **DB_10**).
 * Stored under `SessionMeta.driftSqlFingerprintSummary`; validate `schemaVersion` on read.
 */

import type { DbFingerprintSummaryEntry } from "./db-detector-types";

export const DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION = 1 as const;

/** One fingerprint row in persisted JSON (matches `DbFingerprintSummaryEntry` fields). */
export interface PersistedDriftSqlFingerprintEntryV1 {
  readonly count: number;
  readonly avgDurationMs?: number;
  readonly maxDurationMs?: number;
  readonly durationSampleCount?: number;
  /** Lines at or above slow threshold when scan used `viewerSlowBurstSlowQueryMs`. */
  readonly slowQueryCount?: number;
}

export interface PersistedDriftSqlFingerprintSummaryV1 {
  readonly schemaVersion: typeof DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION;
  readonly fingerprints: Record<string, PersistedDriftSqlFingerprintEntryV1>;
  /** Physical 0-based line index in the log file for the first matching `Drift: Sent` line per fingerprint. */
  readonly firstOccurrenceLineByFingerprint?: Record<string, number>;
}

export function isPersistedDriftSqlFingerprintSummaryV1(v: unknown): v is PersistedDriftSqlFingerprintSummaryV1 {
  if (!v || typeof v !== "object") {
    return false;
  }
  const o = v as Record<string, unknown>;
  if (o.schemaVersion !== DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION) {
    return false;
  }
  const fp = o.fingerprints;
  // Arrays are typeof "object" in JS; reject them so malformed JSON does not pass as a record map.
  if (!fp || typeof fp !== "object" || Array.isArray(fp)) {
    return false;
  }
  return true;
}

export function summaryMapToPersistedV1(
  summary: ReadonlyMap<string, DbFingerprintSummaryEntry>,
  firstLineByFingerprint?: ReadonlyMap<string, number>,
): PersistedDriftSqlFingerprintSummaryV1 {
  const fingerprints: Record<string, PersistedDriftSqlFingerprintEntryV1> = Object.create(null);
  for (const [k, e] of summary) {
    fingerprints[k] = {
      count: e.count,
      ...(e.avgDurationMs !== undefined ? { avgDurationMs: e.avgDurationMs } : {}),
      ...(e.maxDurationMs !== undefined ? { maxDurationMs: e.maxDurationMs } : {}),
      ...(e.durationSampleCount !== undefined ? { durationSampleCount: e.durationSampleCount } : {}),
      ...(e.slowQueryCount !== undefined && e.slowQueryCount > 0 ? { slowQueryCount: e.slowQueryCount } : {}),
    };
  }
  const firstOccurrenceLineByFingerprint =
    firstLineByFingerprint && firstLineByFingerprint.size > 0
      ? Object.fromEntries(firstLineByFingerprint)
      : undefined;
  return {
    schemaVersion: DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION,
    fingerprints,
    ...(firstOccurrenceLineByFingerprint ? { firstOccurrenceLineByFingerprint } : {}),
  };
}

/** Convert persisted fingerprints to a Map for `runDbDetectorsCompare` / viewer baseline. */
export function persistedSummaryToMap(
  p: PersistedDriftSqlFingerprintSummaryV1,
): Map<string, DbFingerprintSummaryEntry> {
  const out = new Map<string, DbFingerprintSummaryEntry>();
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
export function persistedSummaryToBaselineRecord(
  p: PersistedDriftSqlFingerprintSummaryV1,
): Record<string, PersistedDriftSqlFingerprintEntryV1> {
  return { ...p.fingerprints };
}

/** Payload for `setDbBaselineFingerprintSummary` webview message (fingerprint → entry). */
export function fingerprintSummaryMapToBaselineRecord(
  m: ReadonlyMap<string, DbFingerprintSummaryEntry>,
): Record<string, PersistedDriftSqlFingerprintEntryV1> {
  return summaryMapToPersistedV1(m, undefined).fingerprints;
}

const MAX_PERSISTED_FINGERPRINTS = 500;

/** Keep the heaviest hitters so metadata stays bounded. */
export function trimSummaryForPersistence(
  summary: ReadonlyMap<string, DbFingerprintSummaryEntry>,
  firstLineByFingerprint: ReadonlyMap<string, number>,
  maxKeys = MAX_PERSISTED_FINGERPRINTS,
): { summary: Map<string, DbFingerprintSummaryEntry>; firstLineByFingerprint: Map<string, number> } {
  if (summary.size <= maxKeys) {
    return {
      summary: new Map(summary),
      firstLineByFingerprint: new Map(firstLineByFingerprint),
    };
  }
  const sorted = [...summary.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, maxKeys);
  const nextSummary = new Map(sorted);
  const nextLines = new Map<string, number>();
  for (const [k] of sorted) {
    const line = firstLineByFingerprint.get(k);
    if (line !== undefined) {
      nextLines.set(k, line);
    }
  }
  return { summary: nextSummary, firstLineByFingerprint: nextLines };
}
