# Handover — smart_bookmark_trouble_mode
2026-08-06 15:45 UTC · saropa-log-capture / main · bug_002

## Unfinished tasks
1. [pending] F5 manual test — open a log with pre-launch logcat errors, verify the smart bookmark modal skips them and points to the first error after "Launching ... in debug mode"
2. [pending] F5 manual test — set `troubleMode.openOnLoad` to true, open a log, verify Trouble Mode activates automatically and no smart bookmark modal appears
3. [pending] F5 manual test — change `troubleMode.levels` to `["error"]`, verify only error-level lines survive the filter; change live and confirm it updates without reopening
4. [pending] F5 manual test — verify "First error" button in the trouble chart header jumps to the first error after app start

## Completed tasks
1. Smart bookmark pre-launch skip — `findFirstErrorLines` now accepts `skipBeforeLine` option; `getSmartBookmarksFirstErrorAndWarning` detects the first launch boundary via `detectRunBoundaries` + `getRunStartIndices` and passes it. 3 regression tests added. Verified via `npm run compile` (12/12 gates) and `npm run test:file` (9/9 pass). Commit `76f9ceb2`.
2. "First error" jump button in trouble chart — button in the trouble chart header scrolls feed to first post-app-start error via `scrollToLineNumber`. `findFirstErrorLineAfterLaunch()` with O(1) cache (invalidates on allLines length or launchTs change). `syncJumpFirstErrorButton()` shows/hides based on error existence. CSS `.tc-jump-btn` styles. 2 l10n keys. Verified via compile + tests. Commit `042b8ced`.
3. `troubleMode.openOnLoad` setting — new boolean setting (default false). Host sends idempotent `activateTroubleMode` message on each load when enabled. Smart bookmark modal suppressed when setting is on. Webview `activateTroubleMode()` only turns ON, never toggles off. NLS keys in all 11 locale files. Verified via compile. Commit `9f3b727b`.
4. `troubleMode.levels` setting — new array setting (default `["error", "warning", "performance"]`). Valid values: error, warning, performance, database, todo, debug, notice. Host pushes `setTroubleLevels` message on load (when non-default) and on config change (live via `activation-listeners.ts`). Webview `setTroubleLevels()` replaces `TROUBLE_LEVELS` object and re-applies filter if active. NLS keys in all 11 locale files. Verified via compile + trouble mode tests. Commit `5ca7672f`.
5. Bug report archived — `bugs/nav to first error is broken.md` was the informal report. Full finish report written to `plans/history/2026.08/2026.08.06/bug_002_smart-bookmark-pre-launch-errors.md` with status Fixed.

## Session narrative

### User requests
1. "review and fix: D:\src\saropa-log-capture\bugs\nav to first error is broken.md" — the informal bug report described the smart bookmark modal firing on pre-launch device backlog errors (e.g. `E/AndroidRuntime: FATAL EXCEPTION`) that are logcat noise from previous processes, not the user's app.
2. `/finish` — user selected all three options (harden + implement unrequested feature + commit) three times in succession.
3. User note on second /finish: "note that when in 'trouble mode' everything is an error/warning. so this is pretty pointless then" — referring to the "First error" button being redundant when trouble mode already shows only errors/warnings.
4. Third iteration: "1. harden the items raised in the handoff reflection; 2. implement the unrequested feature; 3. update changelog and git commit"

### Investigation & analysis
- **Root cause**: `findFirstErrorLines` in `src/modules/bookmarks/first-error.ts` scanned from index 0 with no launch-boundary awareness. The trouble chart already solved this for its histogram via `viewer-trouble-chart-launch.ts`.
- **Run boundaries**: `src/modules/session/run-boundaries.ts` has `RUN_START_PATTERNS` including `Launching\s.+\s+in\s+(?:debug|profile|release)\s+mode`. `detectRunBoundaries` scans body lines, `getRunStartIndices` filters to non-exited boundaries.
- **Edge case verified**: no launch line → `startIndices[0]` is `undefined` → `skipBeforeLine` is `undefined` → scans from 0 (correct for plain logs).
- **Truncation verified**: unified load path `.slice(0, effectiveUnified)` keeps FIRST N lines, so the launch line (early in log) survives truncation.
- **Trouble mode architecture**: webview-side state only (`vscodeApi.setState()`). Host can send `triggerToggleTroubleMode` but doesn't know current state. New `activateTroubleMode` is idempotent (ON-only).
- **Cache invalidation for `tcFirstErrorCache`**: verified that `resetTroubleChartLaunchScan` changing `troubleChartHostLaunchTs` to 0 and `allLines.length` going to 0 during clear both invalidate the cache check automatically — no explicit reset needed.
- **Timing safety**: `setFileLoadedHandler` fires after the webview has received and processed content, meaning scripts are already initialized. The `typeof` guard in the message handler is an additional safety net.

### Changes made

**`src/modules/bookmarks/first-error.ts`**
- Added `skipBeforeLine?: number` to `FirstErrorOptions`
- Added `FindFirstErrorResult` interface with `skippedPreLaunchErrors` count
- `findFirstErrorLines` counts error-level lines before `skipBeforeLine` and scans main content from that index

