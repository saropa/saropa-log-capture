# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

**VS Code Marketplace** - [marketplace.visualstudio.com / saropa.saropa-log-capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

**Open VSX Registry** - [open-vsx.org / extension / saropa / saropa-log-capture](https://open-vsx.org/extension/saropa/saropa-log-capture)

**GitHub Source Code** - [github.com / saropa / saropa-log-capture](https://github.com/saropa/saropa-log-capture)

<!-- MAINTENANCE NOTES -- IMPORTANT --

    The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

    **Overview** — Each release (and [Unreleased]) opens with one plain-language line for humans—user-facing only, casual wording—then end it with: [log](https://github.com/saropa/saropa-log-capture/blob/vX.Y.Z/CHANGELOG.md) substituting X.Y.Z.

    **Tagged changelog** — Published versions use git tag **`vx.y.z`**; compare to [current `main`](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md).

    **Published version**: See field "version": "x.y.z" in [package.json](./package.json)

    NOTE: try to keep this file to approx 500 lines
    
cspell:disable
-->

---

## [Unreleased]

### Added

- Logs panel: older day groups now collapse by default — only today's group starts expanded; clicking a heading still toggles, and explicit expand/collapse persists across reloads (plan 001 part A)
- Logs panel: non-latest, non-active rows now show a single neutral line-count pill instead of the full severity breakdown — click the pill to expand inline; a "Collapse counts" toggle in Display options controls the behavior (plan 001 part B)

### Fixed

- Smart bookmark modal no longer fires on pre-launch device backlog errors; skipped pre-launch error count is logged to the output channel (bug_002)

## [9.3.7]

Flutter profile mode now captures screenshots on crash, alongside inline log image references, on-demand capture tools, diagnostic self-tests, and smart flow map breadcrumb suggestions. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.7/CHANGELOG.md)

### Added

- Flow map: when a log has no recognized navigation breadcrumbs, the diagram area now suggests custom rules built from the log's own repeated line shapes, addable in one click — arrow-separated lines (`Navigated -> Home`) are recognized alongside colon-separated ones, and a short capture holding a single navigation-worded line is offered too

### Fixed

- Flow map: a suggested breadcrumb rule now reproduces its source line verbatim, so the rule matches the lines it was derived from (an arrow-separated suggestion previously generated a rule that matched nothing), and adding one falls back to user settings when no workspace folder is open instead of failing
- Session Display menu: the Reverse toggle showed its raw l10n key (`viewer.session.toggleReverse.text`) instead of a label — added the missing `.text` string
- l10n key verification now catches dynamic key families via four layers: literal keys, `@l10n-expand` JSDoc tags (cross-file, paren-balanced arg parsing, escape-aware, multi-line tags), `@l10n-family` catalog annotations, and a template-pattern fallback — a missing suffix in any family fails the compile gate; out-of-bounds arg indices emit ERROR (stale tag), non-literal args emit WARN
- Flow map: a log with no navigation breadcrumbs (for example a logcat-only capture) no longer renders a silent blank diagram — the zero-node layout produced an invalid negative-height SVG; the diagram area now explains what the flow map needs, and the zoom toolbar and glyph legend are hidden when there is no diagram to control
- Screenshots now capture in profile-mode Flutter runs: profile builds emit no console exception banners (the previous only trigger source), so live app crashes from the device log (`E/AndroidRuntime: FATAL EXCEPTION`) now trigger a capture — while the days-old crashes the device replays from its buffer at every session start, and routine warning-level system chatter, never do. Live-vs-replayed is judged entirely on the device's own clock, so it works whatever timezone the phone is set to
- The output channel now announces "capture pipeline armed" with the running version at startup (confirms the installed build has the feature) and warns once when an app error passes with no VM Service address known, so an idle capture pipeline is never silent
- Each captured screenshot is now recorded as a line in the log itself, right beside the error that caused it — so screenshots are visible when reading or sharing a log, not just as files in a folder
- A capture count pill sits with the open log's name in the banner as well as the toolbar, so a log you are reading shows how many screenshots it holds; clicking either opens the gallery
- New "capture now" button in the viewer toolbar takes a screenshot on demand. It appears only while a live debug session is being viewed — there is nothing to photograph in a saved log, so the button is absent there rather than present and dead
- Every Flutter debug session now records a screenshot self-test in its log and the output channel — whether capture is on, which triggers are armed, the adb version, and the attached device (or plainly "adb NOT FOUND" / "NO DEVICE attached"). A log that captured nothing now explains why on its own, without a live investigation
- 29 manual translations filled across 9 locales (EN-COPY audit gaps from engine swap)
- Japanese and Korean "Sev" column header fixed from sound transliterations to meaning (重度, 심각)

<details>
<summary>Maintenance</summary>

**l10n pipeline**

- German loanwords (Commit, Detail, Version) kept as-is and added to verified-identical allow-list
- Audit auto-suppresses EN-COPY entries with manual provenance (no code change needed for true cognates)

</details>

---

## [9.3.6]

Non-english language translations have been upgraded to a higher-quality offline engine. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.6/CHANGELOG.md)

<details>
<summary>Maintenance</summary>

**l10n pipeline**

- Translation engine switched from NLLB/Google to Qwen 3 via Ollama (offline, GPU-aware model ladder, no external API fallback)
- Brand shielding uses XBQ…VKZ sentinel tokens (8-char opaque codes) instead of angle-bracket placeholders
- NLLB and Google translations reclassified as low quality in provenance; Qwen and manual are high quality
- Quality audit similarity scoring uses character bigrams for CJK locales (ja, ko, zh) instead of word bags, which produced meaningless scores for scripts without word boundaries
- `--prompt-preview` flag prints Qwen prompts to stderr without calling Ollama
- Round-trip quality audit (menu option 7): samples translations, reverse-translates via Qwen, flags low-similarity divergences
- Stale Google/NLLB references replaced with engine-agnostic wording across pipeline modules
- Sentinel format comment corrected from "7 chars" to "8 chars"
- Dead imports removed from quality audit module

</details>

---

## [9.3.5]

Flow map replays now show a floating screenshot of each screen as they step through, and crash detection no longer misses gesture exceptions. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.5/CHANGELOG.md)

### Added

- Flow map: during a replay, screens with a captured screenshot show a floating preview of what the user saw at that step

### Fixed

- Flow map: gesture exceptions ("Exception caught by gesture", no "library" suffix) are now detected as crashes
- Flow map: replay centering is now zoom-proof, and Escape closes the node-detail popup before stopping a running replay

---

## [9.3.4]

The Flow map gets a major upgrade with session replays, custom breadcrumb mapping, integrated screenshot previews, and theme support, plus a fresh status bar look with quick-action menus.  [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.4/CHANGELOG.md)

### Added

- Flow map: new settings `saropaLogCapture.flowMap.customBreadcrumbs` and `saropaLogCapture.flowMap.customIssues` let any project map its own log lines to screens, actions, and issues without code changes
- Flow map: a Screenshots section shows the captures taken during the session, each joined to the screen that was active and clickable to jump to its log line
- Flow map: a Replay button steps through the session walk, highlighting each screen in visit order

### Changed

- Status bar capture toggle: replaced the bare dot icon with "SLC" text label for discoverability; shows active session count as a badge (e.g. "SLC (2)"); hovering now shows a menu tooltip with command links — toggle capture, open viewer, pause/resume, stop (when a session is active), open settings, and view changelog
- Flow map: the legend line under the Flow heading is now an info icon whose tooltip shows the legend on hover or focus
- Flow map: diagram arrows now label the time spent on a screen before that specific transition, instead of the screen's total time across all visits
- Flow map: repeated warnings keep one issue row per category but now show how often they fired (e.g. "×47")
- Flow map: the diagram now follows the editor color theme (light themes included) — node, edge, and badge colors come from the design tokens instead of fixed dark-only colors
- Flow map: the visit-count badge only appears on screens visited more than once; multiple return arrows fan out instead of drawing on top of each other; long titles and detail lines truncate to their own font's fit
- Flow map: report section titles, table headers, session-info labels, and tooltips are now translatable

### Fixed

- Flow map: a crash without its own widget report no longer claims the next crash's widget and source anchor
- Flow map: a crash that fires between two visits to the same screen now anchors to the screen actually open at that moment
- Flow map: custom patterns skip lines over 500 characters, bounding worst-case regex backtracking from user-supplied patterns
- Flow map: the worst slow query now keeps its real time — it sorts chronologically in the Issue Report and badges the screen that was active, instead of floating to the top with no clock
- Flow map: every unhandled exception in a log is now detected and drawn (previously only the first); each crash edge anchors to the screen active at its own moment
- Flow map: returning to a screen that appears twice in the open-navigation stack no longer closes every surface between the two visits
- Flow map: a mid-log hot restart ("App Startup") now resets the walk to the launch node and is counted in Session info, so repeated Home entries after restarts no longer read as user taps

---

## [9.3.3]

Automatic screenshots now capture your Flutter app the exact moment an error strikes, and signal reports received a massive visual upgrade with new arc gauges, badges, and cleaner layouts. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.3/CHANGELOG.md)

