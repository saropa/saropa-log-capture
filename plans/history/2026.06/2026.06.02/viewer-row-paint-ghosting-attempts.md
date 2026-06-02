# Viewer Row Paint Ghosting — Attempts Log

Tracks every attempt to fix the virtualized-row paint-ghosting bug, per the
global "after 2+ failed attempts, document prior failures FIRST" rule. Read
this file before proposing a next attempt.

## Symptom

The log viewer is a virtualized list. When the visible row range changes,
the viewport renderer in [src/ui/viewer/viewer-data-viewport.ts](../src/ui/viewer/viewer-data-viewport.ts)
swaps the visible rows in bulk. After the swap, Chromium can fail to
invalidate paint inside a recycled row slot's bounding box — the new text
rasterizes on top of un-cleared pixels from the row that previously
occupied that screen position, so faint characters of the prior text ghost
through. Most visible when the slot transitions between severity colors,
e.g. a `level-info` (blue) row recycled to a `level-database` (green) row:
the user sees `DRIFT: Drift debug server disconnected` rendered with the
prior blue text bleeding through, fixing itself only on `:hover`.

Reproduces against
[D:/src/contacts/reports/20260602/20260602_135636_contacts.log:907](D:/src/contacts/reports/20260602/20260602_135636_contacts.log)
(`[14:26:56.382] [drift-perf] DRIFT: Drift debug server disconnected`) at
viewer row #455.

## Attempts

### Attempt #1 — `transform: translateZ(0)` on `.line, .stack-header`

- **Commit:** `49297d75` (2026-05-29, v7.2.0 era), test pin `77e103e5`.
- **Theory:** Promote each visible row to its own GPU compositor layer so
  Chromium invalidates paint per-row on the `viewportEl.innerHTML = …`
  recycle, instead of letting paint cache survive across the slot's content
  swap.
- **Why it should have worked:** The CSS `transform: translateZ(0)` is the
  canonical compositor-layer hint and is well-documented for fixing
  paint-cache artifacts.
- **Why it failed in practice:** Shipped in `dist/extension.js` v7.17.0;
  user reported the artifact still visible on 2026-06-02 against
  `20260602_135636_contacts.log` line 907. Hypothesis: Chromium's layer-
  promotion is a heuristic, not a guarantee. For rows ~14 px tall, the
  compositor often coalesces neighbour rows back into a shared raster, so
  the per-row paint isolation the comment block advertised never actually
  materialized. The hint may help on some Chromium versions but does not
  resolve the bug deterministically.
- **Status:** Kept in the CSS (cheap, can still help in some browser
  versions, composes with later defenses). Test pin retained.
- **Finish report:** [plans/history/2026.05/2026.05.29/viewer-row-paint-ghosting-on-recycle.md](../plans/history/2026.05/2026.05.29/viewer-row-paint-ghosting-on-recycle.md).

### Attempt #2 — Opaque `background: var(--vscode-editor-background)` + atomic DOM swap

- **Trigger:** User report 2026-06-02 that attempt #1 visibly failed in
  v7.17.0; "i dont care about cheapest. i want it properly fixed."
- **Theory:** Stop relying on Chromium's paint-cache heuristics. Two
  independent defenses that compose:
  1. **Paint layer:** every row paints an opaque fill rect before its
     text, so stale pixels from the slot's prior occupant are physically
     covered. Same color as the editor parent (visually invisible) but
     the browser DOES rasterize the fill, which is the whole point. This
     defense does not depend on layer promotion working.
  2. **DOM layer:** replace `viewportEl.innerHTML = parts.join('')` with
     a detached `<template>` parse + `viewportEl.replaceChildren()` +
     `viewportEl.appendChild(template.content)`. Forces full disposal of
     prior child nodes before fresh nodes attach, so new rows have no
     paint-cache lineage with whatever previously occupied the slot. The
     innerHTML setter takes a Chromium fast path that can reuse prior
     child paint records; replaceChildren cannot.
- **Why this should work where #1 didn't:** The opaque background is a
  raster-level guarantee (the fill must be drawn before the text and there
  is no heuristic to skip), and the DOM-swap change attacks the same
  problem at a different layer of the pipeline. Both defenses are
  independent — even if one fails, the other still suppresses the
  artifact.
- **What is kept from #1:** `transform: translateZ(0)` and
  `isolation: isolate` remain on `.line, .stack-header`. They cost
  effectively nothing and compose with the new defenses.
- **What is **not** done:** No `contain: paint` — it would clip the
  severity-gutter `::after` stripe overshoot (`bottom: -50%`), breaking
  the dot-to-dot connector. No `will-change: contents` — that is also a
  hint, and we are explicitly moving away from hints. No switch to a
  fully-keyed per-row virtualizer — that is a larger refactor and the
  opaque-background + atomic-swap combination is expected to fully
  resolve the bug without it.
- **Risks considered:**
  - Opaque background visibly boxes the row only if the editor panel's
    background color differs from the row's parent. The viewport's parent
    inherits the editor background, so the row's fill is identical to
    what was already painted behind it; the only difference is which DOM
    node owns the raster.
  - The `:hover` and `.line.selected` rules still override the base
    background, so hover-highlight and selection visuals are unchanged.
  - `replaceChildren()` + `appendChild(template.content)` is marginally
    slower than `innerHTML = …` but the viewport holds ~50 rows; the
    difference is sub-millisecond and well below the render-loop budget.
  - `measureTagColumnPosition()` runs after the swap and queries the live
    DOM; `appendChild(template.content)` attaches the fragment's children
    synchronously, so the query sees the new nodes.
- **Regression pins** in [src/test/ui/viewer-muted-decorations.test.ts](../src/test/ui/viewer-muted-decorations.test.ts):
  - opaque background on `.line, .stack-header` base rule
  - `transform: translateZ(0)` still present (attempt #1 pin retained)
  - renderer uses `replaceChildren()` + `appendChild(_vTmpl.content)`
  - renderer does NOT assign to `viewportEl.innerHTML`

## If attempt #2 also fails

Before attempt #3, re-read this file and document #2's failure mode here
first. The next move would be the keyed-virtualizer refactor: maintain
stable `<div>` DOM identity per row index across viewport renders, and
update content via `textContent` / DOM-diff rather than wholesale child
replacement. That eliminates the slot-recycle path entirely, which is the
ultimate source of the bug. It is a larger change so it lives behind the
attempts #1 and #2 defenses, not as the first response.
