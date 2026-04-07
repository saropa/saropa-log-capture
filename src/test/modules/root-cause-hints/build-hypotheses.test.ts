import test from "node:test";
import assert from "node:assert/strict";
import { buildHypotheses, ROOT_CAUSE_MAX_HYPOTHESES, ROOT_CAUSE_MAX_TEXT_LEN } from "../../../modules/root-cause-hints/build-hypotheses";
import {
  isRootCauseHintsEligible,
  ROOT_CAUSE_FP_LEADER_MIN_COUNT,
  ROOT_CAUSE_SQL_BURST_MIN_COUNT,
} from "../../../modules/root-cause-hints/root-cause-hint-eligibility";
import type { RootCauseHintBundle } from "../../../modules/root-cause-hints/root-cause-hint-types";

const base: RootCauseHintBundle = {
  bundleVersion: 1,
  sessionId: "s1",
};

test("isRootCauseHintsEligible: false for wrong version or missing sessionId", () => {
  assert.equal(isRootCauseHintsEligible({ ...base, bundleVersion: 2 }), false);
  assert.equal(isRootCauseHintsEligible({ bundleVersion: 1, sessionId: "" }), false);
});

test("isRootCauseHintsEligible: true with qualifying error excerpt", () => {
  assert.equal(
    isRootCauseHintsEligible({
      ...base,
      errors: [{ lineIndex: 1, excerpt: "boom" }],
    }),
    true,
  );
});

test("isRootCauseHintsEligible: false for short error excerpt", () => {
  assert.equal(
    isRootCauseHintsEligible({
      ...base,
      errors: [{ lineIndex: 1, excerpt: "ab" }],
    }),
    false,
  );
});

test("buildHypotheses: empty for ineligible bundle", () => {
  assert.deepEqual(
    buildHypotheses({
      ...base,
      fingerprintLeaders: [{ fingerprint: "fp", count: 3, sampleLineIndex: 0 }],
    }),
    [],
  );
});

test("buildHypotheses: error tier sorts before fingerprint leader", () => {
  const hy = buildHypotheses({
    ...base,
    errors: [{ lineIndex: 10, excerpt: "Something failed badly here" }],
    fingerprintLeaders: [{ fingerprint: "fp1", count: 20, sampleLineIndex: 5 }],
  });
  assert.ok(hy.length >= 2);
  assert.equal(hy[0].templateId, "error-recent");
  assert.equal(hy[0].evidenceLineIds[0], 10);
  assert.ok(hy.some((h) => h.templateId === "fingerprint-leader"));
});

test("buildHypotheses: N+1 for same fingerprint drops duplicate fingerprint leader", () => {
  const hy = buildHypotheses({
    ...base,
    nPlusOneHints: [
      {
        lineIndex: 2,
        fingerprint: "same",
        repeats: 10,
        distinctArgs: 4,
        windowSpanMs: 500,
        confidence: "medium",
      },
    ],
    fingerprintLeaders: [{ fingerprint: "same", count: 30, sampleLineIndex: 1 }],
  });
  const fpOnly = hy.filter((h) => h.templateId === "fingerprint-leader");
  assert.equal(fpOnly.length, 0);
  assert.ok(hy.some((h) => h.templateId === "n-plus-one"));
});

test("buildHypotheses: caps at ROOT_CAUSE_MAX_HYPOTHESES", () => {
  const hints = Array.from({ length: 12 }, (_, i) => ({
    lineIndex: i,
    fingerprint: `f${i}`,
    repeats: 10,
    distinctArgs: 3,
    windowSpanMs: 400,
    confidence: "low" as const,
  }));
  const hy = buildHypotheses({
    ...base,
    nPlusOneHints: hints,
  });
  assert.equal(hy.length, ROOT_CAUSE_MAX_HYPOTHESES);
});

test("buildHypotheses: text length at most ROOT_CAUSE_MAX_TEXT_LEN", () => {
  const long = "x".repeat(400);
  const hy = buildHypotheses({
    ...base,
    errors: [{ lineIndex: 0, excerpt: long }],
  });
  assert.equal(hy.length, 1);
  assert.ok(hy[0].text.length <= ROOT_CAUSE_MAX_TEXT_LEN);
});

test("buildHypotheses: unknown bundleVersion returns []", () => {
  const bad = { ...base, bundleVersion: 99 } as unknown as RootCauseHintBundle;
  assert.deepEqual(buildHypotheses(bad), []);
});

test("isRootCauseHintsEligible / buildHypotheses: fingerprint leader just below threshold (false positive guard)", () => {
  const b: RootCauseHintBundle = {
    ...base,
    fingerprintLeaders: [{ fingerprint: "fp", count: ROOT_CAUSE_FP_LEADER_MIN_COUNT - 1, sampleLineIndex: 0 }],
  };
  assert.equal(isRootCauseHintsEligible(b), false);
  assert.deepEqual(buildHypotheses(b), []);
});

test("isRootCauseHintsEligible / buildHypotheses: sql burst just below threshold (false positive guard)", () => {
  const b: RootCauseHintBundle = {
    ...base,
    sqlBursts: [{ fingerprint: "fp", count: ROOT_CAUSE_SQL_BURST_MIN_COUNT - 1 }],
  };
  assert.equal(isRootCauseHintsEligible(b), false);
  assert.deepEqual(buildHypotheses(b), []);
});

