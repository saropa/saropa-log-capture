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

### Fixed

- Fixed `vsce package` failure caused by `@types/vscode` (`^1.134.0`) being newer than `engines.vscode` (`^1.105.0`); pinned `@types/vscode` to `^1.105.0` to match the engine floor
- Added `verify:engine-types-match` compile gate to catch `@types/vscode` vs `engines.vscode` mismatches before they reach the VSIX packaging step

---

## [9.4.0]

Massive stability and security sweep — dozens of long-standing bugs squashed, secret redaction hardened, dead features cleaned out, and multi-panel viewer support added. [log](https://github.com/saropa/saropa-log-capture/blob/v9.4.0/CHANGELOG.md)

### Security

- Fixed bug 003: bug reports and "Explain with AI" leaked unredacted secrets and absolute file paths. `redact.ts` now matches forward-slash and `vscode://file/` path forms, not just backslash paths; `formatBugReport()` and `formatReportFile()` run a final redaction pass over the fully assembled markdown (closing leaks from raw full-output/selected-text sections and markdown links, not just the header); and the AI data-send consent dialog is now wired into the root-cause hypotheses explain path (it was previously only gated on the line-explain path)
- Added workspace trust gate for integration settings and replaced shell-string interpolation with argument arrays in build/CI, Docker, Linux-log, and Windows-event-log providers

### Removed

- Removed non-functional "Explain with AI" button from analysis panel
- Removed non-functional `deemphasizeFrameworkLevels` setting
- Removed non-functional GitHub Issue and Handoff bug report variants
- Removed dead `rescanTags`, `showTimeline`, and `compareWithMarked` commands (bug_006); removed the now-unreachable `msg.noSessionMarked` l10n key left behind when `compareWithMarked` was deleted, and added a working "Mark for Comparison" context-menu entry point without re-adding the deleted command (bug_014)
- Follow-up cleanup after bugs 005/009/029: removed the now-unreachable `viewer.analysis.aiUnavailable` l10n key left behind when the "Explain with AI" button was deleted (bug_005); deleted the unused `report-variant-runner.ts` and `report-file-variants.ts` modules — no command called into them, so they shipped as dead scaffolding rather than a working feature (bug_009); deleted the dead `bindExportModalKeyboardHandlers()` function, whose Escape/Tab-trap listeners were never wired up because `initExportModal()` duplicated them inline instead of calling it (bug_029)

### Fixed

- Fixed bug 020 follow-up: the `viewer.session.scanFailed` l10n key added by the original fix was never synced into `l10n/bundle.l10n.json`, so `vt()` looked it up and silently fell back to raw English — the base bundle now carries the identity entry alongside the source string
- Fixed bug 028 follow-up: stack trace headers born while Trouble Mode was active were still hardcoded to the class/scope-filter fix's pattern minus Trouble Mode itself, so a new header flashed visible for one `recalcHeights()` pass before Trouble Mode hid it — `tryIngestStackLine()` now computes `calcTroubleFiltered()` at header birth the same way `computeLineBirthHeight()` already does for regular lines, and stamps the header's own `troubleFiltered` flag so `calcItemHeightBase()` respects it on the next recalc too
- Fixed bug 025 follow-up: pinned lines and annotations are keyed by `allLines` index the same as the fixed trim-time re-indexing, but nothing reset them on a full log switch — the `clear` webview message handler now clears `pinnedIndices` and `annotations` alongside the selection-state reset it already did, so a pin/annotation from the previous file can no longer reappear on an unrelated row of the newly opened one
- Fixed bug 011 follow-up: the keyboard bookmark shortcut (`bookmark` action in `viewer-script-keyboard.ts`) still stored the viewer's `allLines` array index instead of the file's `sourceLineNo`, so a bookmark set with the keyboard could resolve to the wrong row after any trim/filter change even though the right-click "Bookmark" menu action was already fixed — both entry points now key off `sourceLineNo` consistently
- Fixed bug 015 follow-up: `openSignal`, `openSqlHistoryForFingerprint`, and `refreshRecurringSignals` posted to the log viewer without waiting for a closed/cold `WebviewView` to resolve, silently dropping the message — `openSignal`'s duplicated inline poll is replaced with the shared `ensureWebviewReadyOrWarn()` gate, `openSqlHistoryForFingerprint` now uses the same gate, and the automatic post-capture `refreshRecurringSignals` refresh uses the silent `ensureWebviewReady()` variant so a closed viewer doesn't pop a warning toast on every capture
- Fixed bug 016 follow-up: bulk delete (`handleDeleteCommand` in `delete-command.ts`) was the one deletion path not calling `cleanupDeletedSessionMetadata()`, orphaning metadata and search-index entries for every file removed through the bulk quick pick — it now shares the same cleanup call as the single-file delete and empty-trash paths
- Fixed bug 033: export timestamps mislabeled a local wall-clock time as UTC (`Z` suffix) and mixed a UTC date header with a local time-of-day, giving lines the wrong date near local midnight in any non-UTC timezone; `buildFullTimestamp()` now uses the session-start date's local calendar day (no `Z` suffix) and tracks a per-export `RolloverState` that detects a decreasing time-of-day between consecutive lines to advance the date across midnight, so long-running sessions that cross one or more local midnights get the correct date on every line
- Fixed bug 046: deleting a log left its `.screenshots/` PNGs and `.screenshots.json` index behind forever, growing disk usage unbounded — sidecar cleanup is now wired into `cleanupDeletedSessionMetadata()`, the single choke point every physical-delete path (single-file delete, bulk delete, empty trash) already shares, so no call site needed a separate patch
- Fixed bug 017 follow-up: `resetAllSettings` already skipped workspace-scope updates without a workspace and used `Promise.allSettled` so one rejected setting couldn't abort the rest, but it still showed the generic success toast even when some updates failed, silently hiding a partial reset — a failed reset now shows a warning with the failed/total counts instead
- Restored walkthrough markdown files to `media/walkthrough/` (the only copy now — the stray `plans/walkthrough/` copy that never shipped is gone), refreshed their stale "sidebar viewer" and keyboard-shortcut content, and added a `verify:walkthrough-media` compile gate so a future move can't silently ship an empty walkthrough step again
- Fixed Crashlytics OAuth scope to match Play Developer Reporting API
- Fixed bug 010: adb logcat and other streaming integrations wrote lines straight to the log file via `logSession.appendLine` and never called `broadcastLine`, so the sidebar/viewer only showed logcat output after a reload and line listeners (file watchers, screenshot triggers, API callbacks) never saw it live — `makeStreamingWriteLine()` in `session-lifecycle-init.ts` now pairs every `appendLine` with a `broadcastLine` call, `broadcastLine` is threaded through `InitSessionParams`, and `session-manager-start.ts` supplies the same callback the DAP output path already used
- Paused capture no longer shows lines in viewer that are absent from the saved file
- Clarified `maxLogFiles` setting description to accurately reflect trash-only behavior
- Commands that require a session context now show guidance instead of silently doing nothing
- Reset All Settings no longer fails when no workspace is open
- Deleting a session now cleans up metadata and search index entries
- Debug output is no longer routed to wrong session in multi-root workspaces
- Fixed bug 034 follow-up: a folder-B debug session starting within 5s (race guard) or 30s (recent-child fallback) of folder-A's session start could still get its output permanently aliased to folder A's log file, even though routing itself was already fixed — `getSingleRecentOwnerSession()` and `getMostRecentOwnerSessionId()` now refuse to alias across workspace folders
- Analysis panel now respects user-configured level detection settings
- Fixed exported log timestamps using inconsistent UTC/local time mix
- Fixed signal report l10n overwrite and template ID mismatch
- Fixed bug 022 follow-up: `collectBurstSignals()` and `collectRootCauseHintBundleEmbedded()` still re-scanned the entire `allLines` array on every batch after the general-signal collector was fixed — both now track their own incremental scan cursor (reset on session change and on the same buffer-trim shrink guard as the general collector), so a batch only walks the lines appended since the previous call
- Fixed bug 030: three sources of false positives in the Signals panel — (1) the burst/silence-burst collector now suppresses a burst when any of its lines match a Gradle/Xcode/Flutter build-or-launch marker (`BUILD SUCCESSFUL`, `Running Gradle task`, `Launching lib/main.dart`, etc.), so a cold-start build no longer fires a HIGH-confidence "possible UI freeze" hint on every run; (2) the ANR risk cache in `signal-host-collectors.ts` now keys on file URI **and** byte size instead of URI alone, so an ANR appearing mid-session after the initial cache fill is picked up on the next check instead of returning a stale/undefined result until the session is reopened
- Fixed bug 031: the signal report's screenshot strip inlined every thumbnail as base64 (up to 3 thumbnails + a 2-image diff pair, 10 MB cap each) into the section HTML, which was then re-persisted whole via `setState` on every `sectionReady` event — thumbnails now resolve through `webview.asWebviewUri()` instead, cutting persisted webview state from tens of MB to a handful of resource references; the before/after diff pair stays base64-inlined because its change-heat overlay reads pixels off a `<canvas>`, which needs a same-origin/data-URI source
- Fixed bug 036: clicking a Signals-panel hypothesis report no longer counts the generated `.md` report toward `maxLogFiles` retention — `readTrackedFiles`/`readTrackedFilesStreaming` (`config-file-utils.ts`) now skip the `reports/` subdirectory entirely during the recursive scan, so real session logs can't be evicted just because a user clicked through report hypotheses
- Fixed Vitals panel interval continuing after panel is closed
- Fixed off-by-one line index in "Open Error Analysis": the 1-based `sourceLineNo` sent by the viewer is now converted to a 0-based index before frame extraction, so the correct line is analyzed instead of the one after it
- Toggle capture now writes to user settings instead of workspace settings
- Status bar click now opens log in the viewer instead of as raw text
- AI features now require explicit opt-in instead of being silently enabled
- GitHub token is now cleared on 401 responses with re-auth prompt
- Fixed bug 044 follow-up: the 401 handler was wired into the share/upload path but not the Gist import path — `importFromGist()` now clears a stale token and offers re-auth on a non-OK Gist API response too; added a manual `saropaLogCapture.clearGitHubToken` command for a user-initiated re-auth (e.g. switching GitHub accounts) instead of only reacting to a failed request
- Fixed bug 043: `verify:list-commands` only checked that the generated command reference matched `package.json` — a command registered in `src/` with no `contributes.commands` entry (invisible in the Command Palette) went undetected; the check now also verifies both directions between the manifest and every `registerCommand()` call in `src/`
- Verified bug 041 items 1 and 3 (Flutter widget-exception banner lines no longer break stack-frame extraction; adb resolution now falls back to `ANDROID_HOME`/`ANDROID_SDK_ROOT` when not on PATH) — both were already fixed prior to this pass
- Capture commands now show feedback when no session is active
- Stack trace headers now respect active filters on arrival
- Fixed stale "Prev/Next" reference in capture diagnostic message
- Walkthrough and first-error dialog no longer interrupt active debug sessions
- Logcat process is now stopped before queue drain to prevent write-after-close errors
- Four commands are now visible in the Command Palette (Refresh Vitals, Refresh Recurring Signals, Open Settings, Open Changelog)
- Log viewer: pins, annotations, and selection state now stay aligned after viewer line trimming
- Scanner line cap prevents unbounded memory growth in analysis passes
- Redact sensitive values from AI context and bug report payloads
- Webview-ready gate prevents commands from firing before viewer is initialized
- Root-cause hint SQL builder no longer injects unchecked identifiers
- Repeat-collapse counters reset correctly across session switches
- Source-line stamps in goto-line and viewer messages use consistent format
- Regression detector and recurring-signal handler guard against empty input
- Export HTML/script now escapes user content to prevent XSS in exported reports
- Pattern extractor guards against malformed log input
- Log session timestamp and tracker output handle missing/trailing newlines
- Removed false deduplication claim from README (feature was never wired in)
- Broadcaster skips expensive HTML build when all viewer panels are hidden
- Fixed bug 035 follow-up: corrected a misleading comment in `ViewerBroadcaster.addLine()` claiming hidden targets "get raw data queued via addLine" — a hidden-viewer line is dropped, not queued for later delivery
- Signal reports now write to a `reports/` subdirectory so they no longer evict session logs via `maxLogFiles` retention
- Flutter widget exception `═══` banners no longer break stack frame extraction in bug reports
- adb screenshot now falls back to `ANDROID_HOME`/`ANDROID_SDK_ROOT` when adb is not on PATH
- Annotated log lines no longer cause cumulative scroll drift; adding or reloading annotations now rebuilds row heights before the viewport re-renders (bug_027)
- Fixed bug 004 follow-up: the first-error notification's `detail` option only renders for modal dialogs — once the dialog became non-modal, the error line text was silently dropped instead of shown; the line text is now folded into the primary message so it still reaches the user

### Changed

- README: fix activity bar → panel, captureAll default true, Compare Sessions → Compare Logs, VS Code ^1.105.0, 10 locales, footer version
- ARCHITECTURE: fix dead INTEGRATION_API.md link, split session-lifecycle.ts → -init/-finalize
- CONTRIBUTING: publish script path (scripts/publish.py), coverage tool (nyc), 300-line rule clarification
- ISSUE_REPORT_GUIDE (renamed from BUG_REPORT_GUIDE): fix stale bugs/history/ path and ROADMAP references, add a feature-request template, and correct the bug template's Status/Severity headings and Problem/Proposed Fix sections to match the 46 filed bug reports on disk
- Changed the `flutterCrashLogs.deleteOriginals` code-level fallback default to `false` (bug_021 partial fix — the `package.json` setting schema still declares `"default": true`, which is what VS Code actually resolves for users who haven't touched the setting, so the destructive default is still in effect; see bug_021 for the remaining `package.json` change needed)
- Session history and viewer broadcaster now support multiple viewer panels

<details>
<summary>Maintenance</summary>

- Fixed `vsce package` failure caused by `@types/vscode` (`^1.134.0`) being newer than `engines.vscode` (`^1.105.0`); pinned `@types/vscode` to `^1.105.0` to match the engine floor
- New advisory `verify:script-position-proxies` script flags `src/test/**/*.test.ts` assertions that locate webview-script code by string position (`indexOf()` ordering comparisons, fixed-offset `.slice()` windows) instead of structure — the failure class behind the extraction/pause-gate test breakages fixed earlier this cycle; prints a copy-pasteable occurrence-count guard suggestion for each finding, heuristic-based, not wired into `npm run compile`
- Archived 45 fixed bug reports from `bugs/` to `plans/history/2026.09/2026.09.03/`; repointed stale `bugs/bug_*.md` references in MASTER_PLAN, plan 114, and the issue report guide
- Fixed publish script hanging at `vsce login` overwrite prompt on Windows — `logout` first so the PAT prompt appears directly without the interactive y/N confirmation that stdin can't reach through the cmd.exe → npx chain; added `VSCE_PAT` env / `.env` support to bypass interactive login entirely (mirrors `OVSX_PAT`)


</details>

---

## [9.3.12]

Copying an error or warning block from the log viewer now reports the line numbers it's actually at, and pulls in a bit of surrounding context. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.12/CHANGELOG.md)

### Fixed

- Log viewer: **Copy Error/Warning** and **Copy Error/Warning JSON** reported line numbers that undercounted by the length of the session header block — the JSON payload's `lineStart`/`lineEnd` and the "Copied lines L-H" toast now use the same header-aware line number the gutter and screenshot matching already rely on

### Changed

- Log viewer: **Copy Error/Warning** and **Copy Error/Warning JSON** now include the same surrounding-context lines (`saropaLogCapture.copyContextLines`, default 3) that **Copy with source** already adds — the reported severity still reflects only the actual fault, not the neighboring context

---

## [9.3.11]

Three flow-map regressions from 9.3.10 are fixed: diagram zoom (wheel and every toolbar button) stopped responding, the screenshot lightbox's zoom still jumped, and screenshots could attach to the wrong screen. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.11/CHANGELOG.md)

### Fixed

- Flow map: diagram zoom (mouse wheel, the +/− buttons, Reset view, Arrange by time, Export as SVG, Center the fault, and the pop-out button) works again — a stray unescaped character broke the script that wires all of them
- Flow map: zooming a screenshot in the lightbox no longer resizes and re-centers the whole dialog on every scroll tick — the picture now zooms inside a box that stays a fixed size, so the point under the cursor actually stays there
- Flow map: the lightbox's previous/next buttons no longer mix the activity-timeline captures and the screen-visit-table captures into one navigation set
- Screenshots: fixed the root cause of captures attaching to the wrong screen in the flow map — the position recorded for a capture now counts every line actually written to the log (including the session header and diagnostic lines), instead of a counter that only tracked lines toward the file-split threshold and silently undercounted from the very first line
- Flow map: a screen label carrying leftover ANSI color codes now matches its screenshot the same way a clean label does, instead of failing to pair silently
- Flow map: the screenshot lightbox's zoom lock now also accounts for the facts grid and nav bar's own width, not just the picture's — a wide caption or path could previously force the dialog wider than the locked zoom box after it opened
- Log capture: the line position recorded for a log-split's continuation header is now counted, instead of leaving a small gap right after any split configured with a non-default max-lines/max-size/silence-timeout rule
- "Open Log" from an error notification, and manual screenshot capture, now use the same corrected line-position counter the flow map's screenshot-mismatch fix introduced, instead of the older counter that could point a few lines early
- Log capture: a session configured with a max-lines split rule no longer degenerates into one file per line after the first split — the threshold now resets per file part the way its own description ("split file after this many lines") always said it would, instead of a counter that never reset and re-triggered a split on every single line once first crossed

<details>
<summary>Maintenance</summary>

- A developer-only self-check runs at activation, re-verifying the flow map's five generated webview scripts are valid JavaScript and logging a warning to the "Saropa Log Capture" output channel if one isn't — the same check the test suite runs, but against the actual build, so a bug like the v9.3.10 zoom regression is visible without a live debugging session first

</details>

---

## [9.3.10]

Flow map diagrams can now be rearranged by hand or laid out along a time axis, exported as a standalone SVG, and screenshots turn up wherever a moment is listed; the screenshot lightbox got a working zoom and prev/next buttons. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.10/CHANGELOG.md)

### Added

- Flow map: diagram cards can be dragged into any arrangement — every arrow, dwell label and return curve follows the card live, so two screens can be put side by side without the diagram coming apart. The Reset view button returns to the automatic layout
- Flow map: an **Arrange by time** toolbar button lays the cards out along a wall-clock axis instead of by graph depth, so horizontal distance becomes elapsed time and near-simultaneous screens stack into a column. Reset view clears it along with any hand-dragged cards
- Flow map: an **Export diagram as SVG** toolbar button saves the diagram exactly as it looks — including any hand rearrangement or by-time layout — as a standalone file for a bug report or a PR. Screenshot thumbnails are left out of the export (their preview only loads inside the panel), and the save confirmation says how many were left out
- Flow map: the screenshot lightbox has previous/next buttons and arrow-key navigation, stepping through the captures on whichever surface it was opened from
- Flow map: the activity timeline shows a small capture under each stretch of the session that has one, clickable straight into the lightbox
- Flow map: the screen-visit table shows each screen's capture in its own row, clickable straight into the lightbox. The column only appears when the session captured something

### Fixed

- Flow map: zooming a screenshot in the lightbox no longer makes the image jump around — the picture now scrolls inside its own box, so the point under the cursor stays put and the left edge of a zoomed capture is reachable
- Flow map: the executive summary fills the width of its column instead of wrapping short in the middle of it
- Flow map: the session-info list splits into two pairs of columns when the detail column is dragged wide enough to hold them
- Flow map: **Center the fault** now scrolls to where a dragged or time-arranged crash card actually is, instead of where the automatic layout first placed it
- Flow map: a screen entered well before every other lane on the by-time layout no longer inflates the row height of lanes that hold nothing but short cards

### Changed

- Screenshots: **Skip Near-Duplicate Screenshots** now defaults to on. It only skips a capture whose picture matches a recent one on the same screen; error, warning and manually-requested captures are never skipped, and an unreadable capture is always kept. Anyone who never touched this setting sees a one-time notice explaining the change, with a shortcut to the setting

<details>
<summary>Maintenance</summary>

- Flow map: consolidated five identical HTML/XML-escaping helpers (one per rendering module) into a single shared function
- Flow map: split the graph builder's crash- and issue-attachment logic into its own module to bring the builder back under the project's 300-line file limit
- Flow map: the crash/issue-attachment module's shared state is now typed narrower than the full graph-walk state, so it can no longer read or write walk-only fields it has no business touching
- l10n: fixed translation script re-translating verified-identical keys every run, causing a garbled-reset → re-translate cycle and phantom "gaps" on 100%-complete locales
- l10n: registered "Zoom"/"Commit"/"File"/"Debug {0}" as verified-identical for the locales already manually confirmed, stopping the deterministic translation-engine errors that recurred on every run
- l10n: translation audit/coverage tables no longer use red for gap and quality-signal counts — red is reserved for actual runtime errors
- New advisory `verify:changelog-maintenance` script flags CHANGELOG bullets that read as internal tooling (l10n pipeline, design-token migrations, compile gates, file splits) but sit outside a Maintenance block; heuristic keyword match, not wired into `npm run compile`

</details>

---

## [9.3.9]

Introduces a new Diagnose Screenshot Capture command, smart near-duplicate screenshot filtering, side-by-side screen comparisons in the flow map lightbox, and major performance fixes that keep reports lightweight. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.9/CHANGELOG.md)

