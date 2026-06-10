# Context menu submenu renders off-screen — attempt history

Status: Fixed and archived (2026-06-09). Height AND width are now both maximized to the
viewport with scroll-on-overflow; resize-responsive. Archived to `plans/history/2026.06/2026.06.09/`
at the user's instruction once the reliability gap was closed.

## Symptom

Right-click the log viewer → hover **Copy & Export** (or any submenu): the flyout
panel renders partly or wholly off-screen — clipped at the top edge, or off the
right edge — and is unusable. Worst in a short/narrow panel (terminal split, small
window). Reported repeatedly; "fixed" three+ times without sticking.

## Root cause (the thing every prior attempt missed)

The flyout is a pure-CSS `:hover` panel (`.context-menu-submenu-content`,
`left:100%; top:0`). Placement was driven by **three coarse classes toggled on the
root menu** in `positionContextMenu()`:

- `flip-submenu` — open flyouts leftward
- `flip-submenu-vertical` — open flyouts upward (`top:auto; bottom:0`)
- `flip-submenu-vertical-top` + `--submenu-content-top` — nudge flyout down near top

Two structural defects:

1. **No height cap, no scroll.** A 14-item flyout (Copy & Export, Actions) is taller
   than a short panel. Nothing could make it fit — it always clipped.
2. **Flip is global, not per-submenu.** The classes were toggled from the *root
   menu's* rect and applied to *all* flyouts uniformly. A trigger mid-screen and a
   trigger near the bottom got the same direction. When the root was near the bottom,
   `flip-submenu-vertical` forced *every* flyout upward — so Copy & Export (trigger
   mid-screen, tall flyout) opened upward and clipped at the top.

## Failed attempts (do NOT repeat)

- **08bb8b1a** "prevent context menu submenu from being cropped at top" — bumped
  `safeTopPx` 12→48 and `nearTopThresholdPx` 80→100. Magic-pixel tuning on the
  global `flip-submenu-vertical-top` class. Did not address height or per-submenu
  direction.
- Earlier passes introduced the `flip-submenu` / `flip-submenu-vertical` /
  `flip-submenu-vertical-top` classes themselves — same global-class model.

Every prior fix tuned a constant on the global model. The model itself was wrong.

## Fix that landed (this attempt — different by design)

Replace the global flip classes with **per-submenu JS positioning** measured against
the live viewport, run on each submenu trigger's `mouseenter`:

- Horizontal: open right if `trigger.right + flyoutWidth + margin <= innerWidth`,
  else open left.
- Vertical: align flyout top to the trigger and grow down if it fits; else grow up if
  it fits; else pick the side with more room and **cap `max-height` to that room with
  `overflow-y: auto`** so the flyout scrolls instead of clipping.

Each flyout decides independently from its own trigger rect, so a mid-screen trigger
and a near-bottom trigger get different placements. The height cap guarantees the
flyout never exceeds the viewport regardless of item count or panel size.

Files: `src/ui/viewer-context-menu/viewer-context-menu.ts` (positionSubmenu +
mouseenter wiring; removed dead flip-class logic),
`src/ui/viewer-styles/viewer-styles-context-menu.ts` (flyout `overflow-y: auto`;
removed dead flip-class rules).

## Finish Report (2026-06-07)

**Reviewed by another AI.**

### Scope
(B) VS Code extension — TypeScript webview script + CSS. No Flutter/Dart; l10n section N/A (no user-facing strings added or changed).

