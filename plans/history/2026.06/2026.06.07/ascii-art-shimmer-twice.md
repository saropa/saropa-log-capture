# ASCII art shimmer settles after two sweeps

**Trigger (user request, verbatim):** "detected ascii art should only shimer twice"

The highlight sweep across grouped ASCII-art log blocks (box-drawing art / figlet banners
detected and grouped in the log viewer) was animating on an `infinite` CSS loop, so every
art block shimmered forever. The user wants it to announce itself with two sweeps on arrival,
then go static.

## Finish Report (2026-06-07)

### Scope

(B) VS Code extension (TypeScript). A single CSS-token change in a styles module plus its
test and the changelog. No Flutter/Dart, no ARB, no user-facing copy strings.

### Change

`src/ui/viewer-styles/viewer-styles-ascii-art.ts` — the shimmer `::after` overlay on
`.line.art-block-start/middle/end` had:

```css
animation: art-block-shimmer 4s ease-in-out infinite;
```

changed to:

```css
animation: art-block-shimmer 4s ease-in-out 2 forwards;
```

- `2` — runs the sweep exactly twice, then stops. An infinite loop on every art block reads
  as a perpetual "loading" state and competes with live log lines for attention.
- `forwards` — holds the final keyframe (`background-position: -300%`), which sits off-screen,
  so the sweep ends cleanly rather than snapping the gradient back to its start position.

A 5-line WHY comment above the property documents the failure mode and the reason for the
fill-mode.

The per-row `animation-delay` stagger (`0.12s` / `0.24s` on middle/end) is unchanged, so the
two sweeps still cascade row-to-row.

### Why it's correct

- `forwards` fill-mode keeps the element at its final keyframe after the 2 iterations, so there
  is no visible reset flash.
- The keyframe runs `300% → -300%`; with `background-size: 300% 100%` and the lit band sitting
  at 45–55% of the gradient, the final position leaves the lit band off the visible box — the
  block settles to its static yellow tint, not a frozen bright streak.
- Strictly reduces compositor work: animations stop after ~8s instead of running forever.
  Aligns with the project's existing high-CPU sensitivity.

### Tests

- Audited the test tree (`art-block|ascii|shimmer|animation|infinite|4s|forwards|iteration`):
  no existing assertion pinned the shimmer animation property, so nothing broke.
- Added a `shimmer settles (finite, not perpetual)` suite to
  `src/test/ui/viewer-ascii-art-block.test.ts` pinning `art-block-shimmer 4s ease-in-out 2 forwards`
  and asserting the old `infinite` form is gone.
- `npx mocha --ui tdd out/test/ui/viewer-ascii-art-block.test.js` → **25 passing** (was 24).

### Gates

- `npm run check-types` → 0 errors.
- `npm run lint` → 0 errors (7 pre-existing warnings in untouched files: `source-linker.js`,
  `viewer-script-keyboard-escape.test.ts`, `viewer-script-messages.ts`).
- `npm run compile` → all verify gates pass (NLS, webview catalogs, command list, dist-size).

### Files

- `src/ui/viewer-styles/viewer-styles-ascii-art.ts` — animation property + WHY comment.
- `src/test/ui/viewer-ascii-art-block.test.ts` — new finite-shimmer suite.
- `CHANGELOG.md` — new `[Unreleased] → Changed` entry.
- `plans/history/2026.06/2026.06.07/ascii-art-shimmer-twice.md` — this report.

### Outstanding

None. On-device visual confirmation (two sweeps then static) is a manual check for the user.
