/**
 * DB detector orchestration (plan **DB_15**). Used by the extension host (session compare, tests) and mirrored
 * in the webview embed for streaming ingest.
 */

import { buildDbFingerprintSummaryDiff } from "./db-fingerprint-summary";
import { createBaselineVolumeCompareDetector } from "./drift-db-baseline-volume-compare-detector";
import { mergeDbDetectorResultsByStableKey } from "./db-detector-merge-stable-key";
import type {
  DbAnnotateLinePayload,
  DbDetectorContext,
  DbDetectorDefinition,
  DbDetectorResult,
  DbDetectorSessionState,
  DbFingerprintSummaryEntry,
} from "./db-detector-types";

export { mergeDbDetectorResultsByStableKey };

/** Maps for `runDbDetectorsCompare` (keeps arity within lint max-params). */
export interface DbDetectorsCompareMaps {
  readonly baseline: ReadonlyMap<string, DbFingerprintSummaryEntry>;
  readonly target: ReadonlyMap<string, DbFingerprintSummaryEntry>;
}

/** Mutable rows (e.g. preview lines with `seq`) that may receive **`annotate-line`** patches from compare output. */
export type DbAnnotateTargetLineRow = { seq?: number; height?: number } & Record<string, unknown>;

export interface RunDbDetectorsCompareOptions {
  readonly signalsEnabled?: boolean;
  /** When set, applies **`annotate-line`** entries in the merged compare results (same phase order as embed rollup phase). */
  readonly annotateTargetLines?: DbAnnotateTargetLineRow[];
  readonly onAnnotateHeightDelta?: (delta: number) => void;
}

/** Default registry for log comparison: baseline volume markers (`createBaselineVolumeCompareDetector`). */
export const DEFAULT_SESSION_DB_COMPARE_REGISTRY: readonly DbDetectorDefinition[] = [
  createBaselineVolumeCompareDetector(),
];

/** Run **`DEFAULT_SESSION_DB_COMPARE_REGISTRY`** (session compare panel / `compareLogSessionsWithDbFingerprints`). */
export function runDefaultSessionDbCompareDetectors(
  maps: DbDetectorsCompareMaps,
  state: DbDetectorSessionState,
  options?: RunDbDetectorsCompareOptions,
): DbDetectorResult[] {
  return runDbDetectorsCompare(DEFAULT_SESSION_DB_COMPARE_REGISTRY, maps, state, options);
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
  options?: { readonly signalsEnabled?: boolean },
): DbDetectorResult[] {
  if (options?.signalsEnabled === false) {
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
  options?: RunDbDetectorsCompareOptions,
): DbDetectorResult[] {
  if (options?.signalsEnabled === false) {
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
  const merged = mergeDbDetectorResultsByStableKey(collected);
  const lines = options?.annotateTargetLines;
  if (lines !== undefined && lines.length > 0) {
    applyDbAnnotateLineResultsToLineItems(lines, merged, options?.onAnnotateHeightDelta);
  }
  return merged;
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
