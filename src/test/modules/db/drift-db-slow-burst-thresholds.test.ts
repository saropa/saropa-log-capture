import * as assert from "node:assert";
import test from "node:test";
import {
  normalizeViewerSlowBurstThresholds,
  VIEWER_SLOW_BURST_DEFAULTS,
} from "../../../modules/db/drift-db-slow-burst-thresholds";

test("normalizeViewerSlowBurstThresholds clamps and floors integers", () => {
  const n = normalizeViewerSlowBurstThresholds({
    slowQueryMs: 0.9,
    burstMinCount: 1.2,
    burstWindowMs: 50,
    cooldownMs: 9999999,
  });
  assert.strictEqual(n.slowQueryMs, 1);
  assert.strictEqual(n.burstMinCount, 2);
  assert.strictEqual(n.burstWindowMs, 100);
  assert.strictEqual(n.cooldownMs, 300_000);
});

test("normalizeViewerSlowBurstThresholds uses defaults for garbage", () => {
  const n = normalizeViewerSlowBurstThresholds({
    slowQueryMs: NaN,
    burstMinCount: Number.POSITIVE_INFINITY,
  });
  assert.strictEqual(n.slowQueryMs, VIEWER_SLOW_BURST_DEFAULTS.slowQueryMs);
  assert.strictEqual(n.burstMinCount, VIEWER_SLOW_BURST_DEFAULTS.burstMinCount);
});
