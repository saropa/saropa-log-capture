/**
 * Scan Saropa log file text for Drift `Sent` SQL and compare fingerprint summaries between two sessions (plan **DB_10**).
 * Aligns with `DbFingerprintSummaryEntry` and `parseDriftSqlFingerprint` / DB_02 normalization.
 */

import { stripAnsi } from "../capture/ansi";
import { buildDbFingerprintSummaryDiff, buildDbFingerprintSummaryFromDetectorContexts } from "./db-fingerprint-summary";
import type {
  DbDetectorContext,
  DbFingerprintSummaryDiffRow,
  DbFingerprintSummaryEntry,
} from "./db-detector-types";
import { parseDriftSqlFingerprint } from "./drift-n-plus-one-detector";
import { ROOT_CAUSE_FP_LEADER_MIN_COUNT } from "../root-cause-hints/root-cause-hint-eligibility";

/** Same token grammar as `viewer-file-loader.ts` `parseElapsedToMs` — keep in sync. */
function parseElapsedToken(elapsedStr: string): number | undefined {
  const m = /^\+(\d+(?:\.\d+)?)(ms|s)$/.exec(elapsedStr);
  if (!m) {
    return undefined;
  }
  const val = Number.parseFloat(m[1]);
  if (!Number.isFinite(val) || val < 0) {
    return undefined;
  }
  return m[2] === "s" ? Math.round(val * 1000) : Math.round(val);
}

/**
 * Extract replay elapsed from Saropa bracketed lines when present (`[+Nms]` / `[+Ns]`).
 * Mirrors `parseFileLine` patterns in `viewer-file-loader.ts`.
 */
export function elapsedMsFromSaropaRawLine(raw: string): number | undefined {
  const timeElapsedCat = /^\[([\d:.]+)\]\s*\[(\+\d+(?:\.\d+)?(?:ms|s))\]\s*\[([\w-]+)\]\s?(.*)$/.exec(raw);
  if (timeElapsedCat) {
    return parseElapsedToken(timeElapsedCat[2]);
  }
  const elapsedCat = /^\[(\+\d+(?:\.\d+)?(?:ms|s))\]\s*\[([\w-]+)\]\s?(.*)$/.exec(raw);
  if (elapsedCat) {
    return parseElapsedToken(elapsedCat[1]);
  }
  return undefined;
}

/** Match `findHeaderEnd` in `viewer-file-loader.ts` — skip metadata before the `===` divider. */
export function saropaLogBodyLineStartIndex(lines: readonly string[]): number {
  const limit = Math.min(lines.length, 50);
  for (let i = 0; i < limit; i++) {
    if (/^={10,}$/.test(lines[i].trim())) {
      const next = i + 1;
      if (next < lines.length && lines[next].trim() === "") {
        return next + 1;
      }
      return next;
    }
  }
  return 0;
}

function rawLineToDbDetectorContext(raw: string, seq: number): DbDetectorContext | null {
  const plain = stripAnsi(raw).trim();
  const parsed = parseDriftSqlFingerprint(plain);
  if (!parsed) {
    return null;
  }
  return {
    timestampMs: seq,
    sessionId: null,
    sourceTag: "database",
    level: "info",
    plainText: plain,
    durationMs: elapsedMsFromSaropaRawLine(raw),
    sql: {
      fingerprint: parsed.fingerprint,
      argsKey: parsed.argsKey,
      sqlSnippet: parsed.sqlSnippet,
    },
  };
}

export interface SaropaLogDbFingerprintScanResult {
  readonly summary: Map<string, DbFingerprintSummaryEntry>;
  /** Physical 0-based line index in `content.split(/\r?\n/)` for first `Drift: Sent` hit per fingerprint. */
  readonly firstLineByFingerprint: Map<string, number>;
}

export interface ScanSaropaLogDatabaseFingerprintsOptions {
  /** When set, `DbFingerprintSummaryEntry.slowQueryCount` uses the same threshold as slow-burst markers. */
  readonly slowQueryMs?: number;
}

/**
 * Full scan: summary stats plus first physical line index per fingerprint (jump-to-line / persistence).
 */
