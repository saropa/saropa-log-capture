# Trouble Mode — app-start handling, chart axes, and the feed App-started divider

The Trouble Mode severity chart began before the app launched (charting the device's pre-app logcat backlog), its bars were hard to click, its axes lacked a peak scale mark and interior time ticks, and there was no marker of where the app actually started — in the chart or the feed. This work resets the chart to the app era at launch with an explanatory green divider, makes the whole bar column clickable, adds axis peak/ticks, and inserts a matching green "App started" divider into the log feed at the launch line.

## Finish Report (2026-07-11)

### Severity chart — app-start handling
- The chart no longer holds a blank "waiting" state before the app launches; it shows the whole span (device backlog included, so real pre-startup issues are not hidden). Once the launch/build boundary resolves (`troubleChartLaunchTs`), the start point resets to the app era — `firstRealWindowKey` drops the pre-app windows — and a bold green divider is drawn at the plot's left edge to explain the burst falling away rather than leaving it an unexplained change.
- `atAppStart` (the divider flag) is `launchTs > 0 && start === realMinKey`. The second clause matters: on an app-era span longer than `TROUBLE_CHART_MAX_BUCKETS` (180 windows) the cap pushes `start` past the real first window, so `bins[0]` is a mid-session window that must NOT be marked "app started". A regression test drives a >180-window span and asserts the flag stays false.
- The per-line bucket scan was extracted to `troubleChartScanLines`; the bar/legend/axis SVG builders moved to a new `viewer-trouble-chart-render.ts` (300-line-limit split, mirroring the launch-scan split).

### Severity chart — clickability and axes
- Every bar carries a transparent full-cell `tc-hit` rect (`fill:transparent; pointer-events:all`) so a click anywhere in the column jumps the feed, not just the ~14px colored bar.
- The peak count renders as the y-axis top scale mark (`tc-ymax`, an HTML chip over the plot with a background so a tall bar under it stays legible) in addition to the head. The x-axis shows up to five evenly spaced `HH:MM` ticks (contiguous window keys map linearly to x, so interior ticks are honest under `preserveAspectRatio="none"`); seconds are dropped since the strip spans minutes. A lone error clamps to a taller floor (`TROUBLE_CHART_MIN_ERROR` = 5px vs 3px) so it stays visible under a tall performance stack.

### Feed — green "App started" divider
- At the first `launch` run boundary (`firstLaunchLineIndex`, from the host `runBoundaries` message), `insertAppStartMarker` splices one green divider into `allLines`, marking where the app began after the device backlog — the feed counterpart to the chart's green marker.
- It reuses the `marker` row type: never filtered, `MARKER_HEIGHT` (28) via `calcItemHeight`'s existing marker branch, `buildPrefixSums` re-run after the splice — no new height/virtualization path. An `appStart` flag drives the render branch's `app-start-marker` class and a solid-green style that stands out from the faint green of ordinary session markers.
- Inserted before `insertRunSeparators` so the `+1` index shift is reflected in `runStartIndices`; the marker insertion is idempotent (guard on `allLines[atIdx].appStart`). Attach / logcat-only captures with no launch line get no divider. New source strings/behavior: `viewer.marker.appStart`, and the builders live in `viewer-run-app-start-divider.ts` (300-line-limit split).

### Review outcome
- A delegated read-only review found one real correctness defect (the cap-trimmed `atAppStart`), fixed above with a test. Lower-probability findings — a repeated `runBoundaries` message double-inserting run separators (pre-existing `insertRunSeparators` non-idempotency, out of scope) and a theoretical mid-group splice (unreachable: the launch line is a fresh `groupId:-1` console line) — were addressed by narrowing the divider module's comments rather than code changes.

### Tests
- `viewer-trouble-chart-prelaunch.test.ts`: backlog charts before app start (no hold); launch resets + flags the divider; the capped-span case does NOT flag it; the lone-error 5px floor.
- `viewer-trouble-chart.test.ts`: y-axis peak in the plot; full-cell `tc-hit`; HH:MM ticks (no seconds); the green divider draws only when a boundary resolved.
- `viewer-run-nav-app-start.test.ts`: `firstLaunchLineIndex` selection, single insertion + index shift + height, idempotency, no-launch no-op, and the `app-start-marker` render class.

### Verification notes
- `check-types` clean; scoped `eslint` clean on the changed files; `verify:l10n-keys` OK (2417 keys). The chart/feed test files pass (38 assertions). The run-nav test chains to `vscode` via l10n, so it runs under the Extension Host (or a stubbed `vscode` locally), not bare `node`. Full `npm run compile` (esbuild/catalogs) not run end to end.

## Finish Report (2026-07-11) — chart anchored to the host app-start line

A follow-up defect on the same feature: on some captures the severity chart still began minutes before the app launched (drawing the phone's pre-launch logcat backlog) while the feed's green "App started" divider was correctly placed — the chart and the divider disagreed on where the app started. Reproduced on `reports/20260711/20260711_133030_contacts.log`: the app launches at 13:32:13 (build completes 13:35:27) but the chart began at 13:30:30.

### Root cause
- The chart derived its app-start boundary from its own resumable webview scan (`troubleChartLaunchTs`, in `viewer-trouble-chart-launch.ts`), independent of the feed divider. Empirical replay of the real log through the compiled scripts showed the scan returns the correct boundary when handed the fully loaded `allLines`, so the field failure is a render-time state issue in the live webview (the scan evaluating to 0), not a logic error in the bucketing. The parallel scanner was a second, drift-prone source of truth for the same fact the host already computes reliably for the divider.
- The feed divider anchors to the host run-boundary detector (`run-boundaries.ts`), which reads the raw file and is deterministic — it was correct in the field.

### Fix
- `handleRunBoundaries` (`viewer-run-nav.ts`) now hands the chart the same host launch line the divider uses, via `setTroubleChartHostLaunchTs(firstLaunchLineIndex(msg.boundaries))`, called BEFORE `insertAppStartMarker` shifts `allLines` indices, then triggers `scheduleTroubleChartUpdate()`.
- `troubleChartLaunchTs()` returns `troubleChartHostLaunchTs` when set (> 0), so the chart's left edge and the feed divider sit on one launch line and cannot disagree. Because `firstRealWindowKey` starts at the first charted event after the boundary, the chart's first bar lands exactly where the divider renders (verified: host launch at 13:32:13 → first bar 13:34:20, `atAppStart` true, the 13:30:30 backlog dropped).
- The webview content scan remains the live-capture fallback for before the host `runBoundaries` message arrives. `resetTroubleChartLaunchScan` (the `'clear'` path) now also zeroes the host boundary so a stale one cannot bleed into the next log.
- Trade recorded in the module header: the host boundary is the LAUNCH instant, so the compile phase (launch → build-complete) is now charted as app-era rather than excluded — matching the divider is preferred over excluding a little compile-phase device noise. The fallback scan keeps its build-complete preference for the pre-host-message window.

### Review outcome
- A delegated read-only review confirmed index handling, splice ordering, guards, and the two new tests are correct, with no existing assertion broken. Two low-severity findings were addressed by documentation: the module header was updated to describe the host-boundary override (it previously claimed the build-complete line was always the boundary), and the `troubleChartHostLaunchTs` comment now records a residual, accepted gap — a log swapped in by an abnormal path that skips `'clear'` AND has no launch line could carry a previous log's boundary; the scan self-heal cannot backstop that because the host early-return means the scan never ran to cache the indices it checks. A robust code guard was judged disproportionate and risky (the marker splice shifts the stored index, so an index-staleness check would false-clear right after the divider is inserted); the normal load path is fully covered by the `'clear'` reset. A guard-symmetry nit was left as-is (harmless: `troubleChartResolveFwd` returns 0 on empty `allLines`).

### Tests
- `viewer-trouble-chart-prelaunch.test.ts`: the host boundary overrides the scan and aligns the chart with the divider (keeps the post-launch warning, drops the pre-launch backlog, flags `atAppStart`); a new log clears the host boundary. The existing build-preference and self-heal tests still pass (they never set the host ts, exercising the fallback). 31 chart assertions + 4 run-nav assertions pass.

### Verification notes
- `check-types` clean; scoped `eslint` clean on the changed files. Fix additionally verified by replaying the real reference log through the compiled `run-boundaries` + chart scripts (host launch@498 → first bar 13:34:20, `atAppStart` true). Full `npm run compile` (esbuild/catalogs) not run end to end.
