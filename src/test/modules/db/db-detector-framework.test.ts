import * as assert from "node:assert";
import * as vm from "node:vm";
import test from "node:test";
import {
  applyDbAnnotateLineResultToLineItems,
  applyDbAnnotateLineResultsToLineItems,
  createDbDetectorSessionState,
  mergeDbDetectorResultsByStableKey,
  runDbDetectorsCompare,
  runDbDetectorsIngest,
  runDefaultSessionDbCompareDetectors,
} from "../../../modules/db/db-detector-framework";
import { createBaselineVolumeCompareDetector } from "../../../modules/db/drift-db-baseline-volume-compare-detector";
import type { DbDetectorContext, DbDetectorDefinition, DbDetectorResult } from "../../../modules/db/db-detector-types";
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

const baseCtx: DbDetectorContext = {
  timestampMs: 1000,
  sessionId: null,
  sourceTag: "database",
  level: "info",
  plainText: "",
  durationMs: undefined,
  sql: { fingerprint: "fp1", argsKey: "[]" },
};

test("mergeDbDetectorResultsByStableKey: higher-priority result wins same stableKey", () => {
  const low: DbDetectorResult = {
    kind: "synthetic-line",
    detectorId: "a",
    stableKey: "k1",
    priority: 0,
    payload: { syntheticType: "n-plus-one-insight" },
  };
  const high: DbDetectorResult = {
    kind: "synthetic-line",
    detectorId: "b",
    stableKey: "k1",
    priority: 10,
    payload: { syntheticType: "n-plus-one-insight" },
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

test("runDbDetectorsIngest: stable priority order; lower cannot preempt higher for same key", () => {
  const first: DbDetectorDefinition = {
    id: "low",
    priority: 0,
    feed: () => [
      {
        kind: "synthetic-line",
        detectorId: "low",
        stableKey: "x",
        priority: 0,
        payload: {},
      },
    ],
  };
  const second: DbDetectorDefinition = {
    id: "high",
    priority: 100,
    feed: () => [
      {
        kind: "synthetic-line",
        detectorId: "high",
        stableKey: "x",
        priority: 100,
        payload: {},
      },
    ],
  };
  const state = createDbDetectorSessionState();
  const out = runDbDetectorsIngest([second, first], baseCtx, state);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].detectorId, "high");
});

test("runDbDetectorsIngest: throwing detector is disabled for the session", () => {
  let calls = 0;
  const bad: DbDetectorDefinition = {
    id: "throws",
    priority: 0,
    feed: () => {
      calls++;
      throw new Error("boom");
    },
  };
  const good: DbDetectorDefinition = {
    id: "ok",
    priority: 10,
    feed: () => [
      {
        kind: "synthetic-line",
        detectorId: "ok",
        stableKey: "only",
        priority: 10,
        payload: {},
      },
    ],
  };
  const state = createDbDetectorSessionState();
  runDbDetectorsIngest([bad, good], baseCtx, state);
  assert.strictEqual(calls, 1);
  assert.ok(state.disabledDetectorIds.has("throws"));
  runDbDetectorsIngest([bad, good], baseCtx, state);
  assert.strictEqual(calls, 1);
});

test("runDbDetectorsCompare: runs compare hooks and merges stableKey by priority", () => {
  const baseline = new Map([["fp", { count: 1 }]]);
  const target = new Map([["fp", { count: 5 }]]);
  const low: DbDetectorDefinition = {
    id: "c-low",
    priority: 0,
    feed: () => [],
    compare: ({ diff }) => {
      const row = diff.find((d) => d.fingerprint === "fp");
      if (!row?.baseline || !row.target) {
        return [];
      }
      return [
        {
          kind: "synthetic-line",
          detectorId: "c-low",
          stableKey: "cmp::fp",
          priority: 0,
          payload: { delta: row.target.count - row.baseline.count },
        },
      ];
    },
  };
  const high: DbDetectorDefinition = {
    id: "c-high",
    priority: 100,
    feed: () => [],
    compare: () => [
      {
        kind: "synthetic-line",
        detectorId: "c-high",
        stableKey: "cmp::fp",
        priority: 100,
        payload: { wins: true },
      },
    ],
  };
  const state = createDbDetectorSessionState();
  const out = runDbDetectorsCompare([high, low], { baseline, target }, state);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].detectorId, "c-high");
});

test("runDbDetectorsCompare: insightsEnabled false returns empty", () => {
  const d: DbDetectorDefinition = {
    id: "x",
    priority: 0,
    feed: () => [],
    compare: () => [
      {
        kind: "synthetic-line",
        detectorId: "x",
        stableKey: "k",
        priority: 0,
        payload: {},
      },
    ],
  };
  const state = createDbDetectorSessionState();
  const out = runDbDetectorsCompare([d], { baseline: new Map(), target: new Map() }, state, {
    insightsEnabled: false,
  });
  assert.deepStrictEqual(out, []);
});

test("runDbDetectorsCompare: throwing compare disables detector", () => {
  const bad: DbDetectorDefinition = {
    id: "bad-compare",
    priority: 0,
    feed: () => [],
    compare: () => {
      throw new Error("compare boom");
    },
  };
  const state = createDbDetectorSessionState();
  runDbDetectorsCompare([bad], { baseline: new Map(), target: new Map() }, state);
  assert.ok(state.disabledDetectorIds.has("bad-compare"));
});

