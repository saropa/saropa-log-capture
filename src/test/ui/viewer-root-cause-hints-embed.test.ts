/**
 * String-level regression tests for the root-cause hypotheses embed only (no `vscode` dependency chain).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getViewerRootCauseHintsScript } from "../../ui/viewer/viewer-root-cause-hints-script";

test("should not contain dismiss button or dismissed variable", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(!chunk.includes("rootCauseHypothesesDismissed"), "dismissed variable must not exist");
  assert.ok(!chunk.includes("root-cause-hypotheses-dismiss"), "dismiss button class must not exist");
  assert.ok(!chunk.includes("rchStr('dismissAria'"), "dismiss aria l10n key must not exist");
  assert.ok(!chunk.includes("rchStr('dismissTitle'"), "dismiss title l10n key must not exist");
});

test("strength uses emoji + l10n tooltips (no confPrefix label)", () => {
  const chunk = getViewerRootCauseHintsScript();
  assert.ok(chunk.includes("rchStr('confTooltipMedium'"));
  assert.ok(chunk.includes("rchStr('confTooltipLow'"));
  assert.ok(chunk.includes("root-cause-hyp-conf--"));
  assert.ok(chunk.includes('role="img"'));
  assert.ok(!chunk.includes("rchStr('confPrefix'"));
});
