# Bug 006 — Toolbar Level Dots Unreadable, Two Filter Strips Diverge

## Status: Fix Ready

## Problem

The toolbar footer level summary renders eight 12px colored dots side-by-side with only counts as text:

```
🔴 29   🟠 137   🟢 4,552   🟣 397   ⚪ 3   🔵 449   🟤 1,838
```

Color alone is the only cue for which dot represents which level. Users repeatedly cannot tell warning (orange) from todo (gray) from debug (brown) at a glance, and color-blind users have no usable signal — they must hover each dot to read the title tooltip. The bug report on this stated, verbatim, "**that is terrible UX!! there are different colored dots in both dot lists**".

Compounding it, the two places where a user can toggle level filters disagree visually:

- Toolbar footer: just colored dots + numeric count.
- Filter drawer: emoji + word label + count circles.

So the same filter state is communicated two different ways depending on where the user is looking.

## Environment

- VS Code version: any
- Extension version: 7.5.4 / Unreleased
- Affects all themes (light + dark) since both use the same fixed level palette.

## Reproduction

1. Open the log viewer.
2. Look at the level summary in the toolbar footer (right of the source-tag chips).
3. Try to find the warning level without hovering. You can't — only the orange color identifies it, and orange/yellow/brown are visually adjacent at 12px.
4. Open the filter drawer. The same levels render as emoji+label+count circles. Two different visual languages for one piece of state.

## Root Cause

`viewer-toolbar-html.ts` rendered each level-dot-group as `<dot><count>` with no in-line text label. The decision was originally that a compact 12px palette saved horizontal space; however, eight similarly-saturated colors at that size are not distinguishable without prior memorisation, and the title tooltip is the only fallback.

`viewer-toolbar-filter-drawer-html.ts` independently grew an emoji + word label model for the larger drawer surface, where space is plentiful. The two were never reconciled.

## Changes Made

### File 1: `src/ui/viewer-toolbar/viewer-toolbar-html.ts`

Added a `<span class="level-letter level-letter-X">…</span>` chip between the dot and the count for each of the eight levels. The chips use single-letter codes for the seven primary levels (`E`, `W`, `I`, `P`, `T`, `N`, `D`) and `DB` for database, since `D` is already taken by debug.

### File 2: `src/ui/viewer-styles/viewer-styles-level.ts`

Added `.level-letter` base style (10px, weight 600, line-height 1, no letter-spacing) and per-level color rules so each chip matches its dot. Inactive state is driven by `.level-dot-group:has(.level-dot:not(.active)) .level-letter { opacity: 0.45 }`, which keeps the active/inactive cue paired between the dot and its letter without needing a JS sync hook (`syncLevelDots()` already toggles `.active` on the dot, and `:has()` cascades the opacity).

`.level-letter-todo` uses `var(--vscode-descriptionForeground)` because gray-on-gray would disappear; the other seven use the dot color directly.

`.level-letter-debug` uses `#a1887f` (a lighter brown) instead of the dot's `#795548` because the darker brown is illegible against most editor backgrounds. The dot itself keeps `#795548` since the colored fill is bigger and survives the contrast hit.

## What This Does Not Fix

The drawer still renders emoji+label+count circles. Full convergence (drawer adopts compact letter chips, or footer adopts emoji+label) would either lose information density in the drawer or blow out the toolbar width budget. Letter labels in the footer are the highest-leverage subset of that work — they let a user scan the footer without hovering, and they share the alphabet that the drawer's word labels imply.

If a future redesign decides to unify entirely, the call site here is small (eight `<span class="level-letter level-letter-X">…</span>` insertions) and reverting the chip is one delete.

## Verification

- `npm run check-types`
- `npm run lint`
- Manual: open the viewer; the footer should read `🔴E 29  🟠W 137  🟢I 4,552 …` style. Toggle a level off via the drawer; the corresponding letter in the footer should fade to 45% opacity. Click a dot in the footer; behavior matches the prior dot-only click (toggles the level). Double-click "solos" the level (existing behavior preserved).