### Deep review
- **Logic/safety:** `positionSubmenu()` guards a missing flyout (`if (!flyout) return`). No recursion; one synchronous measure + style write per `mouseenter`. `mouseenter` does not bubble and fires once per trigger, so no handler storms. `flyout.style.cssText = ''` resets prior placement so a re-hover never inherits a stale `maxHeight`/`bottom`.
- **Architecture:** positioning extracted to `viewer-context-menu-position.ts` (mirrors the existing `viewer-context-menu-*.ts` module split). Functions live in the shared concatenated webview scope; declaration order across modules is irrelevant for hoisted `function` declarations, and the only cross-module caller (`showScrollChromeContextMenu` from `viewer-context-menu-actions.ts`) resolves at call time.
- **No collateral:** the two sibling menu components — `viewer-styles-session-list.ts` and `viewer-session-context-menu.ts` — keep their own independent `flip-submenu` logic; neither was touched. Their tests still pass.
- **Performance/UX:** one `getBoundingClientRect` + one `offsetWidth`/`scrollHeight` read forces a single layout flush per hover — negligible. `overscroll-behavior: contain` stops a flyout scroll from bubbling to the log list.

### Tests
- **Audited** every test referencing the changed symbols: `viewer-context-menu.test.ts` pinned the removed `flip-submenu-vertical` / `--submenu-content-top` strings (rewritten to pin `positionSubmenu`, `mouseenter` wiring, `submenuEl.getBoundingClientRect()`, the `maxHeight`/`spaceBelow`/`spaceAbove` cap, and the *absence* of the dead classes). `viewer-session-context-menu.test.ts` references `flip-submenu` for a different component — left intact, still passes.
- **Ran** (vscode-test Extension Host): `viewer-context-menu` 29 passing, `viewer-context-menu-styles` 4, `viewer-context-menu-html` 24, `viewer-session-context-menu` 15 — all green.
- **Added** two new cases (per-trigger placement; too-tall cap + scroll).

### Maintenance
- CHANGELOG: added a `### Fixed` entry under `[Unreleased]`.
- README verified — no updates needed (no product-fact change).
- `package.json` untouched (no release/dep change).
- Bug archival: this file is a failure-history artifact governed by the global repeat-attempt rule — kept in `bugs/` (not archived to `plans/history/`) so it is found on the next recurrence before any further attempt. Status flipped to `Fixed` in place; on-device confirmation still pending.

### Files changed (commit 628f5976)
- `src/ui/viewer-context-menu/viewer-context-menu.ts` — removed dead flip-class logic from `positionContextMenu`; wired `mouseenter` → `positionSubmenu` on each submenu; concatenated the new position module.
- `src/ui/viewer-context-menu/viewer-context-menu-position.ts` — NEW: `positionContextMenu`, `positionSubmenu`, `hideContextMenu`, `showScrollChromeContextMenu`.
- `src/ui/viewer-styles/viewer-styles-context-menu.ts` — flyout `overflow-y: auto` + `overscroll-behavior: contain`; removed the three dead flip-class CSS rules.
- `src/test/ui/viewer-context-menu.test.ts` — replaced two stale flip-class tests with two new placement/scroll tests.
- `CHANGELOG.md` — Fixed entry.
- `bugs/context-menu-submenu-offscreen_attempts.md` — NEW failure-history record (this file).

### Core logic diff summary
Old: `positionContextMenu` toggled `flip-submenu*` on the root menu from the root's rect; CSS applied them to every flyout uniformly; no height cap. New: each submenu's `mouseenter` runs `positionSubmenu(trigger)` which reads the trigger's live rect, sets `left:100%` or `right:100%` (horizontal fit), then `top:0` (grow down) / `bottom:0` (grow up) by available room, and when neither direction fits sets `maxHeight` to the larger gap with `overflow-y:auto` so the flyout scrolls instead of clipping.

### Outstanding
On-device/manual confirmation across panel sizes (top edge, bottom-right corner, narrow split) — only code + automated tests verified here.

---

## Recurrence #2 (2026-06-09) — height not maximized + not resize-responsive

### Symptom (reported with screenshot)
The per-trigger fix above (commit 628f5976) shipped, but the menu was still "unusable":
the expanded submenu (Columns, near the bottom of a tall root menu) opened as a small
scrollable strip with a scrollbar, even though most of the screen above it was empty.
Two explicit complaints: (a) the expanded submenu is mis-positioned; (b) its height is not
maximized to the available space. Both must stay correct when the screen/panel is resized.

