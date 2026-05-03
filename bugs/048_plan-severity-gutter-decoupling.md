# 048 — Plan: Severity-Gutter Decoupling

## Status: Open

## Problem

Today the severity column in the log viewer doubles as an interactive control. A single CSS state (`.bar-hidden-rows`, an outlined dot) is overloaded onto **four different concepts**, all of which toggle visibility on click:

1. Row sitting after a filter-hidden gap (peek expand) — `data-hidden-from`
2. Already-expanded peek group anchor (peek collapse) — `data-peek-key`
3. Dedup-fold survivor with N hidden duplicates — `data-dedup-count`
4. Collapsed stack header (or Preview-mode last visible frame) — `data-gid` / no data attr

The render-time stamping lives in [src/ui/viewer/viewer-data-viewport.ts:171-177](../src/ui/viewer/viewer-data-viewport.ts#L171-L177), [src/ui/viewer/viewer-data-helpers-render.ts:217-224](../src/ui/viewer/viewer-data-helpers-render.ts#L217-L224), and [src/ui/viewer/viewer-data-helpers-render-stack.ts:52-105](../src/ui/viewer/viewer-data-helpers-render-stack.ts#L52-L105). Click delegation lives in [src/ui/viewer/viewer-peek-chevron.ts:41-88](../src/ui/viewer/viewer-peek-chevron.ts#L41-L88). The CSS that draws the same outlined dot for all four cases is in [src/ui/viewer-styles/viewer-styles-decoration-bars.ts:103-135](../src/ui/viewer-styles/viewer-styles-decoration-bars.ts#L103-L135).

This was introduced by the **unified line-collapsing rethink** (originally tracked in `bugs/unified-line-collapsing.md`, no longer present on disk; references survive in code comments at [viewer-data-viewport.ts:135-149](../src/ui/viewer/viewer-data-viewport.ts#L135-L149) and elsewhere). That plan optimized for visual minimalism: replace the older `▼` / `▾` / `× N` / `[+N]` glyphs and the `(×N)` dedup badges with a single outlined-dot vocabulary so the gutter looks tidy.

The cost of that consolidation is what the user is hitting:

- **Lines vanish on click and read as data deletion.** When the dot is in its "click to collapse" state (cases 2, 3-after-expand, and 4-when-expanded), clicking it removes lines from view. The severity column is universally read as informational, so a click that vanishes neighboring lines reads as a destructive bug, not as a UI toggle.
- **Same icon, opposite intent.** The dot looks identical in every state. The only signal distinguishing "click expands" from "click collapses" is the `title=` tooltip — which requires a hover delay and is invisible during scroll-and-click.
- **Collapse control is geometrically co-located with expand control.** Clicking near where you opened a peek can collapse it, because the same dot owns both actions.
- **Four meanings stamped onto one decoration.** No vocabulary tells the user whether the hidden content is filter-hidden, dedup-folded, or stack-collapsed. The tooltip differs but is the only carrier of that distinction.

## Goal

**The severity column shows severity. It does not accept clicks.** Each of the four expand/collapse concepts gets its own dedicated affordance, and the collapse control for any given expansion is geometrically separated from the expand control that opened it.

## Design

### Principle 1 — severity gutter is read-only

`.bar-hidden-rows` (the outlined-dot CSS state) is removed from the gutter. The `[class*="level-bar-"]::before` dot returns to a single solid presentation: severity color, no outline, no toggle, no click handler.

### Principle 2 — separate affordances per concept

| Concept | Today's affordance | New affordance |
|---|---|---|
| Filter-hidden gap | Outlined dot on the row after the gap | **Inline divider row** between the two visible rows: `─── 12 hidden (filter, dedup) · show ───` |
| Already-expanded peek group | Outlined dot on the first revealed row | Same divider row above the range, but with `· hide ───` action; the divider stays anchored at the start of the revealed range |
| Dedup-fold survivor | Outlined dot on the survivor | Inline `×12` badge at the **end** of the survivor row's text content; click expands inline. After expand, the survivor row shows `×12 (hide)` at its end |
| Collapsed stack header | Outlined dot on the header row | Explicit `▶` / `▼` chevron inside the header row's text (parity with IDE/debugger conventions) |
| Preview-mode last visible frame | Outlined dot on the frame | `─── N more frames hidden · show all ───` divider directly below the last visible frame |

### Principle 3 — collapse controls live at the END of the revealed range

For all four concepts, the user can also collapse from the end of an expanded range. This eliminates the "I clicked near where I opened it and lines I didn't ask to hide vanished" failure mode. Specifically:

- Filter-hidden gap: divider at the start says `· hide ───`, AND a matching divider appears at the end of the revealed range with `─── hide N revealed ───`. Clicking either collapses.
- Dedup fold: survivor row's trailing badge becomes `(hide)`; the LAST revealed duplicate also shows a small inline `(hide above)` link.
- Stack header: the header chevron (`▼`) collapses; the LAST visible frame in an expanded trace also shows a small `(collapse trace)` link aligned right.
- Preview-mode: the divider below the last visible frame is itself the toggle.

### Principle 4 — the divider row IS the affordance

Dividers are full-row-width elements that sit BETWEEN visible rows in the virtual viewport. They:

- Render at a small fixed height (≤14px / 0.9em) so they don't dominate the log
- Carry the count and reason ("12 hidden — filter, dedup") so the user knows what's there before clicking
- Use a button-y visual treatment (subtle background, hover affordance, cursor: pointer) so they read as controls, not as content
- Are accessible: `role="button"`, `aria-expanded`, keyboard-focusable, Enter/Space activates

Dividers are NOT line items in `allLines` — they're injected by the render loop in `renderViewport()` between successive visible rows, similar to how `bar-up` / `bar-down` connector classes are applied today.

## Files to Change

### 1. Remove the overload from the severity gutter

- **[src/ui/viewer-styles/viewer-styles-decoration-bars.ts](../src/ui/viewer-styles/viewer-styles-decoration-bars.ts)** — delete the `.bar-hidden-rows::before` block (lines 103-135). Keep the solid-dot rules unchanged. Add CSS for the new divider row, dedup badge, and stack chevron (see §3).
- **Search-and-remove** every emission of the `bar-hidden-rows` class from row HTML strings:
  - [src/ui/viewer/viewer-data-viewport.ts:171-177](../src/ui/viewer/viewer-data-viewport.ts#L171-L177)
  - [src/ui/viewer/viewer-data-helpers-render.ts:218](../src/ui/viewer/viewer-data-helpers-render.ts#L218)
  - [src/ui/viewer/viewer-data-helpers-render-stack.ts:52,70,94](../src/ui/viewer/viewer-data-helpers-render-stack.ts#L52)
- **[src/ui/viewer/viewer-peek-chevron.ts](../src/ui/viewer/viewer-peek-chevron.ts)** — replace the `.bar-hidden-rows` click delegation with three narrower delegations:
  - `.viewer-divider[data-divider-action]` for filter-hidden dividers
  - `.dedup-badge[data-dedup-survivor-idx]` for inline dedup badges
  - `.stack-toggle[data-gid]` for stack-header chevrons
  - The `peekChevron` / `unpeekChevron` / `peekDedupFold` functions stay (peek-state logic is sound; only the trigger changes).

### 2. Inject divider rows in the render loop

- **[src/ui/viewer/viewer-data-viewport.ts](../src/ui/viewer/viewer-data-viewport.ts)** — `renderViewport()` already detects filter-hidden gaps via the existing `_hiddenFrom` / `_hiddenTo` block (lines 150-158). Replace the row-stamping branch (lines 171-177) with a divider-row push BEFORE the row push:
  ```js
  if (_hiddenFrom >= 0) {
      parts.push(buildHiddenDivider(_hiddenFrom, _hiddenTo, _hInfo, /*action=*/'show'));
  }
  if (_peekKey !== null) {
      parts.push(buildHiddenDivider(/*range from peekAnchorKey scan*/, /*action=*/'hide'));
  }
  ```
  Add a corresponding **trailing** divider after the last row of an expanded peek range (detect by `allLines[i].peekAnchorKey !== allLines[i+1].peekAnchorKey`).
- New helper file (extract to keep `viewer-data-viewport.ts` ≤300 lines): **`src/ui/viewer/viewer-data-divider.ts`** — exports `getDividerRenderScript()` returning JS that defines `buildHiddenDivider(from, to, info, action)` returning the HTML string for the divider element.

### 3. New CSS for the three new affordances

Extract into a new file to keep `viewer-styles-decoration-bars.ts` small: **`src/ui/viewer-styles/viewer-styles-collapse-controls.ts`** — exports `getCollapseControlStyles()` covering:

- `.viewer-divider` — full-row-width thin button bar with reason text
- `.dedup-badge` — inline `×N` pill at the row's end
- `.stack-toggle` — inline chevron inside stack-header text

Wire it into the styles aggregator that already concatenates the other style fragments.

### 4. Stack-header chevron and dedup badge inside row HTML

- **[src/ui/viewer/viewer-data-helpers-render-stack.ts](../src/ui/viewer/viewer-data-helpers-render-stack.ts)** — `renderStackHeader()` emits an inline `<span class="stack-toggle" data-gid="…">▶</span>` (collapsed) or `▼` (expanded), removed the `bar-hidden-rows` branching. `renderStackFrame()` for the dedup-survivor branch (lines 64-78) emits an inline `<span class="dedup-badge" data-dedup-survivor-idx="…">×N</span>` at the row's end instead of stamping the row class.
- **[src/ui/viewer/viewer-data-helpers-render.ts](../src/ui/viewer/viewer-data-helpers-render.ts)** — same dedup-survivor change for non-stack rows (lines 217-224).

### 5. Tooltip and a11y on dividers and badges

- Divider `title`: `12 lines hidden · 8 filter · 4 dedup · click to show`
- Divider `aria-label` mirrors the title; `aria-expanded` reflects state.
- Dedup badge `title`: `12 identical rows folded · click to show`
- Stack chevron `title`: `Collapse stack trace` / `Expand 8 frames`

### 6. Retire the unified-line-collapsing plan reference

Code comments referencing `bugs/unified-line-collapsing.md` should be amended in-place to reference this plan instead. Files (from grep):

- [src/ui/viewer/viewer-data.ts](../src/ui/viewer/viewer-data.ts)
- [src/ui/viewer/viewer-data-helpers-render.ts](../src/ui/viewer/viewer-data-helpers-render.ts)
- [src/ui/viewer-styles/viewer-styles-decoration-bars.ts](../src/ui/viewer-styles/viewer-styles-decoration-bars.ts)
- [src/ui/viewer/viewer-peek-chevron.ts](../src/ui/viewer/viewer-peek-chevron.ts)
- [src/ui/viewer/viewer-data-viewport.ts](../src/ui/viewer/viewer-data-viewport.ts)
- [src/ui/viewer-styles/viewer-styles-content.ts](../src/ui/viewer-styles/viewer-styles-content.ts)
- [src/ui/viewer-decorations/viewer-deco-settings.ts](../src/ui/viewer-decorations/viewer-deco-settings.ts)
- [src/modules/capture/log-session.ts](../src/modules/capture/log-session.ts)
- [src/ui/viewer/viewer-data-helpers-render-stack.ts](../src/ui/viewer/viewer-data-helpers-render-stack.ts)

## Tests

### Update existing tests (will break under this rework)

- [src/test/ui/viewer-peek-chevron.test.ts](../src/test/ui/viewer-peek-chevron.test.ts) — assertions about `class="bar-hidden-rows"` injection become assertions about divider row injection.
- [src/test/ui/viewer-severity-bar-connector.test.ts](../src/test/ui/viewer-severity-bar-connector.test.ts) — same.
- [src/test/ui/viewer-collapse-expand.test.ts](../src/test/ui/viewer-collapse-expand.test.ts) — `toggleStackGroup` now wires through `.stack-toggle`, not `.bar-hidden-rows`.

### New regression tests

1. **Severity dot is non-interactive.** Render a row that previously would have carried `bar-hidden-rows`; assert the row's outer class string contains `level-bar-*` but no toggle class, and that the severity `::before` rule has no `cursor: pointer` or click handler.
2. **Filter-hidden divider appears between visible rows.** Filter to hide rows 5-15; assert a `.viewer-divider[data-divider-action="show"][data-hidden-from="5"][data-hidden-to="15"]` element appears in viewport HTML between row 4 and row 16.
3. **Trailing divider on expanded peek.** After `peekChevron(5, 15)`, assert both leading (`action="hide"`) AND trailing (`action="hide"`) divider elements bracket the revealed range.
4. **Dedup badge expand/collapse.** Survivor row carries `<span class="dedup-badge" data-dedup-survivor-idx="N">×12</span>`. Click expands → all 12 dups visible AND survivor's badge becomes `×12 (hide)`. Click again collapses.
5. **Stack chevron parity.** Collapsed header shows `▶`, expanded shows `▼`. Click toggles. Severity dot does not change.
6. **Click outside controls is a no-op for collapse.** Click anywhere on a row that is NOT a divider, badge, or chevron. Assert `peekOverride` and `collapsed` flags are unchanged.

### Manual UAT checklist

- Filter to a state with many hidden gaps; scroll the log; confirm dividers always render at the right positions and never overlap.
- Expand a peek group; click anywhere on a revealed line that is NOT a divider; confirm nothing collapses.
- Expand a deeply-nested stack with dedup folds; confirm chevron and badge act independently.
- Zoom log font from 80% to 200%; confirm divider, badge, and chevron all scale via `em` and stay column-aligned.
- High-contrast theme (Dark High Contrast); confirm divider visibility.

## Risks

1. **Render-loop divider injection adds DOM nodes per visible gap.** With heavy filtering this could be 50+ extra divider elements in the viewport. Acceptable — they're tiny (≤14px) and don't carry stack-frame complexity. Verify scroll perf with a 50k-line log + aggressive filter that produces many gaps.
2. **`bar-up` / `bar-down` connector logic in [viewer-data-viewport.ts:186-203](../src/ui/viewer/viewer-data-viewport.ts#L186-L203) walks `viewportEl.children` looking for `level-bar-*` siblings.** Divider rows are interleaved children — they'll appear in that walk. The `findNextDotSibling` helper at [viewer-data-viewport.ts:14-22](../src/ui/viewer/viewer-data-viewport.ts#L14-L22) currently stops at `.marker`; extend it to also skip `.viewer-divider`.
3. **Stack-header chevron inside text content vs. existing `getDecorationPrefix`.** The decoration prefix already injects glyphs left of the line content. Place the chevron AFTER the decoration prefix (so it sits next to the actual log text, not the timestamp/line-number block).
4. **Existing keyboard shortcuts assume row-level click delegation.** Any shortcut that triggers expand/collapse via a synthesized click on a row needs to route through the new control selectors.
5. **Settings that toggled visibility of the unified outlined-dot state** (if any exist in [src/ui/viewer-decorations/viewer-deco-settings.ts](../src/ui/viewer-decorations/viewer-deco-settings.ts)) become divider-visibility settings instead. Audit during implementation.
6. **HTML export ([src/ui/viewer-panels/viewer-export-html.ts](../src/ui/viewer-panels/viewer-export-html.ts))** — confirm the export's collapsing UI either inherits the new divider/badge/chevron treatment or is explicitly out of scope. Decide before implementation.

## Out of Scope

- The minimap/severity-bar canvas on the right edge of the viewer ([src/ui/viewer/viewer-scrollbar-minimap.ts](../src/ui/viewer/viewer-scrollbar-minimap.ts)). It paints severity ticks with click-to-navigate behavior, and that's a different control surface — it's not the user's complaint and isn't overloaded.
- Changing what counts as "hidden" — filter logic, dedup logic, and stack-collapse logic all stay exactly as they are. This plan only changes the affordances that surface those states.
- The `peekOverride` / `peekAnchorKey` data model on `allLines` items. The state machine is sound; only its triggers and visualization change.

## Decision Log

- **Why dividers (full-row bars) instead of small icons:** A control whose entire body says what it does and what will happen leaves no room for the "is this informational or interactive?" misreading that the outlined-dot suffers from. Width also gives room for the count + reason text.
- **Why dedup uses an inline badge, not a divider:** The dedup survivor IS a real visible row carrying real text. A divider above or below it would be ambiguous about which row owns the fold. An inline trailing badge is unambiguously attached to the survivor.
- **Why stack chevrons go inside header text, not the gutter:** Convention. Every IDE, debugger, file explorer, and JSON viewer uses inline chevrons for collapsible regions. Putting them in the severity gutter was novel for novelty's sake.
- **Why preserve the peek-key state machine:** It already supports independent multi-group expand/collapse correctly; rewriting it would risk regressions in working logic. Only the UI vocabulary needs to change.
- **Why retire the unified-line-collapsing plan rather than amend it:** That plan's central thesis was "consolidate to one decoration on the gutter dot." This plan's central thesis is the opposite. They cannot coexist as guidance.

## Changes Made

<!-- Fill in as implementation proceeds. -->

## Tests Added

<!-- Fill in as implementation proceeds. -->

## Commits

<!-- Add commit hashes as fixes land. -->