### Added

- Debug screenshot capture (plan 114): during a Flutter debug session, the app's screen is captured automatically when an error is detected (warnings and screen navigation are optional triggers) plus a manual "Capture Screenshot" command — no app-side code needed (uses the Flutter VM Service)
- Screenshots are stored beside the log (`<log>.screenshots/` + `<log>.screenshots.json` metadata) with per-log cap, cooldown, and error-fingerprint dedup
- Log viewer shows a camera badge on the line that triggered each capture; clicking it opens a thumbnail preview, click-through opens the full-size image
- Viewer footer camera icon opens a capture options menu — screenshots master toggle, per-trigger checkboxes (errors/warnings/navigation), Capture now, Open gallery, and the active cooldown/per-log limits; a live counter next to it opens a gallery of all captures with datetime, trigger, and the log lines explaining why each was taken (click to jump into the log)
- Signal reports gain a Screenshots section showing the captures nearest the signal's anchor line
- Signal reports show a before/after screenshot comparison when a capture exists from before the error (screen-navigation shots are the intended source): the earlier frame, the at-error frame, and a third panel highlighting changed pixels in magenta
- Screenshot capture is more resilient: the VM Service address is also read from the Debug Console banner when the debug adapter's announcement event is missing, stale addresses are dropped when a debug session ends, and an unavailable `_flutter.screenshot` API is named plainly in the output channel
- Framework noise (logcat feed, `E/Gralloc4`-style startup noise, benign device `E/` tags) never triggers a screenshot; Flutter app errors and critical device crashes (`AndroidRuntime` fatal exceptions, out-of-memory kills) still do — launch bursts cost nothing and captures always show a screen worth looking at
- After 3 consecutive capture failures automatic screenshots pause for that debug run (one output-channel notice; the manual command still tries, and a new run resets it) — a broken capture endpoint no longer costs a socket timeout per error
- Screenshot anchors are text-verified: the gallery excerpt and the viewer's camera badge locate the triggering line by its stored text when the recorded line number disagrees with the file (session headers and file splits shift the count), so captures land on the right line instead of a nearby one
- The output channel states which discovery path supplied the VM Service address (debug-adapter event or console banner), making "why no screenshots" a one-line diagnosis
- Screenshots now actually capture on modern Flutter: current SDKs removed the `_flutter.screenshot` VM API the feature first relied on, so on Android the extension falls back to `adb exec-out screencap` (real device pixels, any Flutter version) after one VM probe — verified live against a connected device
- Unified timeline shows screenshot events (camera marker with trigger + line); clicking opens the image
- New Integrations row "Debug Screenshots" (on by default) bound to `integrations.screenshots.enabled`, plus per-trigger settings (`onError`, `onWarning`, `onNavigation`, `cooldownMs`, `maxPerLog`)

### Changed

- l10n audit now prints per-locale untranslated string detail (key, reason, English value) below the gap count, so the operator sees exactly which strings need work without opening the JSON report; interactive mode always shows this (capped at 10 per locale), non-interactive suppresses it unless `--verbose` is passed (which removes the cap)
- Signal report stat cards now show severity-colored top borders (red for errors, amber for warnings, blue for info signals)
- Signal report health score replaced with a visual arc gauge — color graduates by tier (green ≥80, amber 50–79, red <50)
- Signal report header upgraded to a hero block with type badge, larger title, and confidence badge on one line
- Signal report evidence blocks highlight the target line with a red left-border accent; surrounding lines fade to draw the eye
- Signal report overview rows now have subtle separators, bolder labels, and consistent vertical rhythm
- Signal panel entries (both "This log" and "Across your logs") now show colored type badges (ERR, WARN, PERF, SQL, NET, MEM, etc.) for at-a-glance category scanning
- Health gauge handles non-finite scores gracefully (renders 0 instead of NaN)
- Migrated hardcoded `border-radius` values to design token variables (`--radius-sm`, `--radius`, `--radius-pill`) across 45+ style files for consistent corner rounding
- Migrated hardcoded `font-size` values to design token type scale (`--text-caption`, `--text-body`, `--text-h2`) across 48+ style files for consistent typography
- Session comparison, collection, bug report, and keyboard shortcuts panels now load the design token layer — they can consume spacing, radius, type, and color tokens like the signal report already does
- Migrated hardcoded `padding`, `margin`, and `gap` values to spacing tokens (`--space-1` through `--space-7`) across 59 style files — single-value, two-value, and three-value declarations that map to the 4 px scale
- Replaced ~750 raw `--vscode-*` CSS variable references with semantic design tokens across 68 style files: surfaces (`--surface-1/2/3`, `--inset`), text (`--text`, `--muted`, `--link`), borders (`--border`), and status accents (`--accent-critical/warning/info`); collapsed redundant fallback chains where the raw variable already resolves through its token

### Fixed

- Fixed 6 test failures caused by the design token migration: updated CSS assertions to match semantic tokens instead of raw `--vscode-*` variables (including the ghost-pixel opaque background guard), fixed signal kind badge exhaustiveness check for hyphenated keys (`slow-op`), and registered dynamically created screenshot element IDs in the wiring test

---

## [9.3.2]

Android platform spam that used to flood log files (200k+ junk lines per session) is now suppressed at capture time, and you can add your own spam patterns in settings. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.2/CHANGELOG.md)

### Added

- New `saropaLogCapture.spamPatterns` setting — define custom spam patterns as comma-separated substring lists; lines matching all substrings in any pattern are suppressed at capture time alongside the built-in patterns

### Fixed

- Suppress BLASTBufferQueue `acquireNextBufferLocked` spam at capture time — consecutive lines matching known high-frequency Android platform patterns are replaced by a single summary line with count and time range, instead of writing hundreds of thousands of junk lines to log files

---

## [9.3.1]

Severity count pills now read the same everywhere: each pill shows its level letter and count together (E, W, I, …), and the sidebar Logs list gains those letters too, so a glance tells you the level without decoding colors. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.1/CHANGELOG.md)

### Changed

- Log-viewer toolbar level pills now carry the prefix letter INSIDE the count pill instead of as a separate level-colored chip beside it; the letter inherits the pill's contrasting foreground so letter and number are the same color.
- Removed the small leading color dot beside each toolbar level pill — the pill itself carries the level color and letter, so the dot was pure duplication (matching the sidebar Logs pills). The whole pill remains the click target and dims when its level is filtered out.
- The severity pill palette is now defined once as shared `--sev-*` design tokens and consumed by the toolbar pills, the sidebar Logs pills, and the minimap severity ticks — so the three can no longer drift apart. As part of this, the sidebar Logs pills for **warning, debug, todo, and performance** now match the toolbar's colors exactly (they had quietly diverged), so a log reads the same color in the list and when open.
- Toolbar level pills no longer briefly flash as letter-only chips before the first counts arrive.
- Sidebar Logs session-history count pills now include the category prefix letter (E/W/I/P/T/N/D/DB/FW/O) and use a slightly smaller font so the letter plus count fit without widening the row.

---

## [9.3.0]

Tag column polish: the `lowmemorykiller` device tag now reads as "Low Memory Killer", and the tag-cell tooltip separates multiple tags with commas so a line's extra tags don't run together as one phrase. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.0/CHANGELOG.md)

### Fixed

- **Project Signals panel showed nothing for logs without performance sampling.** The "This log" section was hidden unless a session carried performance-integration data, and its signal list was built only from fingerprints written at session-finalize — so a plainly-open report full of errors displayed an empty panel. The section now shows whenever a log is open, and when no fingerprint metadata exists it falls back to the errors and warnings the viewer already classifies on screen, grouping identical lines with an occurrence count and a click-to-jump to the source line.

- **Panel tab number badge would not clear.** The unread-hit count on the "Saropa Log Capture" panel tab only cleared on a hide/show transition or when a focusable element inside the viewer took focus, and the count that accrued before the view first resolved was never acknowledged when the panel restored already-visible (e.g. reopening a window with the panel showing a log file) — so it could stay pinned on-screen with no way to dismiss it. It now clears when the panel resolves already-visible and the instant you engage the viewer — pointer, keyboard, or scroll — so it surfaces new activity while the panel is away and disappears the moment you look. The badge also now counts only watch patterns whose `alert` is `"badge"`, so a pattern set to `"flash"`/`"none"` no longer contributes.

