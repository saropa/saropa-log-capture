/**
 * Shared fingerprint summary and diff math for DB_15 session compare / DB_10 (batch only).
 * Extension host and tests; webview compare entry point can mirror or call host later.
 */

import type {
  DbDetectorContext,
  DbFingerprintSummaryDiffRow,
  DbFingerprintSummaryEntry,
} from "./db-detector-types";

type SummaryAcc = {
  count: number;
  sumMs: number;
  durationSamples: number;
  maxMs: number;
  slowQueryCount: number;
};

function finalizeAcc(acc: SummaryAcc): DbFingerprintSummaryEntry {
  const base: DbFingerprintSummaryEntry =
    acc.durationSamples <= 0
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

export interface AccumulateFingerprintSummaryOptions {
  /** Count toward `slowQueryCount` when `durationMs` is defined and >= this value. */
  readonly slowQueryMsThreshold?: number;
}

/** Fold one ingest context into a mutable accumulator (Drift SQL rows only). */
export function accumulateDbDetectorContextForFingerprintSummary(
  acc: Map<string, SummaryAcc>,
  ctx: DbDetectorContext,
  opts?: AccumulateFingerprintSummaryOptions,
): void {
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

export function finalizeDbFingerprintSummaryMap(
  acc: ReadonlyMap<string, SummaryAcc>,
): Map<string, DbFingerprintSummaryEntry> {
  const out = new Map<string, DbFingerprintSummaryEntry>();
  for (const [k, v] of acc) {
    out.set(k, finalizeAcc(v));
  }
  return out;
}

/** Build a summary map from a batch of detector contexts (e.g. one session tail). */
export function buildDbFingerprintSummaryFromDetectorContexts(
  contexts: readonly DbDetectorContext[],
  opts?: AccumulateFingerprintSummaryOptions,
): Map<string, DbFingerprintSummaryEntry> {
  const acc = new Map<string, SummaryAcc>();
  for (const ctx of contexts) {
    accumulateDbDetectorContextForFingerprintSummary(acc, ctx, opts);
  }
  return finalizeDbFingerprintSummaryMap(acc);
}

/**
 * Merge two summaries (e.g. chunked loads). Weighted avg uses `durationSampleCount` when present;
 * entries without samples merge by count and max only.
 */
export function mergeDbFingerprintSummaryEntries(
  a: DbFingerprintSummaryEntry,
  b: DbFingerprintSummaryEntry,
): DbFingerprintSummaryEntry {
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
  const merged: DbFingerprintSummaryEntry = {
    count,
    avgDurationMs: (sum1 + sum2) / n,
    maxDurationMs: hasMax ? maxMs : undefined,
    durationSampleCount: n,
  };
  return slowSum > 0 ? { ...merged, slowQueryCount: slowSum } : merged;
}

export function mergeDbFingerprintSummaryMaps(
  a: ReadonlyMap<string, DbFingerprintSummaryEntry>,
  b: ReadonlyMap<string, DbFingerprintSummaryEntry>,
): Map<string, DbFingerprintSummaryEntry> {
  const out = new Map<string, DbFingerprintSummaryEntry>();
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
export function buildDbFingerprintSummaryDiff(
  baseline: ReadonlyMap<string, DbFingerprintSummaryEntry>,
  target: ReadonlyMap<string, DbFingerprintSummaryEntry>,
): DbFingerprintSummaryDiffRow[] {
  const keys = new Set<string>();
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
