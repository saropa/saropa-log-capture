/**
 * Regression tests for dialog responsiveness. Every modal-content variant must cap its min-width
 * to the viewport: before, a fixed min-width (450/480/500/320/340px) ran the dialog off the left
 * edge and clipped its titles/labels/buttons when the log-viewer panel was narrower than the floor;
 * after, min(Npx, calc(100vw - 24px)) keeps the dialog fully on screen at any width.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getModalStyles } from "../../ui/viewer-styles/viewer-styles-modal";
import { getEditModalStyles } from "../../ui/viewer-styles/viewer-styles-edit-modal";
import { getSessionInfoModalStyles } from "../../ui/viewer-styles/viewer-styles-session-info-modal";

test("base + per-dialog modal-content min-widths cap to the viewport (no bare fixed floor)", () => {
  const css = getModalStyles();
  assert.match(
    css,
    /\.modal-content\s*\{[^}]*min-width:\s*min\([^)]*calc\(100vw/s,
    ".modal-content must cap min-width to the viewport",
  );
  assert.match(
    css,
    /\.log-file-modal-content\s*\{[^}]*min-width:\s*min\([^)]*calc\(100vw/s,
    ".log-file-modal-content must cap min-width to the viewport",
  );
  assert.match(
    css,
    /\.files-list-modal-content\s*\{[^}]*min-width:\s*min\([^)]*calc\(100vw/s,
    ".files-list-modal-content must cap min-width to the viewport",
  );
});

test("edit dialog min-width caps to the viewport", () => {
  assert.match(
    getEditModalStyles(),
    /\.edit-modal-content\s*\{[^}]*min-width:\s*min\([^)]*calc\(100vw/s,
    "edit dialog must cap min-width to the viewport",
  );
});

test("session-info dialog min-width caps to the viewport", () => {
  assert.match(
    getSessionInfoModalStyles(),
    /\.session-info-modal-content\s*\{[^}]*min-width:\s*min\([^)]*calc\(100vw/s,
    "session-info dialog must cap min-width to the viewport",
  );
});
