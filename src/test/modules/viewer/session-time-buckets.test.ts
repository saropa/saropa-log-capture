import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  sessionTimeBucketCountForHeightPx,
  sessionTimeBucketIndex,
} from "../../../modules/viewer/session-time-buckets";

describe("session-time-buckets", () => {
  it("sessionTimeBucketCountForHeightPx matches minimap clamp", () => {
    assert.strictEqual(sessionTimeBucketCountForHeightPx(100), 50);
    assert.strictEqual(sessionTimeBucketCountForHeightPx(120), 60);
    assert.strictEqual(sessionTimeBucketCountForHeightPx(400), 180);
    assert.strictEqual(sessionTimeBucketCountForHeightPx(40), 48);
    assert.strictEqual(sessionTimeBucketCountForHeightPx(NaN), 48);
  });

  it("sessionTimeBucketIndex clamps to bucket range", () => {
    assert.strictEqual(sessionTimeBucketIndex(0, 0, 100, 10), 0);
    assert.strictEqual(sessionTimeBucketIndex(100, 0, 100, 10), 9);
    assert.strictEqual(sessionTimeBucketIndex(50, 0, 100, 10), 5);
    assert.strictEqual(sessionTimeBucketIndex(-1, 0, 100, 10), 0);
    assert.strictEqual(sessionTimeBucketIndex(200, 0, 100, 10), 9);
  });

  it("sessionTimeBucketIndex treats tMin===tMax as span 1 (same as minimap legacy)", () => {
    // span = (tMax - tMin) || 1 → 1; ts=42 vs anchor 10 → proportion maps to last bucket for n=5.
    assert.strictEqual(sessionTimeBucketIndex(42, 10, 10, 5), 4);
  });
});