**`src/ui/provider/log-viewer-provider-load-helpers.ts`**
- `getSmartBookmarksFirstErrorAndWarning` calls `detectRunBoundaries` + `getRunStartIndices` to find first launch line, passes as `skipBeforeLine`
- Returns `skippedPreLaunchErrors` count

**`src/ui/provider/log-viewer-provider-load.ts`**
- Added `skippedPreLaunchErrors?: number` to `LoadResultFirstError` interface

**`src/extension-activation-helpers.ts`**
- Logs skipped pre-launch error count to output channel via `logExtensionInfo`

**`src/extension-activation-handlers.ts`**
- Reads config on each load
- Sends `setTroubleLevels` when non-default levels configured
- Sends `activateTroubleMode` when `openOnLoad` is true
- Suppresses smart bookmark modal when `openOnLoad` is true

**`src/activation-listeners.ts`**
- Live-pushes `setTroubleLevels` on `troubleMode.levels` config change

**`src/test/modules/bookmarks/first-error.test.ts`**
- 3 regression tests: skip pre-launch errors, no skip when undefined/0, all errors before skip

**`src/ui/viewer-search-filter/viewer-trouble-chart.ts`**
- `tcFirstErrorCache` for O(1) cached lookups (invalidates on allLines length or launchTs change)
- `findFirstErrorLineAfterLaunch()` — scans allLines for first error after app-start
- `syncJumpFirstErrorButton()` — shows/hides button based on error existence
- Button click handler scrolls to line via `scrollToLineNumber`

**`src/ui/viewer-search-filter/viewer-trouble-mode.ts`**
- `setTroubleLevels(levels)` — replaces `TROUBLE_LEVELS` object from host-provided array, re-applies filter if active
- `activateTroubleMode()` — idempotent ON-only, calls `toggleTroubleMode()` if not already active
- Updated `TROUBLE_LEVELS` comment to note configurability

**`src/ui/viewer/viewer-script-messages.ts`**
- `activateTroubleMode` and `setTroubleLevels` message handlers

**`src/ui/viewer-styles/viewer-styles-trouble-chart.ts`**
- `.tc-jump-btn` CSS: red border pill, inverts on hover, 10px font to match head row

**`src/ui/provider/viewer-content-body.ts`**
- Button HTML `#tc-jump-first-error` in trouble chart header between peak and legend

**`src/l10n/strings-webview.ts`**
- 2 keys: `viewer.troubleChart.jumpFirstError` and `viewer.troubleChart.jumpFirstError.title`
- Removed unused key `viewer.troubleChart.jumpFirstError.none`

**`src/modules/config/config-types.ts`**
- `troubleModeLevels: readonly string[]` and `troubleModeOpenOnLoad: boolean` added to `SaropaLogCaptureConfig`

**`src/modules/config/config.ts`**
- Reads `troubleMode.levels` (array, validated against 7 valid strings, defaults to `["error", "warning", "performance"]`)
- Reads `troubleMode.openOnLoad` (boolean, default false)

**`package.json`**
- `saropaLogCapture.troubleMode.openOnLoad` — boolean, default false
- `saropaLogCapture.troubleMode.levels` — array of enum strings, default `["error", "warning", "performance"]`, uniqueItems, minItems 1

**`package.nls*.json` (11 files)**
- 4 NLS keys: title/description for both `troubleModeOpenOnLoad` and `troubleModeLevels`

**`plans/reference/webview-outbound-message-types.md`**
- Regenerated (new `activateTroubleMode` and `setTroubleLevels` messages)

**`CHANGELOG.md`**
- `[Unreleased]` entries for all four features/fixes

**`plans/history/2026.08/2026.08.06/bug_002_smart-bookmark-pre-launch-errors.md`**
- Full finish report with defect, root cause, fix, hardening, features, files changed, verification

### Decisions & trade-offs
- **Pre-launch skip via run boundaries, not timestamp**: Used `detectRunBoundaries` (pattern-based on "Launching ... in debug mode") rather than the trouble chart's timestamp-based `troubleChartLaunchTs()`. The smart bookmark runs host-side on content lines where timestamps may not be parsed; the run-boundary detector works on raw text. Both approaches agree on what "app started" means.
- **`activateTroubleMode` vs extending `triggerToggleTroubleMode`**: Created a separate idempotent ON-only function rather than reusing the toggle. The host doesn't know webview state, so a toggle could turn trouble mode OFF if it was already ON from setState persistence.
- **`setTroubleLevels` via direct `postToWebview` instead of broadcaster pipeline**: The full broadcaster pipeline (viewer-target → broadcaster → provider → state → setup + pop-out + activation + listeners) would touch ~10 files for a single message. Using `broadcaster.postToWebview` directly from the load handler and config change listener is lighter. Tradeoff: no typed interface method, but the message is simple (just an array of strings).
- **Baking levels at load time + live push**: The levels are sent on each file load AND on config change. This means the user doesn't need to reopen the log after changing the setting — the filter updates immediately.
- **Cache invalidation for first-error button is implicit**: `tcFirstErrorCache` invalidates when `allLines.length` or `troubleChartLaunchTs()` changes. No explicit reset call needed because both values change naturally when content is cleared/replaced.

