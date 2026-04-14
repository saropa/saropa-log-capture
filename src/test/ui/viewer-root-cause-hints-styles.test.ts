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

test("should use flex layout on list items so signal text wraps", () => {
  const css = getRootCauseHypothesesStyles();
  // Before fix: list items used default inline layout, long signal text
  // overflowed the panel. After fix: flex layout constrains the text button.
  assert.match(
    css,
    /\.root-cause-hypotheses-list\s+li\s*\{[^}]*display:\s*flex/s,
    "list items must use flex layout for wrapping",
  );
  assert.match(
    css,
    /\.root-cause-hypotheses-list\s+li\s*\{[^}]*gap:\s*4px/s,
    "list items must have gap for spacing between children",
  );
});

test("should allow report button text to wrap within available width", () => {
  const css = getRootCauseHypothesesStyles();
  // Before fix: button text never wrapped (default button behavior).
  // After fix: flex:1 + min-width:0 + word-break let long text wrap.
  assert.match(
    css,
    /\.rch-report-btn\s*\{[^}]*flex:\s*1/s,
    "report button must flex-grow to fill available width",
  );
  assert.match(
    css,
    /\.rch-report-btn\s*\{[^}]*min-width:\s*0/s,
    "report button must allow shrinking below intrinsic width",
  );
  assert.match(
    css,
    /\.rch-report-btn\s*\{[^}]*word-break:\s*break-word/s,
    "report button text must break long words to prevent overflow",
  );
});

test("should prevent emoji and dismiss button from shrinking in flex", () => {
  const css = getRootCauseHypothesesStyles();
  // Emoji badge and dismiss × must stay fixed-size while text wraps
  assert.match(
    css,
    /\.root-cause-hyp-conf\s*\{[^}]*flex-shrink:\s*0/s,
    "confidence emoji must not shrink in flex layout",
  );
  assert.match(
    css,
    /\.rch-dismiss-btn\s*\{[^}]*flex-shrink:\s*0/s,
    "dismiss button must not shrink in flex layout",
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
