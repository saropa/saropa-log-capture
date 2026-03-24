/**
 * Merge detector output by `stableKey` (plan **DB_15**).
 * **Single source of truth** for extension host and webview: embed JS is generated from this file
 * (`npm run generate:db-detector-embed-merge` → `src/ui/viewer/generated/db-detector-embed-merge.generated.ts`).
 */
import type { DbDetectorResult } from "./db-detector-types";

/**
 * Same `stableKey` keeps the **last** result in iteration order.
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