export function scanSaropaLogDatabaseFingerprints(
  content: string,
  opts?: ScanSaropaLogDatabaseFingerprintsOptions,
): SaropaLogDbFingerprintScanResult {
  const lines = content.split(/\r?\n/);
  const start = saropaLogBodyLineStartIndex(lines);
  const contexts: DbDetectorContext[] = [];
  const firstLineByFingerprint = new Map<string, number>();
  let seq = 0;
  for (let i = start; i < lines.length; i++) {
    const ctx = rawLineToDbDetectorContext(lines[i], seq++);
    if (ctx?.sql) {
      const fp = ctx.sql.fingerprint;
      if (!firstLineByFingerprint.has(fp)) {
        firstLineByFingerprint.set(fp, i);
      }
      contexts.push(ctx);
    }
  }
  const accOpts =
    typeof opts?.slowQueryMs === "number" && opts.slowQueryMs > 0
      ? { slowQueryMsThreshold: opts.slowQueryMs }
      : undefined;
  return {
    summary: buildDbFingerprintSummaryFromDetectorContexts(contexts, accOpts),
    firstLineByFingerprint,
  };
}

/** Build fingerprint counts (and optional durations) from full log file UTF-8 text. */
export function buildDbFingerprintSummaryFromSaropaLogFileContent(content: string): Map<string, DbFingerprintSummaryEntry> {
  return scanSaropaLogDatabaseFingerprints(content).summary;
}

/** Resolve first line for a normalized fingerprint (re-scan; use metadata hint when possible). */
export function findFirstPhysicalLineForDriftFingerprintInLog(content: string, fingerprint: string): number | undefined {
  return scanSaropaLogDatabaseFingerprints(content).firstLineByFingerprint.get(fingerprint);
}

function sumStatementCounts(map: ReadonlyMap<string, DbFingerprintSummaryEntry>): number {
  let n = 0;
  for (const e of map.values()) {
    n += e.count;
  }
  return n;
}

export type SessionDbFingerprintChangeKind = "new" | "removed" | "more" | "fewer" | "same";

export interface SessionDbFingerprintDiffRow {
  readonly fingerprint: string;
  readonly kind: SessionDbFingerprintChangeKind;
  readonly countA: number;
  readonly countB: number;
  readonly countDelta: number;
  readonly avgA?: number;
  readonly avgB?: number;
  readonly avgDeltaMs?: number;
  readonly slowA?: number;
  readonly slowB?: number;
  readonly slowDelta?: number;
}

function interestScore(r: SessionDbFingerprintDiffRow): number {
  const ad = r.avgDeltaMs !== undefined && r.avgDeltaMs > 0 ? r.avgDeltaMs : 0;
  switch (r.kind) {
    case "new":
      return 10_000 + r.countB * 10 + ad;
    case "removed":
      return 8_000 + r.countA * 10;
    case "more":
      return 5_000 + r.countDelta * 15 + ad;
    case "fewer":
      return 2_000 + Math.abs(r.countDelta);
    case "same":
      return 500 + ad * 2;
    default:
      return 0;
  }
}

/** One union row from `buildDbFingerprintSummaryDiff` → session compare row (counts, avg, slow). */
function sessionDbFingerprintRowFromDiff(d: DbFingerprintSummaryDiffRow): SessionDbFingerprintDiffRow | null {
  const b = d.baseline;
  const t = d.target;
  if (!b && !t) {
    return null;
  }
  const countA = b?.count ?? 0;
  const countB = t?.count ?? 0;
  const countDelta = countB - countA;
  let kind: SessionDbFingerprintChangeKind;
  if (!b) {
    kind = "new";
  } else if (!t) {
    kind = "removed";
  } else if (countDelta > 0) {
    kind = "more";
  } else if (countDelta < 0) {
    kind = "fewer";
  } else {
    kind = "same";
  }
  const avgA = b?.avgDurationMs;
  const avgB = t?.avgDurationMs;
  let avgDeltaMs: number | undefined;
  if (avgA !== undefined && avgB !== undefined) {
    avgDeltaMs = avgB - avgA;
  }
  const slowCountA = b?.slowQueryCount;
  const slowCountB = t?.slowQueryCount;
  const slowA =
    typeof slowCountA === "number" && slowCountA > 0 ? slowCountA : undefined;
  const slowB =
    typeof slowCountB === "number" && slowCountB > 0 ? slowCountB : undefined;
  // Delta uses 0 when a side omitted slow stats (no duration tokens or no threshold scan).
  let slowDelta: number | undefined;
  if (slowA !== undefined || slowB !== undefined) {
    slowDelta = (slowCountB ?? 0) - (slowCountA ?? 0);
  }
  return {
    fingerprint: d.fingerprint,
    kind,
    countA,
    countB,
    countDelta,
    avgA,
    avgB,
    avgDeltaMs,
    slowA,
    slowB,
    slowDelta,
  };
}

