# Flutter exception blocks — collapse by default + remove the left rail

**Triggered by** a user request against the Log Viewer while looking at a
contacts session log (`d:\src\contacts\reports\20260611\20260611_095513_contacts.log`)
full of Flutter "EXCEPTION CAUGHT BY RENDERING LIBRARY" / RenderFlex dumps:

> 1. do not show the left border decoration for errors or any other grouping. it breaks the columnar format and is redundant
> 2. errors MUST be collapsible and like others, collapsed by default!

Follow-ups in the same session: inventory any other log-row rails, simplify the
layout now that rails are gone (→ fixed the jump/peek line accent), and a global
config change (always add l10n strings, never cut a feature for needing one →
restored the hidden-line count).

---

## Finish Report (2026-06-11)

**This work will be reviewed by another AI.**

### Scope

**(B) VS Code extension (TypeScript)** — Log Viewer webview rendering, styles,
client-side scripts, and webview l10n. No Flutter/Dart app code. No docs-only.

### Deep Review

- **Logic & safety.** Banner collapse reuses the established header-map pattern
  (`bannerHeaderMap`, mirroring `groupHeaderMap` / `contHeaderMap`). The
  `calcItemHeight` gate is placed after the filter block (with the continuation
  gate) so it behaves as an explicit user collapse, not a filter, and is not
  bypassed by peek-override. The header-click toggle guards on a collapsed text
  selection so drag-to-select is not hijacked. No recursion, no async, no race —
  all synchronous render-path code.
- **Lifecycle.** `resetFlutterBannerDetector()` now actually runs on session
  clear (it was previously defined but never called) and clears `bannerHeaderMap`,
  so cleared sessions don't retain dead header references.
- **Architecture.** Removed the banner-specific dot-pull / connector-pull / error
  stack rail overrides that existed ONLY to align severity dots with the deleted
  rail — net deletion, not addition. The peek-target fix reuses the exact
  `box-shadow: inset` technique the AI rail already documents, so the two rails
  now share one approach. No new shared primitives introduced.
- **l10n.** Added `viewer.bannerHeader.collapsed` / `.expanded` webview keys
  (English; other locales fall back via the `vt()` bridge until translated on its
  own cadence — no translation run). Visible count reuses the existing
  `viewer.meta.lines` key rather than minting a duplicate. No hardcoded
  user-facing string.
- **Performance / UI.** Banner body/footer rows still enter `allLines` while
  collapsed (height 0), so expand is instant with no re-ingest. The header
  re-renders each frame, so the streamed hidden-line count grows live. No extra
  passes over `allLines`.
- **Refactoring beyond scope.** The DB timestamp-burst decoration
  (`.db-ts-burst-member`) is the one remaining real-border decoration on log rows
  (2px left+right frame box, `box-sizing: border-box`, ~2px inset). Left untouched
  and surfaced to the user — converting it changes its design (loses the right
  edge), so it is not an in-scope alignment bug fix.

### Testing

- **Audited existing tests** for the changed symbols (`banner-group`,
  `bannerCollapsed`, `banner-chevron`, `peek-target`, `getUiStyles`,
  `getFlutterBannerStyles`, `viewer.meta.lines`). Only
  `src/test/ui/viewer-flutter-banner-group.test.ts` and
  `src/test/ui/viewer-collapse-expand.test.ts` reference any of them.
- **`viewer-flutter-banner-group.test.ts`** — rewrote the three rail-era
  rendering tests (which pinned `border-left: 3px`, the `0.15em` dot pull, the
  `0.30em` connector, and the stack rail) to instead assert the rail is GONE, the
  background tint + chevron are present, and the stack rail is absent. Added a
  `collapse` suite (7 tests) covering `bannerHeaderMap` + toggle + reset, default
  collapsed, the `calcItemHeight` gate, the chevron, the member-count increment,
  the localized count render, and the l10n map keys.
- **`viewer-collapse-expand.test.ts`** — the brittle fixed-offset slice
  (`indexOf('expandAllSections') + 500`) clipped the re-render call once the
  function grew to expand banners too; changed it to slice to the next function.
- **No test pins `.peek-target`** (CSS-only); change is visual, verified by
  inspection against the documented AI-rail technique.
