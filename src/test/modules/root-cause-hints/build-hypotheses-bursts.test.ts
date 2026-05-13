import test from "node:test";
import assert from "node:assert/strict";
import { buildHypotheses } from "../../../modules/root-cause-hints/build-hypotheses";
import { isRootCauseHintsEligible } from "../../../modules/root-cause-hints/root-cause-hint-eligibility";
import type { RootCauseHintBundle } from "../../../modules/root-cause-hints/root-cause-hint-types";

const base: RootCauseHintBundle = {
  bundleVersion: 2,
  sessionId: "s-bursts",
};

// -------- F10 Severity escalation --------

test("severity escalation: hypothesis surfaces with correct count and excerpt", () => {
  const hy = buildHypotheses({
    ...base,
    severityEscalations: [
      {
        errorLineIndex: 42,
        errorExcerpt: "Database connection lost",
        precedingWarningLineIds: [38, 40],
        windowMs: 3200,
      },
    ],
  });
  const esc = hy.find((h) => h.templateId === "severity-escalation");
  assert.ok(esc, "expected a severity-escalation hypothesis");
  assert.match(esc.text, /2 warnings/);
  assert.match(esc.text, /3\.2s/);
  assert.match(esc.text, /Database connection lost/);
  // Error first, then warnings in chronological order, so clicking goes to the failure
  assert.deepEqual(esc.evidenceLineIds, [42, 38, 40]);
  assert.equal(esc.confidence, "medium");
});

test("severity escalation: singular wording for one warning", () => {
  // The min is 2 — but if upstream loosens it, hypothesis builder must still grammar correctly.
  // Tests current behavior: a one-warning chain emitted by upstream still renders cleanly.
  const hy = buildHypotheses({
    ...base,
    severityEscalations: [
      {
        errorLineIndex: 5,
        errorExcerpt: "Validation failed on submit",
        precedingWarningLineIds: [3],
        windowMs: 1500,
      },
    ],
  });
  const esc = hy.find((h) => h.templateId === "severity-escalation");
  assert.ok(esc);
  assert.match(esc.text, /1 warning preceded/); // singular, not "warnings"
});

test("severity escalation: eligibility true when chain present", () => {
  assert.equal(
    isRootCauseHintsEligible({
      ...base,
      severityEscalations: [
        {
          errorLineIndex: 1,
          errorExcerpt: "boom",
          precedingWarningLineIds: [0],
          windowMs: 100,
        },
      ],
    }),
    true,
  );
});

// -------- F9 Silence-then-burst --------

test("silence-burst: hypothesis surfaces with silence and burst sizing", () => {
  const hy = buildHypotheses({
    ...base,
    silenceBursts: [
      {
        lineIndex: 100,
        silenceMs: 12500,
        burstSize: 45,
        burstWindowMs: 320,
      },
    ],
  });
  const sb = hy.find((h) => h.templateId === "silence-burst");
  assert.ok(sb);
  assert.match(sb.text, /12\.5s/);
  assert.match(sb.text, /45 lines/);
  assert.match(sb.text, /320ms/);
  assert.equal(sb.confidence, "medium");
});

test("silence-burst: confidence promotes to high for >=30s silence", () => {
  const hy = buildHypotheses({
    ...base,
    silenceBursts: [
      {
        lineIndex: 50,
        silenceMs: 35_000,
        burstSize: 30,
        burstWindowMs: 800,
      },
    ],
  });
  const sb = hy.find((h) => h.templateId === "silence-burst");
  assert.ok(sb);
  assert.equal(sb.confidence, "high");
});

test("silence-burst: eligibility true when present", () => {
  assert.equal(
    isRootCauseHintsEligible({
      ...base,
      silenceBursts: [
        { lineIndex: 0, silenceMs: 11000, burstSize: 21, burstWindowMs: 900 },
      ],
    }),
    true,
  );
});

// -------- F14 Frame-budget cluster --------

test("frame-budget cluster: hypothesis surfaces with count and window", () => {
  const hy = buildHypotheses({
    ...base,
    frameBudgetClusters: [
      {
        lineIndices: [10, 14, 18, 22, 26, 30],
        windowMs: 8400,
      },
    ],
  });
  const fbc = hy.find((h) => h.templateId === "frame-budget-cluster");
  assert.ok(fbc);
  assert.match(fbc.text, /6 slow operations/);
  assert.match(fbc.text, /8\.4s/);
  assert.equal(fbc.confidence, "medium");
  // Evidence preserves chronological order so the user sees the cluster as a sequence
  assert.deepEqual(fbc.evidenceLineIds, [10, 14, 18, 22, 26, 30]);
});

test("frame-budget cluster: eligibility true when present", () => {
  assert.equal(
    isRootCauseHintsEligible({
      ...base,
      frameBudgetClusters: [{ lineIndices: [1, 2, 3, 4, 5], windowMs: 5000 }],
    }),
    true,
  );
});

// -------- Negative cases --------

test("no burst signals: no burst hypotheses emitted", () => {
  const hy = buildHypotheses({
    ...base,
    // Provide an unrelated qualifying signal so the bundle is eligible
    errors: [{ lineIndex: 1, excerpt: "something failed" }],
  });
  assert.equal(hy.filter((h) => h.templateId === "severity-escalation").length, 0);
  assert.equal(hy.filter((h) => h.templateId === "silence-burst").length, 0);
  assert.equal(hy.filter((h) => h.templateId === "frame-budget-cluster").length, 0);
});

test("eligibility: empty burst arrays do not promote eligibility on their own", () => {
  assert.equal(
    isRootCauseHintsEligible({
      ...base,
      severityEscalations: [],
      silenceBursts: [],
      frameBudgetClusters: [],
    }),
    false,
  );
});
