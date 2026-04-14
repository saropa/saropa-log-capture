/**
 * Regression tests for muted decoration/link styling.
 *
 * Decorations (counter, timestamp, elapsed, separator) and clickable links
 * (source-link, url-link) must render in grey (editorLineNumber token) so
 * they visually recede behind severity-coloured log content. Links reveal
 * their blue colour only on hover.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getDecorationStyles } from "../../ui/viewer-styles/viewer-styles-decoration";
import { getLineStyles } from "../../ui/viewer-styles/viewer-styles-lines";

// --- Decoration prefix ---

test("decoration prefix uses editorLineNumber grey, not inherited level color", () => {
  const css = getDecorationStyles();
  assert.match(
    css,
    /\.line-decoration\s*\{[^}]*editorLineNumber-foreground/s,
    ".line-decoration must set color to editorLineNumber token",
  );
});

test("decoration prefix does not use opacity hack", () => {
  const css = getDecorationStyles();
  const rule = css.match(/\.line-decoration\s*\{[^}]*\}/s)?.[0] ?? "";
  assert.ok(
    !rule.includes("opacity"),
    ".line-decoration should not set opacity (explicit color replaces opacity)",
  );
});

test("no standalone deco-counter color rule (parent handles it)", () => {
  const css = getDecorationStyles();
  assert.ok(
    !css.includes(".deco-counter"),
    ".deco-counter rule should be removed — parent .line-decoration sets the grey",
  );
});

// --- Source file links ---

test("source-link defaults to grey, not blue", () => {
  const css = getLineStyles();
  assert.match(
    css,
    /\.source-link\s*\{[^}]*editorLineNumber-foreground/s,
    ".source-link must default to editorLineNumber grey",
  );
});

test("source-link reveals blue on hover", () => {
  const css = getLineStyles();
  assert.match(
    css,
    /\.source-link:hover\s*\{[^}]*textLink-foreground/s,
    ".source-link:hover must switch to textLink blue",
  );
});

// --- URL links ---

test("url-link defaults to grey, not blue", () => {
  const css = getLineStyles();
  assert.match(
    css,
    /\.url-link\s*\{[^}]*editorLineNumber-foreground/s,
    ".url-link must default to editorLineNumber grey",
  );
});

test("url-link reveals blue on hover", () => {
  const css = getLineStyles();
  assert.match(
    css,
    /\.url-link:hover\s*\{[^}]*textLink-foreground/s,
    ".url-link:hover must switch to textLink blue",
  );
});

// --- Recent-error-context border ---

test("recent-error-context uses box-shadow, not border-left (no layout shift)", () => {
  const css = getLineStyles();
  const rule = css.match(/\.line\.recent-error-context\s*\{[^}]*\}/s)?.[0] ?? "";
  /* Before this fix, the rule used border-left + padding-left: 5px, which
     overrode the base 1.85em left padding and shifted content leftward when
     decorations were off.  box-shadow avoids layout participation entirely. */
  assert.ok(
    rule.includes("box-shadow"),
    ".line.recent-error-context must use box-shadow for the left indicator",
  );
  assert.ok(
    !rule.includes("border-left"),
    ".line.recent-error-context must not use border-left (causes layout shift)",
  );
  assert.ok(
    !rule.includes("padding-left"),
    ".line.recent-error-context must not override padding-left (causes content shift)",
  );
});
