# ASCII art shimmer settles after a single sweep

**Trigger (user request, verbatim):** "find the ascii highlight animation and change it to only play once"

The highlight sweep across grouped ASCII-art log blocks (box-drawing art / figlet banners
detected and grouped in the log viewer) was animating twice on arrival (set the day before,
see [ascii-art-shimmer-twice.md](../2026.06.07/ascii-art-shimmer-twice.md)). The user now
wants a single sweep, then static.

## Finish Report (2026-06-08)

### Scope

(B) VS Code extension (TypeScript). A single CSS-token change in a styles module plus its
test and the changelog. No Flutter/Dart, no ARB, no user-facing copy strings.

### Change

`src/ui/viewer-styles/viewer-styles-ascii-art.ts` — the shimmer `::after` overlay on
`.line.art-block-start/middle/end` had:

```css
animation: art-block-shimmer 4s ease-in-out 2 forwards;
```

changed to:

```css
animation: art-block-shimmer 4s ease-in-out 1 forwards;
```

`forwards` (fill mode) is preserved so the sweep still holds its final off-screen keyframe
rather than snapping the gradient back to its start. The WHY comment above the rule was
updated from "Shimmer twice on arrival" to "Shimmer once on arrival". The staggered
`animation-delay` on middle/end rows (0.12s / 0.24s) is unchanged — it still cascades the
single sweep across rows.

### Deep Review

- **Logic & Safety:** Pure CSS iteration-count change in a generated style string. No control
  flow, no async, no recursion. The `2`→`1` token is the only behavioral edit.
- **Architecture & Adherence:** Stays within the existing `viewer-styles-ascii-art.ts` module;
  no new files, no shared-primitive changes. Single source of truth — the iteration count
  lives only in the CSS, and the test pins that exact string.
- **Performance/UX:** Fewer animation iterations = strictly less GPU work. The block still
  announces itself with one sweep, then goes static, which was the stated intent.
- **Documentation:** WHY comment updated in lockstep with the value so it does not drift.

### Testing

- **Audit:** Grepped `src/test` for `shimmer`, `art-block-shimmer`, `forwards`, `animation:`.
  One test pinned the old value: `src/test/ui/viewer-ascii-art-block.test.ts` suite
  "shimmer settles (finite, not perpetual)" asserted
  `animation: art-block-shimmer 4s ease-in-out 2 forwards;`. Updated the assertion, its
  message, the test name, and the explanatory comment to pin the new single-iteration value.
  The sibling `viewer-severity-bar-connector.test.ts` only asserts the connector excludes
  art-block rows (so `::after` stays free for the shimmer) — unaffected by the count, left
  as-is.
- **Run:** `npx mocha out/test/ui/viewer-ascii-art-block.test.js --ui tdd` → 25 passing,
  including "CSS runs the shimmer once with forwards fill, never infinite". (The file uses
  Mocha `suite()` globals, so `node --test` cannot run it; ran via mocha tdd UI.)
- **Typecheck:** `npm run check-types` → clean.

### Files changed

- `src/ui/viewer-styles/viewer-styles-ascii-art.ts` — iteration count `2`→`1`, WHY comment.
- `src/test/ui/viewer-ascii-art-block.test.ts` — assertion + name + comment pin `1 forwards`.
- `CHANGELOG.md` — new `[Unreleased]` section (the released `[7.17.4]` "shimmer twice" entry
  is left intact as published history).
- `plans/history/2026.06/2026.06.08/ascii-art-shimmer-once.md` — this report.

### Outstanding

None. No bug archived — task did not close a `bugs/*.md` file.

## Follow-up (2026-06-08) — iteration count was not the lever; gate on first render

**User report:** "failed. the shimmer never stops."

**Root cause (this is the real fix):** the iteration-count change above (and the
prior `infinite`→`2` change) could never settle the shimmer. `renderViewport()`
in `src/ui/viewer/viewer-data-viewport.ts` does an atomic full-DOM rebuild of the
visible range on every scroll and every incoming log line (`replaceChildren()` +
fresh `<template>` fragment — deliberate, to kill row paint-ghosting). Every
rebuild creates brand-new art-block nodes, and a CSS `::after` animation on a
freshly-created node restarts from iteration 0. So `1`, `2`, and `infinite` all
look identical: perpetual, because the node keeps getting recreated under a live
log stream.

**Fix:** play the shimmer only on a row's FIRST render, latched per item.

- `src/ui/viewer/viewer-data-helpers-render.ts` — when an art-block row is
  rendered and `!item._artShimmered`, add a dedicated `art-shimmer-play` class and
  set `item._artShimmered = true`. Later viewport rebuilds re-render the same item
  with the latch already set, so the class (and thus the animation) is omitted.
- `src/ui/viewer-styles/viewer-styles-ascii-art.ts` — the shimmer `::after` block
  and the staggered `animation-delay` rules are now gated behind
  `.art-shimmer-play` (`.line.art-block-start.art-shimmer-play::after`, etc.). The
  bare `art-block-*` class carries only static styling (color, tint, gutter), so a
  rebuilt-but-already-shimmered row paints no `::after` and no animation. The
  `4s ease-in-out 1 forwards` timing is retained for the single sweep.

**Tests added** (`src/test/ui/viewer-ascii-art-block.test.ts`, "shimmer settles"
suite, now 27 passing total):
- CSS gates `::after` behind `.art-shimmer-play` and the bare `art-block-start::after`
  no longer carries the shimmer.
- Renderer emits `art-shimmer-play` only when `!item._artShimmered` and sets the latch.

**Verification:** `npx mocha out/test/ui/viewer-ascii-art-block.test.js --ui tdd`
→ 27 passing; `npm run check-types` → clean. On-device confirmation that the sweep
plays once and stops under a live stream is still pending the user (F5).
