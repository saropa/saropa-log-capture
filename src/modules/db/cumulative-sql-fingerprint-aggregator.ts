/**
 * Cumulative Drift SQL fingerprint aggregator (plan **DB_17 Step 1**).
 *
 * Merges every sidebar log's persisted `driftSqlFingerprintSummary` into a single
 * map keyed by fingerprint. The active log is **excluded by URI** so the webview
 * can layer it on top of the live `sqlQueryHistoryByFp` rollup without double-counting.
 *
 * Pure function: takes already-loaded metadata, performs no I/O. Callers that
 * need to read metadata from disk should use `loadFilteredMetas()` first.
 */

import type { LoadedMeta } from "../session/metadata-loader";
import {
  isPersistedDriftSqlFingerprintSummaryV1,
  type PersistedDriftSqlFingerprintEntryV1,
} from "./drift-sql-fingerprint-summary-persist";

/** Aggregate row sent to the webview as part of `setCumulativeSqlFingerprintSummary`. */
export interface CumulativeSqlFingerprintEntry {
  /** Sum of `count` across contributing logs. */
  readonly count: number;
  /**
   * Max `maxDurationMs` across contributing logs (undefined when no log reported a duration).
   * NOTE: a maximum is not subtractable. When the active log's contribution is excluded
   * (`indexToPayloadExcludingActive` → `subtractEntry`), this value is passed through unchanged, so
   * it is an UPPER BOUND that may still reflect the excluded log — recomputing it would require the
   * per-log max history, which the index does not retain.
   */
  readonly maxDurationMs?: number;
  /** Sum of `slowQueryCount` across contributing logs (omitted when zero). */
  readonly slowQueryCount?: number;
  /** Number of distinct sidebar logs that contributed to this fingerprint. */
  readonly logCount: number;
  /** First log to carry this fingerprint (by sort order of input metas) — used for cross-log jumps. */
  readonly firstSourceUriString: string;
  /** Physical 0-based line in `firstSourceUriString` where the fingerprint first appears (when persisted). */
  readonly firstSourceLine?: number;
}

/** Payload shape for the `setCumulativeSqlFingerprintSummary` webview message. */
export interface CumulativeSqlFingerprintPayload {
  /** Number of sidebar logs that contributed (excludes the active log). */
  readonly contributingLogCount: number;
  /** Number of sidebar logs scanned that lacked a persisted summary — surface as a re-scan hint. */
  readonly missingSummaryLogCount: number;
  /** Fingerprint → aggregate row. */
  readonly fingerprints: Record<string, CumulativeSqlFingerprintEntry>;
}

/** Resolve a `LoadedMeta.filename` (relative path) to its absolute log URI string for cross-log jumps. */
export interface MetaUriResolver {
  resolveLogUriString(filename: string): string;
}

/** True when the `LoadedMeta` represents the currently displayed log (compare normalized URI strings). */
function isActiveLog(activeUriString: string | undefined, loadedUriString: string): boolean {
  if (!activeUriString) {
    return false;
  }
  return activeUriString === loadedUriString;
}

/** Mutating merge of one persisted entry into the aggregate row. Caller owns `target`. */
function mergeEntryInto(
  target: { count: number; maxDurationMs?: number; slowQueryCount?: number; logCount: number },
  entry: PersistedDriftSqlFingerprintEntryV1,
): void {
  target.count += entry.count;
  target.logCount += 1;
  if (typeof entry.maxDurationMs === "number" && isFinite(entry.maxDurationMs)) {
    if (target.maxDurationMs === undefined || entry.maxDurationMs > target.maxDurationMs) {
      target.maxDurationMs = entry.maxDurationMs;
    }
  }
  if (typeof entry.slowQueryCount === "number" && entry.slowQueryCount > 0) {
    target.slowQueryCount = (target.slowQueryCount ?? 0) + entry.slowQueryCount;
  }
}

/**
 * Aggregate persisted Drift SQL fingerprint summaries across `metas`, excluding the active log URI.
 *
 * `metas` ordering matters for tie-breaking: the FIRST log to contribute a fingerprint becomes
 * `firstSourceUriString`. Sort `metas` by recency (newest first) before calling so cross-log jumps
 * land on the most relevant occurrence.
 */
export function aggregateCumulativeSqlFingerprints(
  metas: readonly LoadedMeta[],
  resolver: MetaUriResolver,
  activeUriString: string | undefined,
): CumulativeSqlFingerprintPayload {
  const fingerprints: Record<string, {
    count: number;
    maxDurationMs?: number;
    slowQueryCount?: number;
    logCount: number;
    firstSourceUriString: string;
    firstSourceLine?: number;
  }> = Object.create(null);
  let contributingLogCount = 0;
  let missingSummaryLogCount = 0;
  for (const m of metas) {
    const uriString = resolver.resolveLogUriString(m.filename);
    if (isActiveLog(activeUriString, uriString)) {
      continue;
    }
    const summary = m.meta.driftSqlFingerprintSummary;
    if (!summary || !isPersistedDriftSqlFingerprintSummaryV1(summary)) {
      missingSummaryLogCount += 1;
      continue;
    }
    const entries = Object.entries(summary.fingerprints);
    if (entries.length === 0) {
      continue;
    }
    contributingLogCount += 1;
    const firstLines = summary.firstOccurrenceLineByFingerprint ?? {};
    for (const [fp, entry] of entries) {
      let row = fingerprints[fp];
      if (!row) {
        row = {
          count: 0,
          logCount: 0,
          firstSourceUriString: uriString,
          ...(typeof firstLines[fp] === "number" ? { firstSourceLine: firstLines[fp] } : {}),
        };
        fingerprints[fp] = row;
      }
      mergeEntryInto(row, entry);
    }
  }
  const out: Record<string, CumulativeSqlFingerprintEntry> = Object.create(null);
  for (const [fp, row] of Object.entries(fingerprints)) {
    out[fp] = {
      count: row.count,
      logCount: row.logCount,
      firstSourceUriString: row.firstSourceUriString,
      ...(row.maxDurationMs !== undefined ? { maxDurationMs: row.maxDurationMs } : {}),
      ...(row.slowQueryCount !== undefined && row.slowQueryCount > 0 ? { slowQueryCount: row.slowQueryCount } : {}),
      ...(row.firstSourceLine !== undefined ? { firstSourceLine: row.firstSourceLine } : {}),
    };
  }
  return { contributingLogCount, missingSummaryLogCount, fingerprints: out };
}
