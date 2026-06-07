# Context menu submenu renders off-screen — attempt history

Status: Fixed (code-verified; on-device confirmation pending — see What to test)

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
