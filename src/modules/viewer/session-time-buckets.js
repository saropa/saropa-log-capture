"use strict";
/**
 * Bucket-count formula and **time-axis** index math for the Performance → Database tab timeline.
 *
 * **What is shared with the SQL minimap** (`viewer-scrollbar-minimap.ts`): only the **clamped count function**
 * `sessionTimeBucketCountForHeightPx` — same as minimap `densityBucketCount = max(48, min(180, floor(h/2)))`.
 * The **height `h` passed in is not the same UI surface**: the minimap uses **live `mmH`** (often yielding N well
 * above 48); the DB tab currently uses a **fixed nominal bar-track height** (56px), which clamps to **N = 48**.
 * So “shared formula” ≠ “same N at runtime” unless callers deliberately pass comparable heights.
 *
 * **What is not shared (orthogonal axes):**
 * - Minimap SQL density: bucket index from **layout / scroll space** — line → offset in `totalHeight` → fraction of
 *   minimap pixel height `py/mmH` → `floor(fraction * N)`. Non-uniform in **time** when line density, filters,
 *   compression, or variable row heights distort the time↔scroll mapping.
 * - Database tab timeline: bucket index from **wall-clock** `timestamp` in `[tMin, tMax]` → uniform time slices
 *   via `sessionTimeBucketIndex`. Comparable to minimap bands only when the log is roughly **chronological and**
 * **time ≈ proportional to scroll position** — do not assume that for all sessions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionTimeBucketCountForHeightPx = sessionTimeBucketCountForHeightPx;
exports.sessionTimeBucketIndex = sessionTimeBucketIndex;
exports.getSessionTimeBucketsScript = getSessionTimeBucketsScript;
/** Same formula as minimap `densityBucketCount = max(48, min(180, floor(h/2)))`. */
function sessionTimeBucketCountForHeightPx(px) {
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
function sessionTimeBucketIndex(ts, tMin, tMax, bucketCount) {
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
function getSessionTimeBucketsScript() {
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
//# sourceMappingURL=session-time-buckets.js.map