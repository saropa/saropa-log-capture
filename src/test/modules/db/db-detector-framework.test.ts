import * as assert from "node:assert";
import test from "node:test";
import {
  applyDbAnnotateLineResultToLineItems,
  applyDbAnnotateLineResultsToLineItems,
  createDbDetectorSessionState,
  runDbDetectorsCompare,
  runDbDetectorsIngest,
  runDefaultSessionDbCompareDetectors,
} from "../../../modules/db/db-detector-framework";
import { createBaselineVolumeCompareDetector } from "../../../modules/db/drift-db-baseline-volume-compare-detector";
import type { DbDetectorContext, DbDetectorDefinition } from "../../../modules/db/db-detector-types";

const baseCtx: DbDetectorContext = {
  timestampMs: 1000,
  sessionId: null,
  sourceTag: "database",
  level: "info",
  plainText: "",
  durationMs: undefined,
  sql: { fingerprint: "fp1", argsKey: "[]" },
};

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

test("runDbDetectorsCompare: signalsEnabled false returns empty", () => {
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
    signalsEnabled: false,
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

test("runDbDetectorsIngest: signalsEnabled false returns empty", () => {
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
  const out = runDbDetectorsIngest([d], baseCtx, state, { signalsEnabled: false });
  assert.deepStrictEqual(out, []);
});
