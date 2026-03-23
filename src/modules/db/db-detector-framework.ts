/**
 * DB detector orchestration (plan **DB_15**). Extension-side / test harness only —
 * the webview embed mirrors merge + run ordering.
 */

import { buildDbFingerprintSummaryDiff } from "./db-fingerprint-summary";
import type {
  DbAnnotateLinePayload,
  DbDetectorContext,
  DbDetectorDefinition,
  DbDetectorResult,
  DbDetectorSessionState,
  DbFingerprintSummaryEntry,
} from "./db-detector-types";

/** Maps for `runDbDetectorsCompare` (keeps arity within lint max-params). */
export interface DbDetectorsCompareMaps {
  readonly baseline: ReadonlyMap<string, DbFingerprintSummaryEntry>;
  readonly target: ReadonlyMap<string, DbFingerprintSummaryEntry>;
}

/**
 * Merge detector output: same `stableKey` keeps the **last** result in iteration order.
 * Callers must concatenate results in ascending detector priority so higher priority wins.
 */
export function mergeDbDetectorResultsByStableKey(results: readonly DbDetectorResult[]): DbDetectorResult[] {
  const order: string[] = [];
  const byKey: Record<string, DbDetectorResult> = Object.create(null);
  for (const r of results) {
    if (!r?.stableKey) {
      continue;
    }
    if (byKey[r.stableKey] === undefined) {
      order.push(r.stableKey);
    }
    byKey[r.stableKey] = r;
  }
  return order.map((k) => byKey[k]);
}

function sortDetectors(defs: readonly DbDetectorDefinition[]): DbDetectorDefinition[] {
  return [...defs].sort((a, b) => a.priority - b.priority);
}

/**
 * Run all registered detectors (sorted by priority ascending), swallow errors per detector,
 * disable failing detectors until state is reset.
 */
export function runDbDetectorsIngest(
  registry: readonly DbDetectorDefinition[],
  ctx: DbDetectorContext,
  state: DbDetectorSessionState,
  options?: { readonly insightsEnabled?: boolean },
): DbDetectorResult[] {
  if (options?.insightsEnabled === false) {
    return [];
  }
  const collected: DbDetectorResult[] = [];
  for (const d of sortDetectors(registry)) {
    if (state.disabledDetectorIds.has(d.id)) {
      continue;
    }
    try {
      const chunk = d.feed(ctx);
      if (chunk?.length) {
        collected.push(...chunk);
      }
    } catch (e) {
      if (!state.loggedDetectorErrors.has(d.id)) {
        state.loggedDetectorErrors.add(d.id);
        console.warn(`[saropa] db detector disabled: ${d.id}`, e);
      }
      state.disabledDetectorIds.add(d.id);
    }
  }
  return mergeDbDetectorResultsByStableKey(collected);
}

/**
 * Batch compare pass (DB_10): runs optional `compare` hooks with a shared diff list.
 * Detectors without `compare` are skipped; merge rules match `runDbDetectorsIngest`.
 */
export function runDbDetectorsCompare(
  registry: readonly DbDetectorDefinition[],
  maps: DbDetectorsCompareMaps,
  state: DbDetectorSessionState,
  options?: { readonly insightsEnabled?: boolean },
): DbDetectorResult[] {
  if (options?.insightsEnabled === false) {
    return [];
  }
  const { baseline, target } = maps;
  const diff = buildDbFingerprintSummaryDiff(baseline, target);
  const input = { baseline, target, diff };
  const collected: DbDetectorResult[] = [];
  for (const d of sortDetectors(registry)) {
    if (!d.compare) {
      continue;
    }
    if (state.disabledDetectorIds.has(d.id)) {
      continue;
    }
    try {
      const chunk = d.compare(input);
      if (chunk?.length) {
        collected.push(...chunk);
      }
    } catch (e) {
      if (!state.loggedDetectorErrors.has(d.id)) {
        state.loggedDetectorErrors.add(d.id);
        console.warn(`[saropa] db detector compare disabled: ${d.id}`, e);
      }
      state.disabledDetectorIds.add(d.id);
    }
  }
  return mergeDbDetectorResultsByStableKey(collected);
}

export function createDbDetectorSessionState(): DbDetectorSessionState {
  return {
    disabledDetectorIds: new Set(),
    loggedDetectorErrors: new Set(),
  };
}

function isAnnotateLinePayload(p: unknown): p is DbAnnotateLinePayload {
  if (p === null || typeof p !== "object") {
    return false;
  }
  const o = p as DbAnnotateLinePayload;
  return (
    typeof o.targetSeq === "number" &&
    Number.isFinite(o.targetSeq) &&
    o.patch !== null &&
    typeof o.patch === "object"
  );
}

/**
 * Apply one **`annotate-line`** result to in-memory line rows (extension host, tests, or batch previews).
 * Matches embed **`applyDbAnnotateLineResult`** semantics: shallow merge, optional **`totalHeight`** delta via callback.
 *
 * @returns whether a row was found and patched
 */
export function applyDbAnnotateLineResultToLineItems<T extends { seq?: number; height?: number }>(
  lines: T[],
  result: DbDetectorResult,
  onHeightDelta?: (delta: number) => void,
): boolean {
  if (result.kind !== "annotate-line" || !isAnnotateLinePayload(result.payload)) {
    return false;
  }
  const { targetSeq, patch } = result.payload;
  const line = lines.find((x) => x.seq === targetSeq);
  if (!line) {
    return false;
  }
  const oldH = typeof line.height === "number" ? line.height : 0;
  const rec = line as Record<string, unknown>;
  for (const [key, val] of Object.entries(patch)) {
    rec[key] = val;
  }
  const newH = patch.height;
  if (typeof newH === "number" && Number.isFinite(newH) && newH !== oldH) {
    onHeightDelta?.(newH - oldH);
  }
  return true;
}

/** Apply every **`annotate-line`** in **`results`** (ignores other kinds). @returns count of successful patches */
export function applyDbAnnotateLineResultsToLineItems<T extends { seq?: number; height?: number }>(
  lines: T[],
  results: readonly DbDetectorResult[],
  onHeightDelta?: (delta: number) => void,
): number {
  let n = 0;
  for (const r of results) {
    if (applyDbAnnotateLineResultToLineItems(lines, r, onHeightDelta)) {
      n++;
    }
  }
  return n;
}
