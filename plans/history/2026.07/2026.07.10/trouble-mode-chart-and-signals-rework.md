# Trouble Mode — severity-chart pre-app handling, warm-up filter, Crash Issues → Signals

The Trouble Mode dashboard drew the device's pre-app startup burst as a muted full-height bar that still dominated the severity chart, and its Crash Issues band listed Firebase Crashlytics cloud data unrelated to the log on screen. This rework drops the pre-app burst from the chart, adds an opt-in feed filter for those warm-up lines, removes the Crashlytics band, and replaces it with a band sourced from the current log's own signals.

## Finish Report (2026-07-10)

### Severity chart — pre-app boundary
- The chart's app-ready boundary (`troubleChartLaunchTs`, `viewer-trouble-chart-launch.ts`) now prefers the **build-complete** line (`√ Built …apk`, `Xcode build done`) over the earlier "Launching … in mode" line, falling back to the launch line when there is no build. Nothing the app emits can precede its own built artifact, so the later cut also excludes device noise produced during the build. "Built" is a chart-specific marker, deliberately NOT mirrored into `run-boundaries.ts` (which treats only "Launching" as a run start).
- The resumable launch scan self-heals: when a cached marker index no longer points at a marker line (proof `allLines` was replaced, not appended), it restarts. This fixes a field report where a reloaded log kept the previous log's boundary — or none — and the device burst scaled the whole strip (observed as `PEAK 118` on a crash-backlog log whose real post-app peak was 34).
- `buildTroubleChartBuckets` now **drops** every window before the boundary (`firstRealWindowKey`) and starts the strip at the first real event, rather than drawing pre-app windows muted at full height. This removes both the dominating spike and the long empty gap between the burst and app start. When every event so far is pre-app, the chart shows its empty state. The muted `tc-bar-pre` rendering path, its CSS, and the `troubleChart.preLaunch` string were removed.
- The chart also honors `enabledLevels` at bucket time, so a level hidden via the toolbar dots / legend chips is absent from bars, peak, and totals — not merely dimmed.

### Warm-up feed filter (opt-in, default off)
- A new `viewer-warmup-filter.ts` adds an "Exclude warm-up logs (before app start)" checkbox to the File Scope filter tab. It sets `warmupFiltered` on line items for lines captured at or before the same app-ready boundary; `calcItemHeight` gates on the flag (single source of truth), and birth height (`computeLineBirthHeight`) folds it in. The boundary resolves as the launch/build line streams in — after the warm-up lines are already rendered — so `maybeReapplyWarmupOnBoundaryChange` re-applies once on a boundary change (per batch, O(n) only on a real change). Resets with the feed on `clear`. This is the filterable, opt-in answer to "hiding data is never the answer": the data is hidden by choice, not lost.

### Crash Issues band removed; current-log Signals band added
- The Trouble Mode Crashlytics band (its webview script, styles, host request handler, issues-to-rows formatter, the `requestTroubleCrashlytics`/`troubleCrashlyticsRows` message path, and orphaned l10n keys) was removed entirely — its rows were Firebase cloud data unrelated to the log being viewed. The standalone Crashlytics panel and its rail detail (`#trouble-detail-crashlytics`, `slcOpenCrashlyticsDetailInRail`, `viewer.troubleCrashlytics.counts`) remain, reachable from the toolbar.
- A new `viewer-trouble-signals.ts` band takes its place, showing the current log's top recurring signals from `signalDataCache.signalsInThisLog` (owned by the Signal panel script). Entering Trouble Mode requests the data; the Signal panel's `signalData` handler calls `renderTroubleSignalsBand` when it arrives. A jumpable row scrolls the feed to the signal's first occurrence via `scrollToLineNumber(lineIndex + 1)`; "All N" opens the full Signal panel; the band collapses like the severity chart and hides when the log has no signals.

### Collapse UX
- The severity chart's collapse caret grows from `--text-h3` to `--text-h2`, and its title text (id `trouble-chart-title`) toggles collapse in addition to the caret; the legend chips keep their own level-filter handlers. The Signals band mirrors this head/collapse chrome.

### Tests
- Webview VM tests cover: pre-app burst trimming and the empty/no-launch/attach/streaming/self-heal/build-complete-preferred cases (`viewer-trouble-chart-prelaunch.test.ts`, split from the main chart test to hold the file line cap); `enabledLevels` bucket exclusion; the warm-up classification and boundary-change re-apply (including a second move and the unchanged no-op); and the Signals band render/empty/missing-cache, five-row cap, "All N" link, jumpable-row `scrollToLineNumber(idx+1)`, and collapse.

### Verification notes
- `check-types` is clean for these files; `npm run compile` could not be run end to end because an unrelated file (`viewer-session-panel-rendering.ts`) was mid-edit by a concurrent workstream and failed typecheck. Verification used the individual gates (tsc filtered, eslint per-file, `verify:l10n-keys`, targeted mocha). Two pre-existing `max-lines` warnings remain in `viewer-script-messages.ts` (382 lines at the v9.2.0 release, unchanged in net by this work); `eslint src` does not fail on warnings.
