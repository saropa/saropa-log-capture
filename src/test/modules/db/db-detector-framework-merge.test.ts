import * as assert from "node:assert";
import * as vm from "node:vm";
import test from "node:test";
import {
  mergeDbDetectorResultsByStableKey,
} from "../../../modules/db/db-detector-framework";
import type { DbDetectorResult } from "../../../modules/db/db-detector-types";
import { getViewerDbDetectorFrameworkScript } from "../../../ui/viewer/viewer-db-detector-framework-script";

/** Snapshot merge output for parity checks (embed returns VM plain objects; avoid deepStrictEqual quirks). */
function mergeResultSummary(results: readonly { detectorId?: unknown; stableKey?: unknown; priority?: unknown }[]): {
  detectorId: string;
  stableKey: string;
  priority: number;
}[] {
  return results.map((r) => ({
    detectorId: typeof r.detectorId === "string" ? r.detectorId : "",
    stableKey: typeof r.stableKey === "string" ? r.stableKey : "",
    priority: typeof r.priority === "number" && Number.isFinite(r.priority) ? r.priority : 0,
  }));
}

function assertMergeParity(
  a: ReturnType<typeof mergeResultSummary>,
  b: ReturnType<typeof mergeResultSummary>,
): void {
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
}

interface EmbedMergeCtx {
  mergeDbDetectorResultsByStableKey: (results: unknown[]) => unknown[];
}

/** Loads the webview embed chunk so `mergeDbDetectorResultsByStableKey` matches production JS (plan DB_15 drift guard). */
function loadEmbedMerge(): EmbedMergeCtx["mergeDbDetectorResultsByStableKey"] {
  const code = getViewerDbDetectorFrameworkScript(true);
  const ctx = vm.createContext({ console });
  vm.runInContext(code, ctx, { filename: "db-detector-framework-embed-merge-parity.js", timeout: 10_000 });
  const fn = (ctx as EmbedMergeCtx).mergeDbDetectorResultsByStableKey;
  if (typeof fn !== "function") {
    throw new TypeError("embed missing mergeDbDetectorResultsByStableKey");
  }
  return fn;
}

test("mergeDbDetectorResultsByStableKey: higher-priority result wins same stableKey", () => {
  const low: DbDetectorResult = {
    kind: "synthetic-line",
    detectorId: "a",
    stableKey: "k1",
    priority: 0,
    payload: { syntheticType: "n-plus-one-signal" },
  };
  const high: DbDetectorResult = {
    kind: "synthetic-line",
    detectorId: "b",
    stableKey: "k1",
    priority: 10,
    payload: { syntheticType: "n-plus-one-signal" },
  };
  const merged = mergeDbDetectorResultsByStableKey([low, high]);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].detectorId, "b");
});

test("mergeDbDetectorResultsByStableKey: embed matches TypeScript (DB_15 drift guard)", () => {
  const embedMerge = loadEmbedMerge();
  const low: DbDetectorResult = {
    kind: "synthetic-line",
    detectorId: "a",
    stableKey: "k1",
    priority: 0,
    payload: {},
  };
  const high: DbDetectorResult = {
    kind: "synthetic-line",
    detectorId: "b",
    stableKey: "k1",
    priority: 10,
    payload: {},
  };
  const tsOut = mergeResultSummary(mergeDbDetectorResultsByStableKey([low, high]));
  const embedOut = mergeResultSummary(embedMerge([low, high]) as DbDetectorResult[]);
  assertMergeParity(embedOut, tsOut);

  const a: DbDetectorResult = {
    kind: "marker",
    detectorId: "m1",
    stableKey: "ka",
    priority: 1,
    payload: {},
  };
  const b: DbDetectorResult = {
    kind: "marker",
    detectorId: "m2",
    stableKey: "kb",
    priority: 2,
    payload: {},
  };
  const ts2 = mergeResultSummary(mergeDbDetectorResultsByStableKey([a, b]));
  const embed2 = mergeResultSummary(embedMerge([a, b]) as DbDetectorResult[]);
  assertMergeParity(embed2, ts2);

  // Same priority + same key: last array element wins in both implementations.
  const tie1: DbDetectorResult = {
    kind: "synthetic-line",
    detectorId: "first",
    stableKey: "tie",
    priority: 5,
    payload: {},
  };
  const tie2: DbDetectorResult = {
    kind: "synthetic-line",
    detectorId: "second",
    stableKey: "tie",
    priority: 5,
    payload: {},
  };
  const ts3 = mergeResultSummary(mergeDbDetectorResultsByStableKey([tie1, tie2]));
  const embed3 = mergeResultSummary(embedMerge([tie1, tie2]) as DbDetectorResult[]);
  assertMergeParity(embed3, ts3);
  assert.strictEqual(ts3[0]?.detectorId, "second");

  // Skips falsy stableKey (embed uses truthy check).
  const emptyKey = { ...low, stableKey: "" };
  const ts4 = mergeResultSummary(mergeDbDetectorResultsByStableKey([emptyKey]));
  const embed4 = mergeResultSummary(embedMerge([emptyKey]) as DbDetectorResult[]);
  assertMergeParity(embed4, ts4);
  assert.strictEqual(ts4.length, 0);
});
