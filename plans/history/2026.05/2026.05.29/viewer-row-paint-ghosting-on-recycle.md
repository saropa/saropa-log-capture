# Viewer Row Paint Ghosting on Recycle

User reported the log viewer rendering line 664 of [contacts/reports/20260529/20260529_123051_contacts.log](d:/src/contacts/reports/20260529/20260529_123051_contacts.log) — `[14:48:49.390] [drift-perf] DRIFT: Drift debug server disconnected` — with blue text ghosting through the green `level-database` row, calling it embarrassing. Hovering the row cleared the ghost. The user pasted the rendered DOM and it was clean (single `.line.level-database.level-bar-database`, one text node, no overlapping span), so the artifact was not in HTML structure.

## Finish Report (2026-05-29)

### Scope

(B) VS Code extension. Two non-test source touches:

- [src/ui/viewer-styles/viewer-styles-lines.ts](../../../../src/ui/viewer-styles/viewer-styles-lines.ts) — added `transform: translateZ(0)` to the `.line, .stack-header` base rule.
- [CHANGELOG.md](../../../../CHANGELOG.md) — added `### Fixed` entry under `## [Unreleased]`.

Plus a regression test:

- [src/test/ui/viewer-muted-decorations.test.ts](../../../../src/test/ui/viewer-muted-decorations.test.ts) — new case pinning the `transform: translateZ(0)` declaration on the base row rule so a future "drop the transform, isolation already handles it" cleanup is caught.

### Root cause

The viewer is a virtualized list: [viewer-data-viewport.ts](../../../../src/ui/viewer/viewer-data-viewport.ts) renders the visible window by writing the full HTML block via `viewportEl.innerHTML = parts.join('')` whenever `startIdx`/`endIdx` change. When a recycled slot transitions from one severity level to another — in the reported case `level-info` (blue, `--vscode-charts-blue`) for `Application finished.` to `level-database` (green, `--vscode-charts-green`) for `DRIFT: Drift debug server disconnected` — Chromium can fail to invalidate the prior paint inside the slot's bounding box. Result: the new green text rasterizes on top of un-cleared blue pixels from the prior row, so faint blue characters ghost through. A `:hover` repaint (or any property change that forces a layer repaint) clears it.

The original CSS for `.line, .stack-header` already had `position: relative; isolation: isolate;` — `isolation: isolate` creates a stacking context but does not promote to a compositor layer, so it doesn't isolate paint invalidation across content swaps.

### Fix

Add `transform: translateZ(0)` to the `.line, .stack-header` base rule. This forces Chromium to promote each visible row to its own compositor layer, so each row's paint is invalidated atomically on `innerHTML` replace. Bounded cost: virtualization keeps ~50 rows live at any time, so the GPU-memory ceiling is small.

```css
.line, .stack-header {
    position: relative;
    isolation: isolate;
    transform: translateZ(0);  /* per-row compositor layer */
}
```

Comment block in the file names the failure mode, the symptom (Drift line ghost behind blue), and the bounded cost.

### Risks considered

- `transform: translateZ(0)` makes the element a containing block for `position: fixed` descendants. There are none inside `.line` or `.stack-header` in this codebase.
- `transform` creates a stacking context (same as the existing `isolation: isolate`), so descendant z-order is unchanged.
- Chromium can anti-alias text differently on compositor layers vs the main layer. For dense monospace columns this could surface as faint blur on some GPUs. If users report this, the fallback is `contain: layout style` (less aggressive — isolates layout/style calculations without forcing a layer), accepting that it may not fully fix the paint glitch.
- The severity-gutter `::after` connector in [viewer-styles-decoration-bars.ts](../../../../src/ui/viewer-styles/viewer-styles-decoration-bars.ts) deliberately overflows past `.line`'s bottom edge (`bottom: -50%`) to reach the next dot. `transform` does NOT clip overflow, so the gutter stripe still works. (`contain: paint` WOULD clip it — that's why it wasn't chosen.)

### Tests audited

Greped `src/test` for any assertion on:

- `viewer-styles-lines`, `getLineStyles` → matches [src/test/ui/viewer-muted-decorations.test.ts](../../../../src/test/ui/viewer-muted-decorations.test.ts)
- `level-bar-database`, `level-info`, `level-database` → matches [src/test/ui/viewer-level-line-colors.test.ts](../../../../src/test/ui/viewer-level-line-colors.test.ts)
- `transform`, `translateZ`, `isolation` — no project-level test files use these terms
- `\.line\s*,`, `\.line\s*\{`, `\.line\s*\.`, `\.line:hover` — no matches in any test

Existing assertions pin separate rules (`.line.level-info`, `.source-link`, `.line.recent-error-context`, `.deco-counter`, `.line-decoration`); none pin the base `.line, .stack-header` declaration list. Verified by reading both files end-to-end.

### Test runs

- `npm run check-types` → 0 errors.
- `npm run compile` → 0 errors. NLS, webview catalogs, host outbound catalog, commands list, dist size all OK (4.32 MiB / 12 MiB ceiling).
- `npm run compile-tests` → OK.
- `node --test out/test/ui/viewer-muted-decorations.test.js` → **9 pass / 0 fail**, including the new `.line, .stack-header carry transform: translateZ(0) for compositor isolation` case.
- `out/test/ui/viewer-level-line-colors.test.js` uses Mocha `suite()` and does not load under raw `node --test` (memory: "Mocha suite() files produce no output that way"). Audited by inspection: every assertion targets `.line.level-<name>` or `.level-bar-<name>` selectors — none touch the base `.line, .stack-header` rule. Safe.

### Manual verification path (for the user)

Reload the Extension Host (Ctrl+R in the Dev Host window) and reopen [contacts/reports/20260529/20260529_123051_contacts.log](d:/src/contacts/reports/20260529/20260529_123051_contacts.log). Scroll to line 664. The row should now render the green `DRIFT: Drift debug server disconnected` cleanly with no blue ghost — without needing to hover.

### Project maintenance

- CHANGELOG entry added under `## [Unreleased] → ### Fixed`.
- README verified — no updates needed (mentions Drift / SQL features but nothing about the row paint pipeline).
- `docs/LAUNCH_TEST.md` does not exist in this project; nothing to update.
- No `bugs/*.md` describes this task; archival not applicable.

### Files in commit `49297d75`

- [src/ui/viewer-styles/viewer-styles-lines.ts](../../../../src/ui/viewer-styles/viewer-styles-lines.ts) — `transform: translateZ(0)` plus comment block.
- [CHANGELOG.md](../../../../CHANGELOG.md) — fix entry.

### Files in this commit (finish-report)

- [src/test/ui/viewer-muted-decorations.test.ts](../../../../src/test/ui/viewer-muted-decorations.test.ts) — new regression test.
- [plans/history/2026.05/2026.05.29/viewer-row-paint-ghosting-on-recycle.md](./viewer-row-paint-ghosting-on-recycle.md) — this file.

### Outstanding

None.

Bug archived: No bug archive — task did not close a `bugs/*.md` file.

Finish report saved: `plans/history/2026.05/2026.05.29/viewer-row-paint-ghosting-on-recycle.md`.
