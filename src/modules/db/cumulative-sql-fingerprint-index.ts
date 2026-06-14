/**
 * Persisted, incrementally-maintained index of Drift SQL fingerprints across ALL sidebar logs
 * (plan **DB_18**). Replaces DB_17's per-load O(N-files) rescan: the index is read as ONE file on
 * log-load and updated by ONE merge at each session finalize.
 *
 * Pure module — no `vscode` / fs. The store (`cumulative-sql-fingerprint-index-store.ts`) owns I/O;
 * the refresh (`cumulative-sql-fingerprint-refresh.ts`) wires read → exclude-active → broadcast.
 *
 * Active-log exclusion: the index is active-agnostic (every log with a summary contributes). The
 * refresh subtracts the active log's own persisted summary before broadcasting, so the live webview
 * rollup (which already covers the active log) is not double-counted. The webview's `liveSeen` filter
 * is a second guard, so fingerprints present in the active log are never rendered as cross-log rows.
 */

import {
  aggregateCumulativeSqlFingerprints,
  type CumulativeSqlFingerprintEntry,
  type CumulativeSqlFingerprintPayload,
  type MetaUriResolver,
} from "./cumulative-sql-fingerprint-aggregator";
import type { LoadedMeta } from "../session/metadata-loader";
import {
  isPersistedDriftSqlFingerprintSummaryV1,
  type PersistedDriftSqlFingerprintEntryV1,
  type PersistedDriftSqlFingerprintSummaryV1,
} from "./drift-sql-fingerprint-summary-persist";

export const CUMULATIVE_SQL_INDEX_SCHEMA_VERSION = 1 as const;

/** On-disk shape of `.saropa/cumulative-sql-index.json`. Validate `schemaVersion` on read. */
export interface CumulativeSqlFingerprintIndexV1 {
  readonly schemaVersion: typeof CUMULATIVE_SQL_INDEX_SCHEMA_VERSION;
  /** Relative log filenames already folded in. Membership gates incremental merge (no double-count). */
  readonly contributingLogs: readonly string[];
  /** Fingerprint → aggregate across every contributing log. */
  readonly fingerprints: Record<string, CumulativeSqlFingerprintEntry>;
}

export function isCumulativeSqlFingerprintIndexV1(v: unknown): v is CumulativeSqlFingerprintIndexV1 {
  if (!v || typeof v !== "object") {
    return false;
  }
  const o = v as Record<string, unknown>;
  if (o.schemaVersion !== CUMULATIVE_SQL_INDEX_SCHEMA_VERSION || !Array.isArray(o.contributingLogs)) {
    return false;
  }
  // Arrays are typeof "object"; reject them so malformed JSON does not pass as a record map.
  return !!o.fingerprints && typeof o.fingerprints === "object" && !Array.isArray(o.fingerprints);
}

/** Empty index — the merge seed and the missing-file fallback before a rebuild. */
export function emptyCumulativeSqlFingerprintIndex(): CumulativeSqlFingerprintIndexV1 {
  return { schemaVersion: CUMULATIVE_SQL_INDEX_SCHEMA_VERSION, contributingLogs: [], fingerprints: {} };
}

/** True when a loaded meta carries a valid, non-empty persisted fingerprint summary. */
function hasUsableSummary(m: LoadedMeta): boolean {
  const s = m.meta.driftSqlFingerprintSummary;
  return !!s && isPersistedDriftSqlFingerprintSummaryV1(s) && Object.keys(s.fingerprints).length > 0;
}

/**
 * Full rebuild from already-loaded metadata (cold path: index missing / corrupt / a contributing
 * log was deleted). Reuses the active-agnostic aggregator so merge math stays in one place.
 */
export function buildCumulativeSqlFingerprintIndex(
  metas: readonly LoadedMeta[],
  resolver: MetaUriResolver,
): CumulativeSqlFingerprintIndexV1 {
  const agg = aggregateCumulativeSqlFingerprints(metas, resolver, undefined);
  return {
    schemaVersion: CUMULATIVE_SQL_INDEX_SCHEMA_VERSION,
    contributingLogs: metas.filter(hasUsableSummary).map((m) => m.filename),
    fingerprints: agg.fingerprints,
  };
}

/** Max of two optionally-undefined numbers, or undefined when both are absent. */
function maxDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) {
    return b;
  }
  return b === undefined ? a : Math.max(a, b);
}

/** Fold one fingerprint entry from a newly-finalized (newest) log into its prior aggregate. */
function mergeOneEntry(
  prev: CumulativeSqlFingerprintEntry | undefined,
  e: PersistedDriftSqlFingerprintEntryV1,
  logUriString: string,
  firstLine: number | undefined,
): CumulativeSqlFingerprintEntry {
  const maxDur = maxDefined(prev?.maxDurationMs, e.maxDurationMs);
  const slow = (prev?.slowQueryCount ?? 0) + (e.slowQueryCount ?? 0);
  return {
    count: (prev?.count ?? 0) + e.count,
    logCount: (prev?.logCount ?? 0) + 1,
    // Newest log wins firstSource so cross-log jumps land on the most recent occurrence.
    firstSourceUriString: logUriString,
    ...(maxDur !== undefined ? { maxDurationMs: maxDur } : {}),
    ...(slow > 0 ? { slowQueryCount: slow } : {}),
    ...(firstLine !== undefined ? { firstSourceLine: firstLine } : {}),
  };
}

