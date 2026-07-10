# Severity gutter dot-join — attempt history

The gutter draws a colored dot per leveled log row. Consecutive dots of the
SAME severity color should read as one connected band; a change of color should
show a clean break (no line bridging a dot of one color to a dot of another).
The connector line must also sit EXACTLY under the dot centers.

This has been reworked repeatedly. Record each attempt here before the next one
so we stop oscillating between the two failure modes (under-joining vs
over-joining).

## Attempt 1 — JS chain stamping (`bar-up` / `bar-down` / `bar-bridge`)

`findNextDotSibling` + `getBarLevel` walked the rendered rows and stamped
`bar-up` / `bar-down` / `bar-bridge` classes; CSS `::after` drew the segments.

Failure: heavy per-render DOM walking, fragile stamping, and the segments were
computed in JS so the dot color and the connector color could disagree. Removed.

## Attempt 2 — per-pair same-CLASS `:has(+ .level-bar-X)` chain

Pure CSS. `.level-bar-X:has(+ .level-bar-X)::after` connected a row to the next
row only when the immediate next sibling carried the EXACT same class.

Failure (user: "sequential dots are NOT joined, NOTHING is joined"):
- Any intervening row (blank line, `.slow-gap` divider, stack frame) severed the
  chain because `+` only sees the immediate sibling.
- `info` and `framework` are the SAME color (both `--vscode-charts-blue`) but
  different classes, so a run mixing them never joined despite looking identical.

## Attempt 3 — full-height class-agnostic stripe (today, commit ada01364)

Pure CSS. Every leveled row painted a FULL-HEIGHT `::after` stripe of its own
`--bar-color` (`top:0; bottom:0`), so adjacent rows abutted edge-to-edge into
one band regardless of class. Robust to variable row heights.

Failure (user: "you regressed by joining NON-matching colors"):
- Because the stripe is class-agnostic and reaches both row edges, the stripe of
  a yellow row and the stripe of an adjacent blue row TOUCH at the shared row
  boundary, producing a continuous line THROUGH a color change. Different-color
  dots looked joined.
- Separately: the stripe (`left:0.89em`, `width:0.14em`) and the dot
  (`left:0.74em`, `width:0.44em`) are centered on the same math point (0.96em)
  but their left edges round to different sub-pixels, so the line looked
  off-center under the dots.

## Attempt 4 — per-COLOR-GROUP half-stripes, center-anchored (current)

Synthesis that fixes BOTH prior failure modes at once — this is why it differs
from 2 and 3:

- Join by COLOR GROUP, not exact class: `info` + `framework` share the blue
  group, so same-color runs join (fixes Attempt 2's info/framework miss).
- Each leveled row splits its `::after` into a TOP half (row top → dot center)
  and a BOTTOM half (dot center → row bottom). The bottom half paints only when
  the NEXT sibling is the same color group (`grp:has(+ grp)`); the top half
  paints only when the PREVIOUS sibling is the same group (`grp + grp`). At a
  color change neither half is painted around the boundary, so the differently
  colored dots stand apart — a clean break (fixes Attempt 3's over-join).
- Halves fill to the row EDGES (not center-to-center), so the band stays
  continuous and exact across variable row heights, keeping Attempt 3's one real
  virtue.
- Blank / `.slow-gap` / art rows carry no group class, so a same-color run that
  straddles one shows a one-row gap. Accepted (same as Attempts 2 and 3).
- Centering: the dot `::before` and the connector `::after` are both anchored on
  a single shared `--gutter-cx` and centered with `transform: translateX(-50%)`,
  so they compute from ONE left reference and cannot drift sub-pixel. The stripe
  is slightly widened for a solid seam (the user explicitly allowed "make it
  wider" rather than a fractional-pixel offset).

The color-group connector rules are generated from a single array in
`viewer-styles-decoration-bars.ts` so the 10 groups stay DRY (one source, not 20
hand-written selectors).
