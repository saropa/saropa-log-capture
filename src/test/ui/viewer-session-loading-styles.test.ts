/**
 * Tests for session panel loading/shimmer CSS classes.
 * Verifies the shimmer-meta class exists and reuses the shared animation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getSessionTagsLoadingStyles } from "../../ui/viewer-styles/viewer-styles-session-tags-loading";

test("session-shimmer-meta class should exist with animation", () => {
  const css = getSessionTagsLoadingStyles();
  assert.match(
    css,
    /\.session-shimmer-meta\s*\{/,
    "shimmer-meta class must be defined",
  );
  assert.match(
    css,
    /\.session-shimmer-meta::after\s*\{.*?animation:\s*session-shimmer/s,
    "shimmer-meta ::after must use the shared session-shimmer animation",
  );
});

test("session-shimmer-meta should have position:relative and overflow:hidden", () => {
  const css = getSessionTagsLoadingStyles();
  assert.match(
    css,
    /\.session-shimmer-meta\s*\{[^}]*position:\s*relative/s,
    "shimmer-meta needs position:relative for the ::after overlay",
  );
  assert.match(
    css,
    /\.session-shimmer-meta\s*\{[^}]*overflow:\s*hidden/s,
    "shimmer-meta needs overflow:hidden to clip the sweep",
  );
});

test("session-shimmer keyframe animation should be defined", () => {
  const css = getSessionTagsLoadingStyles();
  assert.match(
    css,
    /@keyframes session-shimmer\s*\{/,
    "session-shimmer keyframe must exist for the sweep animation",
  );
});
