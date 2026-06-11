# Copy + collapse ASCII art blocks

The user asked, against a screenshot of the log viewer showing the grouped "DRIFT DEBUG SERVER" box-drawing banner: "1. make the ascii art have a special copy menu item(s) - just like errors. 2. make ascii art collapsible but expanded by default." This task adds a dedicated **Copy ASCII art** context-menu item (one-gesture copy of the whole block, mirroring **Copy Error** / **Copy DB cluster**) and a per-block collapse chevron that folds the banner to its start row, expanded by default.

## Finish Report (2026-06-11)

### 1. Critical note

This work will be reviewed by another AI.

### 2. Scope

**(B)** VS Code extension (TypeScript) only. No Flutter/Dart app code, no docs-only-only change.

### 3. Deep review

- **Logic & safety:** `computeAsciiArtBlockRange` / `computeAsciiArtBlockLineRange` early-return on out-of-bounds and on rows with no `artBlockPos`, then expand only over contiguous `artBlockPos` rows — bounded by array edges, no unbounded loop. `toggleAsciiArtBlock` recomputes the band from the clicked index (does not trust a stored start), so a stale index cannot desync the toggle. `calcItemHeight` gates collapsed middle/end rows to 0 while the start row is unconditional, so a block can never collapse to nothing (the toggle anchor always renders).
- **Architecture & adherence:** Followed the existing grouped-block-copy pattern exactly — a dedicated `compute*LineRange` module (TS source-of-truth + browser mirror) wired into `getContextMenuScript()` alongside the incident-range and db-burst-range modules; the menu row carries a `data-copy-*-row` marker gated in `showContextMenu`; the action is handled in `handleBlockCopyAction` via the shared `copyLineRangePlain`. Collapse reuses the established `recalcAndRender()` toggle convention (same as `toggleStackGroup` / continuation groups). No new message types (copy reuses the existing `copyToClipboard` host message).
- **Linter-specific integrity:** SKIPPED [B — not a Dart linter project].
- **Performance & UI/UX:** Range expansion and the toggle are O(block length) over a contiguous run, run only on right-click / chevron-click — not on the render hot path. `artBlockCount` is stamped once at block finalization so render does not re-walk the band. The chevron is absolutely positioned over the block's corner (CSS) so it never reflows the `white-space:pre` box art. Collapsed start row gets full-radius corners so the lone visible row reads as a closed tab rather than an open box.
- **Documentation quality:** Every new function carries a doc header stating the why (range module header explains both detection paths feed one contiguous band; `toggleAsciiArtBlock` explains why `artCollapsed` is set on every row rather than via a start back-reference; the `calcItemHeight` and CSS comments explain the collapsed-corner and absolute-position decisions).
- **Refactoring:** None beyond scope. The two pre-existing `max-lines` warnings on `viewer-data-helpers-core.ts` (335) and `-render.ts` (343) were already over the 300 cap at HEAD (the whole viewer-data-helpers family ships over-limit, as does the untouched `viewer-script-messages.ts` at 352); splitting a shared hot render file as collateral for a two-feature change would be blast-radius churn, so it was not done. My only newly-introduced over-limit risk (the grown test file) was avoided by putting the collapse tests in their own file.

### 4. Testing validation

**A. Existing-test audit.** Grepped `src/test` for every changed symbol (`artBlockPos`, `artCollapsed`, `art-collapse`, `computeAsciiArtBlock`, `copy-ascii-art`, `toggleAsciiArtBlock`, `artBlockCount`) and for the grouped-block-copy markers (`grouped-block-copy-separator`, `copy-error-warning-block`, `handleBlockCopyAction`, `copyEwBlock`, `copyDbCluster`).
- `viewer-ascii-art-block.test.ts` pinned the OLD combined `start || end` height line; my split for collapse broke it. Rewrote that one assertion to pin the new collapse-aware branches (start always `+6`; end `artCollapsed ? 0 : +6`; middle `artCollapsed ? 0 : logFontSize`). Did not delete or comment out.
- `viewer-context-menu.test.ts` and `viewer-context-menu-html.test.ts` reference grouped-block copy but assert presence/structure, not exhaustive item counts — unaffected; ran both to confirm.

**B. New tests.**
- New `viewer-context-menu-ascii-art-range.test.ts` (5 cases): not-an-art-row → null, full-band expansion from any interior row, two adjacent blocks separated by a plain row do not merge, out-of-bounds → null, edge-bounded block.
- New `viewer-ascii-art-collapse.test.ts` (7 cases): `artBlockCount` stamp, collapsed middle/end → 0 height, start always visible, `toggleAsciiArtBlock` flips `artCollapsed` band-wide, chevron rendered only on start, click route to `toggleAsciiArtBlock`, collapsed-corner CSS.

