# Timeline dotted-line rendering bugs

**Fixed:** 2026-02-15

## Bugs

1. **Dots appeared two-colored / gradient** — The 1px timeline line bled through anti-aliased edges of 7px severity dots due to incorrect z-index stacking. Fixed by enlarging dots to 9px and establishing a proper stacking context on level-bar elements.

2. **Line rendered over dots (especially at top)** — The timeline `::before` (z-index: 1) painted above dots because `.line` elements lacked a stacking context. Fixed by removing z-index from the timeline line and adding `z-index: 1` to `[class*="level-bar-"]`.

3. **Timeline too close to left edge** — Dots started at 3px from the panel edge. Indented the timeline line from 6px to 12px and dots from 3px to 8px, with line padding increased from 16px to 24px.

## Files changed

- `src/ui/viewer-styles-decoration.ts` — Timeline line and severity dot positioning, z-index stacking fix
- `src/ui/viewer-styles.ts` — Base `.line` left padding increased from 16px to 24px