test("createBaselineVolumeCompareDetector: marker when target exceeds baseline enough", () => {
  const baseline = new Map([["fp1", { count: 10 }]]);
  const target = new Map([["fp1", { count: 20 }]]);
  const state = createDbDetectorSessionState();
  const out = runDbDetectorsCompare([createBaselineVolumeCompareDetector()], { baseline, target }, state);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].kind, "marker");
});

test("createBaselineVolumeCompareDetector: no marker when increase is trivial", () => {
  const baseline = new Map([["fp1", { count: 2 }]]);
  const target = new Map([["fp1", { count: 3 }]]);
  const state = createDbDetectorSessionState();
  const out = runDbDetectorsCompare([createBaselineVolumeCompareDetector()], { baseline, target }, state);
  assert.strictEqual(out.length, 0);
});

test("applyDbAnnotateLineResultToLineItems: shallow merge by seq", () => {
  const lines = [{ seq: 1, height: 20, level: "info" as const }];
  const ok = applyDbAnnotateLineResultToLineItems(lines, {
    kind: "annotate-line",
    detectorId: "t",
    stableKey: "t",
    priority: 1,
    payload: { targetSeq: 1, patch: { level: "error", tagged: true } },
  });
  assert.strictEqual(ok, true);
  assert.strictEqual(lines[0].level, "error");
  assert.strictEqual((lines[0] as { tagged?: boolean }).tagged, true);
});

test("applyDbAnnotateLineResultToLineItems: missing seq is false and leaves rows unchanged", () => {
  const lines = [{ seq: 1, height: 20 }];
  const snap = JSON.stringify(lines);
  const ok = applyDbAnnotateLineResultToLineItems(lines, {
    kind: "annotate-line",
    detectorId: "t",
    stableKey: "t",
    priority: 1,
    payload: { targetSeq: 999, patch: { x: 1 } },
  });
  assert.strictEqual(ok, false);
  assert.strictEqual(JSON.stringify(lines), snap);
});

test("applyDbAnnotateLineResultToLineItems: height delta invokes callback", () => {
  const lines = [{ seq: 2, height: 20 }];
  let d = 0;
  applyDbAnnotateLineResultToLineItems(
    lines,
    {
      kind: "annotate-line",
      detectorId: "t",
      stableKey: "t",
      priority: 1,
      payload: { targetSeq: 2, patch: { height: 5 } },
    },
    (delta) => {
      d += delta;
    },
  );
  assert.strictEqual(lines[0].height, 5);
  assert.strictEqual(d, -15);
});

test("applyDbAnnotateLineResultsToLineItems: skips non-annotate kinds", () => {
  const lines = [{ seq: 1, height: 10 }];
  const n = applyDbAnnotateLineResultsToLineItems(lines, [
    {
      kind: "marker",
      detectorId: "m",
      stableKey: "m",
      priority: 0,
      payload: {},
    },
    {
      kind: "annotate-line",
      detectorId: "a",
      stableKey: "a",
      priority: 1,
      payload: { targetSeq: 1, patch: { height: 0 } },
    },
  ]);
  assert.strictEqual(n, 1);
  assert.strictEqual(lines[0].height, 0);
});

test("runDbDetectorsCompare: optional annotateTargetLines applies annotate-line from merged results", () => {
  const lines = [{ seq: 1, height: 20 }];
  const ann: DbDetectorDefinition = {
    id: "ann-compare",
    priority: 0,
    feed: () => [],
    compare: () => [
      {
        kind: "annotate-line",
        detectorId: "ann-compare",
        stableKey: "ann::1",
        priority: 1,
        payload: { targetSeq: 1, patch: { height: 0 } },
      },
    ],
  };
  const state = createDbDetectorSessionState();
  let deltaSum = 0;
  runDbDetectorsCompare([ann], { baseline: new Map(), target: new Map() }, state, {
    annotateTargetLines: lines,
    onAnnotateHeightDelta: (d) => {
      deltaSum += d;
    },
  });
  assert.strictEqual(lines[0].height, 0);
  assert.strictEqual(deltaSum, -20);
});

test("runDefaultSessionDbCompareDetectors: same marker count as manual registry for volume regression", () => {
  const baseline = new Map([["fp1", { count: 10 }]]);
  const target = new Map([["fp1", { count: 20 }]]);
  const stateA = createDbDetectorSessionState();
  const stateB = createDbDetectorSessionState();
  const a = runDefaultSessionDbCompareDetectors({ baseline, target }, stateA);
  const b = runDbDetectorsCompare([createBaselineVolumeCompareDetector()], { baseline, target }, stateB);
  assert.strictEqual(a.length, b.length);
  assert.strictEqual(a[0]?.detectorId, b[0]?.detectorId);
});

test("runDbDetectorsIngest: insightsEnabled false returns empty", () => {
  const d: DbDetectorDefinition = {
    id: "x",
    priority: 0,
    feed: () => [
      {
        kind: "synthetic-line",
        detectorId: "x",
        stableKey: "k",
        priority: 0,
        payload: {},
      },
    ],
  };
  const state = createDbDetectorSessionState();
  const out = runDbDetectorsIngest([d], baseCtx, state, { insightsEnabled: false });
  assert.deepStrictEqual(out, []);
});
