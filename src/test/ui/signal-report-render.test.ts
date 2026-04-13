/**
 * Tests for signal report HTML rendering (pure functions, no VS Code dependency).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { renderEvidenceSection, renderRecommendations, buildSignalReportShell, resolveSourcePaths } from "../../ui/signals/signal-report-render";

// --- renderEvidenceSection ---

test("renderEvidenceSection: should return no-data message for empty groups", () => {
  const html = renderEvidenceSection([]);
  assert.ok(html.includes("No evidence lines found"));
});

test("renderEvidenceSection: should render target line with highlight class", () => {
  const html = renderEvidenceSection([
    [
      { lineIndex: 9, text: "context before", isTarget: false },
      { lineIndex: 10, text: "the error line", isTarget: true },
      { lineIndex: 11, text: "context after", isTarget: false },
    ],
  ]);
  assert.ok(html.includes("evidence-line--target"));
  assert.ok(html.includes("the error line"));
  // Line numbers are 1-based in the display
  assert.ok(html.includes(">11<"));
});

test("renderEvidenceSection: should escape HTML in line text", () => {
  const html = renderEvidenceSection([
    [{ lineIndex: 0, text: "<script>alert(1)</script>", isTarget: true }],
  ]);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("renderEvidenceSection: should render multiple evidence groups", () => {
  const html = renderEvidenceSection([
    [{ lineIndex: 5, text: "first group", isTarget: true }],
    [{ lineIndex: 20, text: "second group", isTarget: true }],
  ]);
  const blockCount = (html.match(/evidence-block/g) || []).length;
  assert.strictEqual(blockCount, 2);
});

// --- renderRecommendations ---

test("renderRecommendations: should return recommendation for known template", () => {
  const html = renderRecommendations("error-recent");
  assert.ok(html.includes("recommendation"));
  assert.ok(html.includes("stack trace"));
});

test("renderRecommendations: should return recommendation for n-plus-one", () => {
  const html = renderRecommendations("n-plus-one");
  assert.ok(html.includes("eager loading"));
});

test("renderRecommendations: should return no-data for unknown template", () => {
  const html = renderRecommendations("unknown-template-xyz");
  assert.ok(html.includes("No specific recommendations"));
});

// --- buildSignalReportShell ---

test("buildSignalReportShell: should include hypothesis text escaped", () => {
  const html = buildSignalReportShell({
    nonce: "test-nonce",
    hypothesis: {
      templateId: "error-recent",
      text: "Error: <bad> stuff",
      evidenceLineIds: [1, 2],
      confidence: "high",
      hypothesisKey: "err::abc",
    },
  });
  assert.ok(html.includes("&lt;bad&gt;"));
  assert.ok(!html.includes("<bad>"));
  assert.ok(html.includes("High confidence"));
  assert.ok(html.includes("conf-badge--high"));
});

test("buildSignalReportShell: should use nonce for CSP and script/style tags", () => {
  const html = buildSignalReportShell({
    nonce: "my-nonce-123",
    hypothesis: {
      templateId: "test",
      text: "Test signal",
      evidenceLineIds: [],
      hypothesisKey: "test::1",
    },
  });
  assert.ok(html.includes('nonce-my-nonce-123'));
  assert.ok(html.includes('nonce="my-nonce-123"'));
});

test("buildSignalReportShell: should default to low confidence when undefined", () => {
  const html = buildSignalReportShell({
    nonce: "n",
    hypothesis: {
      templateId: "test",
      text: "Test",
      evidenceLineIds: [],
      hypothesisKey: "test::2",
    },
  });
  assert.ok(html.includes("Low confidence"));
  assert.ok(html.includes("conf-badge--low"));
});

// --- Title and layout (post-refactor) ---

test("buildSignalReportShell: should include Saropa Signal Report title", () => {
  const html = buildSignalReportShell({
    nonce: "n",
    hypothesis: {
      templateId: "test",
      text: "Some signal",
      evidenceLineIds: [],
      hypothesisKey: "test::3",
    },
  });
  assert.ok(html.includes("<h1>Saropa Signal Report</h1>"));
});

test("buildSignalReportShell: should render signal text in summary div", () => {
  const html = buildSignalReportShell({
    nonce: "n",
    hypothesis: {
      templateId: "test",
      text: "Slow operation (3000ms)",
      evidenceLineIds: [],
      confidence: "medium",
      hypothesisKey: "test::4",
    },
  });
  assert.ok(html.includes('class="signal-summary"'));
  assert.ok(html.includes("Slow operation (3000ms)"));
  assert.ok(html.includes("Medium confidence"));
});

test("buildSignalReportShell: should include save report button", () => {
  const html = buildSignalReportShell({
    nonce: "n",
    hypothesis: {
      templateId: "test",
      text: "Test",
      evidenceLineIds: [],
      hypothesisKey: "test::5",
    },
  });
  assert.ok(html.includes('id="save-report-btn"'));
  assert.ok(html.includes("Save Report"));
});

test("buildSignalReportShell: should include both copy and save buttons in btn-row", () => {
  const html = buildSignalReportShell({
    nonce: "n",
    hypothesis: {
      templateId: "test",
      text: "Test",
      evidenceLineIds: [],
      hypothesisKey: "test::6",
    },
  });
  assert.ok(html.includes('class="btn-row"'));
  assert.ok(html.includes('id="copy-report-btn"'));
  assert.ok(html.includes('id="save-report-btn"'));
});

// --- resolveSourcePaths ---

test("resolveSourcePaths: should resolve relative dart path to absolute", () => {
  const line = "  \u2800 \u00BB _EventBadgeWrapperState._loadBadgeCount (./lib/components/event/event_badge_wrapper.dart:233:7)";
  const result = resolveSourcePaths(line, "/home/user/project");
  assert.ok(result.includes("/home/user/project/lib/components/event/event_badge_wrapper.dart:233:7"));
  assert.ok(!result.includes("./lib"));
});

test("resolveSourcePaths: should normalize Windows backslashes", () => {
  const line = "at (./lib/foo.dart:10:5)";
  const result = resolveSourcePaths(line, "D:\\src\\myproject");
  assert.ok(result.includes("D:/src/myproject/lib/foo.dart:10:5"));
  assert.ok(!result.includes("\\"));
});

test("resolveSourcePaths: should handle path without line numbers", () => {
  const line = "see ./lib/utils/helpers.dart for details";
  const result = resolveSourcePaths(line, "/workspace");
  assert.ok(result.includes("/workspace/lib/utils/helpers.dart"));
});

test("resolveSourcePaths: should not modify lines without relative paths", () => {
  const line = "[log] Drift SELECT: SELECT * FROM users; | args: []";
  const result = resolveSourcePaths(line, "/workspace");
  assert.strictEqual(result, line);
});

test("resolveSourcePaths: should resolve multiple paths in one line", () => {
  const line = "called from ./lib/a.dart:1 via ./lib/b.dart:2";
  const result = resolveSourcePaths(line, "/ws");
  assert.ok(result.includes("/ws/lib/a.dart:1"));
  assert.ok(result.includes("/ws/lib/b.dart:2"));
});