### Why #1 was still wrong (the thing it missed)
628f5976 anchored each flyout to its trigger box (`top:0` / `bottom:0`, `position:absolute`)
and capped `max-height` to the room on **one side** of the trigger — `spaceBelow` *or*
`spaceAbove`. A trigger mid-list or near the bottom therefore got only a fraction of the
viewport even when the *other* side (or the viewport as a whole) had ample room. It also
had **no resize handling at all** — open the menu, resize the panel, and it stayed put.

This is genuinely different from #1, not a constant tweak: #1 measured one side of the
trigger; this measures the whole viewport and decouples the flyout from the trigger box.

### Fix that landed (#2)
`positionSubmenu()` switched to `position:fixed` and viewport coordinates:
- Height target is the **full viewport** (`vh - 2*margin`), not one side of the trigger.
- Align the flyout top to the trigger, then **slide it fully on-screen** (clamp top so its
  bottom never passes `vh - margin`); `max-height` + scroll apply **only** when the panel is
  taller than the entire viewport.
- Horizontal unchanged in spirit: open right, flip left on overflow.

Added `repositionOpenContextMenu()` wired to `window.resize` — re-clamps the root menu and
re-runs `positionSubmenu()` on the still-hovered trigger, so both re-maximize on panel resize.
The root `.context-menu` also gained a viewport height cap + `overflow-y:auto` for short panels.

Files: `viewer-context-menu-position.ts` (positionSubmenu rewrite, positionContextMenu cap,
new repositionOpenContextMenu), `viewer-context-menu.ts` (resize listener),
`viewer-styles-context-menu.ts` (root overflow-y; flyout comment), `viewer-context-menu.test.ts`.

### Outstanding (#2)
On-device confirmation across panel sizes and a live resize-while-open — code + automated
tests verified here only.

## Finish Report (2026-06-09)

**This work will be reviewed by another AI.**

### Scope
(B) VS Code extension — TypeScript webview script + CSS. No Flutter/Dart; l10n N/A (no
user-facing strings added or changed — menu labels untouched).

### Deep review
- **Logic/safety:** `positionSubmenu()` still guards a missing flyout (`if (!flyout) return`).
  One synchronous measure + style write per `mouseenter`; `position:fixed` changes only the
  coordinate space, not the lifecycle. `flyout.style.cssText = ''` resets prior placement so a
  re-hover never inherits a stale `maxHeight`/`top`. `repositionOpenContextMenu()` early-returns
  when the menu is closed (`!window.isContextMenuOpen`) so the global `resize` handler is inert
  unless a menu is open — no work on ordinary panel resizes.
- **Architecture:** placement stays isolated in `viewer-context-menu-position.ts`; the resize
  wiring is one line in `initContextMenu` alongside the existing `mouseenter` wiring. The sibling
  components `viewer-styles-session-list.ts` / `viewer-session-context-menu.ts` keep their own
  independent `flip-submenu` logic — untouched, still green (15 passing).
- **Performance/UX:** the resize handler reads two `getBoundingClientRect`s only while a menu is
  open. `position:fixed` keeps the CSS `:hover > .content` relationship intact (hover matches a
  DOM ancestor regardless of visual position), and the flyout's left edge sits flush at the
  trigger's right edge so the pointer crosses no gap. `overscroll-behavior: contain` on both the
  root menu and flyout stops a menu scroll from bubbling to the log list.

### Tests
- **Audited** every `src/test/` file referencing the changed symbols/CSS. `viewer-context-menu.test.ts`
  pinned the removed `spaceBelow`/`spaceAbove` one-sided cap — rewritten to pin `position = 'fixed'`,
  `availableHeight`, `style.maxHeight`, the **absence** of `spaceBelow`/`spaceAbove`, plus a new
  case pinning `addEventListener('resize'`, `repositionOpenContextMenu`, and `.context-menu-submenu:hover`.
  `viewer-context-menu-styles.test.ts` pins only toggle/check/shortcut rules — unaffected by the
  root `overflow-y` addition.
