/**
 * Tests for v2 general signal hypothesis generation and FNV-1a fingerprinting.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildHypotheses } from "../../../modules/root-cause-hints/build-hypotheses";
import type { RootCauseHintBundle } from "../../../modules/root-cause-hints/root-cause-hint-types";

const base: RootCauseHintBundle = { bundleVersion: 1, sessionId: "s1" };
const baseV2: RootCauseHintBundle = { bundleVersion: 2, sessionId: "s2" };

// --- v2 general signal tests ---

test("buildHypotheses: recurring warnings produce warning-recurring hypothesis", () => {
  const hy = buildHypotheses({
    ...baseV2,
    warningGroups: [{ excerpt: "deprecated API call in UserService", count: 5, lineIndices: [1, 2, 3, 4, 5] }],
  });
  assert.ok(hy.some((h) => h.templateId === "warning-recurring"));
  assert.ok(hy[0].text.includes("5x"));
  assert.ok(hy[0].text.includes("deprecated API"));
  assert.equal(hy[0].confidence, "medium");
});

test("buildHypotheses: network failures produce network-failure hypothesis", () => {
  const hy = buildHypotheses({
    ...baseV2,
    networkFailures: [
      { lineIndex: 10, excerpt: "SocketException: Connection refused", pattern: "SocketException" },
      { lineIndex: 15, excerpt: "SocketException: Connection refused", pattern: "SocketException" },
    ],
  });
  assert.ok(hy.some((h) => h.templateId === "network-failure"));
  assert.ok(hy[0].text.includes("2 occurrences"));
});

test("buildHypotheses: memory events produce high-confidence hypothesis", () => {
  const hy = buildHypotheses({
    ...baseV2,
    memoryEvents: [{ lineIndex: 5, excerpt: "OutOfMemoryError: heap exhaustion" }],
  });
  assert.ok(hy.some((h) => h.templateId === "memory-pressure"));
  assert.equal(hy[0].confidence, "high");
});

test("buildHypotheses: classified critical errors produce high-confidence hypothesis", () => {
  const hy = buildHypotheses({
    ...baseV2,
    classifiedErrors: [{ lineIndex: 3, excerpt: "NullPointerException in UserRepo.getById", classification: "critical" }],
  });
  assert.ok(hy.some((h) => h.templateId === "classified-critical"));
  assert.equal(hy[0].confidence, "high");
});

test("buildHypotheses: ANR risk produces anr-risk hypothesis with score", () => {
  const hy = buildHypotheses({
    ...baseV2,
    anrRisk: { score: 72, level: "high", signals: ["3 ANR keywords", "2 GC pauses"] },
  });
  assert.ok(hy.some((h) => h.templateId === "anr-risk"));
  assert.ok(hy[0].text.includes("72"));
  assert.ok(hy[0].text.includes("ANR keywords"));
  assert.equal(hy[0].confidence, "high");
});

test("buildHypotheses: slow operations include actual duration", () => {
  const hy = buildHypotheses({
    ...baseV2,
    slowOperations: [{ lineIndex: 20, excerpt: "loadDashboard took 5200ms", durationMs: 5200 }],
  });
  assert.ok(hy.some((h) => h.templateId === "slow-operation"));
  assert.ok(hy[0].text.includes("5.2s"));
});

test("buildHypotheses: slow operations with same excerpt at different lines merge via content key", () => {
  const hy = buildHypotheses({
    ...baseV2,
    slowOperations: [
      { lineIndex: 10, excerpt: "loadDashboard took 5200ms", durationMs: 5200 },
      { lineIndex: 50, excerpt: "loadDashboard took 5200ms", durationMs: 5200 },
    ],
  });
  const slowHy = hy.filter((h) => h.templateId === "slow-operation");
  assert.strictEqual(slowHy.length, 1, "same excerpt should merge into one hypothesis");
});

test("buildHypotheses: permission denials produce hypothesis", () => {
  const hy = buildHypotheses({
    ...baseV2,
    permissionDenials: [{ lineIndex: 8, excerpt: "SecurityException: CAMERA permission denied" }],
  });
  assert.ok(hy.some((h) => h.templateId === "permission-denial"));
  assert.ok(hy[0].text.includes("CAMERA"));
});

// --- FNV-1a fingerprinting tests ---

test("buildHypotheses: errors with different ports/IDs merge via FNV-1a fingerprint", () => {
  const hy = buildHypotheses({
    ...base,
    errors: [
      { lineIndex: 1, excerpt: "Connection refused on port 8080" },
      { lineIndex: 2, excerpt: "Connection refused on port 9090" },
      { lineIndex: 3, excerpt: "Connection refused on port 3000" },
    ],
  });
  const errHy = hy.filter((h) => h.templateId === "error-recent");
  assert.strictEqual(errHy.length, 1, "ports differ but normalized text is same");
  assert.strictEqual(errHy[0].evidenceLineIds.length, 3);
});

test("buildHypotheses: fatal errors get high confidence via crash category", () => {
  const hy = buildHypotheses({
    ...base,
    errors: [{ lineIndex: 5, excerpt: "FATAL: unhandled exception in main isolate" }],
  });
  const errHy = hy.filter((h) => h.templateId === "error-recent");
  assert.strictEqual(errHy.length, 1);
  assert.strictEqual(errHy[0].confidence, "high");
});