- **Ran:** `npm run test:file -- out/test/ui/viewer-flutter-banner-group.test.js`
  → **26 passing**; `... viewer-collapse-expand.test.js` → **9 passing**;
  `... viewer-webview-l10n.test.js` clean.
- **Gates:** `npm run check-types` clean; `npm run compile` green (NLS 487 keys
  aligned, webview catalogs match, dist 4.65 MiB under ceiling); `npm run lint`
  0 errors, 9 pre-existing warnings (none introduced — `viewer-data-helpers-core`
  / `-render` were already over the 300-line soft cap before this work).

### Section 5 (Flutter l10n / ARB) — SKIPPED [B-NOT-IN-SCOPE]

No Flutter/Dart ARB pipeline involved. The extension's webview l10n equivalent
(NLS + `vt()` bridge) was handled inline and verified by `verify-nls` and
`viewer-webview-l10n.test.ts`.

### Project Maintenance

- CHANGELOG updated (Unreleased → Changed: three entries — collapse+count, rail
  removal, peek/jump accent fix — plus the overview line).
- README verified — no updates needed (no enumerated product-fact changed).
- guides reviewed — collapse chevron + count pill follow the existing
  stack-header collapse pattern; no style-guide change.
- package.json — unchanged (no release / dependency change).
- No `docs/launch/LAUNCH_TEST.md` in this repo — item N/A.
- No bug archive — task did not close a `bugs/*.md` file (ad-hoc user request).
- Global config: `C:\Users\craig\.claude\CLAUDE.md` l10n rule strengthened
  (needing an l10n string is never a reason to skip/shrink/defer/ask for a
  feature; adding source keys ≠ running the translation pipeline). This is a
  user-level file, outside the repo.

### Files changed (across commits 34509eb6, e9163995, f9177a33; 3 also bundled into fb0d7f03 by a concurrent session)

- `src/ui/viewer-styles/viewer-styles-flutter-banner.ts` — rail → tint; chevron + count CSS
- `src/ui/viewer-styles/viewer-styles-ui.ts` — `.peek-target` border-left → inset box-shadow
- `src/ui/viewer/viewer-data-add-flutter-banner.ts` — `bannerHeaderMap`, `toggleFlutterBanner`, reset
- `src/ui/viewer/viewer-data-add.ts` — register header collapsed-by-default; member count
- `src/ui/viewer/viewer-data-helpers-core.ts` — `calcItemHeight` banner collapse gate
- `src/ui/viewer/viewer-data-helpers-render.ts` — chevron + localized count + tooltip
- `src/ui/viewer/viewer-script-click-handlers.ts` — header-row click toggle
- `src/ui/viewer/viewer-script-messages.ts` — reset banner detector on session clear
- `src/ui/viewer/viewer-data-add-stack-group-learning-and-toggle.ts` — banners in Collapse/Expand All
- `src/l10n/strings-webview.ts` — `viewer.bannerHeader.collapsed` / `.expanded`
- `src/test/ui/viewer-flutter-banner-group.test.ts` — rewrote rail tests; added collapse suite
- `src/test/ui/viewer-collapse-expand.test.ts` — de-brittled the slice
- `CHANGELOG.md`
- (this finish report)

### Diff summary of core logic

1. **Collapse:** each banner header line is registered in `bannerHeaderMap` with
   `bannerCollapsed = true`. `calcItemHeight` returns 0 for any banner row whose
   `bannerRole !== 'header'` while its header is collapsed. A whole-header-row
   click (or Collapse/Expand All) toggles `bannerCollapsed` and re-renders.
2. **Rail removal:** `.banner-group-*` and `.stack-header.level-bar-error` lost
   `border-left: 3px` (+ padding/radius); replaced by a background tint. The
   dot/connector offset overrides that existed only to meet the rail were deleted.
3. **Count:** body/footer rows increment `header.bannerMemberCount`; the collapsed
   header renders `vt('viewer.meta.lines', n)` as a pill plus a `vt()` tooltip.
4. **Peek fix:** `.peek-target` accent is now `box-shadow: inset 3px 0 0` (out of
   flow) so the jumped-to row stays column-aligned.

### Outstanding

- DB timestamp-burst frame box (`.db-ts-burst-member`) still uses real
  left+right borders — left as-is by design; offered to the user as an optional
  unification onto the inset-shadow pattern.
