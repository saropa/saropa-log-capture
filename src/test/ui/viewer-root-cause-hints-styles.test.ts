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
  // Fix: test was referencing .root-cause-hyp-evidence which never existed;
  // the actual class is .rch-report-btn (hypothesis text as clickable report button)
  assert.match(
    css,
    /\.rch-report-btn\s*\{.*?border:\s*none.*?background:\s*transparent.*?appearance:\s*none/s,
    "report button rule must reset UA button chrome + appearance:none",
  );
  assert.match(
    css,
    /\.rch-report-btn:hover\s*\{.*?textLink-foreground/s,
    "hover should use theme link foreground color",
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
