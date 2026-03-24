/**
 * Session time bucketing shared between the SQL minimap density bands and the Performance → Database tab timeline.
 * Bucket **count** matches `viewer-scrollbar-minimap.ts` (`densityBucketCount` from pixel height).
 * Timeline buckets by **wall-clock** `timestamp`; minimap SQL density buckets by **scroll Y** but uses the same N.
 */

/** Same formula as minimap `densityBucketCount = max(48, min(180, floor(h/2)))`. */
export function sessionTimeBucketCountForHeightPx(px: number): number {
  const h = Number(px);
  if (!Number.isFinite(h) || h < 1) {
    return 48;
  }
  return Math.max(48, Math.min(180, Math.floor(h / 2)));
}

/**
 * Map a timestamp into `[0, bucketCount - 1]` across `[tMin, tMax]` (inclusive edges).
 * Uses the same clamping as the legacy DB tab: `span = tMax - tMin || 1`.
 */
export function sessionTimeBucketIndex(ts: number, tMin: number, tMax: number, bucketCount: number): number {
  const n = Math.floor(Number(bucketCount));
  if (n <= 0 || !Number.isFinite(ts) || !Number.isFinite(tMin) || !Number.isFinite(tMax)) {
    return 0;
  }
  const span = tMax - tMin || 1;
  let ix = Math.floor(((ts - tMin) / span) * n);
  if (ix < 0) {
    ix = 0;
  }
  if (ix >= n) {
    ix = n - 1;
  }
  return ix;
}

/**
 * Injected once into the viewer before the performance panel and minimap so both call the same helpers.
 */
export function getSessionTimeBucketsScript(): string {
  return /* javascript */ `
/** Keep in sync with src/modules/viewer/session-time-buckets.ts (unit-tested). */
function sessionTimeBucketCountForHeightPx(px) {
    var h = Number(px);
    if (!isFinite(h) || h < 1) return 48;
    return Math.max(48, Math.min(180, Math.floor(h / 2)));
}
function sessionTimeBucketIndex(ts, tMin, tMax, bucketCount) {
    var n = Math.floor(Number(bucketCount));
    if (n <= 0 || !isFinite(ts) || !isFinite(tMin) || !isFinite(tMax)) return 0;
    var span = (tMax - tMin) || 1;
    var ix = Math.floor(((ts - tMin) / span) * n);
    if (ix < 0) ix = 0;
    if (ix >= n) ix = n - 1;
    return ix;
}
`;
}
