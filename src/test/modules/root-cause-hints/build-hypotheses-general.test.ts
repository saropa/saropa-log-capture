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

test("buildHypotheses: slow operations use operationName when present", () => {
  const hy = buildHypotheses({
    ...baseV2,
    slowOperations: [{ lineIndex: 20, excerpt: "PERF dbEventCountForDate: 1023ms (fast=0ms)", durationMs: 1023, operationName: "dbEventCountForDate" }],
  });
  assert.ok(hy.some((h) => h.templateId === "slow-operation"));
  /* operationName should appear in the text, not the raw excerpt. */
  assert.ok(hy[0].text.includes("dbEventCountForDate"), "hypothesis text should contain the operation name");
  assert.ok(!hy[0].text.includes("fast=0ms"), "hypothesis text should not contain raw excerpt extras when operationName is present");
});

test("buildHypotheses: slow operations fall back to excerpt when operationName absent", () => {
  const hy = buildHypotheses({
    ...baseV2,
    slowOperations: [{ lineIndex: 20, excerpt: "loadDashboard took 5200ms", durationMs: 5200 }],
  });
  assert.ok(hy.some((h) => h.templateId === "slow-operation"));
  assert.ok(hy[0].text.includes("loadDashboard took 5200ms"), "hypothesis text should fall back to excerpt");
});

test("buildHypotheses: slow operations sorted by duration descending", () => {
  const hy = buildHypotheses({
    ...baseV2,
    slowOperations: [
      { lineIndex: 1, excerpt: "PERF a: 503ms", durationMs: 503, operationName: "a" },
      { lineIndex: 2, excerpt: "PERF b: 1500ms", durationMs: 1500, operationName: "b" },
      { lineIndex: 3, excerpt: "PERF c: 800ms", durationMs: 800, operationName: "c" },
    ],
  });
  const slowHy = hy.filter((h) => h.templateId === "slow-operation");
  /* Highest duration first. */
  assert.ok(slowHy[0].text.includes("b"));
  assert.ok(slowHy[1].text.includes("c"));
  assert.ok(slowHy[2].text.includes("a"));
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

// --- HTTP status code confidence tests ---

test("buildHypotheses: HTTP 4xx network failures get low confidence", () => {
  const hy = buildHypotheses({
    ...baseV2,
    networkFailures: [
      { lineIndex: 10, excerpt: "[API] 404 Not Found (338ms)", pattern: "404 Not Found" },
      { lineIndex: 15, excerpt: "[API] 404 Not Found (340ms)", pattern: "404 Not Found" },
    ],
  });
  const netHy = hy.filter((h) => h.templateId === "network-failure");
  assert.strictEqual(netHy.length, 1, "same HTTP code should group into one hypothesis");
  assert.strictEqual(netHy[0].confidence, "low", "4xx codes should get low confidence");
  assert.ok(netHy[0].text.includes("2 occurrences"), "should show occurrence count");
});

test("buildHypotheses: HTTP 5xx network failures get medium confidence", () => {
  const hy = buildHypotheses({
    ...baseV2,
    networkFailures: [
      { lineIndex: 20, excerpt: "HTTP 500 Internal Server Error", pattern: "500 Internal Server Error" },
    ],
  });
  const netHy = hy.filter((h) => h.templateId === "network-failure");
  assert.strictEqual(netHy.length, 1);
  assert.strictEqual(netHy[0].confidence, "medium", "5xx codes should get medium confidence");
});

test("buildHypotheses: transport-level network failures still get medium confidence", () => {
  /* Regression check: existing transport patterns must remain medium confidence. */
  const hy = buildHypotheses({
    ...baseV2,
    networkFailures: [
      { lineIndex: 5, excerpt: "SocketException: Connection refused", pattern: "SocketException" },
    ],
  });
  const netHy = hy.filter((h) => h.templateId === "network-failure");
  assert.strictEqual(netHy.length, 1);
  assert.strictEqual(netHy[0].confidence, "medium", "transport patterns must stay medium confidence");
});

test("buildHypotheses: mixed HTTP and transport failures produce separate hypotheses", () => {
  const hy = buildHypotheses({
    ...baseV2,
    networkFailures: [
      { lineIndex: 10, excerpt: "[API] 404 Not Found", pattern: "404 Not Found" },
      { lineIndex: 20, excerpt: "ECONNREFUSED on port 8080", pattern: "ECONNREFUSED" },
      { lineIndex: 30, excerpt: "HTTP 503 Service Unavailable", pattern: "503 Service Unavailable" },
    ],
  });
  const netHy = hy.filter((h) => h.templateId === "network-failure");
  assert.strictEqual(netHy.length, 3, "each distinct pattern should produce its own hypothesis");
  /* Verify confidence differs by type. */
  const h404 = netHy.find((h) => h.hypothesisKey === "net::404 Not Found");
  const h503 = netHy.find((h) => h.hypothesisKey === "net::503 Service Unavailable");
  const hTransport = netHy.find((h) => h.hypothesisKey === "net::ECONNREFUSED");
  assert.ok(h404, "404 hypothesis should exist");
  assert.ok(h503, "503 hypothesis should exist");
  assert.ok(hTransport, "transport hypothesis should exist");
  assert.strictEqual(h404!.confidence, "low");
  assert.strictEqual(h503!.confidence, "medium");
  assert.strictEqual(hTransport!.confidence, "medium");
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
