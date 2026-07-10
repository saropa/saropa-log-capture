# Trouble Mode severity chart — collapse caret size and plot frame

The severity chart's collapse control inherited its head row's 10px label size, at which the
caret glyph reads as a stray pixel rather than as a control — and it is the only affordance
announcing that the chart can be put away. Separately, the plot was drawn with no frame, so a
quiet time window rendered as a short bar floating in blank space with no baseline to read it
against.

## Defect 1 — the collapse caret was invisible

`.trouble-chart .tc-toggle` pinned `font-size: 10px`, matching the uppercase title beside it.
The head row's 10px is itself a deliberate divergence from the 11px `--text-eyebrow` used by
every other pane head: this strip sits directly beneath the toolbar and a size step between
them reads as a misalignment against the toolbar's `.level-letter` / `.dot-count`. That
reasoning covers head-row *text*. It does not cover a control. Applied to a `&#x25BE;` caret,
10px produced a mark the user could not identify as clickable.

The caret is now sized from the type scale (`var(--text-h3)`, 15px in
`viewer-styles-tokens.ts`) rather than from a literal, so it tracks the scale rather than
drifting from it. The head row's uppercase `letter-spacing: 0.04em` is cancelled on the
button: letter-spacing applies to the caret glyph too, and pushed it off the center of its own
hit area.

The module doc header previously asserted, without exception, that head-row text is pinned to
10px. That claim was made false by this change and has been amended to name the caret as the
sole exception, with the reason kept on the rule itself.

## Defect 2 — the plot had no frame

The bars were drawn into an unbounded region. A window with one warning and a window with no
events were visually indistinguishable from each other and from the pane's background: there
was no baseline establishing where zero is.

A dim rule (`1px solid var(--border)`, the same hairline token as the pane's own bottom edge)
now runs down each side of the plot and along its baseline. The frame is open at the top on
purpose. Three sides read as a pair of axes plus a baseline; closing the top would make the
frame a box and imply a ceiling that the bars are measured against. There is no such ceiling —
the vertical scale is the running peak, and it moves as the capture proceeds.

Placement is load-bearing. The rules live on `.tc-plot`, which wraps the `<svg>` alone, and NOT
on `.trouble-chart-body`. `.tc-axis` — the start and end clock labels — is a sibling of
`.tc-plot`, not a child. Framing the body instead would draw the baseline beneath the clock
labels rather than beneath the bars, which inverts the meaning of the rule. A regression test
pins this by asserting that neither `.trouble-chart-body` nor `.tc-axis` carries a border
declaration.

No clipping results: `troubleChartBar` insets each bar within its cell
(`barX = cellX + (cellW - barW) / 2`), so the outermost bars never reach the viewBox edges, and
the borders sit outside the SVG's content box. Nor do the two hairlines stack: the pane's own
`border-bottom` sits below the clock labels and the pane's 8px padding, roughly 20px beneath
the plot's baseline.

## Verification

- `npm run compile` — all 12 gates pass; `dist/extension.js` 5.08 MiB against a 12 MiB ceiling.
- `npx eslint` on both touched files — clean.
- New `src/test/ui/viewer-trouble-chart-styles.test.ts` — 4 passing. Before this file, nothing
  under `src/test/` imported `getTroubleChartStyles()`, so neither a literal font size nor a
  fourth border could be caught by the suite. The tests assert the *declarations* rather than
  pixel values: that the caret resolves its size from the scale and carries no numeric literal,
  and that the plot declares left, right, and bottom borders while declaring neither
  `border-top` nor the `border` shorthand (which would paint a top edge).
- `src/test/ui/viewer-trouble-chart.test.ts` — 17 passing, unchanged. It exercises the bucket
  math and rendered markup in a `node:vm` context and never touches the style module.

## Deliberately not changed

`box-sizing: border-box` was added to `.tc-plot` in the first pass on the theory that it kept
the side rules inside the strip's width. It does not: `.tc-plot` sets no explicit width or
height, so its box-sizing has no effect, and the side borders fall inside the containing block
regardless. The declaration was removed rather than left to mislead the next reader, and the
comment that credited it with an effect was rewritten.

## Known smell, out of scope

`viewer-styles-trouble-chart.ts` writes each of the three palette literals (`#f44336`,
`#ff9800`, `#9c27b0`) twice — once for the legend chip swatch, once for the bar fill. The
header documents why the palette is literal hex rather than theme tokens (the tokens resolve to
the editor's squiggle colors and rendered performance blue, contradicting the toolbar's purple
`P`) and requires lockstep with `viewer-styles-level.ts`, but it does not address the in-file
duplication. Collapsing the pair is a separate change.