- **The "adb Logcat" checkbox in Options → Integrations was misleading for Flutter apps.** It rendered unchecked, but the logcat feed auto-ran for any Dart/Flutter session regardless — so the box read "off" while the feed was live, and unchecking it did nothing. The checkbox now reflects the real on/off state (on by default via the new `saropaLogCapture.integrations.adbLogcat.enabled` setting) and an explicit uncheck truly disables capture. Zero-config Flutter behavior is unchanged (still on by default); you can now turn it off.

### Added

- **Preflight open-PR check.** `npm run preflight` now queries GitHub for open dependabot PRs with passing CI and warns before you publish with unmerged dependency bumps waiting. Requires `gh` CLI; skips silently when offline or unauthenticated.
- **Suite daily-summary API.** `activate()` now exports `apiVersion: 1` and `getDailySummary('YYYY-MM-DD')`, which returns a compact one-day rollup — session/error/warning/signal counts, a plain-language headline, and failure-only "trouble" items that deep-link back into the Log Viewer's Signal panel — or `undefined` for a day with no logs. Built lazily from the on-disk reports store on each call (never at activation), so a sibling Saropa suite tool can fold Log Capture into a consolidated daily report without scraping raw log files. The exported shape is the data-out half of the cross-tool deep-link protocol documented in `commands-suite.ts`.
- **ANR and native-crash evidence is now always captured from logcat, on by default.** New `saropaLogCapture.integrations.adbLogcat.captureAnr` setting (default on): device-critical logcat lines — `ActivityManager` "ANR in <package>", `AndroidRuntime` fatal exceptions, `lowmemorykiller` — bypass the minimum-level and PID filters. Android dumps the ANR header and frozen main-thread stack from the system process (a different PID than your app), so PID scoping (which is on by default) previously dropped exactly the richest ANR detail. Turn the setting off to keep strict PID/level filtering.
- **"Capture sources" status in the Filters panel.** The Log Sources tab now shows which log-streaming integrations are feeding the log — adb Logcat, Terminal, Browser / DevTools, App / File Logs, and Database. With no debug session running each shows a configured **On/Off** dot; once a session starts the status becomes runtime-accurate — a source actively producing reads **Streaming** (adb Logcat names the attached device), one enabled but with nothing to stream reads **Idle** (e.g. adb on with no device attached), and a source that does not apply to the session reads **Off**. It is read-only status, not a second set of toggles; clicking a row opens Options → Integrations where capture is turned on or off. The list refreshes on session start/stop and when an integration setting changes.

### Changed

- **Signals panel renamed to "Project Signals."** The sidebar/panel title and its accessibility region label now read "Project Signals" to make clear the panel spans the whole project, not just the open log.
- **Root-cause hint rows are numbered and no longer sprawl.** Each hint in the in-viewer root-cause strip now carries a leading number and truncates to a single line with an ellipsis so long hints keep the strip compact. Click the hint text to expand it and wrap the full text; opening the detailed Signal Report moved to a small report icon that appears on row hover.
- Logs panel counts now use comma grouping. The per-log severity pills, the day-heading file count, and the pinned-section count format large values as e.g. "12,480" instead of "12480", so a big log's counts stay readable.
- Enabled toolbar toggle icons (trouble mode, signals, decorations, format, expanded panels) now render in VS Code link-blue instead of the same dim grey as inactive icons, so you can tell at a glance which toggles are on. Disabled icons stay dim.
- **Integrations screen is one clean list.** The Saropa companion extensions (Saropa Lints, Saropa Drift Advisor) used to sit in a prose block with "View in Marketplace" links above the real adapter toggles, pushing the actual integration points off-screen. They now appear as rows in the same alphabetical list — each with its Marketplace link inline — and the "Install all with the Saropa Suite" link moved to a quiet footer below the list.
- **Integration descriptions collapse to one line.** Each adapter/companion description now shows a single line when collapsed with the "more" toggle at the end of that line (was four lines), so more integrations fit on screen at once. "more" expands to the full text and notes; "less" collapses it again.
- **Companion rows show a live, one-click install checkbox.** Each Saropa companion row now carries an inline checkbox (like the adapter rows). When the extension is missing the checkbox is enabled — checking it installs the companion directly from the Integrations list (with a Marketplace link still available for details). Once installed it shows checked and disabled (removal stays in the Extensions view). Install or remove a companion while the viewer is open and the row updates immediately — no reload — because the host watches extension changes and pushes state to the viewer. The requested id is re-validated against the companion allowlist host-side, and the checkbox never affects the saved adapter set.
- Large numbers in the toolbar now use comma separators — line counts, hidden-line counts, and selection counters all format with grouping (e.g. "12,345 lines") instead of raw digits.
- Removed the leading middle-dot separator before the truncated-file line count; the pill background already provides visual separation from the filename.
- Toolbar toggle icons now transition smoothly between grey (off) and blue (on) instead of snapping instantly, matching the 0.15s ease timing used by the filename hover.
- Viewer toolbar counters are now high-contrast pills. Each level count (E/W/I/P/T/N/D/DB) renders as a filled chip in that level's own color with a legibility-tuned foreground, and the line-count ("N lines") uses the theme badge colors — replacing the faint gray text that was hard to read against the toolbar.
- Log-list (session history) severity counts now use the same high-contrast pill style: each per-log count (errors, warnings, info, etc.) is a filled chip in its category color instead of faint gray text, so a log's severity mix reads consistently in the list and when opened. The small leading color dot was dropped — the colored pill already carries the category color.
- Logs panel day-heading file count is now a high-contrast pill instead of faint parenthesized text. The per-day count (and the Pinned section count) renders as a filled badge using the theme's badge colors, so it stays legible in every theme; the surrounding parentheses are dropped.
- Logs panel counts now use thousands separators. Every count surface — severity pills, day/pinned headings, the `+N` group and `+N older` badges, and the "Showing X–Y of Z" pagination line — comma-groups large numbers (e.g. `1,381` instead of `1381`) so five-figure line counts stay readable. A malformed count (NaN/Infinity/fractional/missing) now degrades to `0` rather than rendering "NaN"/"∞" in a pill, and the day-count pill no longer wraps mid-number in a narrow sidebar.
- Tag chips: added display-label overrides so all-lowercase Android system tags render as words — `lowmemorykiller` → "Low Memory Killer", `dalvikvm` → "Dalvik VM", `surfaceflinger` → "Surface Flinger", `bufferqueue`, `audioflinger`, `audiotrack`, `mediacodec`, `mediaplayer`, `cameraservice`, `inputmethodmanager`, plus casing fixes for `wpa_supplicant` → "WPA Supplicant" and `libc`.
- Tag-cell hover tooltip now joins tag names with ", " instead of a space, keeping multi-word tags legible (e.g. "Perf, Frame Stall, Flutter").
- **Flutter DevTools inspector "ghost errors" no longer show as errors.** Lines from the Layout Explorer's async widget-tree probe (`ext.flutter.inspector.getLayoutExplorerNode` / a `getLayoutExplorerNode` stack frame) throw a "Null check operator used on a null value" that is developer-tooling noise, not an app fault. Such lines now classify as `debug` — kept off the Errors filter and the timeline — even when they arrive on stderr. This catches the signature-bearing frame only; whole-stack suppression of the bare header line is tracked in `plans/history/2026.07/2026.07.16/BUG_Better_Support_ANR.md`.
- Internal: the ANR keyword regex used by per-line classification and the pre-production ANR risk scorer is now a single shared definition, so the two cannot drift.

---

## [9.2.3]

The Trouble Mode chart now starts exactly where the app started — the same green line the feed shows — instead of a few minutes early on the device's pre-launch noise. [log](https://github.com/saropa/saropa-log-capture/blob/v9.2.3/CHANGELOG.md)

### Fixed

- **Trouble Mode chart started too early on some captures.** The severity chart derived its own app-start point from a resumable webview scan that could drift, leaving the chart drawing the device's pre-launch logcat backlog while the feed's green "App started" divider was correctly placed. The chart now anchors to the same host-detected launch line the divider uses (`setTroubleChartHostLaunchTs` from `handleRunBoundaries`), so the chart's left edge and the feed divider always agree; the webview scan remains only as the live-capture fallback before the host boundary message arrives.

## [9.2.2]

