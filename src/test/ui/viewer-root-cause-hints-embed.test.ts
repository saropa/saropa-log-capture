/**
 * String-level regression tests for the root-cause hypotheses embed only (no `vscode` dependency chain).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getViewerRootCauseHintsScript } from "../../ui/viewer/viewer-root-cause-hints-script";

test("should contain dismiss button with rch-dismiss-btn class", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rch-dismiss-btn"), "dismiss button class must exist");
  assert.ok(chunk.includes('data-rch-dismiss="'), "dismiss button must carry hypothesis key as data attribute");
});

test("should contain rchDismissedKeys for session dismiss state", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rchDismissedKeys"), "dismissed keys object must exist");
  assert.ok(chunk.includes("Signal hidden for this session"), "dismiss toast message must exist");
});

test("should contain restore button with rch-restore-btn class", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rch-restore-btn"), "restore button class must exist");
  assert.ok(chunk.includes("dismissed"), "restore button text must mention dismissed count");
});

test("should filter dismissed signals from copy-all", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("hVisible"), "copy-all handler must filter to visible signals only");
});

test("strength uses emoji + l10n tooltips (no confPrefix label)", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rchStr('confTooltipMedium'"));
  assert.ok(chunk.includes("rchStr('confTooltipLow'"));
  assert.ok(chunk.includes("root-cause-hyp-conf--"));
  assert.ok(chunk.includes('role="img"'));
  assert.ok(!chunk.includes("rchStr('confPrefix'"));
});

test("error collector skips recentErrorContext lines (proximity-inherited errors)", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(
    chunk.includes("row.recentErrorContext"),
    "collect loop must filter out proximity-inherited error lines to prevent duplicate hypotheses from stack-frame continuations",
  );
});
