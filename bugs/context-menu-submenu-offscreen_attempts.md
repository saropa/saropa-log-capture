# Context menu submenu renders off-screen — attempt history

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