### Added

- The Diagnose Screenshot Capture report lines up its values in a column computed from the labels, so adding a row cannot quietly misalign the rest
- Screenshot settings are resolved in one place, so the Diagnose Screenshot Capture report shows the values capture is really using — including any clamping of a hand-edited value — rather than reading the settings a second time
- New command **Diagnose Screenshot Capture**: reports the settings in force, whether a debug session's VM Service is known, captures kept and skipped (in this process and on disk), and the log, capture-directory and sidecar paths — so the state of the capture pipeline can be asked for rather than pieced together from output-channel lines that scrolled past
- Flow map: the Screenshots gallery reports how many near-duplicate captures were skipped for that log, so the setting's effect is visible in the report it affects rather than only in the output channel
- Screenshots: an optional **Skip Near-Duplicate Screenshots** setting (off by default) drops a capture whose picture matches a recent one. The phone's status bar is left out of the comparison, so two shots of the same screen that differ only by the clock count as the same picture; error, warning and manual captures are never skipped, and every skip is written to the output channel with its similarity. On a real seven-capture session it removed two duplicates and kept both fault captures
- Flow map: any screen captured more than once can be compared in the screenshot lightbox — two captures side by side with their clocks, stepping through the rest of that screen's set
- Flow map: a screen can also be compared against another session — the lightbox lists recent sessions that captured the same screen, so "what did this look like yesterday" is one click