- **Ran** (vscode-test Extension Host): `viewer-context-menu` 30 passing, `-styles` 4, `-columns` 5,
  `-html` 24, `viewer-session-context-menu` 15, `viewer-scrollbar-toggle-and-resize` 13 — all green.
  `npm run check-types` clean; `npm run compile` passes all verify gates and the dist-size cap.

### Maintenance
- CHANGELOG: added a `### Fixed` entry under `[Unreleased]`.
- README verified — no updates needed (behavior fix, no product-fact change). No `docs/LAUNCH_TEST.md`
  or `doc/guides/` in this repo — N/A.
- `package.json` untouched by this task.
- Bug archival: **deliberately NOT archived.** This is a recurrence-tracking artifact governed by the
  global repeat-attempt rule (now at recurrence #2, on-device confirmation still pending). Per the
  prior pass's recorded decision, it stays in `bugs/` so the NEXT recurrence finds the full failure
  history before any further attempt. Status remains `Fixed (code-verified; on-device pending)`.

### Files changed (this task only — the flow-map workstream files in the tree are NOT mine)
- `src/ui/viewer-context-menu/viewer-context-menu-position.ts` — `positionSubmenu` rewrite to
  position:fixed + full-viewport height; `positionContextMenu` viewport height cap; new
  `repositionOpenContextMenu`; module doc-comment updated.
- `src/ui/viewer-context-menu/viewer-context-menu.ts` — `window.resize` → `repositionOpenContextMenu`.
- `src/ui/viewer-styles/viewer-styles-context-menu.ts` — root `.context-menu` `overflow-y:auto` +
  `overscroll-behavior:contain`; flyout doc-comment updated for fixed positioning.
- `src/test/ui/viewer-context-menu.test.ts` — rewrote the too-tall-cap test; added a resize test.
- `CHANGELOG.md` — Fixed entry.
- `bugs/context-menu-submenu-offscreen_attempts.md` — recurrence #2 record + this finish report.

---

## Reliability hardening (2026-06-09) — width never capped, only height

### Gap closed
Recurrences #1 and #2 fully solved the **vertical** axis (full-viewport height + cap + scroll +
resize-responsive) but left the **horizontal** axis half-done: `positionSubmenu()` measured the
flyout's natural width and flipped right→left on overflow, but never *capped* it. A flyout wider than
a narrow terminal split still ran off the right edge with no scroll — exactly the original symptom's
"off the right edge … worst in a short/narrow panel" wording, which every prior pass read as a
vertical problem. A second, quieter defect: width was measured *before* the height cap applied, so a
flyout that scrolls vertically grew by its scrollbar width *after* placement and could nudge past the
right edge.

### Fix (different from #1/#2 — a new axis, not a re-tune)
`positionSubmenu()` now treats width symmetrically with height:
- Apply the height cap (`maxHeight`) **before** measuring `offsetWidth`, so a vertical scrollbar's
  width is included in the horizontal flip/clamp math.
- If the flyout is wider than `innerWidth - 2*margin`, cap `maxWidth` and set `overflowX:auto` so it
  scrolls horizontally instead of clipping off-screen; clamp `flyoutWidth` to the available width so
  the flip/clamp can never place it past the edge.

Files: `src/ui/viewer-context-menu/viewer-context-menu-position.ts` (positionSubmenu width cap +
measure-order; module doc-comment), `src/test/ui/viewer-context-menu.test.ts` (new width-cap test),
`CHANGELOG.md` (Fixed entry under `[Unreleased]`).

### Verification
`npm run check-types` reports only `src/modules/flow-map/*` errors from another workstream's
**uncommitted** working-tree changes (not touched here); the context-menu files are clean. Those
flow-map errors block `tsc` emit, so the vscode-test suite could not be emitted; the change was instead
verified by bundling `viewer-context-menu.ts` with esbuild (which pulls in only its own imports, not
flow-map) and asserting the generated script string carries `availableWidth`, `maxWidth`,
`overflowX:auto`, and that the height cap precedes the width measure — all green.

