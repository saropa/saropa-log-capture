import test from "node:test";
import assert from "node:assert/strict";
import { computeDebuggingVelocity } from "../../../modules/compare/debugging-velocity";

test("fewer than two sessions is not measurable", () => {
  assert.equal(computeDebuggingVelocity([]), undefined);
  assert.equal(computeDebuggingVelocity([["a", "b"]]), undefined);
});

test("an error gone from the latest session counts as resolved", () => {
  // h1 seen in sessions 0,1 then gone; h2 still present in the latest.
  const v = computeDebuggingVelocity([["h1"], ["h1", "h2"], ["h2"]]);
  assert.ok(v);
  assert.equal(v!.resolved, 1);
  assert.equal(v!.persisting, 1);
  assert.equal(v!.velocityPct, 50);
});

test("avgSessionsToResolve is the inclusive first→last span of resolved errors", () => {
  // h1 spans sessions 0..1 (2 sessions) then gone in session 2.
  const v = computeDebuggingVelocity([["h1"], ["h1"], ["other"]]);
  assert.equal(v!.resolved, 1);
  assert.equal(v!.avgSessionsToResolve, 2);
});

test("all errors still present yields 0% velocity", () => {
  const v = computeDebuggingVelocity([["h1"], ["h1"]]);
  assert.equal(v!.resolved, 0);
  assert.equal(v!.persisting, 1);
  assert.equal(v!.velocityPct, 0);
});

test("all errors resolved (latest session is clean) yields 100% velocity", () => {
  // The latest session carries no error fingerprints, so both earlier errors are resolved.
  const v = computeDebuggingVelocity([["h1", "h2"], []]);
  assert.equal(v!.resolved, 2);
  assert.equal(v!.persisting, 0);
  assert.equal(v!.velocityPct, 100);
});