### Rejected / dismissed / deferred
- **Explicit `tcFirstErrorCache` reset in `resetTroubleChartLaunchScan`**: Investigated and determined that the cache self-invalidates because the reset changes `troubleChartHostLaunchTs` to 0 (different launchTs) and the clear handler sets `allLines.length` to 0 (different length). No explicit reset needed.
- **Threading `troubleModeLevels` through the HTML build pipeline** (ViewerHtmlOptions → ViewerScriptsOptions → getTroubleModeScript parameter): Would require touching ~6 additional files in the content/scripts build chain. The `postToWebview` approach is simpler and provides live updates.
- **Full broadcaster pipeline for setTroubleLevels**: Would add typed interface methods across 10 files. Overkill for a simple array-of-strings message.
- **Trouble mode presets** (named profiles like "Errors only", "SQL debug"): Deferred as a future feature suggestion. Would need workspace state storage and a dropdown UI in the trouble chart header.

### User feedback & corrections
- User's key feedback: "note that when in 'trouble mode' everything is an error/warning. so this is pretty pointless then" — this drove the `openOnLoad` setting (if trouble mode is your default, suppress the redundant modal) and the `levels` setting (configurable what "trouble" means).
- User selected "all three options" on every /finish gate (harden + implement unrequested feature + commit), three times in succession.

## Key files & paths
- `src/modules/bookmarks/first-error.ts` — core first-error scanner with `skipBeforeLine` and `skippedPreLaunchErrors`
- `src/modules/session/run-boundaries.ts` — `RUN_START_PATTERNS`, `detectRunBoundaries`, `getRunStartIndices` (read-only reference)
- `src/ui/viewer-search-filter/viewer-trouble-mode.ts` — webview trouble mode script: `TROUBLE_LEVELS`, `setTroubleLevels`, `activateTroubleMode`, `toggleTroubleMode`
- `src/ui/viewer-search-filter/viewer-trouble-chart.ts` — "First error" button: `findFirstErrorLineAfterLaunch`, `syncJumpFirstErrorButton`, `tcFirstErrorCache`
- `src/extension-activation-handlers.ts` — load handler: sends `setTroubleLevels` and `activateTroubleMode`, suppresses smart bookmark modal
- `src/extension-activation-helpers.ts` — `maybeSuggestSmartBookmark` function
- `src/activation-listeners.ts` — config change listener, live-pushes `setTroubleLevels`
- `plans/history/2026.08/2026.08.06/bug_002_smart-bookmark-pre-launch-errors.md` — full bug report + finish report

## How to verify
1. `npm run compile` — all 12 gates pass (confirmed)
2. `npm run compile-tests && npm run test:file -- out/test/modules/bookmarks/first-error.test.js` — 9/9 pass (confirmed)
3. `npm run test:file -- out/test/ui/viewer-trouble-mode.test.js` — pass (confirmed)
4. F5 in VS Code (not Cursor): open a log with pre-launch logcat errors → smart bookmark should point to first error AFTER "Launching ... in debug mode", not the device backlog
5. F5: set `troubleMode.openOnLoad` = true → open a log → Trouble Mode activates, no smart bookmark modal
6. F5: change `troubleMode.levels` to `["error"]` → only errors survive the filter; change live → updates without reopening
7. F5: in Trouble Mode, check trouble chart "First error" button → scrolls to first error after app start

## Gotchas & traps
- **Webview scripts share scope**: All webview JS files are concatenated into one page scope via template literals. `TROUBLE_LEVELS` is a `var` (not `const`) because `setTroubleLevels` reassigns it. Function names like `activateTroubleMode` must be globally unique.
- **Trouble mode state is webview-only**: `troubleModeActive` lives in `vscodeApi.setState()`. The host cannot query it — the `activateTroubleMode` message is fire-and-forget, idempotent.
- **NLS locale files have English placeholders**: The 4 new NLS keys (for `troubleModeLevels` and `troubleModeOpenOnLoad`) are untranslated English in all 10 locale files. The MT pipeline is never run unattended.
- **`activateTroubleMode` vs `triggerToggleTroubleMode`**: The former is idempotent ON-only; the latter toggles. Never use `triggerToggleTroubleMode` when you mean "ensure trouble mode is on" — it will turn it OFF if already active.
- **config.ts `troubleModeLevels` reader**: Uses an IIFE with validation against a hardcoded list of 7 valid level strings. If a new severity level is added to the classifier, it must also be added here AND to the `package.json` enum.
- **`setTroubleLevels` with empty array is a no-op**: Guarded by `if (!Array.isArray(levels) || levels.length === 0) return;` — the user can't accidentally hide all lines via an empty config.
- **Trouble chart legend chips are NOT affected by `setTroubleLevels`**: The chips are built from `enabledLevels` (the level-filter system), not `TROUBLE_LEVELS`. Adding `database` to `troubleMode.levels` will show database lines in trouble mode but the legend chips won't show a database swatch.
