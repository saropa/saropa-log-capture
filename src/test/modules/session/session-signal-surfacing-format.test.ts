import test from "node:test";
import assert from "node:assert/strict";
import {
  selectSurfacingVariant,
  truncateLabel,
} from "../../../modules/session/session-signal-surfacing-format";

// -------- variant selection --------

test("both counts non-zero selects the combined variant with both args", () => {
  const v = selectSurfacingVariant({ newErrorCount: 2, recurringCount: 3 });
  assert.equal(v.key, "msg.sessionSignals.both");
  assert.deepEqual(v.args, [2, 3]);
});

test("only new errors selects the new-only variant", () => {
  const v = selectSurfacingVariant({ newErrorCount: 1, recurringCount: 0 });
  assert.equal(v.key, "msg.sessionSignals.newOnly");
  assert.deepEqual(v.args, [1]);
});

test("only recurring selects the recurring-only variant", () => {
  const v = selectSurfacingVariant({ newErrorCount: 0, recurringCount: 4 });
  assert.equal(v.key, "msg.sessionSignals.recurringOnly");
  assert.deepEqual(v.args, [4]);
});

test("nothing actionable yields a null key so the toast is suppressed", () => {
  const v = selectSurfacingVariant({ newErrorCount: 0, recurringCount: 0 });
  assert.equal(v.key, null);
  assert.deepEqual(v.args, []);
});

// -------- label truncation --------

test("label under the limit is returned unchanged", () => {
  assert.equal(truncateLabel("short error", 60), "short error");
});

test("label over the limit is truncated with an ellipsis to exactly the limit", () => {
  const long = "x".repeat(80);
  const out = truncateLabel(long, 60);
  assert.equal(out.length, 60);
  assert.ok(out.endsWith("..."));
});

test("label exactly at the limit is not truncated", () => {
  const exact = "y".repeat(60);
  assert.equal(truncateLabel(exact, 60), exact);
});