### Fixed

- Flow map: a screen with a very large number of crashes now wraps them into further columns instead of one column that grows off the bottom of the report
- Flow map: the two report columns size their scroll area from the actual header height, so a wrapped toolbar no longer pushes the bottom of each column out of reach
- Flow map: screenshot thumbnails on the diagram cards rendered as empty frames — captures are now referenced from disk instead of being embedded in the panel, which drops a screenshot-heavy report from megabytes of markup to a few kilobytes and lets each capture load on its own
- Flow map: a short session no longer fans out across the screen — terminal crash cards stack in a column beside the walk rather than sitting side by side in it, and any genuinely wide row of sibling screens wraps instead of widening the canvas (a real four-step session measured 1272px wide before, 456px after)
- Flow map: diagram card thumbnails render again — the diagram's own node coloring was being painted over the top of every screenshot
- Flow map: the diagram and the detail column each scroll on their own, so a long issue table no longer drags the diagram off the screen
- Log viewer: the screenshot preview popover shows the full path of the capture it is previewing, not just the filename
- Flow map: the screenshot lightbox shows the capture's filename with a one-click copy of its full path, and the image can be zoomed by scrolling over it or with a zoom slider (which overrides fit-to-window; the fit button returns)
- Flow map: a screenshot that has been moved or deleted since the report was built now says so in its frame, instead of showing a broken-image placeholder
- Screenshots: a screenshot record with an unrecognized trigger is now rejected when the sidecar is read, instead of reaching the gallery and the diagram as an untinted mystery capture
- Flow map: the capture-count badge on a diagram card keeps its contrast over any severity tint, and hovering a card thumbnail now says which capture is on show and what triggered it
<details>
<summary>Maintenance</summary>

