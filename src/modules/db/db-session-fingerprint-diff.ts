/**
 * Scan Saropa log file text for Drift `Sent` SQL and compare fingerprint summaries between two sessions (plan **DB_10**).
 * Aligns with `DbFingerprintSummaryEntry` and `parseDriftSqlFingerprint` / DB_02 normalization.
 */

import { stripAnsi } from "../capture/ansi";
import { buildDbFingerprintSummaryDiff, buildDbFingerprintSummaryFromDetectorContexts } from "./db-fingerprint-summary";
import type { DbDetectorContext, DbFingerprintSummaryEntry } from "./db-detector-types";
import { parseDriftSqlFingerprint } from "./drift-n-plus-one-detector";

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

/**
 * Full scan: summary stats plus first physical line index per fingerprint (jump-to-line / persistence).
 */
export function scanSaropaLogDatabaseFingerprints(content: string): SaropaLogDbFingerprintScanResult {
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
  return {
    summary: buildDbFingerprintSummaryFromDetectorContexts(contexts),
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
    const b = d.baseline;
    const t = d.target;
    if (!b && !t) {
      continue;
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
    rows.push({ fingerprint: d.fingerprint, kind, countA, countB, countDelta, avgA, avgB, avgDeltaMs });
  }
  rows.sort((a, b) => interestScore(b) - interestScore(a));
  return rows;
}

export interface SessionDbFingerprintCompareResult {
  readonly totalStatementsA: number;
  readonly totalStatementsB: number;
  readonly distinctFingerprintsA: number;
  readonly distinctFingerprintsB: number;
  /** Sorted by interest (regressions first); UI may truncate. */
  readonly rows: readonly SessionDbFingerprintDiffRow[];
  readonly hasDriftSql: boolean;
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
  return {
    totalStatementsA,
    totalStatementsB,
    distinctFingerprintsA: mapA.size,
    distinctFingerprintsB: mapB.size,
    rows,
    hasDriftSql: totalStatementsA + totalStatementsB > 0,
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
