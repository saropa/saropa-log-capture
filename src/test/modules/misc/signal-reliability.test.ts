import test from "node:test";
import assert from "node:assert/strict";
import { classifyReliability } from "../../../modules/misc/signal-reliability";

test("fewer than two sessions is not classifiable (no reliability information)", () => {
  assert.equal(classifyReliability(1, 1), undefined);
  assert.equal(classifyReliability(0, 0), undefined);
});

test("a zero session count is not classifiable", () => {
  assert.equal(classifyReliability(0, 10), undefined);
});

test("present in at least 80% of sessions is consistent", () => {
  assert.deepEqual(classifyReliability(8, 10), { percentage: 80, tier: "consistent" });
  assert.deepEqual(classifyReliability(10, 10), { percentage: 100, tier: "consistent" });
});

test("present in 25%–79% of sessions is intermittent", () => {
  assert.deepEqual(classifyReliability(6, 10), { percentage: 60, tier: "intermittent" });
  assert.deepEqual(classifyReliability(1, 4), { percentage: 25, tier: "intermittent" });
});

test("present in under 25% of sessions is rare", () => {
  assert.deepEqual(classifyReliability(1, 10), { percentage: 10, tier: "rare" });
});

test("count above total is clamped so percentage never exceeds 100", () => {
  assert.deepEqual(classifyReliability(12, 10), { percentage: 100, tier: "consistent" });
});
