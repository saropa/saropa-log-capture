import * as assert from "node:assert";
import test from "node:test";
import {
  buildDbFingerprintSummaryDiff,
  buildDbFingerprintSummaryFromDetectorContexts,
  mergeDbFingerprintSummaryEntries,
  mergeDbFingerprintSummaryMaps,
} from "../../../modules/db/db-fingerprint-summary";
import type { DbDetectorContext } from "../../../modules/db/db-detector-types";

function ctx(over: Partial<DbDetectorContext> & Pick<DbDetectorContext, "sql">): DbDetectorContext {
  return {
    timestampMs: 1,
    sessionId: null,
    sourceTag: "database",
    level: "info",
    plainText: "",
    durationMs: undefined,
    ...over,
  };
}

test("buildDbFingerprintSummaryFromDetectorContexts: counts SQL rows and durations", () => {
  const fp = "select ? from t";
  const map = buildDbFingerprintSummaryFromDetectorContexts([
    ctx({ sql: { fingerprint: fp, argsKey: "[]" }, durationMs: 10 }),
    ctx({ sql: { fingerprint: fp, argsKey: "[1]" }, durationMs: 30 }),
    ctx({ sql: null }),
  ]);
  const e = map.get(fp);
  assert.ok(e);
  assert.strictEqual(e!.count, 2);
  assert.strictEqual(e!.durationSampleCount, 2);
  assert.strictEqual(e!.avgDurationMs, 20);
  assert.strictEqual(e!.maxDurationMs, 30);
});

test("mergeDbFingerprintSummaryEntries: weighted average and max", () => {
  const a = { count: 2, avgDurationMs: 10, maxDurationMs: 10, durationSampleCount: 2 };
  const b = { count: 1, avgDurationMs: 40, maxDurationMs: 40, durationSampleCount: 1 };
  const m = mergeDbFingerprintSummaryEntries(a, b);
  assert.strictEqual(m.count, 3);
  assert.strictEqual(m.durationSampleCount, 3);
  assert.strictEqual(m.avgDurationMs, 20);
  assert.strictEqual(m.maxDurationMs, 40);
});

test("mergeDbFingerprintSummaryMaps: combines keys", () => {
  const a = new Map([["x", { count: 1 }]]);
  const b = new Map([["y", { count: 2 }]]);
  const m = mergeDbFingerprintSummaryMaps(a, b);
  assert.strictEqual(m.size, 2);
  assert.strictEqual(m.get("x")!.count, 1);
  assert.strictEqual(m.get("y")!.count, 2);
});

test("buildDbFingerprintSummaryDiff: sorted union", () => {
  const baseline = new Map([
    ["b", { count: 1 }],
    ["a", { count: 2 }],
  ]);
  const target = new Map([["c", { count: 3 }]]);
  const diff = buildDbFingerprintSummaryDiff(baseline, target);
  assert.deepStrictEqual(
    diff.map((r) => r.fingerprint),
    ["a", "b", "c"],
  );
  assert.deepStrictEqual(diff[0], { fingerprint: "a", baseline: { count: 2 }, target: undefined });
  assert.deepStrictEqual(diff[2], { fingerprint: "c", baseline: undefined, target: { count: 3 } });
});
