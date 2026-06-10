import * as assert from "node:assert";
import test from "node:test";
import { classifyTailChange } from "../../ui/provider/tail-change-classify";

// Plan 039b: the tail watcher's grow/shrink/equal decision drives append vs full-reload vs no-op.

test("classifyTailChange: growth appends new lines", () => {
  assert.strictEqual(classifyTailChange(10, 15), "append");
});

test("classifyTailChange: first lines into an empty viewer append", () => {
  assert.strictEqual(classifyTailChange(0, 5), "append");
});

test("classifyTailChange: shrink (truncate/rewrite) triggers full reload", () => {
  assert.strictEqual(classifyTailChange(100, 40), "reload");
});

test("classifyTailChange: truncate to empty triggers full reload", () => {
  assert.strictEqual(classifyTailChange(100, 0), "reload");
});

test("classifyTailChange: unchanged count is a no-op (metadata-only touch)", () => {
  assert.strictEqual(classifyTailChange(42, 42), "noop");
});

test("classifyTailChange: single-line growth still appends", () => {
  assert.strictEqual(classifyTailChange(42, 43), "append");
});