**l10n pipeline**

- 25 untranslated trouble-chart legend and flow-map strings filled across 10 locales (DB, Debug, TODO, Screenshot, Trigger); all locales now at 100% coverage
- `is_acronym_only` now recognizes acronym + placeholder patterns (e.g. "DB {0}", "TODO {0}") so they classify as identity instead of untranslated gaps
- `fill-identity` action (menu 8 / `--run-mode fill-identity`) stamps provenance on EN-COPY bundle entries that match any forced-identity criterion; scans bundles directly with dry-run preview and confirmation prompt in interactive mode
- `ACRONYM_ONLY_STRINGS` expanded with "APP" and "FW" (analysis badge labels with garbled MT output)
- Garbled acronym translations (NLLB hallucinations for short inputs like "APP", "FW") are now automatically reset to identity during `run_sync` — no manual cleanup needed

**Build gates**

- New `verify:acronym-coverage` compile gate asserts every acronym-only source string in `strings-*.ts` is registered in `ACRONYM_ONLY_STRINGS`; includes minimum-count assertion and overlap check between the acronym set and the uppercase-words exclusion list

</details>

---

## [9.3.8]

Introduces quality-of-life improvements to the Logs panel by collapsing older logs and simplifying severity counts to reduce visual clutter. Trouble Mode also gains an auto-activation setting, customizable severity filters, and a new quick-jump button to locate initial errors faster. The flow map now reads like a storyboard — captured screenshots appear on the diagram cards themselves, and any screenshot opens full size in a lightbox. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.8/CHANGELOG.md)


