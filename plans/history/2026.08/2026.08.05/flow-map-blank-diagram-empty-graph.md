# Flow map rendered a blank diagram for breadcrumb-less logs

The Session Flow Map's diagram area rendered as empty white space for any log that produced zero
navigation events. The zero-node layout computed a negative canvas height, emitting an invalid SVG
that browsers silently drop, so the Flow section showed nothing beside a live zoom toolbar.

## Finish Report (2026-08-05)

### Defect

`layout()` in `flow-map-svg.ts` derived the canvas height from the running row cursor:
`height = y - ROW_GAP + MARGIN`. With no rows placed, `y` never advanced past `MARGIN`, yielding
`26 - 54 + 26 = -2`. The emitted element carried `viewBox="0 0 288 -2"` and `height="-2"`. A negative
height is invalid SVG; browsers render nothing and report no error, so the failure surfaced only as
missing output.

Reproduced against real captures in `D:\src\contacts\reports\20260805\` — logcat-only sessions and
tooling runs parse to zero `nav`/`reached` events, so every one of them hit the negative-height path.
The defect had been latent since the flow map shipped: it is triggered by log SHAPE (no navigation
breadcrumbs), not by any recent code change. Logs from instrumented app sessions always had at least
one node and never reached it.

A second-order problem sat on top: with no nodes, the diagram still rendered its zoom/pan/replay
toolbar and the legend tooltip, so the panel presented interactive controls and a glyph key for
content that did not exist.

### Changes

- `flow-map-svg.ts` — `layout()` floors the returned height at `MARGIN * 2`, guaranteeing valid
  dimensions for any graph including the empty one.
- `flow-map-html.ts` — `flowDiagramHtml()` returns a localized empty-state note
  (`flowMap.emptyDiagram`) instead of a diagram plus toolbar when `graph.nodes` is empty. A new
  `legendAndDiagram()` helper is the single place deciding whether the legend renders, shared by the
  main report's Flow section and the pop-out body so the two cannot drift.
- `strings-flow-map.ts` — the `flowMap.emptyDiagram` English source key, naming what the diagram
  needs (`Screen Navigation` lines or `[flowmap]` tags) and noting the other report sections are
  still populated.
- `flow-map-panel-styles.ts` — `.fm-empty` muted-note styling.

### Test correction

`flow-map.test.ts`'s "no jump-to-crash control when the session has no fault" fixture used
UNTIMESTAMPED `[flowmap] enter` lines. The parser only classifies timestamped lines, so that fixture
had always produced an empty graph — the test asserted a zoom toolbar over nothing and would have
caught this defect had its fixture been valid. The fixture is now timestamped and exercises the
intended two-node case.

### Coverage added

`flow-map-review.test.ts` pins both directions: a breadcrumb-less log yields an SVG with no negative
dimensions plus the empty-state note and no toolbar or legend (in the report and the pop-out), and a
walked log still renders legend and toolbar with no empty note.

### Verification

`npm run check-types` clean; targeted eslint clean; six flow-map suites total 87 tests passing; full
12-step `npm run compile` green. Runtime confirmation in the Extension Development Host (F5) remains
outstanding — the empty-state is host-rendered HTML, but the SVG dimension behavior was verified only
through string assertions, not a live browser layout.
