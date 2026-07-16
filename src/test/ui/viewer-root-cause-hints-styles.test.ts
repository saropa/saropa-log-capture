/**
 * Regression tests for Signals strip CSS: evidence controls must not use native button chrome
 * (before: light background in dark webviews; after: link-like reset + theme tokens).
 * Also verifies dismiss/restore button styles are present.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getRootCauseHypothesesStyles } from "../../ui/viewer-styles/viewer-styles-root-cause-hints";

test("Signals hint text button resets UA styling to theme link appearance", () => {
  const css = getRootCauseHypothesesStyles();
  // The clickable hint text is .rch-hyp-text (report-open moved to the .rch-report-btn icon).
  assert.match(
    css,
    /\.rch-hyp-text\s*\{.*?border:\s*none.*?background:\s*transparent.*?appearance:\s*none/s,
    "hint text rule must reset UA button chrome + appearance:none",
  );
  assert.match(
    css,
    /\.rch-hyp-text:hover\s*\{.*?var\(--link\)/s,
    "hover should use the --link token (maps to theme textLink-foreground)",
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
    /\.rch-dismiss-btn:hover\s*\{.*?var\(--status-bad\)/s,
    "dismiss button hover must use the --status-bad token (maps to theme editorError-foreground)",
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
    /\.root-cause-hypotheses-list\s+li\s*\{[^}]*gap:\s*var\(--space-1\)/s,
    "list items must have gap for spacing between children (--space-1 = 4px)",
  );
});

test("hint text truncates by default and wraps only when the row is expanded", () => {
  const css = getRootCauseHypothesesStyles();
  // Default: flex:1 + min-width:0 + ellipsis truncate the hint to one line so the strip stays compact.
  assert.match(
    css,
    /\.rch-hyp-text\s*\{[^}]*flex:\s*1/s,
    "hint text must flex-grow to fill available width",
  );
  assert.match(
    css,
    /\.rch-hyp-text\s*\{[^}]*min-width:\s*0/s,
    "hint text must allow shrinking so the ellipsis triggers at the column edge",
  );
  assert.match(
    css,
    /\.rch-hyp-text\s*\{[^}]*text-overflow:\s*ellipsis/s,
    "hint text must truncate with an ellipsis by default",
  );
  // Expanded: clicking the text toggles .rch-expanded on the row, which wraps the full text.
  assert.match(
    css,
    /li\.rch-expanded\s+\.rch-hyp-text\s*\{[^}]*white-space:\s*normal/s,
    "expanded row must wrap the full hint text",
  );
});

test("hint list is numbered via a CSS counter", () => {
  const css = getRootCauseHypothesesStyles();
  assert.match(
    css,
    /\.root-cause-hypotheses-list\s*\{[^}]*counter-reset:\s*rch-item/s,
    "list must reset the numbering counter",
  );
  assert.match(
    css,
    /li::before\s*\{[^}]*counter-increment:\s*rch-item[^}]*content:\s*counter\(rch-item\)/s,
    "each row must render its number via the counter",
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
    /\.rch-restore-btn:hover\s*\{.*?var\(--link\)/s,
    "restore button hover must use the --link token (maps to theme textLink-foreground)",
  );
});