### Added

- Logs panel: older day groups now collapse by default — only today's group starts expanded; clicking a heading still toggles, and explicit expand/collapse persists across reloads (plan 001 part A)
- Logs panel: non-latest, non-active rows now show a single neutral line-count pill instead of the full severity breakdown — click the pill to expand inline; a "Collapse counts" toggle in Display options controls the behavior (plan 001 part B)
- Logs panel: "Expand all" / "Collapse all" buttons in the Display submenu to open or close all day groups at once; buttons auto-hide when day headings are off (plan 001)
- Trouble chart: "First error" button in the header jumps to the first error after app start
- Setting `troubleMode.openOnLoad`: auto-activate Trouble Mode when a log opens; suppresses the smart bookmark modal since Trouble Mode already surfaces errors
- Setting `troubleMode.levels`: choose which severity levels survive the Trouble Mode filter (default: error, warning, performance); changes apply live without reopening the log
- Command palette: "Trouble Mode — Errors Only" and "Trouble Mode — Reset Levels" for quick preset switching
- Trouble chart: bars and legend now dynamically bucket all configured severity levels instead of only error/warning/performance; chart rebuilds when `troubleMode.levels` changes
- Flow map: screens that were captured now show the screenshot on the diagram card itself, with a count pill when a screen was captured more than once
- Flow map: clicking any screenshot — a diagram card's thumbnail or a gallery figure — opens a lightbox with the capture at full size plus its screen, capture time, trigger, and a clickable log line
- Flow map: the pop-out diagram carries the same screenshot thumbnails as the report
- Flow map: a screen captured several times shows the capture that faulted — error first, then warning — instead of whichever came first, and the count pill takes that severity's tint