test("buildHypotheses: same error text on different lines merges into one hypothesis with both evidence IDs", () => {
  const hy = buildHypotheses({
    ...base,
    errors: [
      { lineIndex: 3, excerpt: "connection refused on port 8642" },
      { lineIndex: 7, excerpt: "connection refused on port 8642" },
    ],
  });
  const errHy = hy.filter((h) => h.templateId === "error-recent");
  assert.equal(errHy.length, 1);
  assert.ok(errHy[0].evidenceLineIds.includes(3));
  assert.ok(errHy[0].evidenceLineIds.includes(7));
});

test("buildHypotheses: errors ranked by frequency, most frequent text first", () => {
  const hy = buildHypotheses({
    ...base,
    errors: [
      { lineIndex: 10, excerpt: "disk full" },
      { lineIndex: 1, excerpt: "connection refused on port 8642" },
      { lineIndex: 2, excerpt: "connection refused on port 8642" },
      { lineIndex: 3, excerpt: "connection refused on port 8642" },
    ],
  });
  const errHy = hy.filter((h) => h.templateId === "error-recent");
  assert.equal(errHy.length, 2);
  assert.equal(errHy[0].evidenceLineIds.length, 3);
  assert.equal(errHy[1].evidenceLineIds.length, 1);
});

test("buildHypotheses: timestamp-varying duplicates merge (suffix-based key)", () => {
  const hy = buildHypotheses({
    ...base,
    errors: [
      { lineIndex: 5, excerpt: "04-01 17:23:59.153 565 565 E adbd : failed to connect to socket tcp:8642" },
      { lineIndex: 6, excerpt: "04-01 17:23:59.467 565 565 E adbd : failed to connect to socket tcp:8642" },
    ],
  });
  const errHy = hy.filter((h) => h.templateId === "error-recent");
  assert.equal(errHy.length, 1);
  assert.ok(errHy[0].evidenceLineIds.includes(5));
  assert.ok(errHy[0].evidenceLineIds.includes(6));
});

test("buildHypotheses: timestamp-stripped errors stay separate from genuinely different errors", () => {
  const hy = buildHypotheses({
    ...base,
    errors: [
      { lineIndex: 1, excerpt: "04-01 17:00:00.111 565 565 E adbd : failed to connect to socket tcp:8642" },
      { lineIndex: 2, excerpt: "04-01 17:00:00.222 565 565 E adbd : failed to connect to socket tcp:8642" },
      { lineIndex: 3, excerpt: "04-01 17:00:00.333 565 565 E SurfaceFlinger : display was null" },
    ],
  });
  const errHy = hy.filter((h) => h.templateId === "error-recent");
  assert.strictEqual(errHy.length, 2);
  assert.strictEqual(errHy[0].evidenceLineIds.length, 2);
  assert.strictEqual(errHy[1].evidenceLineIds.length, 1);
});

test("buildHypotheses: whitespace-only error excerpts do not qualify (no strip)", () => {
  const b: RootCauseHintBundle = {
    ...base,
    errors: [
      { lineIndex: 0, excerpt: "    " },
      { lineIndex: 1, excerpt: "\t\n" },
    ],
  };
  assert.equal(isRootCauseHintsEligible(b), false);
  assert.deepEqual(buildHypotheses(b), []);
});

test("buildHypotheses: decorative separator lines are filtered out (not real errors)", () => {
  const separators: RootCauseHintBundle = {
    ...base,
    errors: [
      { lineIndex: 0, excerpt: "═══════════════════════════════════════" },
      { lineIndex: 1, excerpt: "────────────────────────────────────────" },
      { lineIndex: 2, excerpt: "========================================" },
      { lineIndex: 3, excerpt: "****************************************" },
      { lineIndex: 4, excerpt: "▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼" },
    ],
  };
  // Eligibility still passes (excerpts pass length check) but hypotheses are empty
  assert.deepEqual(buildHypotheses(separators), []);
});

test("buildHypotheses: mixed decorative and real errors only surfaces real ones", () => {
  const hy = buildHypotheses({
    ...base,
    errors: [
      { lineIndex: 0, excerpt: "═══════════════════════════════════════" },
      { lineIndex: 1, excerpt: "RenderFlex overflowed by 42 pixels" },
      { lineIndex: 2, excerpt: "────────────────────────────────────────" },
    ],
  });
  const errHy = hy.filter((h) => h.templateId === "error-recent");
  assert.strictEqual(errHy.length, 1);
  assert.ok(errHy[0].text.includes("RenderFlex"));
});

test("buildHypotheses: sql burst at threshold is eligible and emits burst template", () => {
  const b: RootCauseHintBundle = {
    ...base,
    sqlBursts: [{ fingerprint: "bfp", count: ROOT_CAUSE_SQL_BURST_MIN_COUNT, windowMs: 100 }],
  };
  assert.equal(isRootCauseHintsEligible(b), true);
  const hy = buildHypotheses(b);
  assert.ok(hy.some((h) => h.templateId === "sql-burst" && h.hypothesisKey === "burst::bfp"));
});
