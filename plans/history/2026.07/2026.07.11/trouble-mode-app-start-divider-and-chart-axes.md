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