### Changed

- Flow map: diagram nodes are now portrait "storyboard" cards (168px wide) instead of 236px landscape boxes, so a screenshot fits on the card at a recognizable size and more sibling screens fit per row
- Flow map: the report now bounds embedded screenshots by total size (6 MB of image data) as well as count (12), and skips any single capture larger than the whole budget — a high-DPI screenshot can no longer freeze the panel it is embedded in
- Flow map: the screenshot lightbox keeps keyboard focus inside itself and returns focus to the thumbnail that opened it

- Trouble Mode preset commands fall back to global config when no workspace is open
- Trouble chart "todo" swatch changed from amber (#ffc107) to green (#8bc34a) for better contrast with the warning swatch

### Fixed

- Logs panel: stale day keys in `collapsedDays` are pruned when the session list changes so the persisted map does not grow unboundedly; skipped on option-toggle re-renders (plan 001)
- Logs panel: "Expand all" / "Collapse all" now cover all session dates including paginated pages, not just the currently rendered DOM subset (plan 001)

- Smart bookmark modal no longer fires on pre-launch device backlog errors; skipped pre-launch error count is logged to the output channel (bug_002)

<details>
<summary>Maintenance</summary>

- Trouble Mode level constants (valid set + defaults) consolidated into a single source of truth (`trouble-level-constants.ts`) shared by config reader, load handler, and webview initialisation
- New `verify:trouble-levels` compile gate asserts `package.json` enum/default match the shared constants AND every valid level has a matching chart legend l10n key
- First-error scan extracted to `viewer-trouble-chart-first-error.ts` (chart file was over the 300-line limit)

</details>

---

## [9.3.7]

Flutter profile mode now captures screenshots on crash, alongside inline log image references, on-demand capture tools, diagnostic self-tests, and smart flow map breadcrumb suggestions. [log](https://github.com/saropa/saropa-log-capture/blob/v9.3.7/CHANGELOG.md)

### Added

- Flow map: when a log has no recognized navigation breadcrumbs, the diagram area now suggests custom rules built from the log's own repeated line shapes, addable in one click — arrow-separated lines (`Navigated -> Home`) are recognized alongside colon-separated ones, and a short capture holding a single navigation-worded line is offered too

### Fixed

- Flow map: a suggested breadcrumb rule now reproduces its source line verbatim, so the rule matches the lines it was derived from (an arrow-separated suggestion previously generated a rule that matched nothing), and adding one falls back to user settings when no workspace folder is open instead of failing
- Session Display menu: the Reverse toggle showed its raw l10n key (`viewer.session.toggleReverse.text`) instead of a label — added the missing `.text` string
- Flow map: a log with no navigation breadcrumbs (for example a logcat-only capture) no longer renders a silent blank diagram — the zero-node layout produced an invalid negative-height SVG; the diagram area now explains what the flow map needs, and the zoom toolbar and glyph legend are hidden when there is no diagram to control
- Screenshots now capture in profile-mode Flutter runs: profile builds emit no console exception banners (the previous only trigger source), so live app crashes from the device log (`E/AndroidRuntime: FATAL EXCEPTION`) now trigger a capture — while the days-old crashes the device replays from its buffer at every session start, and routine warning-level system chatter, never do. Live-vs-replayed is judged entirely on the device's own clock, so it works whatever timezone the phone is set to
- The output channel now announces "capture pipeline armed" with the running version at startup (confirms the installed build has the feature) and warns once when an app error passes with no VM Service address known, so an idle capture pipeline is never silent
- Each captured screenshot is now recorded as a line in the log itself, right beside the error that caused it — so screenshots are visible when reading or sharing a log, not just as files in a folder
- A capture count pill sits with the open log's name in the banner as well as the toolbar, so a log you are reading shows how many screenshots it holds; clicking either opens the gallery
- New "capture now" button in the viewer toolbar takes a screenshot on demand. It appears only while a live debug session is being viewed — there is nothing to photograph in a saved log, so the button is absent there rather than present and dead
- Every Flutter debug session now records a screenshot self-test in its log and the output channel — whether capture is on, which triggers are armed, the adb version, and the attached device (or plainly "adb NOT FOUND" / "NO DEVICE attached"). A log that captured nothing now explains why on its own, without a live investigation
- Japanese and Korean "Sev" column header fixed from sound transliterations to meaning (重度, 심각)

<details>
<summary>Maintenance</summary>

**l10n pipeline**

- 29 manual translations filled across 9 locales (EN-COPY audit gaps from engine swap)
- German loanwords (Commit, Detail, Version) kept as-is and added to verified-identical allow-list
- Audit auto-suppresses EN-COPY entries with manual provenance (no code change needed for true cognates)
- l10n key verification now catches dynamic key families via four layers: literal keys, `@l10n-expand` JSDoc tags (cross-file, paren-balanced arg parsing, escape-aware, multi-line tags), `@l10n-family` catalog annotations, and a template-pattern fallback — a missing suffix in any family fails the compile gate; out-of-bounds arg indices emit ERROR (stale tag), non-literal args emit WARN

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

- Signal report stat cards now show severity-colored top borders (red for errors, amber for warnings, blue for info signals)
- Signal report health score replaced with a visual arc gauge — color graduates by tier (green ≥80, amber 50–79, red <50)
- Signal report header upgraded to a hero block with type badge, larger title, and confidence badge on one line
- Signal report evidence blocks highlight the target line with a red left-border accent; surrounding lines fade to draw the eye
- Signal report overview rows now have subtle separators, bolder labels, and consistent vertical rhythm
- Signal panel entries (both "This log" and "Across your logs") now show colored type badges (ERR, WARN, PERF, SQL, NET, MEM, etc.) for at-a-glance category scanning
- Health gauge handles non-finite scores gracefully (renders 0 instead of NaN)

<details>
<summary>Maintenance</summary>

**l10n pipeline**

- l10n audit now prints per-locale untranslated string detail (key, reason, English value) below the gap count, so the operator sees exactly which strings need work without opening the JSON report; interactive mode always shows this (capped at 10 per locale), non-interactive suppresses it unless `--verbose` is passed (which removes the cap)

**Design tokens**

- Migrated hardcoded `border-radius` values to design token variables (`--radius-sm`, `--radius`, `--radius-pill`) across 45+ style files for consistent corner rounding
- Migrated hardcoded `font-size` values to design token type scale (`--text-caption`, `--text-body`, `--text-h2`) across 48+ style files for consistent typography
- Session comparison, collection, bug report, and keyboard shortcuts panels now load the design token layer — they can consume spacing, radius, type, and color tokens like the signal report already does
- Migrated hardcoded `padding`, `margin`, and `gap` values to spacing tokens (`--space-1` through `--space-7`) across 59 style files — single-value, two-value, and three-value declarations that map to the 4 px scale
- Replaced ~750 raw `--vscode-*` CSS variable references with semantic design tokens across 68 style files: surfaces (`--surface-1/2/3`, `--inset`), text (`--text`, `--muted`, `--link`), borders (`--border`), and status accents (`--accent-critical/warning/info`); collapsed redundant fallback chains where the raw variable already resolves through its token
- Fixed 6 test failures caused by the design token migration: updated CSS assertions to match semantic tokens instead of raw `--vscode-*` variables (including the ghost-pixel opaque background guard), fixed signal kind badge exhaustiveness check for hyphenated keys (`slow-op`), and registered dynamically created screenshot element IDs in the wiring test

</details>

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

<details>
<summary>Maintenance</summary>

- The ANR keyword regex used by per-line classification and the pre-production ANR risk scorer is now a single shared definition, so the two cannot drift

</details>

---

For older versions see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).
