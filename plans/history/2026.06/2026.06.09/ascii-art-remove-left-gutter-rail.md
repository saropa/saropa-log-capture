# ASCII art-block — remove left gutter rail

User request (verbatim): "get rid of the left side border for ascii art. it breaks
the layout." After the plan-055 Phase-1 grid migration kept art blocks on the
legacy flat layout, the continuous severity rail down the left of a box-drawing
block (e.g. the DRIFT DEBUG SERVER banner) was shifting the box and reading as a
stray vertical line. This change removes that rail.

## Finish Report (2026-06-09)

This work will be reviewed by another AI.

**Scope:** (B) VS Code extension — webview CSS + one test comment + a regression
guard. No Flutter/Dart, no ARB, no docs-product-fact change. l10n SKIPPED
[B-NOT-IN-SCOPE].

### What shipped
Commit `8172c0c3` (code/CSS) + this report's commit (test guard + report).

Removed the art-block gutter rail in
[viewer-styles-ascii-art.ts](../../../../src/ui/viewer-styles/viewer-styles-ascii-art.ts):
the rule
```
.line.art-block-start[class*="level-bar-"],
.line.art-block-middle[class*="level-bar-"],
.line.art-block-end[class*="level-bar-"] {
    border-left: 0.14em solid var(--bar-color);
    margin-left: 0.82em;
}
```
drew a continuous left border + 0.82em indent on every art-block row. The block's
severity now reads from its yellow tint + rounded border. The `::after` shimmer
and the connector-chain exclusion (`:not(:is(.art-block-*))::after`) are untouched
— art blocks still own `::after` for the shimmer.

### Files changed
- `src/ui/viewer-styles/viewer-styles-ascii-art.ts` — removed the border-left/margin-left rail rule; updated the file-header doc comment.
- `src/ui/viewer-styles/viewer-styles-decoration-bars.ts` — refreshed the stale comment that said art blocks "already paint a continuous border-left."
- `src/test/ui/viewer-severity-bar-connector.test.ts` — refreshed the stale comment (assertion unchanged — the connector exclusion is still required for the shimmer).
- `src/test/ui/viewer-ascii-art-block.test.ts` — added a regression guard asserting the rail (`border-left: 0.14em…`, `margin-left: 0.82em`) is gone.
- `CHANGELOG.md` — Unreleased › Changed entry.

### Core logic summary (for the Reviewer AI)
Pure CSS removal — no JS/logic change. Risk surface: (1) the connector `::after`
chain must STILL exclude art-block rows (it does — unchanged) so the shimmer
isn't overwritten by a static stripe; (2) art-block-start keeps its `::before`
severity dot (only middle/end suppress it), so the block isn't left with zero
severity indication; (3) the removed `margin-left` shifted all three rows
uniformly, so the box stays internally aligned (just 0.82em further left).

### Testing
- `npm run check-types` — clean.
- `npm run compile` — clean (esbuild + verify + dist size OK).
- Node-shim (pure CSS/JS string assertions): viewer-severity-bar-connector +
  viewer-ascii-art-block (incl. the new guard) + viewer-column-layout — all pass.
- **Not executed here:** the full `vscode-test` Extension Host suite (needs the
  `vscode` module; not available in the node shim). CSS-only change; assertions
  audited and run via shim.

### Open / follow-up
- **Runtime/visual (F5) confirmation is the user's** — confirm the DRIFT box now
  sits clean with no left rail and the box stays aligned.
- Part of the broader plan 055 Phase 2+ work (AI rows / stack headers / chips →
  grid; CSV/markdown `.cols`), tracked in
  [plans/055_plan-viewer-row-grid-rewrite.md](../../../055_plan-viewer-row-grid-rewrite.md).

`No bug archive — task did not close a bugs/*.md file.`
`Finish report saved: plans/history/2026.06/2026.06.09/ascii-art-remove-left-gutter-rail.md`
