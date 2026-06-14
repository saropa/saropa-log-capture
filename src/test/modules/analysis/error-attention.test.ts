import test from "node:test";
import assert from "node:assert/strict";
import { scoreErrorAttention } from "../../../modules/analysis/error-attention";

test("no factors yields score 0 and no contributions", () => {
  const r = scoreErrorAttention({});
  assert.equal(r.score, 0);
  assert.deepEqual(r.contributions, []);
});

test("app code + recently changed + recurring sums their weights", () => {
  const r = scoreErrorAttention({ inAppCode: true, recentlyChanged: true, recurring: true });
  assert.equal(r.score, 8); // 3 + 3 + 2
  assert.equal(r.contributions.length, 3);
  assert.equal(r.contributions[0].key, "in app code");
});

test("negative factors lower the score but the result floors at 0", () => {
  const r = scoreErrorAttention({ frameworkOnly: true, commonSdkError: true });
  assert.equal(r.score, 0); // -2 + -1 = -3, clamped to 0
  // The contributions still record the negatives for transparency.
  assert.equal(r.contributions.length, 2);
  assert.ok(r.contributions.some((c) => c.weight === -2));
});

test("positive and negative factors net correctly above the floor", () => {
  const r = scoreErrorAttention({ inAppCode: true, frameworkOnly: true });
  assert.equal(r.score, 1); // 3 - 2
});

test("contributions are ordered most-positive first", () => {
  const r = scoreErrorAttention({ inDocumentation: true, inAppCode: true });
  assert.equal(r.contributions[0].key, "in app code");
  assert.equal(r.contributions[0].weight, 3);
});
