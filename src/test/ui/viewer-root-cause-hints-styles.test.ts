/**
 * Regression tests for Signals strip CSS: evidence controls must not use native button chrome
 * (before: light background in dark webviews; after: link-like reset + theme tokens).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getRootCauseHypothesesStyles } from "../../ui/viewer-styles/viewer-styles-root-cause-hints";

test("should not contain dismiss button styles", () => {
  const css = getRootCauseHypothesesStyles();
  assert.ok(
    !css.includes(".root-cause-hypotheses-dismiss"),
    "dismiss CSS class must not exist after removal",
  );
});

test("Signals evidence buttons reset UA styling to theme link appearance", () => {
  const css = getRootCauseHypothesesStyles();
  // Order in stylesheet: border + background reset, link color token, then appearance:none (after: no UA button face).
  assert.match(
    css,
    /\.root-cause-hyp-evidence\s*\{.*?border:\s*none.*?background:\s*transparent.*?--vscode-textLink-foreground.*?appearance:\s*none/s,
    "evidence rule must reset UA button and keep theme link + appearance:none",
  );
  assert.match(
    css,
    /\.root-cause-hyp-evidence:hover\s*\{.*?textLink-activeForeground/s,
    "hover should prefer active link foreground when theme provides it",
  );
});