/**
 * Fold one just-finalized log's persisted summary into the index (incremental finalize hook).
 * Idempotent on `filename` — re-finalizing the same log returns the input unchanged, so counts
 * never double. The finalized log is the NEWEST, so it WINS firstSource attribution for its
 * fingerprints (matches the rebuild path's newest-first ordering).
 */
export function mergeSummaryIntoCumulativeSqlFingerprintIndex(
  index: CumulativeSqlFingerprintIndexV1,
  filename: string,
  summary: PersistedDriftSqlFingerprintSummaryV1,
  logUriString: string,
): CumulativeSqlFingerprintIndexV1 {
  const entries = Object.entries(summary.fingerprints);
  if (index.contributingLogs.includes(filename) || entries.length === 0) {
    return index;
  }
  const next: Record<string, CumulativeSqlFingerprintEntry> = { ...index.fingerprints };
  const firstLines = summary.firstOccurrenceLineByFingerprint ?? {};
  for (const [fp, e] of entries) {
    next[fp] = mergeOneEntry(next[fp], e, logUriString, firstLines[fp]);
  }
  return {
    schemaVersion: CUMULATIVE_SQL_INDEX_SCHEMA_VERSION,
    contributingLogs: [...index.contributingLogs, filename],
    fingerprints: next,
  };
}

/**
 * Subtract the active log's contribution from one aggregate row. Returns null when the active log
 * was the only / dominant contributor (count or logCount drops to zero) so the row disappears.
 * `firstSourceUriString` is left as-is: if it points at the now-excluded active log, the webview's
 * `liveSeen` filter drops that fingerprint anyway (it is in the active log's live rollup).
 */
function subtractEntry(
  entry: CumulativeSqlFingerprintEntry,
  active: PersistedDriftSqlFingerprintEntryV1,
): CumulativeSqlFingerprintEntry | null {
  const count = entry.count - active.count;
  const logCount = entry.logCount - 1;
  if (count <= 0 || logCount <= 0) {
    return null;
  }
  // slowQueryCount IS subtractable (a sum). When the aggregate has none, no log reported slow queries
  // — so the active log contributed none either, and there is nothing to subtract.
  const slow = entry.slowQueryCount !== undefined
    ? entry.slowQueryCount - (active.slowQueryCount ?? 0)
    : undefined;
  return {
    count,
    logCount,
    firstSourceUriString: entry.firstSourceUriString,
    // maxDurationMs is passed through UNCHANGED: a max can't be subtracted without per-log history,
    // so the surviving value is an upper bound that may still reflect the excluded active log. See the
    // field doc on CumulativeSqlFingerprintEntry.maxDurationMs.
    ...(entry.maxDurationMs !== undefined ? { maxDurationMs: entry.maxDurationMs } : {}),
    ...(slow !== undefined && slow > 0 ? { slowQueryCount: slow } : {}),
    ...(entry.firstSourceLine !== undefined ? { firstSourceLine: entry.firstSourceLine } : {}),
  };
}

/**
 * Build the broadcast payload from the index, excluding the active log's own contribution so the
 * live webview rollup is not double-counted. `activeSummary` is the active log's persisted summary
 * (often absent for a still-streaming session — then nothing is subtracted). `totalLogFileCount`
 * feeds `missingSummaryLogCount` for the re-scan hint without reading every metadata file.
 */
export function indexToPayloadExcludingActive(
  index: CumulativeSqlFingerprintIndexV1,
  activeFilename: string | undefined,
  activeSummary: PersistedDriftSqlFingerprintSummaryV1 | undefined,
  totalLogFileCount: number,
): CumulativeSqlFingerprintPayload {
  const excludesActive = !!activeFilename
    && index.contributingLogs.includes(activeFilename)
    && !!activeSummary;
  const subtract = excludesActive ? activeSummary.fingerprints : null;
  const fingerprints: Record<string, CumulativeSqlFingerprintEntry> = {};
  for (const [fp, entry] of Object.entries(index.fingerprints)) {
    const adjusted = subtract && subtract[fp] ? subtractEntry(entry, subtract[fp]) : entry;
    if (adjusted) {
      fingerprints[fp] = adjusted;
    }
  }
  return {
    contributingLogCount: Math.max(0, index.contributingLogs.length - (excludesActive ? 1 : 0)),
    missingSummaryLogCount: Math.max(0, totalLogFileCount - index.contributingLogs.length),
    fingerprints,
  };
}
