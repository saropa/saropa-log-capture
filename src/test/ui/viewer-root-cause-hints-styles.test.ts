/**
 * Regression tests for Signals strip CSS: evidence controls must not use native button chrome
 * (before: light background in dark webviews; after: link-like reset + theme tokens).
 * Also verifies dismiss/restore button styles are present.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getRootCauseHypothesesStyles } from "../../ui/viewer-styles/viewer-styles-root-cause-hints";

test("Signals evidence buttons reset UA styling to theme link appearance", () => {
  const css = getRootCauseHypothesesStyles();
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

test("should contain dismiss button styles with hover-reveal pattern", () => {
  const css = getRootCauseHypothesesStyles();
  assert.ok(css.includes(".rch-dismiss-btn"), "dismiss button class must exist");
  assert.match(
    css,
    /\.rch-dismiss-btn\s*\{.*?opacity:\s*0/s,
    "dismiss button must be hidden by default",
  );
  assert.match(
    css,
    /li:hover\s+\.rch-dismiss-btn\s*\{.*?opacity:\s*1/s,
    "dismiss button must appear on li hover",
  );
  assert.match(
    css,
    /\.rch-dismiss-btn:hover\s*\{.*?errorForeground/s,
    "dismiss button hover must use error foreground color",
  );
});

test("should contain restore button styles", () => {
  const css = getRootCauseHypothesesStyles();
  assert.ok(css.includes(".rch-restore-btn"), "restore button class must exist");
  assert.match(
    css,
    /\.rch-restore-btn:hover\s*\{.*?textLink-foreground/s,
    "restore button hover must use link foreground color",
  );
});
