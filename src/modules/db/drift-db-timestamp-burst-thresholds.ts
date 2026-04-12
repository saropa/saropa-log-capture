/**
 * Thresholds for the DB timestamp burst detector (plan **DB_16**).
 *
 * Fires when multiple DB-classified lines share the same timestamp (within tolerance),
 * indicating redundant or unnecessarily concurrent database access.
 */

export interface ViewerTimestampBurstThresholds {
  /** Minimum DB lines at the same instant to trigger a marker. */
  readonly minCount: number;
  /** Max ms difference to consider two timestamps "the same instant". */
  readonly toleranceMs: number;
  /** Suppress duplicate markers within this window (ms). */
  readonly cooldownMs: number;
}

export const VIEWER_TIMESTAMP_BURST_DEFAULTS: ViewerTimestampBurstThresholds = {
  minCount: 3,
  toleranceMs: 10,
  cooldownMs: 5000,
};

const CLAMP_MIN_COUNT: [number, number] = [2, 50];
const CLAMP_TOLERANCE: [number, number] = [0, 100];
const CLAMP_COOLDOWN: [number, number] = [0, 60_000];

function clamp(val: number, [lo, hi]: [number, number]): number {
  return Math.max(lo, Math.min(hi, val));
}

/** Validate and clamp partial input; missing fields use defaults. */
export function normalizeViewerTimestampBurstThresholds(
  partial?: Partial<ViewerTimestampBurstThresholds>,
): ViewerTimestampBurstThresholds {
  const d = VIEWER_TIMESTAMP_BURST_DEFAULTS;
  if (!partial) {
    return d;
  }
  const minCount = typeof partial.minCount === "number" && Number.isFinite(partial.minCount)
    ? clamp(Math.round(partial.minCount), CLAMP_MIN_COUNT)
    : d.minCount;
  const toleranceMs = typeof partial.toleranceMs === "number" && Number.isFinite(partial.toleranceMs)
    ? clamp(Math.round(partial.toleranceMs), CLAMP_TOLERANCE)
    : d.toleranceMs;
  const cooldownMs = typeof partial.cooldownMs === "number" && Number.isFinite(partial.cooldownMs)
    ? clamp(Math.round(partial.cooldownMs), CLAMP_COOLDOWN)
    : d.cooldownMs;
  return { minCount, toleranceMs, cooldownMs };
}
