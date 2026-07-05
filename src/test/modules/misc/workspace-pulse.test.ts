import test from "node:test";
import assert from "node:assert/strict";
import { computeWorkspacePulse } from "../../../modules/misc/workspace-pulse";

test("nothing to report yields undefined (strip stays hidden)", () => {
  assert.equal(computeWorkspacePulse({ newErrorCount: 0, resolvedErrorCount: 0, recurringCount: 0 }), undefined);
});

test("velocity alone is enough to show the strip", () => {
  const p = computeWorkspacePulse({ newErrorCount: 0, resolvedErrorCount: 0, recurringCount: 0, velocityPct: 80 });
  assert.ok(p);
  assert.equal(p!.velocityPct, 80);
  assert.equal(p!.tone, "steady");
});

test("a bare 0% fix-rate with no tracked issues stays hidden (vacuous)", () => {
  // Regression: the panel used to show "▲ 0 · ▼ 0 · ● 0 · Fixed 0%" — an all-zero strip that
  // reads as noise. Nothing tracked and 0% fixed means there is nothing to report.
  assert.equal(computeWorkspacePulse({ newErrorCount: 0, resolvedErrorCount: 0, recurringCount: 0, velocityPct: 0 }), undefined);
});

test("0% fix-rate still shows when there are stable issues to fix (actionable)", () => {
  const p = computeWorkspacePulse({ newErrorCount: 0, resolvedErrorCount: 0, recurringCount: 4, velocityPct: 0 });
  assert.ok(p);
  assert.equal(p!.stable, 4);
  assert.equal(p!.velocityPct, 0);
});

test("more resolved than new reads as improving", () => {
  const p = computeWorkspacePulse({ newErrorCount: 1, resolvedErrorCount: 3, recurringCount: 2 });
  assert.equal(p!.improving, 3);
  assert.equal(p!.worsening, 1);
  assert.equal(p!.stable, 2);
  assert.equal(p!.tone, "improving");
});

test("more new than resolved reads as worsening", () => {
  const p = computeWorkspacePulse({ newErrorCount: 4, resolvedErrorCount: 1, recurringCount: 0 });
  assert.equal(p!.tone, "worsening");
});

test("equal new and resolved reads as steady", () => {
  const p = computeWorkspacePulse({ newErrorCount: 2, resolvedErrorCount: 2, recurringCount: 1 });
  assert.equal(p!.tone, "steady");
});

test("negative inputs are floored at zero", () => {
  const p = computeWorkspacePulse({ newErrorCount: -5, resolvedErrorCount: -1, recurringCount: 3 });
  assert.equal(p!.worsening, 0);
  assert.equal(p!.improving, 0);
  assert.equal(p!.stable, 3);
});
