/**
 * Optional host-side `compare()` detector: surfaces fingerprints where the target session ran **more**
 * queries than the baseline (DB_10 / DB_15 follow-up). Used via **`runDefaultSessionDbCompareDetectors`**
 * from **`compareLogSessionsWithDbFingerprints`** (session comparison webview) and tests; the log viewer
 * embed uses a separate streaming marker (`db.baseline-volume-hint`).
 *
 * **Threshold note:** batch compare here uses `MIN_BASELINE_COUNT` **5** to limit noise on thin baselines.
 * The streaming embed hint uses **3** (`viewer-db-detector-framework-script.ts`) so live tailing can fire
 * sooner with the same baseline payload — intentional asymmetry between batch markers and live UX.
 */

import type { DbDetectorCompareInput, DbDetectorDefinition, DbDetectorResult } from "./db-detector-types";

export const DB_COMPARE_BASELINE_VOLUME_ID = "db.compare-baseline-volume";

const MIN_BASELINE_COUNT = 5;
const MAX_RESULTS = 40;

export function createBaselineVolumeCompareDetector(): DbDetectorDefinition {
  return {
    id: DB_COMPARE_BASELINE_VOLUME_ID,
    priority: 5,
    feed: () => [],
    compare(input: DbDetectorCompareInput): readonly DbDetectorResult[] {
      const out: DbDetectorResult[] = [];
      for (const row of input.diff) {
        if (out.length >= MAX_RESULTS) {
          break;
        }
        const bc = row.baseline?.count ?? 0;
        const tc = row.target?.count ?? 0;
        if (bc < MIN_BASELINE_COUNT || tc <= bc) {
          continue;
        }
        const fpShort = row.fingerprint.length > 48 ? `${row.fingerprint.slice(0, 48)}…` : row.fingerprint;
        out.push({
          kind: "marker",
          detectorId: DB_COMPARE_BASELINE_VOLUME_ID,
          stableKey: `${DB_COMPARE_BASELINE_VOLUME_ID}::${row.fingerprint}`,
          priority: 5,
          payload: {
            category: "db-compare",
            label: `SQL volume up (${tc} vs ${bc}): ${fpShort}`,
          },
        });
      }
      return out;
    },
  };
}