**Commands run (vscode-test Extension Host):**
- `viewer-context-menu-ascii-art-range.test.js` → 5 passing
- `viewer-ascii-art-collapse.test.js` → 7 passing
- `viewer-ascii-art-block.test.js` → 28 passing (after the assertion update)
- `viewer-script-syntax.test.js` → 17 passing (confirms the injected webview JS parses)
- `viewer-context-menu-html.test.js` → 24 passing; `viewer-context-menu.test.js` → 31 passing
- `npm run check-types` → clean; `npm run compile` → clean (NLS 487 keys aligned, webview incoming/outbound catalogs match, list-commands match, dist 4.65 MiB under cap)
- `npm run lint` → 0 errors; remaining 9 warnings all pre-existing (`max-lines` on the two helpers files + untouched `viewer-script-messages.ts`, plus unrelated `max-params`/`curly` in files not touched here).

### 5. Localization

SKIPPED [B — extension scope]. Strings added are extension i18n, handled inline at write time (not Flutter ARB): host `t()` keys `viewer.ctx.copyAsciiArt.label`/`.title` in `strings-viewer-g.ts`; webview `vt()` keys `viewer.art.expand`/`viewer.art.collapse` in `strings-webview-b.ts`. These are not `package.nls` manifest keys, so `verify-nls` (which passed) does not cover them; translation of these new keys is a separate pipeline on its own cadence and was not triggered.

### 6. Project maintenance & tracking

- CHANGELOG.md — updated under `## [Unreleased]` → Added with a user-facing entry for both features.
- README verified — no updates needed (no documented product fact changed; the viewer's context menu and grouping are not enumerated there).
- `package.json` / lock — untouched (no release, no dependency change).
- Guides reviewed — no `plans/guides/` change needed (terminology: "ASCII art block", "Copy ASCII art" follow existing copy-action and grouping naming).
- LAUNCH_TEST — no `docs/launch/LAUNCH_TEST.md` exists in this repo; manual steps captured in the What-to-test handoff instead.
- Roadmap — SKIPPED [no ROADMAP entry for this ad-hoc request].
- No bug archive — task did not close a `bugs/*.md` file.

### 7. Persist finish report

Finish report saved: plans/history/2026.06/2026.06.11/copy-collapse-ascii-art-blocks.md (this file). Task closed no `bugs/*.md` and no active plan.

### 9. Files changed

New:
- `src/ui/viewer-context-menu/viewer-context-menu-ascii-art-range.ts` — range computation (TS + browser mirror).
- `src/test/ui/viewer-context-menu-ascii-art-range.test.ts` — 5 range cases.
- `src/test/ui/viewer-ascii-art-collapse.test.ts` — 7 collapse cases.
- `plans/history/2026.06/2026.06.11/copy-collapse-ascii-art-blocks.md` — this finish report.

Modified:
- `src/ui/viewer-context-menu/viewer-context-menu.ts` — import + wire `getAsciiArtRangeBrowserScript`; gate the Copy ASCII art row in `showContextMenu`.
- `src/ui/viewer-context-menu/viewer-context-menu-html.ts` — Copy ASCII art menu row.
- `src/ui/viewer-context-menu/viewer-context-menu-block-copy.ts` — handle `copy-ascii-art-block`; doc note.
- `src/ui/viewer/viewer-data-helpers-core.ts` — stamp `artBlockCount`; collapse-aware `calcItemHeight` branches.
- `src/ui/viewer/viewer-data-add-ascii-art-detect.ts` — stamp `artBlockCount` (entropy path); `toggleAsciiArtBlock`.
- `src/ui/viewer/viewer-data-helpers-render.ts` — `art-collapsed` class + collapse chevron on start row.
- `src/ui/viewer/viewer-script-click-handlers.ts` — `.art-collapse-chevron` click route.
- `src/ui/viewer-styles/viewer-styles-ascii-art.ts` — chevron, count, collapsed-corner CSS.
- `src/l10n/strings-viewer-g.ts` — host menu strings.
- `src/l10n/strings-webview-b.ts` — webview chevron tooltip strings.
- `src/test/ui/viewer-ascii-art-block.test.ts` — updated the `calcItemHeight` height assertion for the collapse-aware branches.
- `CHANGELOG.md` — Unreleased Added entry.

### Diff summary of core logic

- **Range:** `computeAsciiArtBlockRange(allLines, idx)` returns `null` unless `idx` carries `artBlockPos`, then expands `lo`/`hi` over contiguous `artBlockPos` neighbours. Same logic in the browser `computeAsciiArtBlockLineRange`.
- **Copy:** gated row in `showContextMenu` (`showAsciiArt`), action `copy-ascii-art-block` → `copyLineRangePlain(lo, hi)` (the existing plain-text block-copy path).
- **Collapse:** `toggleAsciiArtBlock(idx)` recomputes the band and flips `artCollapsed` on every row; `calcItemHeight` returns 0 for collapsed middle/end and always renders start; render emits an absolutely-positioned `.art-collapse-chevron` (▾ expanded / ▸ + count collapsed) on the start row plus an `art-collapsed` class for full-radius corners; the click handler routes the chevron to the toggle.

### Outstanding work

None for the requested scope. On-screen rendering of the chevron position/collapsed box was not exercised on a running Extension Host in this pass — see What to test.
