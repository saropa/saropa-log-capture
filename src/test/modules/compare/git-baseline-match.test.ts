import * as assert from "node:assert";
import test from "node:test";
import {
  commitsMatch,
  pickBaselineKey,
  type BaselineCandidate,
} from "../../../modules/compare/baseline-match";
import { getSessionCommit } from "../../../modules/session/session-commit-from-meta";

// --- getSessionCommit (normalizer over the integrations payload) ---

test("getSessionCommit: undefined integrations yields undefined", () => {
  assert.strictEqual(getSessionCommit(undefined), undefined);
});

test("getSessionCommit: reads git provider commit", () => {
  assert.strictEqual(getSessionCommit({ git: { commit: "abc1234" } }), "abc1234");
});

test("getSessionCommit: falls back to buildCi when git has none", () => {
  assert.strictEqual(
    getSessionCommit({ git: { describe: "v1" }, buildCi: { commit: "def5678" } }),
    "def5678",
  );
});

test("getSessionCommit: git wins over buildCi", () => {
  assert.strictEqual(
    getSessionCommit({ git: { commit: "aaaaaaa" }, buildCi: { commit: "bbbbbbb" } }),
    "aaaaaaa",
  );
});

test("getSessionCommit: trims and rejects empty/non-string commit", () => {
  assert.strictEqual(getSessionCommit({ git: { commit: "  abc1234  " } }), "abc1234");
  assert.strictEqual(getSessionCommit({ git: { commit: "" } }), undefined);
  assert.strictEqual(getSessionCommit({ git: { commit: 123 } }), undefined);
});

// --- commitsMatch (short-vs-full prefix equality) ---

test("commitsMatch: full SHA matches its short prefix", () => {
  const full = "a".repeat(40);
  assert.ok(commitsMatch("aaaaaaa", full));
  assert.ok(commitsMatch(full, "aaaaaaa"));
});

test("commitsMatch: differing commits do not match", () => {
  assert.strictEqual(commitsMatch("abcdef0", "abcdef1".repeat(1) + "0".repeat(33)), false);
});

test("commitsMatch: prefixes shorter than 7 chars never match", () => {
  assert.strictEqual(commitsMatch("abc", "abc".padEnd(40, "0")), false);
});

test("commitsMatch: case-insensitive", () => {
  assert.ok(commitsMatch("ABC1234", "abc1234" + "0".repeat(33)));
});

// --- pickBaselineKey (most-recent match selection) ---

const cand = (key: string, commit: string | undefined): BaselineCandidate => ({ key, commit });

test("pickBaselineKey: returns the only match", () => {
  const list = [cand("20260101_a.log", "abc1234"), cand("20260102_b.log", "999aaaa")];
  assert.strictEqual(pickBaselineKey(list, "abc1234" + "0".repeat(33)), "20260101_a.log");
});

test("pickBaselineKey: prefers lexically greatest (most recent) on ties", () => {
  const sha = "abc1234" + "0".repeat(33);
  const list = [cand("20260101_a.log", "abc1234"), cand("20260105_b.log", "abc1234")];
  assert.strictEqual(pickBaselineKey(list, sha), "20260105_b.log");
});

test("pickBaselineKey: undefined when nothing matches", () => {
  const list = [cand("20260101_a.log", "999aaaa"), cand("20260102_b.log", undefined)];
  assert.strictEqual(pickBaselineKey(list, "abc1234" + "0".repeat(33)), undefined);
});

test("pickBaselineKey: skips candidates without a commit", () => {
  const list = [cand("20260101_a.log", undefined)];
  assert.strictEqual(pickBaselineKey(list, "abc1234" + "0".repeat(33)), undefined);
});