/**
 * Classify each fingerprint in the union of A/B and sort with regressions (more queries, higher avg) first.
 */
export function rankSessionDbFingerprintChanges(
  baseline: ReadonlyMap<string, DbFingerprintSummaryEntry>,
  target: ReadonlyMap<string, DbFingerprintSummaryEntry>,
): SessionDbFingerprintDiffRow[] {
  const diff = buildDbFingerprintSummaryDiff(baseline, target);
  const rows: SessionDbFingerprintDiffRow[] = [];
  for (const d of diff) {
    const row = sessionDbFingerprintRowFromDiff(d);
    if (row) {
      rows.push(row);
    }
  }
  rows.sort((a, b) => interestScore(b) - interestScore(a));
  return rows;
}

const RCH_SESSION_DIFF_MAX_FP = 8;

/**
 * Fingerprints to surface as session-compare regression hypotheses in the log viewer (DB_14).
 * Aligns with `collectSessionDiffRegressionFpsEmbedded` thresholds: "new" needs leader-scale volume;
 * "more" needs a relative jump vs baseline A.
 */
export function regressionFingerprintsForRootCauseHints(
  baseline: ReadonlyMap<string, DbFingerprintSummaryEntry>,
  target: ReadonlyMap<string, DbFingerprintSummaryEntry>,
): string[] {
  const ranked = rankSessionDbFingerprintChanges(baseline, target);
  const out: string[] = [];
  for (const r of ranked) {
    if (r.kind === "new") {
      if (r.countB >= ROOT_CAUSE_FP_LEADER_MIN_COUNT) {
        out.push(r.fingerprint);
      }
    } else if (r.kind === "more") {
      const baseC = r.countA;
      const curC = r.countB;
      if (baseC > 0 && curC - baseC >= Math.max(3, Math.floor(baseC * 0.25))) {
        out.push(r.fingerprint);
      }
    }
    if (out.length >= RCH_SESSION_DIFF_MAX_FP) {
      break;
    }
  }
  return out;
}

export interface SessionDbFingerprintCompareResult {
  readonly totalStatementsA: number;
  readonly totalStatementsB: number;
  readonly distinctFingerprintsA: number;
  readonly distinctFingerprintsB: number;
  /** Sorted by interest (regressions first); UI may truncate. */
  readonly rows: readonly SessionDbFingerprintDiffRow[];
  readonly hasDriftSql: boolean;
  /** True when any row has slow-query counts (requires duration tokens in logs + scan threshold). */
  readonly hasSlowQueryStats: boolean;
  readonly firstLineByFingerprintA: ReadonlyMap<string, number>;
  readonly firstLineByFingerprintB: ReadonlyMap<string, number>;
}

/** Build compare view model from two pre-scanned bodies (one scan per file on the host). */
export function compareScannedSaropaDbFingerprints(
  scanA: SaropaLogDbFingerprintScanResult,
  scanB: SaropaLogDbFingerprintScanResult,
): SessionDbFingerprintCompareResult {
  const mapA = scanA.summary;
  const mapB = scanB.summary;
  const rows = rankSessionDbFingerprintChanges(mapA, mapB);
  const totalStatementsA = sumStatementCounts(mapA);
  const totalStatementsB = sumStatementCounts(mapB);
  const hasSlowQueryStats = rows.some((r) => r.slowA !== undefined || r.slowB !== undefined);
  return {
    totalStatementsA,
    totalStatementsB,
    distinctFingerprintsA: mapA.size,
    distinctFingerprintsB: mapB.size,
    rows,
    hasDriftSql: totalStatementsA + totalStatementsB > 0,
    hasSlowQueryStats,
    firstLineByFingerprintA: scanA.firstLineByFingerprint,
    firstLineByFingerprintB: scanB.firstLineByFingerprint,
  };
}

/** Session A = first file (baseline), session B = second file (target). */
export function compareSaropaLogDatabaseFingerprints(textA: string, textB: string): SessionDbFingerprintCompareResult {
  return compareScannedSaropaDbFingerprints(
    scanSaropaLogDatabaseFingerprints(textA),
    scanSaropaLogDatabaseFingerprints(textB),
  );
}

/** Max rows to render in the session comparison webview (keeps HTML small). */
export const SESSION_DB_FP_COMPARE_MAX_ROWS = 60;
