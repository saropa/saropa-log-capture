/**
 * Tests for shared hypothesis text utilities: truncateText and excerptKey.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { excerptKey, truncateText } from "../../../modules/root-cause-hints/build-hypotheses-text";

// --- truncateText ---

test("truncateText: should return text as-is when under max length", () => {
  assert.strictEqual(truncateText("short text", 100), "short text");
});

test("truncateText: should collapse whitespace", () => {
  assert.strictEqual(truncateText("  too   many   spaces  ", 100), "too many spaces");
});

test("truncateText: should truncate with ellipsis at max length", () => {
  const result = truncateText("a".repeat(300), 240);
  assert.strictEqual(result.length, 240);
  assert.ok(result.endsWith("…"));
});

// --- excerptKey ---

test("excerptKey: should lowercase and collapse whitespace", () => {
  assert.strictEqual(excerptKey("  Hello   World  "), "hello world");
});

test("excerptKey: should take last 80 chars for long excerpts", () => {
  const long = "a".repeat(100);
  const result = excerptKey(long);
  assert.strictEqual(result.length, 80);
});

test("excerptKey: should produce stable keys for equivalent excerpts", () => {
  const a = excerptKey("Connection  refused on port  8080");
  const b = excerptKey("Connection refused on port 8080");
  assert.strictEqual(a, b);
});

test("excerptKey: should handle empty string", () => {
  assert.strictEqual(excerptKey(""), "");
});
