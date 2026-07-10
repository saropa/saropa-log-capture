# Trouble Mode severity chart ignored the level toggles

The severity chart above the Trouble Mode feed kept counting a level's lines in its bars
and legend totals after that level was turned off via the toolbar level dots or the
chart's own legend chips, even though the feed itself correctly hid those lines. The
chart's own header comment claimed "chart totals can never disagree with the feed," but
`buildTroubleChartBuckets` never actually read the toggle state, and no code path rebuilt
the chart when a level was toggled at all.

## Root cause

Two independent gaps in `src/ui/viewer-search-filter/`:

1. `buildTroubleChartBuckets()` (`viewer-trouble-chart.ts`) bucketed every `'line'` item
   whose `item.level` was one of `error` / `warning` / `performance` (`TROUBLE_LEVELS`),
   with no check against `enabledLevels` — the `Set` the toolbar's level dots and the
   chart's own legend chips both toggle (`viewer-level-filter.ts`). A line hidden from the
   feed by `levelFiltered` therefore still counted toward the chart's bars, totals, and
   peak scale.
2. `syncLevelDots()` (`viewer-level-filter.ts`) — the one function every level-changing
   path calls (`toggleLevel`, `selectAllLevels`, `selectNoneLevels`, `soloLevel`,
   `restoreLevelState`) — already called `syncTroubleChartChips()` to dim the legend chip,
   but nothing told the chart to re-run `buildTroubleChartBuckets()` and repaint. Even after
   fixing (1), the stale chart would not have refreshed until some unrelated event (a new
   line arriving, the collapse chevron) forced a re-render.

## Fix

- `buildTroubleChartBuckets()` now skips a line when `enabledLevels` exists and does not
  have `item.level` (guarded with `typeof enabledLevels !== 'undefined'` for the VM test
  harness, where the level-filter script is not loaded).
- `syncLevelDots()` now also calls `scheduleTroubleChartUpdate()` when the chart script is
  present, immediately after the existing `syncTroubleChartChips()` call. Because every
  level-changing path already funnels through `syncLevelDots()`, this one call covers all
  five entry points without touching any of them individually.

## Verification

- `npm run compile` — all 12 gates pass.
- New `src/test/ui/viewer-trouble-chart-level-filter.test.ts` — 5 passing:
  - a disabled level (a 4-event burst, large enough that leaving it counted would have set
    the peak) is excluded from bins, legend totals, AND the peak scale;
  - with no `enabledLevels` set at all (the VM-harness fallback), every charted level still
    counts, so the guard cannot silently blank the chart if the level-filter script is ever
    absent from the concatenated page;
  - `toggleLevel`, `soloLevel`, and `selectAllLevels` — three of the five entry points —
    each schedule a chart rebuild through the real `syncLevelDots()` choke point (verified
    against the actual `viewer-level-filter.ts` script, not a mock);
  - no rebuild is scheduled while Trouble Mode itself is off, matching
    `scheduleTroubleChartUpdate`'s existing no-op guard.
- Existing `src/test/ui/viewer-trouble-chart.test.ts` (21 tests) and
  `viewer-level-filter-context-focus.test.ts` (3 tests) — unchanged, still passing; neither
  exercises `enabledLevels` against `buildTroubleChartBuckets`, so this is additive
  coverage, not a fix to a broken assertion.
