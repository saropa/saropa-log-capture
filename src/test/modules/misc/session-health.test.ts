import test from "node:test";
import assert from "node:assert/strict";
import { computeSessionHealth } from "../../../modules/misc/session-health";

test("a clean session scores 100 with no factors", () => {
  const h = computeSessionHealth({});
  assert.equal(h.score, 100);
  assert.deepEqual(h.factors, []);
});

test("errors subtract 10 each and are reported as a factor", () => {
  const h = computeSessionHealth({ errors: 3 });
  assert.equal(h.score, 70);
  assert.equal(h.factors.length, 1);
  assert.equal(h.factors[0].key, "errors");
  assert.equal(h.factors[0].count, 3);
  assert.equal(h.factors[0].delta, -30);
});

test("each signal type is capped so one noisy category cannot dominate", () => {
  // 200 warnings would be -400 uncapped; the warning cap is -10.
  const h = computeSessionHealth({ warnings: 200 });
  assert.equal(h.score, 90);
  assert.equal(h.factors[0].delta, -10);
});

test("ANR applies its penalty once for any positive score", () => {
  assert.equal(computeSessionHealth({ anrScore: 1 }).score, 75);
  assert.equal(computeSessionHealth({ anrScore: 999 }).score, 75);
  assert.equal(computeSessionHealth({ anrScore: 0 }).factors.length, 0);
});

test("score is clamped at 0 and factors are ordered most-severe first", () => {
  const h = computeSessionHealth({
    errors: 10, anrScore: 5, memoryEvents: 10, networkFailures: 10, warnings: 10,
  });
  assert.equal(h.score, 0);
  assert.equal(h.factors[0].key, "errors");
  assert.equal(h.factors[1].key, "anrScore");
});
