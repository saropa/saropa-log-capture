import * as assert from "node:assert";
import test from "node:test";
import {
  createDbDetectorSessionState,
  mergeDbDetectorResultsByStableKey,
  runDbDetectorsCompare,
  runDbDetectorsIngest,
} from "../../../modules/db/db-detector-framework";
import type { DbDetectorContext, DbDetectorDefinition, DbDetectorResult } from "../../../modules/db/db-detector-types";

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