A new green "App started" divider cleanly separates pre-app noise in your log feed, while the Trouble Mode chart aligns to match it, gains fully clickable bars, and cleans up its axes. [log](https://github.com/saropa/saropa-log-capture/blob/v9.2.2/CHANGELOG.md)

### Added

- **A green "App started" divider now marks where the app launched in the log itself.** At the launch line — after the device's startup backlog — a bold green divider separates the pre-app noise from the app's own output, the feed counterpart to the Trouble Mode chart's green app-start marker. It appears once per launch and never for attached or logcat-only captures with no launch line. [log](https://github.com/saropa/saropa-log-capture/blob/v9.2.2/CHANGELOG.md)

### Changed

- **The Trouble Mode severity chart now marks where the app started and resets to it, instead of starting before the app.** The chart shows everything (the device's pre-app logcat backlog included, so nothing is hidden); the moment the launch/build point is detected, the chart resets its start to the app era and draws a bold green app-start divider at the left edge — so the pre-app burst falling away is explained by the divider, not an unexplained change, and the bars scale to the app's own trouble. Attach sessions and captures that never launch an app chart their whole span with no divider.
- **Trouble Mode chart bars are now clickable across their whole column.** The colored bar is thin, so clicks used to land in the empty space beside it and do nothing; a full-cell hit target now jumps the feed to that window from anywhere in the column.
- **The Trouble Mode chart axes are clearer.** The peak count is shown as the top mark of the vertical axis (in addition to the head), the time axis carries several evenly spaced ticks instead of just the two ends, and axis times drop the seconds (HH:MM) since the strip spans minutes. A single error also renders a touch taller so it stays visible under a tall performance stack.

---

## [9.2.1]

Trouble Mode gets a local Signals band and a resizable panel, a new filter lets you hide noisy pre-app startup lines, and the severity chart finally updates correctly when you toggle levels. [log](https://github.com/saropa/saropa-log-capture/blob/v9.2.1/CHANGELOG.md)

### Added

- **Trouble Mode now shows a Signals band for the log you're viewing.** In place of the removed Crash Issues band, a compact band lists the current log's top recurring signals (errors, warnings, performance patterns) with their occurrence counts — the same "Signals in this log" the Signal panel computes, sourced from this capture rather than the cloud. Click a signal to jump the feed to its first occurrence; the band collapses like the severity chart, and "All N" opens the full Signal panel.
- **New "Exclude warm-up logs" filter hides the device's pre-app noise from the feed.** A checkbox in the **File Scope** filter tab (under "Exclude lines with no source file", off by default) hides everything captured before the app started — the device's logcat backlog and the build tool's output, up to the same app-ready point the severity chart begins at. The data isn't lost: untick it to see the warm-up lines again.
- **The Trouble Mode error-report rail can now be dragged wider.** A new resize handle sits between the scrollbar minimap and the rail (right edge of the minimap); dragging it resizes the report panel instead of the minimap, between the rail's existing 320–560px bounds. The chosen width persists per workspace.

### Removed

- **The Crash Issues band is gone from Trouble Mode.** Those rows came from Firebase Crashlytics (your app's top crashes across all users, cloud-cached) and had nothing to do with the log on screen, which was confusing beside a specific capture. Crashlytics is still fully available from its own toolbar button; Trouble Mode now focuses on the log you're viewing. A Signals band sourced from the current log takes its place (see Added).

### Changed

- **The severity chart's collapse control is easier to hit.** Its caret is larger so it reads as a control, and you can click the chart's **title text** — not just the small arrow — to fold or unfold it.

### Fixed

- **Turning off a severity toggle (error/warning/performance) now updates the Trouble Mode chart, not just the feed.** The chart's bars and legend totals previously counted every charted line regardless of which levels were enabled, so a dimmed chip could sit beside a bar still counting the level the user just hid. The chart now reads the same `enabledLevels` set the toolbar dots and legend chips gate, and toggling a level (from either control) now rebuilds the chart.
- **The severity chart no longer shows the device's startup burst at all.** The pre-app logcat backlog (and build-tool output) used to draw as a muted full-height bar that still dominated the strip; the chart now **drops** those windows entirely and starts at the first real app-era event — no dominating spike, and no long empty gap between the burst and app start. The app-ready boundary anchors on the **build-complete** line (`√ Built …apk`, `Xcode build done`) — a later, stronger cut than "Launching…" that also drops device noise during the build — and falls back to the launch line when there is no build. The launch scan self-heals if a log is swapped in without a clear, so the boundary can't get stuck on the previous log. (Excluding those lines from the log feed itself is a separate opt-in filter.)
- **A truncated Flutter exception dump no longer paints the rest of the session red.** When a `RenderFlex overflowed` / `Exception caught by …` banner's closing rule never arrived (e.g. cut off by the debug adapter's `maxLogLineLength` truncating a long widget-tree dump mid-sentence), the banner group stayed "open" forever, forcing every later line — permission logs, perf stalls, Crashlytics telemetry — to Error severity. The banner now auto-closes after a generous line cap instead of leaking (bug_012).
- **Log Sessions panel: severity-count dots on a narrow row no longer lose their number.** A row's meta line (time · duration · size · tags) truncates with an ellipsis when the panel is too narrow to fit everything, but the colored severity dots (errors, warnings, info, debug, etc.) used to be concatenated into that same truncating text. When the cut landed inside a dot's chip, the tiny dot survived the clip while its count number — and every dot after it — silently vanished, leaving orphaned dots with no visible number (their tooltip, e.g. "Errors", still worked, which is how this was found). Dots now render as their own element beside the meta text instead of inside it, and wrap onto a second line instead of ever being cut mid-chip.

---

## [9.2.0]

Trouble Mode's reports now open **beside** the log instead of covering it, the loading view shows the issue instead of the word "Loading", and the severity chart finally has a legend and a time axis. [log](https://github.com/saropa/saropa-log-capture/blob/v9.2.0/CHANGELOG.md)

### Added

- **Copy Tags.** A new right-click item copies a line's tags (bracket tags, structured tag, logcat tag, source tag) as one comma-separated list. It sits next to Copy Timestamp in the Copy & Export submenu and hides itself on lines that carry no tags.
- **A search box in the Message Tags panel filters the tag list live**, and the panel now always shows every tag — the old "Show all (N)" expander collapsed the list to the top 20 by count with no indication a tag you knew existed was hidden below the fold.
- **Copy every tag as JSON** from a new button beside the Message Tags panel's tag count. The export groups by the cleaned display tag and lists every distinct raw tag string that collapsed into it (e.g. `"Chat Service": ["com.google.android.libraries.foo.ChatService", "org.other.pkg.ChatService"]`), useful for auditing what a short tag name actually stands for across packages.

### Changed

- **Large logs recompute less while scrolling.** The viewer now remembers whether each row is blank instead of re-deriving it on every height pass and again for every painted row, recomputing only when you toggle structured parsing or file formatting. On logs with tens of thousands of lines this trims repeated work on the scroll path.
- **The viewer reopens the log you were reading.** Reloading the window, or pressing F5, always jumped to the newest log in the reports folder and threw away whatever you had open — then offered a "Resume" button only if that log happened to live in the reports folder. The viewer now reopens the log you last opened yourself, wherever it lives, including a file you loaded through **Open Log File** from anywhere on disk. If it has been deleted or sent to the trash, the newest log opens instead. The **Resume** button is gone, because there is nothing left to resume; when a newer log exists, the log status bar says so and offers to open it.
- **"Always switch to latest" now waits for a log to actually arrive.** The setting says it switches to the newest log "the moment it arrives", but it switched to any log newer than the one you were reading — so a log already sitting on disk could pull the viewer off a log you had deliberately opened, as soon as anything in the reports folder changed. It now only follows logs written after the window opened.
- **All bracket tags now render as visual chips.** Lines with `[frame-stall]`, `[db]`, `[perf]`, `[retry]`, and other bracket tags from the tag vocabulary render those tags as colored semantic chips before the message, instead of displaying them as plain text. The tags are stripped from the message body so they appear exactly once, with level-based coloring that matches the tag's severity (error tags red, performance tags purple, database tags blue, etc.).
- **One set of tags per line — the chips and the Message Tags panel finally match.** A log line was split across three separate tag parsers: bracket tags (`[perf]`, `[frame-stall]`) became inline chips, the device tag had its own column, and only the *first* tag reached the Message Tags panel. So a chip you saw in the log often had no entry to toggle, and toggling a tag appeared to do nothing. Every tag on a line is now one unified set that drives both the chips **and** the panel; a line hides only when all of its tags are hidden, so toggling any one back on reveals it.
- **Tag chips render in the tag column and open the filter panel.** The chips sit in the tag column (not inline in the message), each is a readable, clickable pill, and clicking one opens the Message Tags panel scrolled to that tag — replacing the confusing per-chip inline filter. The column is wider so names are not cut to "Activi…", and hovering it lists every tag in full. Chip colors switched to theme-aware colors, legible on dark **and** light backgrounds (the old performance-purple and debug-brown read as dark-on-dark).
- **The Message Tags panel is alphabetized** (still keeping the highest-count tags when the list is collapsed).
- **Removed the flow-tags toolbar button.** It cycled `[flowmap]` navigation lines between chips / raw / hidden but was redundant; those lines still render as chips by default.
- **The log status bar stays up.** The blue bar under the toolbar was a pop-up: it appeared when you clicked the filename and vanished the moment you clicked anything in it — including its own **Open in Editor** and **Copy Full Path** buttons. It is now a permanent bar for as long as a log is open, and only its **×** closes it. Clicking the filename or the "N newer" chip brings it back.
- **The session context line moved into the status bar.** The adapter, project, launch configuration, and device — "dart · contacts · contacts (debug mode) (motorola edge 2022)" — used to be squeezed into the toolbar's right edge between the icons and the file path. It now sits in the status bar beside the log's name and lifespan, where the rest of the open log's identity already lives.
- **The status bar's buttons look like buttons.** **Copy Full Path** was transparent text on the blue bar next to a filled **Open in Editor**, so it read as disabled when it was always live. Both are now proper buttons carrying icons, while the **⋮** and **×** stay as plain chrome.
- **Trouble Mode reports open in a side rail, not over the log.** Selecting a log line, or a row in the crash-issues band, used to replace the entire feed with the report — so you could read the report or the log, never both, which is the whole job of triage. Both now open in a column to the right of the feed, sized to the viewport. In a narrow sidebar, where two readable columns will not fit, the report still opens over the feed as before. The report itself reads as a report: a severity-colored header, a title that wraps instead of truncating, and a **Reveal in log** button that scrolls the feed back to the line it describes.
- **The crash-issue loading view shows the issue.** Clicking a crash issue used to show a single "Loading issue…" line filling the pane, even though the row already knew the title, subtitle, event and user counts, state, and version range. The header now paints instantly from what is already on screen, and only the stack trace — the part that needs the network — shimmers while it loads.
- **The severity chart is readable.** It gains a legend with per-level totals, start and end time labels, and a peak-count label. Single events render as a visible bar instead of a one-pixel dash, and the time window holding the line you are reading in the side rail is highlighted.
- **The severity chart collapses.** A chevron beside its title folds the chart away and gives the strip's height back to the log. The legend totals and the peak count stay on screen while it is collapsed, so you keep the counts without keeping the bars.
- **The severity chart matches the toolbar.** Its bars, legend dots, and label text now use the toolbar's red, orange, and purple, at the toolbar's text size. Performance previously drew blue in the chart while the toolbar labeled those same lines with a purple **P**.
- **The severity chart's collapse chevron is visible.** Drawn at the head row's 10px label size it read as a stray pixel rather than a control. It is now large enough to see and click.
- **The severity chart has a frame.** A dim rule down each side and along the baseline bounds the bars, so a quiet window reads as a short bar over a baseline rather than as blank space.
- **The severity chart's legend is a level filter.** The **ERROR**, **WARN**, and **PERF** chips (each with its running count) now work like the toolbar's level dots: single-click a chip to hide or show that level, double-click to focus only it. The chip and its toolbar dot stay in sync both ways, and a hidden level dims in both. The labels are abbreviated to keep the chips compact in the chart's head row.
- **The crash-issues band is compact and dates itself.** It shows the top five issues with an **All N issues** link into the full Crashlytics panel, rather than a scrolling list that squeezed the feed. Because the band reads a cache and never fetches, its header now states when that cache was last updated.

### Fixed

- **The tag column shows one chip per row, plus a "+N" badge, instead of two or three full chips.** A line carrying multiple bracket/device tags (`Database Perf Log`, `Perf Frame Stall`) rendered a chip for every one of them, cluttering the fixed-width column and, on busier lines, visibly squeezing the message text down to a sliver. Only the line's primary (highest-priority) tag renders as a chip now, with a neutral `+N` badge when more exist; every tag is still listed on the cell's hover tooltip and still fully filterable from the Message Tags panel.
- **App-emitted bracket tags (`[db]`, `[perf]`, `[important:...]`) are recognized again in a re-opened saved log.** Every line written to a `.log` file carries a `[HH:MM:SS.mmm] [source]` wrapper; the tag scanner used to give up on the wrapper's timestamp bracket before ever reaching the app's own tag, so a line like `[10:48:41.586] [logcat] 07-10 ... I flutter : [IMPORTANT:flutter/shell/platform/android/android_context_vk_impeller.cc(62)] Using the Impeller rendering backend (Vulkan).` showed the raw bracket text as plain message content instead of a chip. The scanner now recognizes and skips the wrapper first.
- **A bracket tag's `:metadata` suffix (`[perf:cold start]`) no longer leaks into the chip's own label.** Its display name is now just the tag (`Perf`); the metadata continues to show inline in the message text where it always has.
- **Tag-column chips no longer clip their own bottom border, and rows read as a consistent height again.** The chip's box (10px text at the inherited 1.1 line-height ratio, plus padding and border) was taller than the row's fixed height, so the row's overflow clipping sheared off the chip's bottom border — visible as a missing border on tagged rows and, since untagged rows clipped nothing, as inconsistent row-to-row height. The chip now sets its own `line-height: 1` and tighter vertical padding, the same fix already used for the level letter/dot badges, so it fits entirely inside the row.
- **A fully-qualified Android tag with a bracketed sequence counter (`Tag[epoch:seq][tid]`) no longer fractures the tag/message split.** Some GmsCore/Clearcut components emit lines like `07-10 10:45:49.281 25822 25918 I Foo.Bar.TelecomRegistra[000:619][25918] Telecom registration synclet` with no colon-space before the message — the parser used to split at the first colon it found, which landed inside the bracket counter, truncating the tag and eating the start of the message. The bracket counter is now recognized as part of the tag and stripped for display (`TelecomRegistra`), and the message parses intact.
- **The Message Tags panel's tag count no longer looks clickable when it does nothing.** "N tags (M hidden)" inherited a pointer cursor meant for rows that wrap a checkbox — clicking it had no effect. It now reads as the plain status text it is.
- **Tags always render as "Title Case With Spaces."** The Message Tags panel showed a tag in all-lowercase (`activitymanager`) while the same tag's chip in the log's tag column showed it run together in raw case (`ActivityManager`) — two different renderings of the same tag, neither readable. Both surfaces now format every tag name the same way: `Activity Manager`, `Flutter JNI`, `Frame Stall`.
- **Fully-qualified Android/Java tags no longer flood the Message Tags panel with near-duplicate chips.** A log line tagged with a fully-qualified class name (e.g. `com.google.android.libraries.communications.conference.service.impl.ChatService`) produced its own chip per class, and every class in the same package shared a 60+ character common prefix — dozens of unreadable, near-identical entries. Tags with two or more dots now collapse to their last segment (`ChatService`), merging same-class hits from different packages into one chip.
- **The severity gutter joins same-color dots — and only same-color dots — into one bar, centered under the dots.** The colored dots down the left edge connect into a continuous band across a run of same-severity lines. The connector draws toward a neighboring dot only when that dot is the same color, so a run of one severity reads as one bar while a change of color shows a clean break instead of a line running through it; `info` and `framework` lines (both blue) count as one color and join, as they look identical. The connecting line and the dots also share a single center point, so the line sits exactly under the dots instead of drifting a sub-pixel to one side.
- **File-path links in the log are visible again.** Clickable `file.ext:line:col` links were drawn in the editor's gutter-gray, which recedes into the dark viewer background to the point of being unreadable. They now use the theme's link color with a dotted underline, so a path looks like the link it is.
- **Long lines no longer bleed dim text over the row below.** A line too wide for the pane wrapped to a second visual line, but the row is a fixed single line tall, so the overflow painted down over the next row as unreadable ghost text. Wrapped lines now clip to their row; use no-wrap mode to scroll the full line horizontally.
- **AI activity lines show a labeled tag and drop the confusing second bar.** `[AI Edit]`, `[AI Bash]`, `[AI Ask]`, and `[AI Warn]` rendered as plain text whose only category cue was a solid color rail down the left edge — which sat beside the severity dots and read as a second, contradictory severity bar. The action now renders as a colored chip (matching how every other tagged line shows its tag), the left rail is gone, and AI rows instead take a single magenta dot in the shared severity gutter, so a run of AI activity reads as one joined band without competing with the severity colors.
- **Log lines with an empty message no longer take a full row.** Android emits warnings that carry a tag and nothing else — `W keystore2:` with no message after the colon. Because the viewer lifts the parsed timestamp, process, and level out of the text and into their own columns, these lines rendered as a full-height row holding only a tag chip, and could even sprout an expander arrow for the hidden lines beneath them. They now collapse to the same slim sliver every other empty line gets, with no tag and no arrow.
- **Crash issues opened from Trouble Mode get the full detail.** Opening an issue from the crash-issues band silently dropped the "In your project", "Seen in your logs", and device-state panels — they only appeared for issues opened from the Crashlytics sidebar. Both paths now run through the same code, so both get everything.
- **A failed crash-issue load offers to retry.** "Could not load this issue." was a dead end; it now comes with a **Try again** button, and both it and "No stack trace available for this issue." were hardcoded English that never reached translation.
- **Switching crash issues quickly no longer shows the wrong stack.** A slow fetch for one issue could land after you had already opened another, overwriting the second issue's detail with the first issue's stack while every surrounding panel still described the second. Late replies for an issue you have navigated away from are now discarded.
- **Closing the Crashlytics sidebar no longer closes an unrelated report.** A crash issue opened from Trouble Mode's crash-issues band lives in the side rail, which does not belong to the sidebar panel; closing the panel now leaves it alone.
- **The device's startup noise no longer flattens the severity chart.** A phone drains its logcat backlog while an app starts, so the opening seconds of a log carry dozens of framework warnings that belong to the device, not to your app. That single burst set the chart's scale and squashed every real spike after it into a sliver. Time windows that end before the app's launch line are now excluded from the peak. They still draw — nothing is hidden — but muted, and their tooltip reads **Before app launch**.
- **The chart's peak label is no longer drawn over.** The tallest bar is almost always the burst of device warnings a phone emits while an app starts, it always lands in the leading time window, and it painted straight through the "Peak N" label pinned to the plot's top-left corner. The label now sits in the chart's header beside the title.
- **Copy to Search now opens the search bar.** Right-clicking a line and choosing **Copy to Search** filled in the search field but left the search bar hidden if it was not already open, so the pasted text was invisible until you separately opened search. The action now opens the bar itself.

---

## [9.1.2]

Trouble Mode grew up — a live severity chart, a band of your top Crashlytics issues, and a detail pane for any row you click — plus a one-click Markdown report for any issue and richer `[flowmap]` tagging for actions, exits, and errors. [log](https://github.com/saropa/saropa-log-capture/blob/v9.1.2/CHANGELOG.md)

### Added

- **`[flowmap]` navigation lines show as compact chips in the log viewer.** An instrumented app emits one `[flowmap] …` line per surface entered, action taken, and failure; raw, they are long and repetitive and drown the feed. A new "Flow tags" toolbar button (tag icon) cycles three modes: **chips** (default) renders each tag line as a small verb-colored pill — `→ Contact View`, `↩ Home`, `✕ Picker`, `＋ Favorite`, `↗ Google Maps`, `💥 Payment declined` — with the meaning, surface kind, and source anchor on hover; **raw** shows the original text; **hidden** filters the tag lines out. The mode persists per-view across reloads. Colors follow the flow palette (enter blue, back purple, exit gray, action green, handoff amber, error red).
- **Copy a focused Markdown report for any issue.** The Trouble Mode detail pane has a "Copy report" button, and every log line has a "Copy issue report" right-click item. Both copy a compact Markdown report — the severity, the environment (app version, debug adapter, debug target, when known), and the exact fault line with its stack — and nothing else, so the report is the problem with no surrounding noise. Fault text that itself contains a code fence can't break the block. A message confirms the copy.
- **Trouble Mode shows a band of your top Crashlytics crash issues above the feed.** When Trouble Mode is active, the most active cached crash issues (from the background Crashlytics watcher's on-disk cache) appear as a compact band between the severity chart and the feed — no new network call, and nothing shows if the cache is empty. Each row shows the issue, its severity, and event/user counts; clicking one opens the existing in-viewer Crashlytics detail. The band is hidden whenever Trouble Mode is off.
- **Trouble Mode: select a feed row to open a detail pane for that issue.** Clicking a row while Trouble Mode is active slides in an in-viewer detail pane (over the feed, leaving the chart and toolbar visible) showing the fault line, its severity, the session's ANR risk when elevated, and the surrounding context with the line's position in the session and the preceding action — reusing the signal report's own evidence and context builders. Close it with the × or Escape; leaving Trouble Mode dismisses it.
- **Trouble Mode now shows a live severity chart above the feed.** While Trouble Mode is active, a compact bar chart sits above the log, bucketing errors, warnings, and performance issues into tumbling time windows so you can see bursts and rates at a glance. Each bar stacks the three severities using the theme's error/warning/info colors; clicking a bar scrolls the feed to that window's first row. The window width is configurable with `saropaLogCapture.troubleMode.chartInterval` (1–60 seconds, default 5). The chart reads the same per-line severity the feed filters on, so it can never disagree with what the feed shows, and it aggregates entirely in the viewer (no extra capture buffer) with a bounded recent-activity window.
- **`[flowmap] action` tag — explicit in-screen action breadcrumbs for the Session Flow Map.** Apps can now emit `[flowmap] action "<Category>" [file.dart:line]` (parallel to `enter` and `handoff`) to count user actions — Favorite, Share, Delete — on the screen where they happened. Action counts previously came only from app-specific heuristic text patterns, so most projects' Flow Maps showed no action data. Counts appear as per-screen action badges in the Flow Map report; the tag never creates nodes or edges. Format spec: `plans/guides/flowmap-tag-navigation.md`.
- **`[flowmap] exit` tag — surface-dismissed marker that fixes inflated dialog dwell.** A dialog or sheet used to keep accruing time until the next screen change, so dismissing it and staying on the screen behind charged that idle time to the dialog. Emit `[flowmap] exit <kind> "<Name>"` at the dismissal point and the surface's dwell stops there; the revealed caller resumes accruing. An exit that doesn't name the currently open surface is ignored.
- **`[flowmap] error` tag — a failure badge on the surface where it happened.** Emit `[flowmap] error "<Category>" [file.dart:line]` from the app's exception handler to record a failure in the Issue Report table and badge the exact active surface (dialogs included) with a marker — so the Flow Map shows *where* the app broke. Each occurrence is recorded (explicit errors are not deduped).
- **`[flowmap] back` verb — correct return-arrow direction.** Emit `[flowmap] back <kind> "<Name>" [file.dart:line]` (the form Saropa Contacts logs from its back handler) when the app knows a step is a return. It forces a return edge even when the open-surface stack can't detect the return (the target was already closed), so a re-entry no longer draws as forward navigation. Previously only the alternate `[flowmap] enter screen "Home" back` keyword was recognized, so the standalone verb the app actually emits was silently dropped and back-navigation never appeared. The `enter … back` keyword still works as an alternate spelling.

### Removed

- **The Integrations screen no longer lists companion-tool issues.** The "Issues found by your companion tools" block (Drift Advisor / Saropa Lints diagnostics read from the workspace mirrors) rendered an unbounded raw diagnostics feed inside an options surface. The Options panel is for configuration only; companion findings stay in the tools' own UIs and the signal report's ecosystem section. The Integrations icon badge now counts only pending integration suggestions.

### Changed

- **Trouble Mode now lives in the log viewer toolbar, next to the filter icon.** The toggle moved off the editor view title bar into the viewer's own toolbar (a warning-triangle button) where the other filters live. The button highlights while active, and the level dots dim for the levels Trouble Mode is hiding (info, notice, debug, database, todo) so you can see exactly what is suppressed. The separate footer chip is gone — the button and dots carry the state.
- **Collapse all / expand all moved into the log viewer toolbar.** The section-fold controls that were on the editor view title bar are now a single toolbar button that swaps its icon to show state (collapse-all when sections are open, expand-all when collapsed). The commands remain available from the command palette.
- **Disabling capture now stops in-flight capture immediately.** Turning the master capture switch off (status bar toggle, Options panel, `saropaLogCapture.toggleCapture`, or the setting) finalizes any active session — flushing and closing the log file — and stops session-scoped work: external log tailers, the adb logcat process, terminal capture, and database live tail. Per-event DAP processing is skipped before buffering, and the background Crashlytics poller stops. Previously these kept running until the debug session happened to end. The captured log stays on disk; turning capture back on starts fresh on the next debug session. When disabling stopped live sessions, the toast names how many.

### Fixed

- **Turning off a level now hides its lines instead of dimming them.** The level filter's ±context window (default 3 lines) was re-revealing a disabled level's lines as dimmed *context* around still-shown neighbors, so turning off Performance with most levels still on left the perf lines visible-but-dimmed. The context reveal is now gated to a focused selection (when the shown levels are a minority) — excluding one or two levels hides them cleanly, while soloing or narrowing to a few levels still shows their surrounding context.
- **Performance lines no longer show a redundant `[perf]` tag.** Structured logcat lines like `I/flutter (…): [perf] [frame-stall] …` kept a leading `[perf]` in the message body even though the severity is already shown by the row color and level chip. The structured render path now strips a leading tag that only restates the severity (`[perf]`, `[warn]`, `[error]`, …); a descriptive tag such as `[frame-stall]` is kept as the line's tag.
- **Bare "performance" no longer misclassifies prose as a performance signal.** The `severityKeywords` setting default in `package.json` still shipped the bare keyword "performance", so informational lines containing noun phrases like "Performance settings filtering" classified as the performance level even after the in-code defaults dropped it (VS Code resolves the `package.json` default, making it the live list). Removed there too; specific keywords (`perf`, `jank`, `fps`, `choreographer`, `slow operation`, …) and the structural patterns (`Skipped N frames`, `GC pause`, `took Nms`) still catch real performance logs.
- **Webview default perf keywords were missing "slow operation".** The webview's built-in perf keyword regex (active only until the settings broadcast arrives) lacked `slow operation`, which the extension-side default includes. Restored parity and extended the extension/webview parity test corpus with keyword-default cases so this drift is caught in CI.

---

## [9.1.1]

Cut through the noise with the new Trouble Mode. This zero-context triage filter instantly strips away nominal lines so you only see errors, warnings, and performance issues. We've also made saving signal reports completely automatic—they now write straight to your reports folder the moment you open them. [log](https://github.com/saropa/saropa-log-capture/blob/v9.1.1/CHANGELOG.md)

### Changed

- **Signal reports now save automatically when opened.** The manual **Save Report** button is gone — opening a signal report writes the full markdown report to your reports folder immediately, and the report's Session Overview links straight to the saved file. The log-file path in the overview is now a link too (opens the log in the viewer).

### Added

- **Trouble Mode — a zero-context triage filter for the log viewer.** Toggle it from the view title bar (the warning icon) or the command palette (**Toggle Trouble Mode**), and the viewer strips every nominal line to show only errors, warnings, and performance issues. It is a separate filter layered on top of your existing level selection — turning it off restores exactly what you had. A footer chip shows when the mode is active; click it to exit. Markers (run separators, database signals) always stay visible. This is the first stage of the Trouble Mode dashboard; the live chart, detail pane, Crashlytics rows, and Copy Report handoff follow.
- **`[frame-stall]` bracket tag** for explicit performance-level annotation (aliases: `[perf]`, `[jank]`, `[slow]`, `[latency]`, `[timing]`, `[profile]`, `[frame]`, `[fps]`, `[gc]`, `[memory]`, `[bench]`, `[benchmark]`). Any of these tags at the start of a log line routes it to the Performance level in the viewer.
- **Quantified performance metric detection.** Logs containing `took <n>ms` or `duration: <n>ms` patterns (e.g., `Database query took 2400ms`, `Elapsed duration: 1.5s`) now automatically classify as **Performance**. Supports fractional durations and optional spaces (`took 500 ms`).

### Fixed

- **Slow-query and repeat-query warnings now stay visible when the Database filter is off.** Drift's own performance annotations — `Drift SLOW <n>ms …` (over-threshold queries) and `Drift REPEAT x<n> …` (N+1 query storms) — carry the app's `[database]` tag, so they used to classify as **Database** and disappear the moment you turned that level off. They now classify as **Performance** and appear under the Performance filter (and no longer force an error when the logged SQL happens to contain an "…Error" enum value).
- **Removed bare "performance" keyword from default severity patterns.** The bare word "Performance" was matching English prose like "Performance settings filtering" and misclassifying informational logs. Real performance logging now requires structured forms: `[perf]` bracket tags, `perf:` labels, or quantified metrics like `took Xms` (see Added section above).
- **Blank rows no longer render an expander arrow.** An empty log line sitting just above filter-hidden rows was picking up the "reveal hidden rows" chevron, showing a blank sliver with an expander on it. The chevron now attaches to the nearest non-blank row instead.
- **Copy Report / the saved report now include the Recommendations section.** The exported markdown previously omitted the recommendations shown on the panel; the copied and saved reports now carry the same advice alongside evidence, cross-session history, and other signals.
- **Cross-Session History rows now open the selected session.** Clicking a history row called an unregistered command and silently did nothing; it now loads that session's log into the viewer.

---

## [9.1.0]

The viewer now follows the newest run automatically. When a new log arrives, the viewer jumps to it the moment it appears — no more clicking Open on the newer-log banner. Prefer the old behavior? Turn off **Always Switch to Latest Log** and the viewer stays on the log you are reading, surfacing the banner instead. [log](https://github.com/saropa/saropa-log-capture/blob/v9.1.0/CHANGELOG.md)

### Added

- **"Always Switch to Latest Log" setting (`saropaLogCapture.autoSwitchToLatest`).** On by default: the viewer automatically loads the newest controller log as soon as it appears, instead of only surfacing the sticky newer-log banner and waiting for a click. Turn it off to keep the passive banner. Joins the existing newer-log banner/dot settings. Switching happens without stealing editor focus, and only when the newest log differs from the one already open (so it never reloads in a loop).
- **Error notification setting (`saropaLogCapture.showErrorSnackbars`).** When enabled, each newly detected error during live capture pops a notification showing the error text, with **Open Log** (opens the Log Viewer scrolled to that error line) and **Error Report** (opens the bug-report webview for that error) buttons. Off by default. Notifications are coalesced so bursts don't flood the corner: repeats of the same error signature (variations like differing ports/ids/timestamps normalize to one) are suppressed, and a short cooldown limits how fast distinct errors can stack.

### Changed

- **Icon-bar badges (Signal, SQL, Integrations, Crashlytics, Collections, Bookmarks, Trash) now count unread items, not the panel total.** Each badge shows only how many items arrived since you last opened that panel; opening the panel clears it to zero. Baselines persist across viewer reloads, and a panel that is already open never lights its own badge while you are looking at it.

### Fixed

- **Signals panel formatting overhaul.** The Signals sidebar now reads as one clean, aligned list. Every signal row, section subtitle, and empty state starts its icon on a single left rail; the critical/high severity accent is painted inside the row instead of as a border, so severity rows no longer jog their text right. Signal labels now fill the real column width and truncate with an ellipsis at the panel edge (they were cut off at a fixed 50–60 characters, stranding "..." well short of the available space). Rows that open something (a session, a log line, or inline detail) now carry a trailing chevron; rows that do nothing show none, so it is obvious at a glance which rows are clickable.
- **Signals "Workspace pulse" strip no longer shows an all-zero row.** A pulse of `▲ 0 · ▼ 0 · ● 0 · Fixed 0%` — nothing improving, worsening, stable, and a fix-rate measured against nothing — is vacuous, so the strip now stays hidden in that case. A positive fix-rate, or a 0% fix-rate when there are recurring issues it actually measures, still shows.
- **Opening a cross-session signal now gives immediate feedback.** Clicking a signal that has to load a different session's log could sit silently for a moment, looking like a dead click. The clicked row now shimmers and a slim loading bar appears under the panel header until the target line is reached.

---

## [9.0.11]

The live viewer no longer crashes the debugger during very high-volume sessions. Under a sustained firehose (full logcat plus per-query database logs), the viewer's pending-line queue could grow without limit until the editor's extension host ran out of memory and aborted — dropping the debug session every few minutes. The queue is now capped and drains faster under load. [log](https://github.com/saropa/saropa-log-capture/blob/v9.0.11/CHANGELOG.md)

### Fixed

- **High-volume sessions no longer crash the extension host (bug 001).** When a debug target streamed lines faster than the viewer could post them to the webview, the `pendingLines` staging queue grew unbounded toward the ~4GB V8 heap limit; the extension host aborted with an out-of-memory illegal-instruction crash (`0xC000001D`) roughly every seven minutes, terminating the active Dart/Flutter debug session each time. The queue is now hard-capped at 20,000 lines: on overflow the oldest un-posted lines are dropped (the full stream is still in the session log file) and a single notice marker records the count, mirroring the existing early-output buffer cap.
- **Batch flush now back-pressures correctly.** When the queue was backlogged, the flush interval previously *lengthened* (200ms → 500ms), halving drain throughput exactly when the queue was growing — accelerating the runaway. The interval now *shortens* under backlog (200ms → 50ms) so the consumer speeds up; per-flush payload size stays bounded.

---

## [9.0.10]

Search now always shows what it finds. If a match is tucked inside a collapsed group or hidden by a filter, the viewer reveals it instead of scrolling to an empty spot — and tells you which filter was hiding it, with a one-click way to turn that filter off. The match counter also reports how many results are hidden. [log](https://github.com/saropa/saropa-log-capture/blob/v9.0.10/CHANGELOG.md)

### Fixed

- **Log banner "Open in Editor" now works.** Clicking **Open in Editor** (or any file action) in the click-opened log banner did nothing when the log was viewed in a popped-out panel: the banner posted a bare message that the host resolved against the panel's own current-file URI, which is only set for the live tail session — not for an opened report. The banner now sends the URI it is actually displaying, so every action targets the open file regardless of where it is shown.
- **Log banner kebab menu no longer hides behind the log.** The overflow (⋮) menu painted under the colored severity bars and log text because the banner had no stacking promotion above the content. The banner is now raised above the log content (still below the toolbar and dialogs) so the menu is fully visible.
- **Search no longer scrolls to an invisible match.** Searching for text that lived inside a collapsed continuation/stack/banner/ASCII-art group, or on a line hidden by a filter (level, Log Sources tier, exclusions, source/class/SQL tags, file scope, metadata, time range, manual hide), showed "Showing 1 of 1" but nothing on screen. Navigating to a match now expands any collapsed group automatically and force-shows the matched line past the filter so it is always visible.
- **Null-guard test for `clearSearchState` widened.** The two leading typeof-guards added by the search-reveal feature pushed the `matchCountEl` guard past the test's 200-char slice window, producing a false test failure. Widened the slice to 400 chars; the guard itself was always present.

### Added

- **"Hidden by filter" search notice.** When the current match was only visible because search revealed it past an active filter, an inline notice names the responsible filter (e.g. "This match was hidden by the Level filter.") with a one-click **Disable** action to turn that filter off for full context.
- **Richer search match counter.** The badge now reads "Match N of M" and appends "· K hidden by filters" when some results sit outside the visible set, so you know matches exist beyond what is shown.

### Changed

- **Log banner buttons use title case** — "Open in Editor" and "Copy Full Path".

## [9.0.9]

Level badges now match what you see: the count on a severity dot equals the rows that appear when you focus it. Earlier, device noise (Android `E/` logcat) inflated the Error count, so the badge could say 32 while focusing Error showed none. [log](https://github.com/saropa/saropa-log-capture/blob/v9.0.9/CHANGELOG.md)

### Fixed

- **Level dot counts now equal the rows shown when you focus that level.** The badge total was computed from a separate raw text classification, while the rows are filtered by each line's effective level. These diverged: Android-native device logcat (`gralloc4`, `Badge`, `MediaCodec`, …) is deliberately shown as informational rather than error, but the badge still counted it as error — so the Error dot read 32 while double-clicking it revealed zero. Counts are now tallied from the same per-row level the filter uses (effective, after device demotion and repeat-collapse), so every badge equals exactly what isolating that level displays. App and Dart errors are unaffected — only Android OS/hardware-layer logcat is treated as informational, and it always was for display. (Background: `plans/history/2026.06/2026.06.26/level-badge-count-vs-visible-attempts.md`.)

## [9.0.8]

Database (and other) lines no longer vanish when you isolate a severity: Drift query logs stay visible under the Database filter, and double-clicking a level dot to focus it now opens the Log Sources tiers so you actually see those lines. [log](https://github.com/saropa/saropa-log-capture/blob/v9.0.8/CHANGELOG.md)

### Fixed

- **Drift / database log lines no longer disappear under the Database filter.** Each Drift interceptor line ends with an inline `» Member (./path.dart:line:col)` call-site annotation; that trailing source reference was being misread as a stack frame, so the whole SQL line got folded into a collapsed stack group and lost its `database` level. Isolating Database then showed ~1 row even when the count badge said 200+. Content lines carrying that inline `»` annotation are now kept as normal log lines (a genuine standalone stack frame — `⠀ » Member (path)` with nothing before the `»` — is still detected). Guarded in both the extension-side and webview detectors with a parity-corpus regression case.
- **Double-clicking a level dot to focus a severity now opens the Log Sources tiers.** Device and External tiers default to **Warn+**, which independently hides every non-error/warning line regardless of the level filter — so soloing Debug or Database showed nothing despite the count badge. Soloing a level now resets all three tiers to **All** and moves the drawer radios to match, so the isolated level's lines are actually shown.

### Maintenance

- Aligned `@types/vscode` down to `^1.105.0` to match `engines.vscode`. The dev type range had drifted ahead to `^1.125.0`, which vsce rejects at the Package step — the prerequisite manifest-compat gate now self-heals or stops before any version/CHANGELOG mutation, preserving the committed VS Code compatibility floor.

## [9.0.7]

Group related logs into named Investigations with notes, so a multi-session bug reads as one case — and bug reports now point at where the failing operation actually began instead of just dumping a fixed window. [log](https://github.com/saropa/saropa-log-capture/blob/v9.0.7/CHANGELOG.md)

### Added

- **Investigations — bundle related logs into one named, annotated case.** A curated layer over automatic session grouping: give a multi-session debugging effort a title ("Bug #42: Payment timeout") and notes (the root cause), spanning whichever logs you choose. Right-click a log in the Logs panel → **Add to Investigation** (or **Remove from Investigation**), or use the Command Palette: New / Rename / Edit Notes / Delete / **Open Investigation**. Open shows the member sessions or a one-page **overview** that gathers the title, notes, and each session with its error/warning counts and notes. Investigations are non-destructive (a log can be in an auto group and any number of investigations) and persist per-workspace.
- **Bug reports now point at where the failing operation began.** The Log Context section already flagged the largest pause before an error; it now also walks back from the error to find the logical start of the operation it belongs to — a blank-line break, a timestamp gap, or a rise in severity — and annotates "the failing operation begins N lines back". The full context window is still shown unchanged; this just marks the boundary so a developer reads the relevant operation instead of guessing how far back to look.

<details>
<summary>Maintenance</summary>

**Build tooling**

- **F5 (Run Extension) now uses a fast `dev-build` instead of the full `compile` chain.** Debug launches were blocked behind the whole validate-and-bundle pipeline (two `tsc` passes plus nine `verify:*` checks), which pinned a CPU core and kept the "Waiting for preLaunchTask 'compile'…" dialog up until everything finished. The launch configs now run only the two artifact-producing steps — regenerate the embedded DB-detector merge source, then `esbuild` the bundle — so F5 starts quickly. Full type/lint/verify coverage still runs via `npm run compile` and in CI.
- **`.vscode-test/` no longer accumulates a full ~200 MB VS Code build per release.** `@vscode/test-electron` downloads a complete editor per version under `.vscode-test/` and never prunes the old ones; left unbounded this reached 16.3 GB / 179,824 files across 26 installs and froze the window on open ([Bug 002](plans/history/2026.06/2026.06.25/bug_002_vscode-test-cache-hangs-window-on-open.md) / [Bug 003](plans/history/2026.06/2026.06.25/bug_003_workspace-large-dir-blowout-detection-and-prevention.md)). A new `posttest` step ([prune-vscode-test-cache.mjs](scripts/modules/test/prune-vscode-test-cache.mjs)) keeps only the newest install after every `npm test`, bounding the cache to one build. Run it manually with `npm run prune:vscode-test` (`--dry-run` to preview). Build/test tooling only.
- **The packaged `.vsix` no longer ships repo and CI artifacts.** `.vscodeignore` did not exclude `coverage/`, `.nyc_output/`, `reports/`, `plans/`, `bugs/`, `examples/`, `test/`, `.github/`, and `l10n/provenance/`, so a package pulled in 2,851 files (~18 MB) of test-coverage HTML, captured logs, and planning docs that have no runtime consumer. Those folders are now ignored; only `dist/`, `l10n/` bundles, `images/`, `media/walkthrough/`, `audio/`, and the manifest NLS files ship — 47 files. Packaging only.

</details>

---

For older versions see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).
