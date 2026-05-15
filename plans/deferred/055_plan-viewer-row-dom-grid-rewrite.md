# PLAN 055: Viewer row DOM grid/column rewrite (Item E Path 2)

Status: **DEFERRED.** Spun out of plan 054 Item E. Path 1 (incremental column
hardening via fixed-width inline-block decoration prefix) landed across seven
commits and satisfies the original verification gate. This plan preserves
Path 2 — the original spec's full DOM rewrite into named columns — so the
option is documented without occupying an active plan slot.

## Why deferred

- **Path 1 closed the visible complaint.** Columns align top-to-bottom across
  the viewport; toggling line number / timestamp / PID / TID / tag recomputes
  width via `applyDecorationLayoutWidth`; long logcat tags clip to the
  reserved column rather than spilling into the message.
- **High blast radius.** The flat-`<div class="line">` DOM is the contract
  every other render path uses — `renderItem`, `renderStackHeader`,
  `renderStackFrame`, marker rows, chip rows (`repeat-notification`,
  `n-plus-one-signal`), banner-group rows, dedup-fold survivors, art-block
  rows, structured-file rows. Restructuring it risks regressions in all of
  them simultaneously.
- **File-size headroom.** `renderItem` already pushes
  [viewer-data-helpers-render.ts](../../src/ui/viewer/viewer-data-helpers-render.ts)
  near the 300-LOC eslint cap. Path 2 likely forces a split across modules.
- **No live user pain point.** Path 1 closed the original report; there is
  currently no UI feature blocked by the flat DOM.

## Spec (what Path 2 would do)

Restructure each `.line` into fixed-position columns, all optional except text:
- Col A: severity glyph/bar (always reserved width)
- Col B: line number (optional, toggle)
- Col C: timestamp (optional, toggle)
- Col D…: existing optional decorations (elapsed, quality badge, source tag,
  PID/TID, parsed-level prefix, parsed tag)
- Col N: message text (flex, wraps)

Use CSS grid or `display: flex` with fixed-width children so columns align
down the whole viewport like an editor gutter.

Must preserve:
- Virtualized row height (`calcItemHeight` returns one `ROW_HEIGHT`)
- Blank-line quarter-height
- Stack-frame indentation (one column past the decoration prefix)
- Search highlight, current-match, context-line styling
- Art-block continuation rows (`art-block-start` / `-middle` / `-end`)
- Banner-group rendering (`banner-group-start` / `-mid` / `-end`)
- Continuation-badge inline injection inside the decoration prefix
- Dedup-fold survivor `×N` badge anchored at end of message text

## Files (when reactivated)

- [src/ui/viewer/viewer-data-helpers-render.ts](../../src/ui/viewer/viewer-data-helpers-render.ts) — `renderItem`, DOM contract owner
- [src/ui/viewer/viewer-data-helpers-render-stack.ts](../../src/ui/viewer/viewer-data-helpers-render-stack.ts) — `renderStackHeader`, `renderStackFrame`
- `src/ui/viewer-styles/viewer-styles-lines.ts`
- `src/ui/viewer-styles/viewer-styles-content.ts`
- `src/ui/viewer-styles/viewer-styles-decoration-bars.ts`
- New: `src/ui/viewer-styles/viewer-styles-columns.ts`

## Reactivation criteria

Move out of `deferred/` and schedule if any of:
- User reports column misalignment that Path 1 cannot fix with reasonable
  effort (i.e. fixed-width inline-block math is no longer sufficient).
- A new feature requires a per-column DOM contract (resizable columns,
  drag-to-reorder columns, column-level context menus, per-column hover
  affordances).
- `applyDecorationLayoutWidth` grows beyond reasonable complexity (current
  approach: enabled-flags × data-presence flags → em units).

## Background

Full Item E history: archived plan
[plans/history/2026.05/2026.05.15/054_plan-viewer-stack-noise-filter-layout.md](../history/2026.05/2026.05.15/054_plan-viewer-stack-noise-filter-layout.md).

Path 1 test guard (pins the inline-block column model in place):
[src/test/ui/viewer-column-layout.test.ts](../../src/test/ui/viewer-column-layout.test.ts).
That test file's header comment also records the Path 1 vs Path 2 decision in
prose, so the rationale is discoverable from the test alongside this plan.
