import test from "node:test";
import assert from "node:assert/strict";
import { classifyFreshness, daysSinceCommitDate } from "../../../modules/misc/code-freshness";

// Fixed "now" so the day math is deterministic: 2026-06-14T00:00:00Z.
const NOW = Date.parse("2026-06-14T00:00:00Z");

test("days-since math counts whole days from a YYYY-MM-DD date", () => {
  assert.equal(daysSinceCommitDate("2026-06-14", NOW), 0);
  assert.equal(daysSinceCommitDate("2026-06-07", NOW), 7);
  assert.equal(daysSinceCommitDate("2026-05-15", NOW), 30);
});

test("an unparseable date returns undefined", () => {
  assert.equal(daysSinceCommitDate("not-a-date", NOW), undefined);
});

test("a future commit date clamps to 0 rather than going negative", () => {
  assert.equal(daysSinceCommitDate("2026-06-20", NOW), 0);
});

test("tiers: <=7 recent, <=30 moderate, else stale", () => {
  assert.equal(classifyFreshness(0), "recent");
  assert.equal(classifyFreshness(7), "recent");
  assert.equal(classifyFreshness(8), "moderate");
  assert.equal(classifyFreshness(30), "moderate");
  assert.equal(classifyFreshness(31), "stale");
});

test("undefined days is the unknown tier", () => {
  assert.equal(classifyFreshness(undefined), "unknown");
});