### Outstanding
The flow-map type errors belong to that workstream's in-progress changes and should be resolved there
to restore the full `tsc` test gate. On-device confirmation of the narrow-split case is the only manual
check left for this menu.

## Finish Report (2026-06-09)

**This work will be reviewed by another AI.**

### Scope
(B) VS Code extension — TypeScript webview script + one test. No Flutter/Dart; l10n N/A (no
user-facing strings added or changed — menu labels untouched).

### Deep review
- **Logic/safety:** `positionSubmenu()` keeps its missing-flyout guard (`if (!flyout) return`). The new
  width branch is one synchronous read + style write; no new loops, recursion, or async. The height
  cap is applied before the width is measured so a vertical scrollbar's width is included in the
  horizontal flip/clamp — the only ordering invariant the change introduces, and it is pinned by a test.
  `flyout.style.cssText = ''` at entry still resets all prior placement (including the new `maxWidth`/
  `overflowX`) so a re-hover never inherits a stale width cap.
- **Architecture:** placement stays isolated in `viewer-context-menu-position.ts`; no new module, no new
  shared primitive, no API surface change. The sibling components `viewer-styles-session-list.ts` /
  `viewer-session-context-menu.ts` keep their own independent `flip-submenu` logic — untouched.
- **Performance/UX:** still one `getBoundingClientRect` + a couple of `offsetWidth`/`scrollHeight`
  reads per hover (one forced layout flush) — negligible. Horizontal scroll on a flyout is a last
  resort that only engages when the panel is narrower than the menu's natural width; it is strictly
  better than the prior clip-off-screen behavior.
- **Refactoring:** none beyond scope. Width is now handled symmetrically with height, which removes the
  asymmetry that was the actual code smell.

### Tests
- **Audited** `src/test/ui/viewer-context-menu.test.ts` (the only test referencing the changed symbols).
  The recurrence-#2 test pinned `position='fixed'`, `availableHeight`, `style.maxHeight`, and the absence
  of `spaceBelow`/`spaceAbove` — all still true, left intact. Added a new case pinning `availableWidth`,
  `style.maxWidth`, `overflowX='auto'`, and that the height cap precedes the width measure.
- **Ran** the assertions against the real generated script by bundling `viewer-context-menu.ts` with
  esbuild (pulls in only its own imports, not the broken flow-map workstream) — all green. The full
  vscode-test suite could not be emitted because another workstream's **uncommitted** `flow-map/*`
  type errors block `tsc` emit tree-wide; that is not this task's code.

### Maintenance
- CHANGELOG: added a `### Fixed` entry under `[Unreleased]` and updated the human summary line.
- README verified — no updates needed (behavior fix, no product-fact change). No `docs/LAUNCH_TEST.md`
  in this repo — N/A.
- `package.json` untouched.
- Bug archived: `bugs/context-menu-submenu-offscreen_attempts.md` →
  `plans/history/2026.06/2026.06.09/context-menu-submenu-offscreen_attempts.md` (this file).

### Files changed (commit bf592a2f + this report's follow-up commit)
- `src/ui/viewer-context-menu/viewer-context-menu-position.ts` — `positionSubmenu` width cap +
  overflow-x + height-cap-before-width-measure ordering; module doc-comment updated.
- `src/test/ui/viewer-context-menu.test.ts` — new viewport-width cap test.
- `CHANGELOG.md` — `### Fixed` entry under `[Unreleased]`.
- `bugs/context-menu-submenu-offscreen_attempts.md` → `plans/history/2026.06/2026.06.09/…` — archived
  with this recurrence record + finish report.

### Outstanding (finish report)
On-device confirmation of the narrow-split / scrolling-flyout case. The full `tsc`/vscode-test gate is
blocked by another workstream's uncommitted flow-map type errors, not by this change.
