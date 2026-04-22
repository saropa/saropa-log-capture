# Bug: "Show native scrollbar" cannot be disabled once enabled

## Symptom

In the log viewer, right-click → **Scroll map & scrollbar** → **Show native scrollbar**
(or right-click on the minimap / scrollbar → same compact menu):

- Turning the toggle **on** works: the 10px native scrollbar appears, the checkmark
  goes on, and the Top/Bottom jump buttons shift left to clear the scrollbar.
- Turning the toggle **off** only half-works: the checkmark goes off and the jump
  buttons slide back inward, but the 10px scrollbar stays visible on screen.

The workspace setting `saropaLogCapture.showScrollbar` *is* being written to `false`,
and the `scrollbar-visible` body class *is* being removed (proven by the jump buttons
reacting to the new `--scrollbar-w` CSS variable). Only the actual scrollbar paint
is stuck.

## Root cause

Chromium paints `::-webkit-scrollbar` once per scroll container and caches the
composited layer. Cycling `overflow-y: auto → hidden → auto` (what the previous fix
in commit 33bca990 did) forces a layout recalc but not a scrollbar repaint.

- **0 → 10px** worked because the scrollbar layer had to be created fresh anyway, so
  Chromium read the current `::-webkit-scrollbar { width: 10px }` rule.
- **10px → 0** failed because the already-composited 10px layer was preserved
  through the overflow cycle; Chromium never re-read `::-webkit-scrollbar { width: 0 }`.

`scrollbar-width: none` cannot be used as an alternative — the existing CSS comment
in [viewer-styles.ts](../src/ui/viewer-styles/viewer-styles.ts) explains that
Chromium 130+ treats it as authoritative and hides the horizontal bar too, which
would break wide nowrap lines.

## Fix

`applyScrollbarVisible` in [viewer-script.ts](../src/ui/viewer/viewer-script.ts)
now briefly sets `display: none` on `#log-content`, forces a synchronous reflow
via `offsetHeight`, and restores the previous display value. `display: none` tears
down the element's render tree entirely, so when it comes back Chromium rebuilds
the scroll container and re-reads `::-webkit-scrollbar` from scratch.

`scrollTop` is captured before the toggle and restored afterward because
`display: none` resets it to 0 on re-display.

## Files touched

- [src/ui/viewer/viewer-script.ts](../src/ui/viewer/viewer-script.ts) — swap
  `overflow-y` cycle for `display: none` cycle; preserve `scrollTop`; update the
  doc comment to explain the asymmetry that motivated the change.
- [src/test/ui/viewer-scrollbar-toggle-and-resize.test.ts](../src/test/ui/viewer-scrollbar-toggle-and-resize.test.ts)
  — rename and rewrite the "cycles overflow reflow" test to assert `display = 'none'`
  and `logEl.scrollTop = sT` restoration.
- [CHANGELOG.md](../CHANGELOG.md) — entry under `[7.3.0] - Unreleased` → Fixed.
