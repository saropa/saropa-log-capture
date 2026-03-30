# Changelog Archive

Versions 3.11.0 and prior. For current changes see [CHANGELOG.md](./CHANGELOG.md).

---

## [3.11.0]

Adds clear Settings UI titles for every extension option; fixes the Performance chip, virtual-scroll flicker, jump-button placement, and context-menu submenu clipping. [log](https://github.com/saropa/saropa-log-capture/blob/v3.11.0/CHANGELOG.md)

### Changed

• **Settings UI titles for all extension options** — Every `saropaLogCapture.*` configuration key now has a **`title`** in addition to its description, so VS Code Settings shows a clear row label and search matches work better. English titles are derived from each setting's description (non-English `package.nls.*.json` files use the same strings until translated).

### Fixed

• **Performance chip / title bar control** — The nav **Performance** control opens the Performance block inside **Insights › Session details**. The panel script still looked for the old standalone `#performance-panel` node (removed when Performance moved into Insights), so the control did nothing; the script now targets the embedded `insight-pp-*` markup. Visibility is also stricter now: the chip appears only when session metadata has meaningful performance snapshot metrics or a real samples file path, not just a placeholder snapshot object.

• **Log viewer scroll flicker (filters, tail, end of log)** — Virtual-scroll "hysteresis" used line-index slack, which fails when many lines are height 0: every small scroll rebuilt the viewport DOM and caused flashing. Rebuilds are skipped only when the visible line range is unchanged. Tail-follow (`autoScroll`) now uses a Schmitt-trigger band so distance-to-bottom jitter does not flip follow mode every frame.

• **Jump Top / Bottom on wrong horizontal edge** — Some 3.10.0 installs still used older `left: 8px` positioning. Jump buttons are anchored to the log wrapper's **right** (clear of minimap / scrollbar) again, with a final CSS block so placement cannot be overridden.

• **Context menu submenu clipped at top (short webviews)** — If the viewer is short enough that both vertical flip rules applied, a later CSS rule canceled the "safe top" submenu offset; the offset now takes precedence so flyouts stay below panel chrome.

### Removed

• **Icon bar Replay button** — Session replay is opened from the footer **Replay** control and the log-area replay bar only, not from a sidebar/toolbar entry.

---

## [3.10.0]

This release makes Log Capture more useful day to day with broader ecosystem support and smoother cross-source debugging. [log](https://github.com/saropa/saropa-log-capture/blob/v3.10.0/CHANGELOG.md)

### Added

• **Application / file logs (Phase 3)** — When **Application / file logs** is enabled in integrations and paths are set under `integrations.externalLogs.paths`, the extension **tails** each existing file during the debug session (new lines only after session start), then writes **`basename.<label>.log`** sidecars at session end. The log viewer loads those sidecars with source ids **`external:<label>`** alongside Debug and Terminal; use **Filters → Sources** to show or hide them. Commands: **Saropa Log Capture: Add external log path** (appends to workspace `paths`) and **Saropa Log Capture: Open external logs for this session** (opens sidecars for the log currently loaded in the viewer; shows a short progress notification when there are multiple files). If tailers did not run, session end still falls back to reading the last N lines from each path. See [docs/integrations/application-file-logs.md](docs/integrations/application-file-logs.md) and [docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md](docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md).

• **Unified session log (Phase 4)** — Optional **`saropaLogCapture.integrations.unifiedLog.writeAtSessionEnd`**: after integrations write sidecars, the extension writes **`basename.unified.jsonl`** next to the main log (one JSON line per row: `source` + `text`). Order: full main log, then terminal sidecar, then external sidecars. **`integrations.unifiedLog.maxLinesPerSource`** (default 50k) truncates each stream from the tail if needed. The unified viewer load also computes **run navigation** boundaries and **smart bookmarks** like normal `.log` loads. Open the `.unified.jsonl` file in the log viewer to use the same **Sources** filter as a multi-file session. See [docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md](docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md).

• **Saropa Lints integration (Phase 3 — Log Capture)** — When generating a bug report, if `violations.json` (or extension API data) is missing or older than 24 hours and the Saropa Lints extension exposes `runAnalysis`, an information message offers **Continue without refresh**, **Run full analysis**, and **Analyze stack-trace files only** (when the stack has app frames). Analysis runs in a progress notification; stack-scoped runs use `runAnalysisForFiles` when present, otherwise `runAnalysis({ files })`. After refresh, lint data is re-read on the same collect pass.

• **Saropa Lints integration (Phase 4 — Log Capture)** — Health score params for bug report headers prefer `reports/.saropa_lints/consumer_contract.json` (`healthScore.impactWeights` + `healthScore.decayRate`) when present; fallback order is consumer contract → Saropa Lints extension API → built-in constants.

• **Saropa Lints integration (Phase 5)** — Bug report lint tables include an **Explain** link per violation that opens Saropa Lints' **Explain rule** panel. Bug report key findings also highlight critical/high OWASP-mapped issues in the crash file. When adding a session to an investigation, the extension can pin `reports/.saropa_lints/violations.json` so exported investigation bundles keep a lint snapshot.

• **Saropa Lints integration (Phases 1–2)** — Optional integration with the Saropa Lints extension: bug report **Known Lint Issues** section can be filtered by impact level (setting `saropaLogCapture.lintReportImpactLevel`: essential = critical+high only; recommended = +medium; full = all). Section heading shows the filter in use (e.g. "Known Lint Issues (critical + high only)"). When the Saropa Lints extension is installed and exposes its API, Log Capture uses it for violations data and health score params instead of reading the file; otherwise it reads `reports/.saropa_lints/violations.json` and uses built-in constants. Commands **Show code quality for frame** and **Open quality report** are only enabled when the Saropa Lints extension is installed. Design: [docs/integrations/SAROPA_LINTS_INTEGRATION.md](docs/integrations/SAROPA_LINTS_INTEGRATION.md).

• **Saropa Drift Advisor integration** — Optional integration with the Drift Advisor extension: **Drift Advisor** appears in Configure integrations (adapter id `driftAdvisor`). When the Drift Advisor extension is installed, right-click a log line with category `drift-perf` or `drift-query` to show **Open in Drift Advisor** (invokes the Drift Advisor command). The **Show Integration Context** popover shows a **Drift Advisor** block (query count, avg duration, slow count, health) and an **Open in Drift Advisor** button when the session has `meta.integrations['saropa-drift-advisor']`. **Built-in provider (Phase 5–6):** With **driftAdvisor** enabled, session end tries Drift's `getSessionSnapshot()` (5s timeout) or reads workspace `.saropa/drift-advisor-session.json`, then writes session meta and `{logBase}.drift-advisor.json` (Drift's bridge overwrites if it runs later). Schema: [plans/integrations/drift-advisor-session.schema.json](plans/integrations/drift-advisor-session.schema.json). Short user index: [docs/integrations/README.md](docs/integrations/README.md). No dependency on Drift Advisor at install time; when only one extension is installed, no errors. Design: [plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md](plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md).

• **Multi-source view and source filter** — When a log has a `.terminal.log` sidecar (from the Terminal integration), the viewer shows both Debug Console and Terminal output. A **Sources** section in the Filters panel (Filters → Sources) lets you show only Debug output, only Terminal, or both. Quick Filter presets **"Just debug output"** and **"Complete (all sources)"** apply the source filter in one click. Presets can now store a `sources` filter (e.g. `["debug"]`). Reset all filters restores all sources.

### Changed

• **Viewer: blank lines and line numbers** — Blank lines no longer show a severity dot (the vertical severity bar still runs through them for continuity). The line-number counter is hidden on blank lines by default so "double line break" gaps are visually minimal. **Decoration settings** (gear next to the Deco button) now include **Show line number on blank lines** (off by default): when enabled, blank lines show their file line number so references like "see line 53" and Go to Line match the file. The displayed counter uses file line number (idx+1) when available so the sequence never skips.

• **Performance: unified JSONL writer** — When `saropaLogCapture.integrations.unifiedLog.writeAtSessionEnd` is enabled, the unified log writer tails the main log and sidecars from disk instead of reading full files into memory.

• **Performance: external log tailing** — The external log adapter batches `fs.watch` change bursts (debounce) to reduce extension-host stalls under high log churn.

### Fixed

• **Context menu submenu cropped at top (terminal)** — The Copy & Export (and other) submenu could still have its top cut off when the right-click menu was opened near the top of the viewer (e.g. in the terminal panel under the tab bar). The safe top margin is increased (12px → 48px) and the "near top" threshold widened (80px → 100px) so the submenu flyout is pushed down enough to stay below toolbars and panel headers.

---

## [3.9.1]

Fixes footer path gestures: double-click opens the log's containing folder (not its parent), and hold-to-copy path shows a status bar confirmation. [log](https://github.com/saropa/saropa-log-capture/blob/v3.9.1/CHANGELOG.md)

### Fixed

• **Footer: double-click to open folder** — Double-clicking the path in the log viewer footer now opens the folder that contains the current log file (e.g. `reports/20260316`) instead of its parent (`reports`). The extension now reveals the current file in the OS so the file manager opens the correct containing folder.

• **Footer: hold to copy path feedback** — After holding on the footer path to copy it to the clipboard, a status bar message ("File path copied to clipboard") is shown for 2 seconds so users get clear confirmation that the copy succeeded.

---

## [3.9.0]

Improves the log viewer with Insights in a tab, markdown copy, and scrollbar control; fixes text selection while tailing and refines session elapsed display and jump-button placement. [log](https://github.com/saropa/saropa-log-capture/blob/v3.9.0/CHANGELOG.md)

### Fixed

• **Code quality** — Addressed multiple findings: merged duplicate config imports and combined `context.subscriptions.push()` calls in activation; replaced nested ternary in smart bookmarks with explicit if/else; iterated `Set` directly in log viewer (no array copy); refactored viewer action dispatch into two handlers plus small helpers to reduce cognitive complexity and switch case count; introduced `msgStr()` for safe message field string coercion; replaced `void` with `.then(undefined, () => {})` and `parseInt` with `Number.parseInt`. Behavior unchanged.

• **Performance panel script (code quality)** — Replaced negated condition in `getPerformancePanelScript` with a positive check so ID prefix selection satisfies Sonar rule S7735; behavior unchanged.

• **Text selection during tailing** — Selecting text in the log viewer while the log is being written to no longer fails: the viewport uses the existing hysteresis so it skips a full DOM re-render when the visible line range is unchanged, preserving the user's selection. Spacer heights are still updated so scroll height stays correct.

### Changed

• **Session elapsed display format** — Session elapsed time in the log viewer no longer uses clock-style `T+M:SS` (e.g. `T+5:15`). It now uses duration-style text with unit suffixes (e.g. `45s`, `5m 15s`, `1h 5m 15s`, `2d 1h 5m 15s`) so it is unambiguous as elapsed time. Labels in the decoration settings and context menu (Options) were updated from "Session time (T+)" / "Log time (T+)" to "Session elapsed".

• **Jump-to-top / jump-to-bottom buttons** — Buttons are now positioned on the right side of the log area so they do not cover the scrollbar minimap or the native vertical scrollbar when it is enabled. Right offset uses CSS variables `--mm-w` and `--scrollbar-w` so layout stays correct for all minimap sizes and scrollbar settings.

### Added

• **Open Insights in New Tab** — The Insights panel can be opened as a main editor tab for easier reading in a large view. Use the **Open in new tab** (link-external) button in the Insights panel header, or the command **Saropa Log Capture: Open Insights in New Tab**. The tab shows the same content as the sidebar (Cases, Recurring, Hot files, Performance, Environment) and stays in sync with the current log. Close via the tab's × or the panel's Close button.

• **Insights panel: Copy to Markdown** — A copy button in the Insights panel header copies the full case to the clipboard as markdown: current log name, errors/warnings summary, Session details (Performance groups and events from the Current tab), This log (errors and recurring), Your cases, Across your logs (recurring errors and hot files), and Environment. Uses the same `copyToClipboard` message as other viewer copy actions; no loading state (builds synchronously from in-memory state and Performance DOM).

• **Performance panel (Log tab): right-click to copy message** — When the log has no performance data, the explanatory message block in the Log tab is copyable: right-click it and choose **Copy message** to copy the full text to the clipboard. The message wording was clarified (this log file / if Performance is enabled) so it does not imply the user has not enabled the integration.

• **Show scrollbar setting** — New setting `saropaLogCapture.showScrollbar` (default: false) controls whether the native vertical scrollbar is shown in the log viewer. When off, the minimap is the only scroll indicator; when on, the native scrollbar is visible (10px) and the jump buttons keep clear of it.

---

## [3.8.0]

Adds code quality metrics in the viewer, regression hints (blame and first-seen), and smart bookmark suggestions; fixes context menu and selection behavior. [log](https://github.com/saropa/saropa-log-capture/blob/v3.8.0/CHANGELOG.md)

### Fixed

• **Row selection on right-click** — Shift-click row selection in the log viewer no longer disappears when opening the context menu. The viewport re-render after right-click now re-applies the selection highlight so Copy Line, Hide Selection, and other selection-based actions work as expected.

• **Stack trace icons** — Collapsible stack headers in the log viewer now show the correct Unicode triangles (▶ ▼ ▷) instead of the literal escape text `\u25b6` / `\u25bc` / `\u25b7`.

• **Context menu submenu cropped at top** — When the right-click menu was opened near the top of the view (e.g. under a toolbar), the Copy & Export (and other) submenu flyout could have its top cut off. The menu now applies a vertical offset so submenu content stays below a safe viewport margin; when the menu is also near the bottom, the existing "open upward" behavior still wins.

### Added

• **Code quality metrics (Phase 3)** — **Show code quality for frame:** right-click a stack frame in the log viewer → **Show code quality** to open a popover with line coverage %, lint warnings/errors, and doc density for that file. **Open quality report:** open the session's `basename.quality.json` sidecar from the context menu or command palette. **Heatmap:** stack frame lines show a subtle coverage tint (green/yellow/red) when quality badges are enabled. **Bug reports:** new setting `saropaLogCapture.integrations.codeQuality.includeInBugReport` (default false) adds a "Code Quality (referenced files)" section for files with low coverage or lint issues. The viewer receives `meta.integrations.codeQuality` when loading a log. Plan [100](bugs/history/20260318/100_code-quality-metrics.md) implemented.

• **Regression hints** — Correlate errors with Git history for "Introduced in commit X". **Blame-based:** for a source line (e.g. from a stack frame), show "Last changed in commit X" with optional link in the Analysis panel source section and in the error hover. **First-seen:** for recurring errors, show "Introduced in commit X" on Insights recurring cards (and "Recurring in this log") when the first session where the error appeared had Git integration (commit stored in session meta). Commit links respect `saropaLogCapture.integrations.git.commitLinks`. New module: `regression-hint-service` (blame + first-seen session→commit); Git provider now stores `commit` at session start and in session-end meta. Plan [034](bugs/history/20260318/034_plan-regression-hints.md) implemented.

• **Smart bookmarks** — When you open a log file, the extension can suggest adding a bookmark at the first error (or first warning) line if that line is not already bookmarked. One suggestion per file per session; notification shows "First error at line N. Add bookmark?" with **Add bookmark** and **Dismiss**. Settings: `saropaLogCapture.smartBookmarks.suggestFirstError` (default true), `saropaLogCapture.smartBookmarks.suggestFirstWarning` (default false). Plan [038](bugs/history/20260318/038_plan-smart-bookmarks.md) implemented.

---

## [3.7.1]

Stabilizes Project Logs and extension development by fixing a crash, wiring proposed APIs correctly, and aligning Insight → Insights naming. [log](https://github.com/saropa/saropa-log-capture/blob/v3.7.1/CHANGELOG.md)

### Fixed

• **Session panel crash** — Project Logs no longer throws "escapeHtmlText is not defined". Shared helpers `escapeAttr` and `escapeHtmlText` are defined once in the session panel bootstrap; inlined fragments (rendering, events) use them. A runtime test runs the same script combination the webview uses and dispatches a sessionList message to catch missing dependencies.

• **Extension development** — Launch configs include `--enable-proposed-api=saropa.saropa-log-capture` so F5 can use the terminal proposed API when enabled locally. **Publishing:** The extension no longer declares `enabledApiProposals` in `package.json`, so it can be published to the Marketplace. Terminal capture (integrated terminal output) uses the proposed API when available and is skipped gracefully when not (try/catch in `terminal-capture.ts`).

### Changed

• Rename **Insight** menu and panel labels to **Insights** (lightbulb icon in the viewer and command palette entry) for consistency with cross-session Insights terminology.

### Administration

• **Modularized 4 files over 300-line limit.** Split to satisfy the project's 300-line file limit. No behavior or API changes. New/updated modules: `investigation-commands-helpers` (resolve/pick investigation, format insight payload); `session-manager-internals` (applyStartResult, broadcast/watcher helpers); `session-manager-stop` (buildStopSessionDeps); `viewer-insight-panel-script-part-a/b/c` (Insight panel IIFE fragments); `viewer-styles-insight-layout`, `viewer-styles-insight-sections`, `viewer-styles-insight-hero`. Entry points unchanged: `commands-investigation`, `session-manager`, `viewer-insight-panel-script`, `viewer-styles-insight`.

---

## [3.7.0]

Major UX release focused on webview accessibility, a unified Insights panel, smarter Flutter/Dart memory classification, and modularizing large files. [log](https://github.com/saropa/saropa-log-capture/blob/v3.7.0/CHANGELOG.md)

### Added

• **Webview accessibility (a11y)** — Viewer: main landmark on primary content, `aria-live` on line-count so filter/load updates are announced; level flyup "All"/"None" are buttons for keyboard use. Options, Project Logs, and Integrations panels: `role="region"` and `aria-label` on containers; key controls labeled. Focus moves into Options and Project Logs on open and returns to the icon bar on close (Escape or Close). README documents keyboard and screen-reader use; audit at `bugs/028_webview-a11y-audit.md`. Plan [028](bugs/028_plan-webview-accessibility.md) in progress (focus trap and remaining panels pending).

• **Unified Insight panel (single view)** — One scroll, no tabs. The **Insight** panel (icon bar, lightbulb) is a single narrative: **Active Cases** (top 3 + View All), **Recurring errors** (top 5), **Frequently modified files** (collapsed), **Environment** (platforms, SDK, debug adapters; collapsed), and **Performance** (when a log is open). Context-aware: with no log selected you see Cases, Recurring, Hot files, Environment; with a log selected **Performance** (with scope label "Current log: &lt;filename&gt;") and **Recurring in this log** (filtered to errors that appear in the current session) move to the top. **Inline add-to-case:** "+" on each recurring card and hot file opens the Cases section so you can add a session. **requestInsightData** returns errors, statuses, hot files, platforms, sdkVersions, debugAdapters, **recurringInThisLog**, **errorsInThisLog**, and **errorsInThisLogTotal** (when a log is open). **currentLogChanged** triggers refresh of performance and insight data. **14 UX enhancements:** empty states (Cases, Recurring, Hot files); loading states; "This log" single empty message; keyboard nav on section headers (Arrow Up/Down, Enter/Space); scroll into view after add-to-case and create-case; Session details hint; recurring/errors text truncation with full tooltip; "Top 3 of N" for errors-in-log; cases list "N source(s) · Updated X ago"; hero 0/0 and no-data message; sparkline "Session trend" label; export confirmation. Plan 041 (Unified Insight Model) implemented; see `bugs/history/20260317/041_plan-unify-investigation-recurring-performance.md`.

• **Flutter/Dart memory classification** — Memory-related log lines (e.g. memory pressure, heap/VM gen, leak hints) are classified as **Performance** and shown in the Performance panel **Memory** group only when the line has Flutter/Dart context (logcat `I/flutter`/`D/dart` or `package:flutter`/`package:dart`) and a high-confidence phrase (`Memory: N`, memory pressure/usage/leak, old/new gen, retained N, leak detected, potential leak). Reduces false positives from generic "memory"/"heap" in other runtimes. Heuristics are best-effort; see `bugs/001_integration-specs-index.md`.

### Administration

• **Modularized 11 files over 300-line limit.** Split into smaller modules to satisfy ESLint `max-lines` (300, excluding blanks/comments). No behavior or API changes. New modules: `commands-export-insights`, `commands-export-helpers`; `log-session-helpers` (extended); `investigation-search-file`, `investigation-store-io`, `investigation-store-workspace`; `session-manager-routing`, `session-manager-start`, `session-manager-stop`; `viewer-content-body`, `viewer-content-scripts`; `viewer-message-handler-actions`, `viewer-message-handler-investigation`; `log-viewer-provider-state`; `viewer-performance-trends`, `viewer-performance-session-tab`; `viewer-replay-timing`, `viewer-replay-controls`; `viewer-session-panel-investigations`, `viewer-session-panel-events`. Callers still import from the original entry files where applicable.

---

## [3.6.2]

Empty log fixes (late-start fallback for Dart run, 30s recent-child window, runbook and diagnostic message); Project Logs recent-updates indicators and last-viewed tracking; investigation UX improvements. [log](https://github.com/saropa/saropa-log-capture/blob/v3.6.2/CHANGELOG.md)

### Added

• **Late-start fallback** — when output is buffered and no log session exists (e.g. Dart run or Cursor never fired `onDidStartDebugSession`), the extension starts capture using the active debug session so logs are still written.

• **Recent-child alias window** — parent/child fallback now aliases when exactly one owner was created in the last 30s (was 15s) to reduce two-file races for Dart/Flutter.

• **Recent-updates indicators in Project Logs** — Session list shows an **orange** dot for logs that have new lines since you last viewed them, and a **red** dot for logs updated in the last minute. "Last viewed" is updated when you open a session from the list or panel; the list refreshes periodically while a session is recording so the red indicator stays accurate. Active (recording) session continues to use the recording icon only.

• **Investigation UX** — In Project Logs, clicking "+ Create Investigation..." now shows an inline name field in the panel (instead of the VS Code input at the top of the window) so focus stays where the user is looking. Create/Cancel buttons and Enter/Escape keyboard support; loading state ("Creating…") prevents double-submit. Short hint under the Investigations header explains: "Pin sessions and files to search and export together." README clarifies how Investigations differ from Recurring (error-pattern analysis) and Performance (perf analysis).

### Documentation

• Runbook [010](bugs/010_runbook-missing-or-empty-logs.md): clearer steps when a log file is empty or near-empty (enable `diagnosticCapture` to inspect the pipeline; runbook reorganized with first steps up front).

---

## [3.6.1]

Empty log file fixes and capture safeguards: replay all early output, single- and multi-session fallbacks, race guard, buffer timeout warning, and optional diagnosticCapture. [log](https://github.com/saropa/saropa-log-capture/blob/v3.6.1/CHANGELOG.md)

### Added

• **`saropaLogCapture.diagnosticCapture`** (default `false`) — when enabled, logs capture pipeline events (new session, output buffered, output written) to the "Saropa Log Capture" output channel.

• **Single-session fallback** — DAP output for an unknown session id is routed to the single active log session when exactly one exists.

• **Replay all early output for first session** — when creating the first log session, all buffered output (every session id) is replayed into it.

• **Race guard** — if exactly one session was created in the last 5 seconds, a new session is aliased to it instead of creating a second file.

• **Multi-session fallback** — output for an unknown session id with 2+ active sessions is routed to the most recently created session.

• **Buffer timeout warning** — after 30s of buffered output with no log session for that id, a one-time warning is logged to the Saropa Log Capture output channel.

### Fixed

• Empty logs / dropped output regression introduced in 3.1.3 (replay and session routing).

---

## [3.6.0]

Enhanced error analysis with hover popups and inline triage controls. [log](https://github.com/saropa/saropa-log-capture/blob/v3.6.0/CHANGELOG.md)

### Added

• **Error hover popup** — hovering over error badges (CRITICAL/TRANSIENT/BUG) in the log viewer shows a floating popup with classification, crash category, cross-log history, triage status, and fingerprint hash. Includes an "Analyze" button to open the full analysis panel.

• **Error analysis in Analysis Panel** — when analyzing an error/warning line, the panel now includes error-specific sections: classification header with triage controls (open/closed/muted), cross-log timeline sparkline, log occurrence count, and an action bar with Copy Context, Bug Report, Export (.slc/JSON/CSV), and AI Explain buttons.

• **Clickable error badges** — error classification badges in the log viewer are now clickable to open the analysis panel directly for that error line.

• **Per-file coverage badges** — stack frame lines in the viewer now show a coverage percentage badge (green/yellow/red) when a coverage report is configured. Toggleable via Decoration Settings. Badges render on both stack-header and stack-frame lines.

• **Quality sidecar** — session end writes a `quality.json` sidecar with per-file coverage data for referenced code.

• **Coverage parser improvements** — single file read for both aggregate and per-file parsing, Cobertura attribute order flexibility, safe JSON parsing, ambiguous basename guard.

• **Code Quality Metrics integration design doc** — per-file coverage, lint, and doc density overlay for code referenced in log stack traces (`bugs/100_code-quality-metrics.md`).

• **Code Quality Metrics provider** — `codeQuality` integration provider assembles per-file coverage, lint warnings/errors (ESLint JSON), and comment density into an enriched `quality.json` sidecar at session end.

• **Lint report reader** — parses ESLint `--format json` output to extract per-file warning/error counts for log-referenced files.

• **Comment density scanner** — scans referenced source files for comment-to-code ratio and JSDoc/dartdoc coverage on exported symbols.

• **Code quality settings** — `integrations.codeQuality.lintReportPath`, `scanComments`, and `coverageStaleMaxHours` settings for configuring quality data sources.

• **AI module tests** — unit tests for JSONL parser, line formatter, prompt builder, and type helpers (ai-jsonl-parser, ai-jsonl-types, ai-line-formatter, ai-prompt).

• **Bug report tests** — unit tests for keyword extraction and thread-aware stack trace formatting (report-file-keywords, bug-report-thread-format).

• **Crashlytics event parser tests** — unit tests for structured thread parsing, raw trace parsing, device/custom key extraction.

• **Insights export format tests** — unit tests for CSV and JSON export serialization.

### Changed

• **Terminology standardization** — replaced user-facing "session" with "log" across all locales, webview UI, context menus, performance panel, error analysis, error hover, walkthrough docs, and setting descriptions (per CONTRIBUTING.md). Fixed grammatical gender/case/particle agreement in de, ru, es, pt-br, it, ko locale files. Internal identifiers, setting keys, command IDs, and "debug session" (VS Code concept) are unchanged.

• **Updated feature discipline rule** in `.claude/rules/global.md` — replaced stale reference to non-existent `docs/PLAN_SAROPA_LOG_CAPTURE.md` with references to `ROADMAP.md` and `bugs/*.md` plans.

• **Added nyc coverage configuration** with Istanbul instrumentation, text/lcov/HTML reporters, and 50% threshold gates. Uses nyc instead of c8 because c8 cannot collect V8 coverage from VS Code's Extension Host process.

• **CI now runs coverage** instead of plain tests, and uploads the coverage report as an artifact (14-day retention).

• **Added coverage badge** to README linking to CI runs.

## [3.5.4]

Replay controls redesigned for a cleaner, less intrusive UX. [log](https://github.com/saropa/saropa-log-capture/blob/v3.5.4/CHANGELOG.md)

### Changed

• **Replay panel is now horizontal and anchored to the bottom-right** of the log area, replacing the tall vertical strip that obscured content.

• **Top/Bottom jump buttons moved to the left side** so they no longer overlap the scrollbar minimap.

• **Replay button added to the viewer footer** (before the version number) for quick access without the floating toggle.

### Removed

• **Removed the floating replay toggle button** that overlapped the top-right corner. Replay is now triggered from the footer button or the icon bar.

## [3.5.3]

[log](https://github.com/saropa/saropa-log-capture/blob/v3.5.3/CHANGELOG.md)

### Fixed

• **Resolved all 32 eslint warnings across the codebase.** Addressed strict equality (`!==`), unused variables, missing curly braces, excessive nesting (`max-depth`), too many function parameters (`max-params`), and files exceeding the 300-line limit (`max-lines`). Extracted helper functions and split large files to improve maintainability.

• **Replay controls no longer overlap the minimap.** The replay toggle and panel now offset by the minimap width, respecting all size settings (small/medium/large).

### Changed

• **Consolidated three status bar items into one.** Pause icon, line count, and watch counts now appear in a single status bar entry instead of separate items. Pause/resume remains available via command palette.

• **More integrations enabled by default.** New installs now start with `packages`, `git`, `environment`, `performance`, and `terminal` enabled (previously only `packages` and `performance`). All are lightweight, broadly applicable, and no-op when not relevant.

• **Clearer integration performance notes.** Each adapter now shows a warning icon when it has meaningful performance cost, needs external configuration, or is platform-specific. "When to disable" text updated to explain prerequisites (e.g. "you haven't configured a report path").

• **Removed integration adapter names from status bar.** The status bar no longer lists which adapters are active — it was cluttering the bar and confusing users. Integration info is still available in the Options panel.

### Removed

• **Standalone Crashlytics status bar indicator.** The always-visible Crashlytics status bar item has been removed to reduce clutter. Crashlytics setup status is still available in the viewer panel.

### Added

• **Session time (T+) toggle in context menu.** Options submenu now includes a quick toggle for session elapsed time, matching the gear panel checkbox.

---

## [3.5.2]

[log](https://github.com/saropa/saropa-log-capture/blob/v3.5.2/CHANGELOG.md)

### Fixed

• **Publish script spawns unwanted windows on Windows.** Extension listing now reads the filesystem (`~/.vscode/extensions/`, `~/.cursor/extensions/`) instead of calling `code --list-extensions` / `cursor --list-extensions`, which spawned persistent editor windows. Added `CREATE_NO_WINDOW` flag to all subprocess calls to suppress cmd.exe console flashes. Marketplace browser open after publish is now prompted instead of automatic.

• **Stray .meta.json files polluting user projects.** A fallback code path wrote `.meta.json` sidecar files next to arbitrary files across workspace folders instead of using the central metadata store. Removed the sidecar write path entirely — all metadata now goes through `.session-metadata.json` only. On activation the extension scans for and deletes orphan `.meta.json` sidecars that match its format, cleaning up affected projects automatically.

### Added

• **Getting Started walkthrough command.** Added `Saropa Log Capture: Getting Started` command to open the VS Code walkthrough directly, plus an "About Saropa" step with ecosystem and company info. The walkthrough auto-opens on first install.

• **OWASP Security Context in bug reports.** Bug reports now include a "Security Context" section when crash-related files have OWASP-mapped lint violations, showing categories (M1–M10, A01–A10) with affected rules. OWASP findings also appear in Key Findings.

## [3.5.1]

Replay controls now live in a compact floating vertical panel instead of a full-width horizontal bar. [log](https://github.com/saropa/saropa-log-capture/blob/v3.5.1/CHANGELOG.md)

### Added

• **Create Bug Report File.** Right-click selected lines in the log viewer and choose "Create Bug Report File" to auto-create a comprehensive `.md` report. Includes selected text, session info, full decorated output (in a collapsible block), cross-session analysis, environment details, and user-fillable sections. Also available from the Command Palette (without selection).

• **`saropaLogCapture.reportFolder` setting.** Configure where bug report files are created (default: `bugs/`, relative to workspace root).

### Changed

• **Replay bar: collapsible vertical layout.** The replay controls (play/pause/stop, mode, speed, scrubber) are now a floating vertical panel toggled by an icon in the top-right corner of the log area. The bar is hidden by default — no more wasted vertical space when you're not replaying. The vertical scrubber stretches to fill the available height.

## [3.5.0]

Track elapsed session time with T+ decorations in the log viewer, and get instant codebase context from project health scores and lint breakdowns in bug reports. [log](https://github.com/saropa/saropa-log-capture/blob/v3.5.0/CHANGELOG.md)

### Added

• **Session time (T+) decoration.** New "Session time (T+)" checkbox in the decoration settings panel shows elapsed time from the first log line (e.g., `T+0:00`, `T+3:42`, `T+1:23:42`). Hours appear only when elapsed exceeds 1 hour; days appear only past 24 hours. Respects the existing milliseconds toggle. Can be shown independently of or alongside the wall-clock timestamp.

• **Project health score in bug report header.** Shows "Project health: N/100" with tier and total violation count when lint data is available.

• **Per-impact breakdown in Known Lint Issues section.** Lists non-zero violation counts by impact level (critical, high, medium, low, opinionated) above the violations table.

### Changed

• Bug report staleness message now says "Run analysis in Saropa Lints" instead of `dart run custom_lint` when the Saropa Lints VS Code extension is detected in the workspace.

### Removed

• **Cursor IDE warning.** Removed the startup warning for Cursor IDE users — log capture works fine in Cursor.

--

## [3.4.3]

Auto-hide patterns let you permanently suppress matching log lines with a right-click, plus a management modal to review and remove patterns. [log](https://github.com/saropa/saropa-log-capture/blob/v3.4.3/CHANGELOG.md)

### Added

• **Auto-hide patterns.** Select text in the log viewer, right-click > Hide, and choose "Hide Selection (Always)" to permanently suppress matching lines across all sessions. Patterns are stored in `saropaLogCapture.autoHidePatterns` setting. "Hide Selection" and "Hide Selection (This Session)" hide for the current session only.

• **Auto-hide pattern management modal.** Double-click the hidden counter in the footer to view and remove auto-hide patterns (both session and persistent).

### Changed

• Renamed "Hide Lines" context submenu to "Hide".

• Hidden counter in footer now shows icon + count only (no background pill or "hidden" text), matching the style of other filter indicators.

• Peek mode now reveals both manually hidden and auto-hidden lines.

### Fixed

• Auto-hide now applies to stack headers and repeat notifications, not just regular lines.

• Hidden counter no longer double-counts lines that are both manually hidden and auto-hidden.

• Session auto-hide patterns are cleared when the viewer is cleared.

• Removed redundant "Hide Selection" context menu item (kept "This Session" and "Always").

• Single-quote characters in auto-hide patterns are now HTML-escaped in the management modal.

• Auto-hidden count is decremented before splice in trimData, preventing incorrect counts after trim.

---

## [3.4.2]

Tames the overflowing context menu by grouping copy and export actions into a submenu, and splits six files that exceeded the 300-line limit into focused modules. [log](https://github.com/saropa/saropa-log-capture/blob/v3.4.2/CHANGELOG.md)

• **Viewer context menu: Copy & Export submenu.** The right-click menu was too long and could overflow the screen. Copy, Copy Line, Copy All, Copy All Decorated, Copy as snippet, Copy with source, Select All, and Export current view are now under a **Copy & Export** submenu; **Copy to Search** is in the same submenu after a separator. Behavior and visibility rules are unchanged; existing tests pass.

• **Modularized files over 300-line limit.** Split investigation commands (share/export into `investigation-commands-share.ts`, `investigation-commands-export.ts`), l10n strings into `l10n/strings-a.ts` and `l10n/strings-b.ts`, .slc bundle logic into `slc-types.ts`, `slc-session-files.ts`, `slc-session.ts`, and `slc-investigation.ts`, Build/CI API fetchers into `build-ci-api.ts`, and viewer-styles (Crashlytics setup/diagnostic, options integrations/shortcuts) into dedicated style modules. No behavior changes; existing tests and public API unchanged.

---

## [3.4.1]

[log](https://github.com/saropa/saropa-log-capture/blob/v3.4.1/CHANGELOG.md)

### Fixed

• **Extension activation on Cursor IDE** — Cursor wraps VS Code APIs differently from stock VS Code, so `vscode.debug.onDidReceiveDebugSessionCustomEvent` could be `undefined` during activation. The extension now guards the subscription and logs a one-time warning instead of crashing.

---

## [3.4.0]

In this version we add paginated Project Logs and Export Insights Summary; improve Crashlytics setup and Share Investigation (LAN, file links, Gist docs); introduce Explain with AI, Share Investigation (Gist/LAN/upload/shared folder), Build/CI API sources, and performance/crash-dump options; fix empty logs (replay and single-session fallback), session summary Open Log, CSP unsafe-inline, replay speeds and bar visibility, viewer in new window, and session list time display; and consolidate Marketplace URL config, viewer decorations, and correlations into the Session Timeline. [log](https://github.com/saropa/saropa-log-capture/blob/v3.4.0/CHANGELOG.md)

### Added

• **Project Logs: pagination.** The session list in the Project Logs panel is now paginated so 100+ sessions load and scroll without lag. Only the current page is rendered; a bar shows "Showing X–Y of Z" with Previous/Next when there are multiple pages. Page size defaults to 100 and is configurable via **Saropa Log Capture › Session List Page Size** (`saropaLogCapture.sessionListPageSize`, 10–500). Page resets when you refresh, change date range, or other filters. Plan [028](bugs/history/20260313/028_plan-lazy-load-session-list.md) completed.

• **Export Insights Summary.** Export recurring errors and hot files as CSV or JSON for reports or tooling. Command **Saropa Log Capture: Export Insights Summary** (or **Export summary** from the Cross-Session Insights panel or Recurring Errors slide-out): choose scope (current session, current investigation, last 7 days, or all sessions), format (CSV/JSON), then save. Output includes error signatures, counts, sessions, sample lines, first/last seen; hot files with session counts; and meta (session count, time range, exported-at). Capped at 500 errors and 500 files per export. Plan [032](bugs/history/20260313/032_plan-export-insights-summary.md) completed.

• **Crashlytics: setup automation and help when connection fails.** (1) **Setup:** Step 1 shows an OS-specific install one-liner (e.g. `winget install -e --id Google.CloudSDK` on Windows) with Copy; Step 2 includes “run in external terminal” hint with copyable auth command and a note about `saropaLogCapture.firebase.serviceAccountKeyPath` for a service account JSON key; Step 3 offers “Use existing file: …” when a workspace `google-services.json` is found. (2) **Checklist:** Setup wizard shows a one-line status (✓ gcloud · ✗ token · ○ config). (3) **When connection fails:** Copy diagnostic (plain text for support or terminal), Show Output (Saropa Log Capture channel), and Open Firebase Console (project-specific when available); same actions on “Query failed” (e.g. 404). (4) **Status bar:** “Crashlytics: ready” or “Crashlytics: complete setup in panel” so setup state is visible without opening the panel; updates on workspace change and after panel refresh. (5) **Service account key:** New setting `saropaLogCapture.firebase.serviceAccountKeyPath` (path to a Google Cloud service account JSON key). When set, the extension uses it for Crashlytics API access instead of gcloud (useful in CI or when gcloud is not available). (6) **In-app documentation:** All setup, auth, config, APIs, caching, troubleshooting, and architecture are in the Crashlytics panel **Help** section and contextual "If this doesn't work" hints; no external doc. Plan [030](bugs/history/20260313/030_plan-crashlytics-setup-and-help.md) completed.

• **Options: Keyboard shortcuts screen.** The keyboard shortcuts reference is now available from the viewer: open **Options** (gear) → **Keyboard shortcuts…** to see power shortcuts (Ctrl+F, Space, M, P, etc.) and key commands (Command Palette). Double-click a **power shortcut** row to rebind it (then press the new key; Escape cancels); double-click a **command** row to open VS Code Keyboard Shortcuts (Ctrl+K Ctrl+S) focused on that command. Same slide-out panel pattern as Integrations; back returns to Options.

• **Configurable viewer keybindings.** Power shortcuts (panel viewer) are rebindable. Setting `saropaLogCapture.viewerKeybindings` (object: actionId → key descriptor, e.g. `"togglePause": "p"`) persists overrides; defaults are used when a key is not overridden. Keybindings are sent to the viewer on load and when the setting changes. Status bar shows "Press a key for [action] (Escape to cancel)" when recording. Plan [040](bugs/history/20260313/040_plan-configurable-viewer-keybindings.md) completed.

• **Docker integration: includeInspect and --until.** (1) New setting `integrations.docker.includeInspect` (default `false`): when enabled, full `docker inspect` output is written to `${baseFileName}.container-inspect.json` and referenced in meta as `inspectSidecar`. (2) Container logs are now bounded by session end: `docker logs` uses `--until <endEpoch>s` with a 60s lag so logs are clipped at session end instead of relying only on `--tail`. Plan [007](bugs/history/20260313/007_plan-docker-inspect-and-until.md) completed and moved to history.

• **Share Investigation follow-ups.** (1) **Gist expiration:** Documented that secret gists do not expire; README and Gist README / Share quick-pick describe how to delete old gists (GitHub → Your gists → Delete). (2) **LAN + import:** Import from URL now accepts same-network `http` (e.g. `http://192.168.1.5:port/investigation.slc`) in addition to `https`; private/LAN hosts (127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16–31.x.x) are allowed. (3) **Copy deep link (local file):** New Share menu option exports the investigation to a .slc file (save dialog), then copies a `vscode://…/import?url=file:///…` link to the clipboard; import supports `file://` URLs for local .slc files. (4) **UX and UI:** Doc and README clarify how to open a shared .slc (Investigation panel → **Open .slc file** or Command Palette → **Import .slc Bundle**). Investigation panel now has an **Open .slc file** button (with and without an active investigation) so recipients can open a shared file without using the command palette; toast and Share menu description point to this flow.

• **Central errors module.** New `src/modules/analysis/errors.ts` re-exports error types and helpers from level-classifier, error-fingerprint, error-rate-alert, and the ErrorStatus type from error-status-store. Provides a single import path for AI explain-error and other features that need “is this an error line?” and “what kind of error?”.

• **Explain with AI (Phase 1).** Right-click a log line → **Explain with AI** to get an explanation from the VS Code Language Model (e.g. GitHub Copilot). Requires **Saropa Log Capture > AI: Enabled** in Settings and an installed LM extension. Context is built from the error line and surrounding lines (±10 by default; configurable via `saropaLogCapture.ai.contextLines`). Response is shown in a notification with **Copy** and **Show details** (webview panel).

• **Explain with AI (Phase 2): rich context.** Stack traces are extracted from the log (e.g. "at …", "#0 …", "(file:line)") and included in the AI prompt and in the explanation panel. Integration data (performance, HTTP requests, terminal output) around the error time is loaded from sidecars and session meta and included when `saropaLogCapture.ai.includeIntegrationData` is on (default). The **Show details** panel now has sections for the error line, stack trace, context at error time, and the AI explanation.

• **Explain with AI (Phase 3): polish.** Explanations are cached in memory (configurable via `saropaLogCapture.ai.cacheExplanations`; default on) so the same error returns instantly. Optional model preference: `saropaLogCapture.ai.modelPreference` (e.g. `copilot`, `claude`) filters available chat models. Multi-line selection: when you select several log lines and right-click → **Explain with AI**, the selection is sent as the error block and context is built around it. The explanation panel has a **Copy explanation** button; notifications show "(cached)" when the result came from cache.

• **Explain with AI: localization and loading feedback.** All user-facing strings for the feature use `l10n.ts` (and `package.nls.json` for the AI enabled setting description). A progress notification ("Explaining with AI…") is shown while context is built and the model is called. Cache eviction refreshes LRU when an existing key is re-set.

• **Share Investigation.** Share an investigation via GitHub Gist or export as .slc file. From the Investigation panel click **Share** or run **Share Investigation** from the command palette: choose **Share via GitHub Gist** (requires GitHub sign-in; creates a secret gist and a `vscode://` deep link) or **Export as .slc file**. **Share on LAN** starts a temporary HTTP server on this machine and gives a download URL for teammates on the same network (Copy URL / Stop server). **Upload to configured URL** (when `share.uploadPutUrl` is set) PUTs the .slc to a presigned S3/Azure or other URL. **Save to shared folder** (when `share.sharedFolderPath` is set) writes the .slc to a team path (absolute or relative to workspace). Recipients open the link or file in VS Code to import the investigation (read-only). **Recent shares** (last 10) are stored in workspace state; use **Recent shares…** in the Share menu to copy a link again. Command **Clear share history** removes stored links (does not delete gists). Settings: `saropaLogCapture.share.gistPublic`, `saropaLogCapture.share.includeNotes`, `saropaLogCapture.share.uploadPutUrl`, `saropaLogCapture.share.sharedFolderPath`. Import from URL is supported via `vscode://saropa.saropa-log-capture/import?url=...` or `?gist=...`. Large investigations (>50 MB) show a warning before upload.

• **Build/CI: API sources (GitHub Actions, Azure DevOps, GitLab CI).** Build/CI integration can now use API-based sources instead of only a file. New setting `integrations.buildCi.source` (default `file`): `file` (existing last-build.json), `github`, `azure`, or `gitlab`. For GitHub, the extension calls the Actions API with the repo from git remote and current branch; for Azure/GitLab, set `azureOrg`/`azureProject` or `gitlabProjectId` (and optional `gitlabBaseUrl`). Tokens are stored in VS Code SecretStorage. Commands: **Saropa: Set Build/CI GitHub Token**, **Saropa: Set Build/CI Azure PAT**, **Saropa: Set Build/CI GitLab Token**, and matching Clear commands. API fetches run asynchronously after session start (10s timeout) and append build status and link to the log header and session meta when available.

• **Options: master capture switch.** The Options panel (gear) now has a **Capture** section at the top with **Enable log capture**. When off, no log files are created during debug sessions (same as `saropaLogCapture.enabled` in Settings). The checkbox is synced on load and when toggled.

• **Performance: always-on by default and clearer UX.** Performance integration is now in the default `integrations.adapters` (with `packages`), so new workspaces capture a system snapshot (CPUs, RAM) for every session without turning it on per session. The Performance icon in the icon bar is shown only when Performance is enabled. Project Logs list shows a small performance icon next to logs that have performance data. When you open a log that has performance data, a **Performance** chip appears in the session bar; clicking it opens the Performance panel. The Session tab explains clearly that data cannot be added to an existing log and how to get it for the next run; overhead note added.

• **Viewer icon bar: optional labels and bar-click toggle.** The log viewer’s vertical icon bar (Project Logs, Search, Bookmarks, etc.) can show text labels next to each icon. Click the bar background or the separator between icon groups (not on an icon) to toggle labels on or off. The choice is persisted in webview state so it survives reloads.

• **Project Logs: multi-select with Ctrl/Cmd-click.** In the Project Logs panel you can Ctrl-click (or Cmd-click on macOS) to select multiple sessions. The context menu then applies to all selected items: Copy Deep Links / Copy File Paths (newline-separated to clipboard), Export (one file per session), Tag (dialog per session), Open (each in turn), Replay (first selected). Single-item behavior is unchanged. Trash panel remains single-selection.

• **Capture diagnostics for empty logs.** New setting `saropaLogCapture.diagnosticCapture` (default `false`). When enabled, the extension logs capture pipeline events to the "Saropa Log Capture" output channel: new log session created, output buffered (no session yet), and output written to log (once per session).

• **Single-session output fallback.** If DAP output arrives under a session id that has no log session yet, but there is exactly one active log session, that output is now routed to that session and written to the log instead of being buffered indefinitely.

• **Replay all early output when creating the first session.** Output that arrives before any log session exists is buffered by session id. We used to replay only the buffer for the session that had just started, so output that had been tagged with a different id was never replayed and the log stayed empty. When we create the first log session we now replay every buffered session’s output into that session, so no early output is dropped.

• **Why it broke after v3.1.3:** The 3.1.3 refactor (modularization only) likely changed the order/timing of tracker registration and event delivery. Output then often arrived before a session existed or under a different session id; we only replayed the “just started” session’s buffer, so other output was dropped. The fixes above (replay all early output + single-session fallback) address that.

• **Race guard when creating a session.** If we're about to create a new log session but exactly one session was created in the last 5 seconds (e.g. the other half of a parent/child pair), we now alias the new session to that one instead of creating a second file. Fixes the case where Project Logs shows the file but it stays empty because output went to a different log file created in the same run.

• **Multi-session fallback.** When output arrives for an unknown session id and there are 2+ active log sessions, we now route that output to the most recently created session so it is not dropped. Ensures at least one file receives output when a race created two files.

• **Buffer timeout warning.** If output has been buffered for a session id for over 30 seconds with no log session ever created, we log a one-time warning to the Saropa Log Capture output channel so you can see that capture may be misconfigured or the session never started.

• **Performance integration: profiler output copy and process memory.** New setting `integrations.performance.profilerOutputPath` (default empty): at session end, an external profiler file (e.g. `.cpuprofile`, `.trace`) is copied into the session folder when the path is set (supports `${workspaceFolder}`; 100 MB max). New setting `integrations.performance.processMetrics` (default `false`): when enabled, the extension captures the debug target process memory (MB) from the DAP `process` event and records it in the performance snapshot and session meta. Process memory is read at session end (Windows: PowerShell; Linux: `/proc/<pid>/status`; macOS: `ps`). If the adapter does not send a process ID or the read fails, the field is omitted.

• **Integrations: dedicated screen from Options.** The Options panel no longer lists all integration checkboxes inline. A single **Integrations…** button opens a dedicated Integrations screen (same slide-out, view switch) with back navigation. Each adapter now has a long description, a performance note, and when-to-disable guidance. This reduces clutter and makes it easier to choose adapters and understand cost.

• **Crash dumps: copy into session folder.** New setting `integrations.crashDumps.copyToSession` (default `false`). When enabled, discovered crash dump files are copied into the session output folder so the session is self-contained. Total copy size is capped at 500 MB; duplicate basenames get a numeric suffix. The sidecar JSON includes a `copiedTo` path per file and `copiedCount` in meta.

### Fixed

• **Session summary "Open Log" button.** The "Open Log" action in the notification shown after a session ends now opens the completed log file. Previously it ran the open command, which only opens the active session; after finalize there is no active session so nothing happened. The summary now carries the log URI and opens it directly. [bugs/history/20260313/fix-session-summary-open-log.md](bugs/history/20260313/fix-session-summary-open-log.md)

• **CSP: remove unsafe-inline from viewer.** Viewer and Session Comparison webviews no longer use `'unsafe-inline'` in Content-Security-Policy `style-src`. Session-perf chip and hidden-lines counter visibility are toggled via the `.u-hidden` class (in nonced styles) instead of inline styles. Plan [027](bugs/history/20260313/027_plan-csp-remove-unsafe-inline.md) completed.

• **Viewer load: TypeScript and lint.** Restructured performance-data block in `log-viewer-provider-load.ts` so the try/catch parses correctly (no return inside try). Replaced `!=` with `!==` for eqeqeq. GitHub auth session check in extension activation now uses `vscode.authentication.getSession(..., { createIfNone: false })` instead of removed `getSessions`. Build/CI fetch no longer casts headers to `HeadersInit` (type not in project lib). Docs: `cross-session-analysis.md` paths for error-fingerprint updated to `src/modules/analysis/error-fingerprint.ts`.

• **Session replay: more speeds, 0.5x display, and bar visibility.** Replay speed dropdown now includes 0.1x, 0.25x, 0.75x, and 10x (in addition to 0.5x, 1x, 2x, 5x). Selecting 0.5x (half speed) now correctly shows and applies the chosen speed instead of appearing unchanged. The replay bar (Play, Pause, Stop, Mode, Speed, scrubber) is now shown whenever a log file with lines is loaded, so replay options are visible without clicking the replay icon first; the bar remains visible after stopping replay. Default speed setting allows 0.1x–10x. Replay bar uses a short fade-in when shown.

• **Viewer in new window: clicks on sessions now open log content.** Opening the Saropa Log Capture tab in a new window (e.g. via "Open in New Window") left the session list visible but clicking a session did not show log content in that window. The sidebar log viewer is a WebviewView; VS Code resolves one view per window. The extension now tracks all resolved views and broadcasts load/postMessage to each, so the viewer in the window where you click receives the content. Batch timer and badge updates were adjusted for multi-view (stop timer only when the last view is removed; update badges on all views).

• **Session list file time display.** Time in the Project Logs session list was inconsistent: some entries showed relative time ("X hrs ago"), some showed clock time, and some showed nothing (e.g. when day headings were on and the file was older than 24 hours). The panel now always shows a time (relative when &lt; 24h, otherwise clock time). When session metadata has no valid mtime, the extension falls back to filesystem stat so the list always has a time when the file exists. Loading state is shown while the list is built after tree data changes.

### Changed

• **Marketplace URL: single source of truth.** Extension marketplace links (changelog, item page, bug report header, Gist README) now use `src/modules/marketplace-url.ts`. Fork maintainers can change the base URL in one place for Open VS X or other hosts. About panel changelog link only opens when URL has been set (guards against click before content load). Plan [029](bugs/history/20260313/029_plan-marketplace-url-config.md) completed.

• **Viewer: blank lines and decorations.** Blank lines are defined as lines whose text is empty or only whitespace (spaces, tabs, Unicode whitespace) via a single regex (`/^\s*$/`). Such lines never show the decoration prefix (counter, timestamp, chevron). When "Hide blank lines" is on, those same lines are hidden. When shown, blank lines keep the severity bar (inherited from the previous line) and line tint for visual continuity.

• **Viewer: clearer decoration labels and Timestamp in context menu.** The "Line prefix" option is renamed to **Line decorations (dot, number, time)** in both the right-click context menu and the Options panel so it's clear it controls the severity dot, counter, and time in the left margin. A **Timestamp** toggle was added to the context menu (Options submenu) so per-line timestamps can be shown or hidden without opening the Options panel; turning Timestamp on from the menu enables line decorations if they were off.

• **Correlations: integrated into Session Timeline.** The correlations list no longer appears as a separate sidebar view. When you open a session timeline, detected correlations are shown in a block directly in the timeline panel (below the toolbar), with "Jump to event" links. The section is only shown when there are correlations for that session, keeping the timeline as the single place for events and correlation context.

---

## [3.3.0]

Auto-correlation across debug, HTTP, perf, and terminal in the Session Timeline; Git line history and commit links in session meta; and Investigation Mode Phase 3–4 (export/import, bug-report context, and UX polish). [log](https://github.com/saropa/saropa-log-capture/blob/v3.3.0/CHANGELOG.md)

### Added

• **Auto-correlation detection.** When the Session Timeline is opened, the extension detects related events across sources (debug, HTTP, perf, terminal) within a configurable time window. Correlated events show a link badge (▶) in the timeline and in the log viewer; clicking the badge highlights all related events. New **Correlations** sidebar view lists detected correlations for the last opened timeline session with "Jump to event" links. Settings: `correlation.enabled`, `correlation.windowMs`, `correlation.minConfidence`, `correlation.types`, `correlation.maxEvents`. Detection runs after timeline load with a brief "Detecting correlations…" phase when enabled.

• **Git: line history in session meta and commit links.** When `integrations.git.includeLineHistoryInMeta` is enabled, at session end the extension parses the log for file:line references (Dart, JS/TS, Java-style stack traces), runs `git blame` for each (capped at 20, 2s timeout per blame), and stores a `lineHistory` array in session meta. New setting `integrations.git.commitLinks` (default `true`) resolves commit hashes to web URLs (GitHub, GitLab, Bitbucket) and adds them to line history meta and to the blame status bar when opening source from a log line. Blame display shows a brief "Git blame…" loading message until the result is ready.

• **Investigation Mode: Export, import, and integration (Phase 3).** Investigations can be exported as `.slc` bundles (manifest v3) with all pinned sources and sidecars; import recreates the investigation in the workspace. Bug reports now include an optional "Investigation Context" section (name, pinned sources table, recent search, notes) when an investigation is active. "Generate Bug Report" in the investigation panel produces a report from investigation context. Export and import show notification progress.

• **Investigation Mode: UX polish (Phase 4).** Project Logs panel shows an "Investigations" section with list and "Create Investigation…"; clicking an investigation opens it, creating sets active. Session context menu includes "Add to Investigation". New command "New Investigation from Sessions…" multi-selects sessions and creates an investigation with them. All new user-facing strings are localized (en + placeholder in other locales).

---

## [3.2.1]

Fixes empty log file when Flutter/Dart child session starts before parent so a single file captures all debug output. [log](https://github.com/saropa/saropa-log-capture/blob/v3.2.1/CHANGELOG.md)

### Fixed

• **Flutter/Dart: empty log file when child session starts before parent.** When the Dart VM (child) debug session started before the Flutter (parent) session, the extension created a second log file for the parent that never received output. The parent now reuses the child's log session so a single file captures all debug output.

---

## [3.2.0]

Investigation Mode Phase 2 (cross-source search), Cursor IDE compatibility warning, empty state watermark, file info panel, and empty-line decoration fix. [log](https://github.com/saropa/saropa-log-capture/blob/v3.2.0/CHANGELOG.md)

### Added

• **Investigation Mode: Cross-source search (Phase 2).** Search across all pinned sources in an investigation, including auto-resolved session sidecars (`.terminal.log`, `.requests.json`, `.events.json`, `.queries.json`, `.browser.json`). Features include:
• Search options: case sensitivity, regex mode, configurable context lines
• Search history dropdown with last 10 queries
• Progress bar showing file-by-file search status
• Cancellation support (new search auto-cancels previous)
• Large file handling with warning badges (>10MB searched partially)
• Missing source detection with warning badges
• Context lines before/after matches (dimmed, clickable)

• **Cursor IDE (in)compatibility warning.** Detects when running in Cursor IDE and warns that debug output capture may not work due to differences in the Debug Adapter Protocol implementation. Shows a one-time dismissible notification with workaround guidance.

• **Empty state watermark.** When log content is empty, a centered watermark now displays with context-aware messages ("Empty log file" or "No log entries") instead of a blank area.

• **File info panel.** A metadata panel at the bottom of the log viewer shows file name (clickable to reveal), folder (clickable to open), modification date/time, and stats (line count, file size, errors, warnings, performance issues).

### Fixed

• **Empty lines no longer show decoration prefixes.** Blank or whitespace-only lines now skip counter and timestamp decorations, matching the existing behavior for severity bars.

---

## [3.1.3]

Modularized six oversized files, fixed replay bar when log is empty, and aligned @types/vscode with engine for packaging. [log](https://github.com/saropa/saropa-log-capture/blob/v3.1.3/CHANGELOG.md)

### Changed

• **Modularized 6 files exceeding 300-line limit.** Split `extension-activation.ts`, `context-loader.ts`, `investigation-panel.ts`, `timeline-panel.ts`, `viewer-panel-handlers.ts`, and `viewer-context-popover.ts` into smaller focused modules. Extracted types, handlers, scripts, and styles into dedicated files. No behavior changes — pure refactoring.

### Fixed

• **Replay bar no longer appears when log is empty.** Added defense-in-depth guards to prevent the replay controls from showing "0 / 0" when no log lines are loaded. The replay icon and bar now require lines to exist before becoming visible, and the state is re-evaluated after file load completes.

• **Aligned `@types/vscode` with `engines.vscode` for packaging.** Downgraded `@types/vscode` from `^1.110.0` to `^1.105.0` to match the engine constraint, fixing vsce packaging error on Cursor-compatible builds.

---

## [3.1.2]

Enables Cursor IDE compatibility by lowering the VS Code engine requirement to 1.105.0. [log](https://github.com/saropa/saropa-log-capture/blob/v3.1.2/CHANGELOG.md)

### Changed

• **Lowered VS Code engine requirement to 1.105.0.** Enables installation in Cursor IDE (which uses VS Code 1.105.1). The extension does not use any APIs requiring 1.108+.

---

## [3.1.1]

Failed release (reverted) — the engine change was incorrectly applied and had to be redone in 3.1.2. [log](https://github.com/saropa/saropa-log-capture/blob/v3.1.1/CHANGELOG.md)


~~### Changed~~

• ~~**Lowered VS Code engine requirement to 1.105.0.** Enables installation in Cursor IDE (which uses VS Code 1.105.1). The extension does not use any APIs requiring 1.108+.~~

---

## [3.1.0]

Major feature release: unified timeline view correlates all log sources on one time axis, context popovers show related data around any log line, and you can now hide/unhide lines manually. [log](https://github.com/saropa/saropa-log-capture/blob/v3.1.0/CHANGELOG.md)

### Added

• **Unified Timeline View.** Correlate all data sources (debug console, terminal, HTTP, performance, Docker, browser, database, events) on a single time-synchronized view. Access via right-click session → Show Timeline. Features include: source filter checkboxes with color coding, time range scrubber with draggable handles and zoom controls (+/−/reset), minimap showing event density with click-to-navigate, virtual scrolling for 100k+ events, keyboard navigation (arrow keys + Enter), and export to JSON/CSV. Click any event to jump to the source log line or sidecar file.

• **Context Popover for integration data.** Right-click a log line → Actions → Show Integration Context to see a floating popover with performance, HTTP requests, terminal output, and Docker status from ±5 seconds around that line. Configurable time window via `saropaLogCapture.contextWindowSeconds` setting.

• **Volume slider plays preview sound.** When adjusting the audio volume slider in Options, a preview sound now plays after you stop dragging, so you can hear the actual volume level. Debounced to avoid spamming sounds while adjusting.

• **Hide Lines feature.** Manually hide log lines via right-click → Hide Lines submenu. Options include: Hide This Line (single row), Hide Selection (shift+click range), Hide All Visible (all currently shown lines), and corresponding Unhide actions. A footer counter shows "N hidden" with click-to-peek functionality — click to temporarily reveal hidden lines, click again to re-hide. New logs are never hidden by default.

### Fixed

• **Panel badge now clears when clicking in the log viewer.** The watch hits badge (showing unread error/warning counts) previously only cleared when the panel visibility changed. Now it also clears when you click anywhere in the already-visible panel.

• **Dart/Flutter exceptions now detected as errors.** Fixed detection of Dart internal error types like `_TypeError`, `_RangeError`, and `_FormatException` that weren't being marked red. Also added detection for `Null check operator used on a null value` messages. These patterns are now recognized even when the logcat prefix is `I/` (Info level), so exceptions in `I/flutter` output are properly highlighted as errors.

• **Severity bar now matches error/warning color for framework lines.** Framework log lines (e.g. `E/MediaCodec`) now show red/yellow/purple severity bars matching their log level, instead of always showing a blue "framework" bar. This makes errors from framework code visually consistent with the text color.

• **Context line spacing improved when filtering by level.** When double-clicking to show only errors (or other levels) with context lines, the visual gap now appears after the error group instead of before, creating cleaner visual grouping.

• **Replay controls hidden during recording and when empty.** The replay icon and playback bar are now hidden when a debug session is active or no log file is loaded. Clicking a session in Project Logs now shows the replay icon so users can start playback.

• **Dart/Flutter stack traces no longer show timestamps on each frame.** Stack frames using the `#0`, `#1`, `#2` format were not being detected, so each line displayed a redundant timestamp. Now the viewer correctly detects Dart, Python, and other stack frame formats, showing the timestamp only on the first line of the stack trace.

---

## [3.0.6]

Exposes a public API so other VS Code extensions can subscribe to log events and inject lines, plus reduces VS Code window spawns during publish. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.6/CHANGELOG.md)

### Fixed

• **Publish script spawns fewer VS Code windows on Windows.** Removed extension-cache clearing that forced a redundant `code --list-extensions` call, reducing VS Code window spawns from 4 to 3 (with one missing extension) or from 3 to 2 (happy path). Remaining CLI calls now print a notification before spawning so the user knows what is happening.

### Added

• **Public extension API.** Other VS Code extensions can now consume a typed API via `vscode.extensions.getExtension('saropa.saropa-log-capture')?.exports`. Exposes live line events (`onDidWriteLine`), session lifecycle events (`onDidStartSession` / `onDidEndSession`), file split events, `getSessionInfo()`, `insertMarker()`, `writeLine()`, and `registerIntegrationProvider()`.

• **`writeLine()` public API method.** Consuming extensions can write structured log lines into the active capture session via `api.writeLine(text, { category, timestamp })`. Lines go through the same pipeline as DAP output: exclusion rules, flood protection, deduplication, watch patterns, viewer display, and all export formats. No-op when no session is active.

• **User-configurable settings for Performance, Terminal, and Linux Logs integrations.** Added `package.json` setting definitions so these adapters' options (snapshot timing, terminal selection, WSL distro, etc.) appear in VS Code's Settings UI.

## [3.0.5]

Streamlines the session UI — metadata moves to a tooltip, the replay bar tucks behind an icon, and severity connectors fade back so the dots stand out. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.5/CHANGELOG.md)

### Added

• **Long-press session count copies session info.** Long-pressing the "Session X of Y" label copies all session metadata (date, project, debug adapter, etc.) to the clipboard.

### Fixed

• **Publish script no longer spawns multiple VS Code windows.** Cached the `code --list-extensions` CLI output so the editor is queried at most once per run instead of 3–4 times.

### Changed

• **Split 8 oversized files under 300-line limit.** Extracted cohesive modules from `session-lifecycle`, `session-manager`, `session-history-provider`, `viewer-handler-wiring`, `log-viewer-provider`, `viewer-context-menu`, `viewer-session-panel`, and `extension-activation` — no behavior changes.

• **Severity connector bars semi-transparent.** The vertical bars joining consecutive severity dots are now rendered at reduced opacity so they don't visually overpower the dots themselves.

• **Replay bar hidden behind icon.** The replay transport bar (play/pause/stop, speed, scrubber) is no longer always visible during replay. A replay icon appears in the icon bar when replay is active; click it to toggle the controls.

• **Session info moved to tooltip.** Session metadata (date, project, debug adapter, launch config, VS Code version, extension version, OS) is now shown as a tooltip on the session count label instead of a dedicated slide-out panel.

• **Session count always visible.** The "Session X of Y" label and Prev/Next buttons are now always shown (defaulting to "Session 1 of 1" for a single session) instead of hiding when there is no navigation.

• **Icon bar spacing.** Increased vertical gap between icon bar buttons from 2px to 3px for better visual balance after removing the Session Info icon.

### Removed

• **Session Info sidebar icon and panel.** The info icon (ℹ) and its full-height slide-out panel have been removed. The same information is now available via the session count tooltip.

---

## [3.0.4]

Fixes multi-line severity inheritance and localized strings showing raw keys, adds scroll-to-top and find-in-files sorting, and improves Project Logs list performance. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.4/CHANGELOG.md)

### Fixed

• **Continuation lines not inheriting severity level.** Multi-line log messages (e.g. Flutter `[ERROR:...]` followed by `See https://...`) now inherit the severity level from the preceding line when timestamps are within 2 seconds and the continuation has no explicit level markers.

• **Localized messages showing raw keys.** All `vscode.l10n.t()` calls used symbolic keys (e.g., `msg.gitignoreLogPrompt`) which displayed literally in English locale. Introduced `src/l10n.ts` helper that maps keys to English strings before passing through `vscode.l10n.t()`. Fixes 159 call sites across 26 source files. Also fixed 14 calls in `commands-export.ts` and `commands-session.ts` that incorrectly passed inline English text as positional substitution arguments. Re-keyed all 11 translation bundles to use English strings as lookup keys.

### Added

• **Scroll to Top button.** New "Top" button appears when scrolled past 50% of viewport height. Both Top and Bottom buttons hidden on small files (< 150% viewport height).

• **Find-in-files sort by match count.** Sort toggle in the find panel header reorders results by number of matches (most hits first).

• **Footer path gestures.** Footer now shows the relative path (or full path if outside workspace). Long-press copies the path to clipboard. Double-click opens the containing folder.

### Changed

• **Project Logs list performance.** Items-level cache with fetch deduplication eliminates redundant directory scans and metadata loads on repeat opens. Bulk central metadata read (`.session-metadata.json` read once per refresh, not once per file). Severity scan skipped when sidecar already has cached counts. Concurrency-limited batch loading (max 8 parallel file reads). Debounced webview session list requests (150ms).

• **Panel close buttons.** Replaced text `x` with codicon icons, restyled to match the refresh button size across all panels.

• **Panel widths.** All slide-out panels now share a single user-resizable width. The slot controls the width; all panels fill it via `width: 100%`. Resize handle updates only the slot (not individual panels). Persisted width applies immediately when the setting arrives, even if a panel is already open. Removed `max-width` constraints from Crashlytics, Recurring, Performance, Info, and Session panels.

• **Tidy mode improvements.** File extension stripped in tidy mode. Time extracted from filename and shown as 12-hour format (e.g. "10:19 AM"); hidden when it matches the session modified time. Severity dots moved inline with meta text. "N lines" text replaced by colored severity dots that sum to total line count (uncategorized lines shown as a dim "other" dot).

• **Tidy subfolder display.** Only shows subfolder prefix when basenames collide for disambiguation.

• **About panel changelog.** URL link moved above changelog content; changelog cleared on panel close.

### Fixed

• **Prev/Next session navigation.** Both buttons were navigating to the next session due to `safeLineIndex()` rejecting negative direction values.

• **Search tags textbox styling.** CSS ID mismatch (`#options-search` vs `#filters-search`) left the input unstyled.

• **Search mode toggle.** Toggle was resetting search text and missing active-state styling.

• **Find-in-files screen jump.** Session navigator CSS transition caused a visual jump when switching files.

• **Scroll-to-bottom button.** Button was inside the scroll container making it unclickable; moved to positioned wrapper with proper z-index.

## [3.0.3]

Automated release to publish accumulated fixes; no user-facing changes beyond what shipped in 3.0.2. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.3/CHANGELOG.md)


---

## [3.0.2]

In this release we add eight new integration adapters (performance, terminal, WSL, security, and more), one-click export to Grafana Loki, session replay with timing, and full support for remote workspaces (SSH, WSL, Dev Containers). [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.2/CHANGELOG.md)

### Added

• **Eight new integration adapters.** Performance (system snapshot at session start, optional periodic sampling, Session tab in Performance panel), Terminal output (capture Integrated Terminal to sidecar; requires supported VS Code terminal API), WSL/Linux logs (dmesg and journalctl for WSL or remote Linux), Application/file logs (read last N lines from configured paths at session end), Security/audit (Windows Security channel with optional redaction, app audit file path), Database query logs (file mode: JSONL query log at session end), HTTP/network (request log JSONL at session end), Browser/DevTools (file mode: browser console JSONL/JSON at session end). All opt-in via `saropaLogCapture.integrations.adapters`. Config under `integrations.performance.*`, `integrations.terminal.*`, `integrations.linuxLogs.*`, `integrations.externalLogs.*`, `integrations.security.*`, `integrations.database.*`, `integrations.http.*`, `integrations.browser.*`. See [bugs/001_integration-specs-index.md](bugs/001_integration-specs-index.md) and [docs/integrations/TASK_BREAKDOWN_AND_EASE.md](docs/integrations/TASK_BREAKDOWN_AND_EASE.md).

• **Export to Loki (Grafana Loki).** One-click push of the current (or selected) log session to Grafana Loki. Enable via `saropaLogCapture.loki.enabled`, set `saropaLogCapture.loki.pushUrl` to your Loki push API URL (e.g. Grafana Cloud or `http://localhost:3100/loki/api/v1/push`). Store API key with command **Saropa Log Capture: Set Loki API Key** (Secret Storage). Command **Export to Loki** and session context menu **Export to Loki**; progress notification while pushing; labels `job=saropa-log-capture`, `session`, and optional `app_version` from metadata.

• **Remote workspace support (Task 90).** Extension runs in the workspace context for Remote - SSH, WSL, and Dev Containers (`extensionKind: workspace`). Save dialogs (export logs, save bug report) default to the workspace folder so the chosen path is on the remote when applicable. Integration providers (test-results, build-ci, code-coverage, environment-snapshot, crash-dumps) resolve workspace-relative paths via a shared `resolveWorkspaceFileUri` so paths work correctly in remote workspaces. README now includes a "Remote development (SSH, WSL, Dev Containers)" section.

• **Session replay.** Replay a saved log session with optional timing: lines appear in order with delay from per-line timestamps or `[+Nms]` elapsed prefixes (or fixed delay when absent). **Replay** is available from the Project Logs list (right-click a session → Replay) and from the command palette (**Saropa Log Capture: Replay Session**). Replay bar: Play, Pause, Stop; **Timed** (use line deltas) vs **Fast** (fixed short delay); speed (0.5x–5x); scrubber to seek. **Space** toggles play/pause. Settings: `replay.defaultMode`, `replay.defaultSpeed`, `replay.minLineDelayMs`, `replay.maxDelayMs`.

• **Copy with source: surrounding context lines.** New setting `saropaLogCapture.copyContextLines` (default 3, max 20). When using **Copy with source** from the log viewer context menu, the copied excerpt now includes this many log lines before and after the selection (or the right-clicked line), so stack traces and surrounding errors are included. Set to 0 to copy only the selection. NLS description in package.nls.json.

### Fixed

• **NLS verification.** Added missing manifest keys to all 10 localized package.nls.\*.json (de, es, fr, it, ja, ko, pt-br, ru, zh-cn, zh-tw): `command.exportToLoki.title`, `command.setLokiApiKey.title`, and `config.copyContextLines.description`, so `verify-nls` passes and publish can complete.

### Changed

• **Publish script: vsce login when PAT missing.** If marketplace PAT verification fails, the script now runs `vsce login saropa` interactively instead of only printing a manual command. Handles both first-time (PAT prompt only) and overwrite (y/N then PAT) flows; user sees a short hint if vsce asks to overwrite. No piped token so prompt order is correct in all cases.

• **Integration design docs.** Completed integration design documents (package-lockfile, build-ci, git-source-code, environment-snapshot, test-results, code-coverage, crash-dumps, windows-event-log, docker-containers) removed from `docs/integrations/`. Content is covered by: README there (points to Options, provider code, and bugs specs), [bugs/001_integration-specs-index.md](bugs/001_integration-specs-index.md) and `integration-spec-*.md`, provider JSDoc in `src/modules/integrations/providers/`, and CHANGELOG entries from when each was added (e.g. 2.0.19). That folder now holds design docs for **planned** integrations only.

---

## [3.0.1]

We improved the docs and added ARCHITECTURE.md, made config and JSON parsing safer, and tightened deep links and split rules. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.1/CHANGELOG.md)

### Added

• **System-wide code comments and ARCHITECTURE.md.** Deep comment pass across entry, activation, capture pipeline, config, integrations, handlers, analysis, export, storage, and UI: file-level JSDoc, section comments (`// --- ... ---`), and inline "why" comments. New `ARCHITECTURE.md` describes high-level flow (DAP → tracker → SessionManager → LogSession + Broadcaster), lifecycle, config, and comment conventions.

• **Config validation and safe JSON.** `config-validation.ts`: clamp, ensureBoolean, ensureEnum, ensureStringArray, ensureNonNegative, ensureNonEmptyString; MAX_SAFE_LINE and MAX_SESSION_FILENAME_LENGTH for deep links. `safe-json.ts`: safeParseJSON and parseJSONOrDefault for defensive parsing. Config and integration-config use validation; session-metadata and error-status-store use parseJSONOrDefault; build-ci and test-results use safeParseJSON. Unit tests for config-validation and safe-json.

• **Deep link and split-rules hardening.** Deep links: session name validated (no path traversal, length cap); line number clamped to 1..MAX_SAFE_LINE; generateDeepLink trims and uses safe default. parseSplitRules accepts null/undefined and clamps numeric settings to safe maxima.

### Fixed

• **ESLint curly.** Added braces to single-line `if` bodies in config, integration-config, deep-links, file-splitter, and viewer-message-handler for consistency.

• **Integration config.** Crashlytics and Windows Events `leadMinutes`/`lagMinutes` now correctly preserve user value `0` (was replaced by default); added `configNonNegative` helper to avoid duplication.

---

## [3.0.0]

In this release we add tail mode for live file watching, .slc session bundle export/import, a configurable viewer line cap, session date filter, copy-as-snippet for GitHub/GitLab, and accessibility improvements, plus a lot of refactoring under the hood. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.0/CHANGELOG.md)

### Added

• **Documentation standards and extension logging.** CONTRIBUTING documents file-level doc headers, JSDoc for public APIs, and inline comment guidelines. Shared extension logger (`extension-logger.ts`) with `setExtensionLogger()` at activation; `logExtensionError`, `logExtensionWarn`, `logExtensionInfo` used in edit/export, rename, deep links, and rebuild index. Cursor rules for documentation and error-handling/testing (`.cursor/rules/`).

• **Unit test coverage.** Tests for `EarlyOutputBuffer` (session-event-bus) and for file retention selection logic (`selectFilesToTrash`). CONTRIBUTING Testing section and `npm run test:coverage` (c8).

• **Parameter validation and assertion helper.** Viewer message handler validates `msg.type` and logs invalid messages; `assertDefined(ctx, 'ctx')` at dispatch entry. New `assert.ts` with `assertDefined` for required params.

• **Tail mode (Task 89).** New setting `saropaLogCapture.tailPatterns` (default `["**/*.log"]`) and command **Saropa Log Capture: Open Tailed File**. Pick a workspace file matching the patterns; the viewer opens it and appends new lines as the file grows (file watcher). NLS in all 11 locales.

• **Wow feature specs.** Full design docs for Consider for Wow: AI Explain this error, Session replay, One-click export to Loki/Grafana in `docs/wow-specs/`. ROADMAP §7 links to each spec.

• **.slc session bundle (Tasks 74–75).** **Export:** Command **Export as .slc Bundle** and session context menu **Export as .slc Bundle** save the current (or selected) session to a `.slc` ZIP containing main log, split parts, `manifest.json`, and `metadata.json`. Export shows a notification progress while building the bundle; split-part reads run in parallel. **Import:** Command **Import .slc Bundle** opens a file picker; selected `.slc` files are extracted into the workspace log directory with unique names, metadata merged into `.session-metadata.json`, then a single session list refresh and the last imported log opened in the viewer. Progress notification during import. NLS in all 11 locales and bundle.l10n. Unit tests for manifest validation (`isSlcManifestValid`). README Export section documents .slc bundle.

• **Configurable viewer line cap.** New setting `saropaLogCapture.viewerMaxLines` (default 0 = 50,000). When set, the viewer and file load are capped at `min(viewerMaxLines, maxLines)` to reduce memory for very large files. Applied in sidebar and pop-out viewer; NLS in all 11 locales.

• **Session list date filter.** Project Logs panel has a dropdown: "All time", "Last 7 days", "Last 30 days". Selection is persisted with session display options and filters sessions by `mtime` in the webview.

• **Unit tests for viewer line cap and session display.** Tests for `getEffectiveViewerLines` (default, custom cap, cap at maxLines) and for `buildViewerHtml` with `viewerMaxLines`; tests for `defaultDisplayOptions.dateRange` in session-display.

• **Copy as snippet (GitHub/GitLab).** Context menu item "Copy as snippet (GitHub/GitLab)" copies selection or visible lines wrapped in ` ```log ` … ` ``` ` for pasting into issues.

• **Minimal a11y (accessibility).** Icon bar has `role="toolbar"` and each button has `aria-label`; footer level filters, filter badge, version link, jump-to-bottom button, and copy-float have `aria-label` and/or `role="button"` where appropriate; level flyup toggle buttons have `aria-label`.

• **Viewer a11y (extended).** Log content region has `role="log"` and `aria-label="Log content"`; session/split nav buttons and context-lines slider have `aria-label`; split breadcrumb label has `aria-hidden`. Unit test asserts log region a11y in `buildViewerHtml`.

### Changed

• **File line limit (300 lines).** Split 10 files that exceeded the limit into smaller modules: commands (session, export, tools, deps), extension (activation), config (config-types), project-indexer (project-indexer-types), session-metadata (session-metadata-migration), log-viewer-provider (load, setup), viewer-provider-helpers (viewer-provider-actions), viewer-data-helpers (core, render), viewer-script (viewer-script-messages), pop-out-panel (uses shared dispatchViewerMessage). Behavior unchanged; structure only.

• **File retention.** Pure helper `selectFilesToTrash(fileStats, maxLogFiles)` extracted for testability; `enforceFileRetention` uses it.

• **Error handling.** Edit-line and export-log failures, session rename failures, and deep-link errors now log to the extension output channel before showing user messages.

• **Plan.md footer consolidation.** Plan marked closed: footer no longer has Excl/App Only/Preset/Categories/No Wrap/Export; those live in Filters panel, Options, or context menu. Status and current UX summarized at top of plan.

• **README Known Limitations.** Viewer line cap now documents `viewerMaxLines` (0 = 50k default) and that it cannot exceed `maxLines`; suggests setting it lower to reduce memory. Settings table includes `viewerMaxLines`. Keyboard shortcuts table and accessibility note added under Known Limitations; cross-link to docs/keyboard-shortcuts.md.

• **Requirements in README.** Documented VS Code ^1.108.1 (or Cursor/Open VSX–compatible editor) and link to `engines.vscode` in package.json.

• **Redaction tip.** README settings table now suggests redacting secrets (e.g. `API_KEY`, `SECRET_*`, `*_TOKEN`) via `redactEnvVars`.

• **About panel changelog URL.** Changelog link is built from extension id (`buildChangelogUrl(extensionId)`) instead of a hardcoded URL; callers pass `context.extension.id`.

• **Keyboard shortcuts doc.** `docs/keyboard-shortcuts.md` lists Power Shortcuts and Key Commands; linked from README and Documentation table.

• **Preset "last used".** Last applied filter preset name is stored in workspace state and re-applied when the viewer loads (sidebar and pop-out).

• **TypeScript.** Enabled `noImplicitReturns`, `noFallthroughCasesInSwitch`, and `noUnusedParameters` in tsconfig.json.

• **Filter presets schema.** Added `levels` and `appOnlyMode` to `saropaLogCapture.filterPresets` in package.json and all 11 package.nls.\* locale files.

• **Publish script (Step 10).** Added `--yes` to accept version and stamp CHANGELOG without prompting (non-interactive/CI). When stdin is not a TTY, version is accepted by default; clearer error suggests `--yes` if confirmation fails.

• **ROADMAP.** Marked resolved project-review issues (Known Limitations, integration index, tsconfig, filterPresets schema, F5 note, DAP-only doc) as fixed in §2. Completed items removed from §7; Do Soon (README cap, integration index, a11y) removed; Do Next and Consider for "Wow" renumbered 1–6.

### Fixed

• **README Known Limitations.** Updated to describe viewer line cap via `maxLines` and `viewerMaxLines`, and "Showing first X of Y lines" when truncated; added note that capture is Debug Console (DAP) only with link to Terminal output capture doc.

• **README Quick Start.** Added F5 testing note: use VS Code (not Cursor) for Extension Development Host.

• **Integration specs index.** `bugs/001_integration-specs-index.md` now marks implemented adapters (buildCi, git, environment, testResults, coverage, crashDumps, windowsEvents, docker) as Done; intro sentence clarifies Done = implemented, Pending = planned.

---

## [2.0.19]

We added runtime and manifest localization (11 locales), a project indexer for faster analysis, an integration framework with Packages and eight more adapters (Build/CI, Git, Test results, Crashlytics, etc.), and a reset button in the Options panel.

### Added

• **Runtime localization (l10n).** Status bar text, notification messages, and input prompts now use `vscode.l10n.t()` with `l10n/bundle.l10n.json`. Locale-specific bundles (`bundle.l10n.{locale}.json`) provided for de, es, fr, it, ja, ko, pt-br, ru, zh-cn, zh-tw (English placeholder values; replace with translations as needed). Manifest localization (package.nls.\*) unchanged.
• **Manifest localization: five additional locales.** Added `package.nls.fr.json`, `package.nls.it.json`, `package.nls.pt-br.json`, `package.nls.ru.json`, and `package.nls.zh-tw.json` so command titles, view names, walkthrough text, and Firebase time-range enums are localized for French, Italian, Portuguese (Brazil), Russian, and Chinese (Traditional). Config setting descriptions remain in English for these locales; translate as needed. All 11 manifest locales now align with the l10n bundle set.
• **Translation rollout plan archived.** `docs/translation-rollout-plan.md` moved to `docs/history/` (spec complete).
• **Project indexer.** Lightweight, delta-aware index of project docs and completed log sessions for faster analysis. Index lives in `.saropa/index/`; Crashlytics cache moved to `.saropa/cache/crashlytics/`. New settings: `projectIndex.enabled`, `projectIndex.sources`, `projectIndex.includeRootFiles`, `projectIndex.includeReports`, `projectIndex.maxFilesPerSource`, `projectIndex.refreshInterval`. Docs scanner uses the index when enabled (index-first lookup, fallback to full scan). Analysis panel doc matches can show section heading when available. Command **Rebuild Project Index** for manual refresh. File watchers mark sources dirty for lazy rebuild; inline updates when sessions finalize or are trashed/restored.
• **Options panel: Reset extension settings.** Actions section now includes "Reset extension settings" (in addition to "Reset to default" for viewer-only options). Triggers `saropaLogCapture.resetAllSettings`; confirmation is shown in the host. Available in both main viewer and pop-out.
• **Export current view from context menu.** "Export current view…" was moved from the Options panel to the log content right-click menu (next to Copy All / Select All) so it is clear the action exports the current log, not options. The export modal (level filters, templates) is unchanged; opening it is now via context menu only.
• **Integration API and first adapter (Packages).** Extensible framework for attaching external data to log sessions (header lines, meta, sidecars). Users enable adapters via `saropaLogCapture.integrations.adapters`. **Packages** adapter (id: `packages`) runs at session start: detects npm/yarn/pnpm lockfile, computes content hash, adds a "Lockfile: … sha256:…" line to the context header and stores payload in session meta for reproducibility. Status bar shows which adapters contributed (e.g. "Packages") while recording. Design and future adapter specs: `docs/integrations/INTEGRATION_API.md`, `bugs/integration-spec-*.md`.
• **Additional integration adapters.** Build/CI (file-based last-build.json), Git (describe, uncommitted, stash), Environment snapshot (env checksum, config file hashes), Test results (file or JUnit XML), Code coverage (lcov/Cobertura/summary), Crash dumps (scan for .dmp/.core at session end), Windows Event Log (Application/System in session range, Windows only), Docker (container inspect and logs at session end). Each is opt-in via `integrations.adapters` and has its own settings under `saropaLogCapture.integrations.<id>.*`.
• **Integrations in Options panel.** Options slide-out (gear icon) now includes an **Integrations** section with one checkbox per adapter. Toggling updates workspace `integrations.adapters` immediately. Current state is sent when the viewer loads and echoed back after each change so the panel stays in sync. Command **Saropa Log Capture: Configure integrations** still available from the Command Palette (Quick Pick).

---

## [2.0.18]

We reorganized the source tree by domain, fixed the Copy All/Line crash, improved the publish script, and fixed run boundaries and separators for Flutter logs.

### Changed

• **Src folder reorganization.** `src/modules`, `src/ui`, and `src/test` are grouped into subfolders by domain/responsibility (see 2.0.18 entry). Modules: capture, session, config, crashlytics, bug-report, ai, export, search, source, analysis, git, storage, features, misc. UI: provider, viewer, viewer-styles, viewer-panels, viewer-nav, viewer-search-filter, viewer-context-menu, viewer-decorations, viewer-stack-tags, session, analysis, insights, panels, shared. Tests mirror under `test/modules/` and `test/ui/`.

### Fixed

• **Copy All / Copy Line script error.** When a log line had no `html` (e.g. edge case in viewer data), "Copy All" or copy-float threw `Cannot read properties of undefined (reading 'replace')`. `stripTags` is now null/undefined-safe so clipboard copy never throws.
• **Publish script Step 10 when tag exists and changelog unpublished.** When the version is already released (tag exists) and CHANGELOG still has an unpublished section (`[Unreleased]`, `[Unpublished]`, or `[Undefined]`), the script now offers "Bump to vX.Y.Z?" first instead of "Publish as-is?". Stamping accepts all three headings.
• **Run 2 incorrectly detected during normal startup.** Run boundaries now treat only "Launching ... in debug mode", "Hot restart", and "Hot reload" as run starts. Mid-startup lines ("✓ Built", "Connecting to VM Service", "Connected to the VM Service") no longer start a new run, so a single Flutter startup shows as one run.
• **Run separator overlapping severity bar.** The run separator bar now uses the same left padding (14.25em) as log lines so it does not overlap the left severity/timeline bar.

---

## [2.0.17]

We add a run navigator and visual run separators for logs with multiple runs (e.g. Flutter launch or hot restart), a Reset to default in Options, and a comfortable line height toggle.

### Added

• **Run navigator in title bar.** When a log has multiple runs (launch, hot restart/reload), the run navigator (Run 1 of N, Prev/Next) appears in the same bar as the session navigator, separated by a pipe. Hidden when only one run is detected.
• **Run separators in list view.** Above each new run (except the first) a tall pink/dark-pink bar shows run number, start and end time, duration, and issue counts with colored dots (error/warning/perf/info). Run summaries are computed when loading a file; separators are inserted in a single pass for performance.
• **Options panel: Reset to default.** Actions section includes a "Reset to default" button that restores all viewer options (display, layout, audio) to their defaults. Does not change VS Code workspace settings.
• **Context menu: Comfortable line height.** Options submenu now includes a "Comfortable line height" toggle. Checked = comfortable (2.0), unchecked = compressed (1.2). Syncs with the Options panel line-height slider.

### Changed

• **Session details merged into nav bar; scroll-up-reveal header.** The session context line (adapter · project · date) is now in the same bar as the session and run navigators instead of a separate row above the log. The bar hides when scrolling down and reveals when scrolling up (smart sticky / scroll-up-reveal), with a 0.28s cubic-bezier animation. Shown when at top of log or when scrolling up past a small threshold.
• **Severity styling: info level uses yellow.** Info lines (e.g. Android `I/`) now use yellow for text, severity bar dot, and whole-line tint for clearer visibility.
• **Blank lines join previous block.** Empty lines get the previous line's severity tint and a `.line-blank` class so they visually join; set `--blank-line-bg` in CSS to override with a custom color.
• **Project Logs header: no "Default" label; whole header clickable.** The header shows only "Project Logs" when using the default folder. The suffix (path) appears only when a non-default folder is selected. The entire header (title and optional suffix) is clickable to choose folder; reset and close/refresh remain separate controls.
• **Project Logs Tags toggle off by default.** When the session list loads or refreshes, the Tags filter section stays closed and the Tags button is inactive. Users can still open it with the Tags button.

### Fixed

• **run-summaries test expectations.** Test "builds one summary per run with timestamps and counts" now expects duration 2000ms (first run 12:00:00→12:00:02) and infos 2 (Launch + "info" line); implementation was correct.
• **Sidebar panel width no longer changes when switching between Options and Project Logs.** All slide-out panels (Options, Project Logs, Search, Find, Bookmarks, etc.) now share a single width with a minimum of 560px, persisted with Project Logs display options, so the sidebar no longer resizes when switching panels.
• **Severity dot on blank lines.** The colored severity bar (green/red/etc. dot) is no longer shown for lines that have no visible text, even when the decoration prefix (counter, timestamp, chevron) is shown.
• **Legacy .meta.json in workspace root not removed.** Migration now includes the workspace root (in addition to the configured log dir and override folder) so legacy sidecars in the project root (e.g. `CHANGELOG.meta.json`, `CLAUDE.md.meta.json`) are migrated and deleted on first Project Logs load.

---

## [2.0.16]

In this release you can jump between runs in a log and copy multiple lines at once; we also moved to central session metadata and fixed CPU spikes, context menu closing, and minimap issues.

### Added

• **Run navigation within a log.** When viewing a log file that contains multiple app runs (e.g. Flutter launch, hot restart, hot reload, exit), a "Run 1 of N" bar appears with Prev/Next to jump between runs. Boundaries are detected from lines such as "Launching ... in debug mode", "Connected to the VM Service", "Performing hot restart", "Application finished.", and "Exited (-1)".
• **Copy Line (context menu) with multi-line selection.** When multiple lines are selected (shift+click) and you right-click a line in that range, "Copy Line" copies all selected lines as full lines. Otherwise it copies only the single line under the cursor.
• **Crashlytics: Open google-services.json from error view.** When the Crashlytics panel shows "Query failed" (e.g. HTTP 404), an **Open google-services.json** button opens the config file the extension uses (with progress notification). Helps verify projectId/appId when the API returns "Project or app not found".

### Changed

• **Session metadata no longer uses sidecar .meta.json files.** Metadata (tags, display name, trashed, annotations, etc.) is now stored in a single dot-prefixed file in the log directory: `reports/.session-metadata.json`. The log directory stays clean (no per-file sidecars); the dot prefix keeps the metadata file hidden. On first opening Project Logs (or when viewing a folder that had sidecars), all `.meta.json` files in that directory are migrated into the central store and the sidecar files are deleted. Per-file migration also runs on first read if a sidecar is still present.
• **Crashlytics: better google-services.json discovery.** The extension now prefers `android/**/google-services.json` (e.g. `android/app/google-services.json`) for Flutter/Android projects, then falls back to any workspace `google-services.json`. Both searches run in parallel. Output channel logs which file was used (e.g. `Config from android/app/google-services.json`).
• **Crashlytics: clearer config and 404 messages.** Error text now mentions `google-services.json` (e.g. android/app/) and settings `saropaLogCapture.firebase.projectId / .appId` so users know where to fix config. Single shared hint string used for "no file found", setup wizard, and 404.

### Fixed

• **CPU spike (100%) during capture.** Extension host and webview no longer saturate CPU when the log viewer is hidden or under heavy output: incremental prefix sums (O(new lines) instead of O(n) per batch), visibility-aware updates (skip HTML/linkify and viewport/minimap work when panel or tab is hidden), throttled visible-line count when filters are on, minimap skipped when tab hidden and sampled above 50k lines, batch cap (2000 lines per message) and adaptive flush interval (500ms when backlog > 1000). Viewer refreshes when the user returns to the tab.
• **Right-click context menu cancelled when new log lines arrived.** The menu no longer closes on auto-scroll. Programmatic scrolls are suppressed while the context menu is open, and the scroll handler ignores programmatic scrolls so the menu stays open when content is appended.
• **Decorations scale with font zoom.** Prefixed time, counter, and severity bar (dot and connector) now use em-based sizes so they scale with the log font when using the Options slider or Ctrl+scroll zoom.
• **Severity bar overlapping line numbers when decorations on.** With line prefix (time and number) enabled, the gutter severity bar (dot at 0.69em) was drawn over the decoration numbers. Decorated lines now use 1.25em left clearance so the bar and connector sit to the left of the counter/timestamp (padding-left 14.25em = 1.25em bar + 13em decoration; text-indent -13em unchanged).
• **Context menu submenus off screen at bottom.** When the main menu was near the bottom of the viewport, opening Search, Actions, or Options caused the flyout to extend below the window. The menu now applies a vertical flip so submenu panels open upward and stay visible.

---

## [2.0.15]

We split the session panel and styles into smaller modules and started publishing to Open VSX so you can install from Cursor and VSCodium.

### Changed

• **Session panel and session styles modularized.** Split `viewer-session-panel.ts` (HTML moved to `viewer-session-panel-html.ts`) and `viewer-styles-session.ts` (styles split into `viewer-styles-session-panel`, `-list`, `-tags-loading`) to comply with the 300-line file limit. No behavior or API changes; callers still import from `viewer-session-panel` and `viewer-styles-session`.

### Publishing

• **Open VSX / Cursor marketplace.** The extension is now published to Open VSX (open-vsx.org) as well as the VS Code Marketplace, so it appears in Cursor, VSCodium, and other editors that use Open VSX. Install from the Extensions view in Cursor or via **Extensions: Install from VSIX…** with a .vsix from the GitHub release.

---

## [2.0.14]

We add an option to hide blank lines, let you pick the Project Logs folder, show loading states and animations, surface a changelog excerpt in the About panel, and include Open VSX in the publish pipeline.

### Added

• **Hide blank lines option.** Toggle in the flyout context menu (Options) and in the Options panel (Layout). When on, lines that are empty or only whitespace are hidden from the viewport.
• **Project Logs root folder.** Panel header shows path as suffix (e.g. "Project Logs · d:\src\contacts"); click path to open folder picker. Reset icon when using a custom folder; last-used folder is used as picker defaultUri. Header always shows the actual folder path (never "Default").
• **Project Logs loading state.** Progress bar and shimmer while the session list loads; loading label shows the folder path being loaded (e.g. "Loading d:\src\contacts…").
• **Sidebar open animation.** Slide-out panels animate open (0.25s ease-out) with overflow hidden until the width transition ends; close already animated.
• **Footer under log area only.** The status bar (filename, level dots, line count, version) now sits only under the log content area, not under the sidebar panels.
• **Version link in footer.** Version appears on the far right of the footer and opens the About panel when clicked.
• **About panel changelog.** About panel shows current version, a "Recent changes" excerpt from CHANGELOG.md (first three version sections), and a "Full changelog on Marketplace" link to the VS Code Marketplace changelog page.
• **Selection count in footer.** When text is selected in the log viewport, the footer shows "N lines, M chars selected"; updates are throttled with requestAnimationFrame for smoothness.

### Changed

• **Side-by-side panel layout.** Flyout panels (session, search, options, find, bookmarks, trash, info, filters, crashlytics, recurring, performance, about) push the log viewport narrower with animated width transitions; the virtual scroll viewport recalculates via ResizeObserver.
• **Project Logs tag chips.** Tags sorted by session count (desc); count shown on every chip; badge-style chips (no border); section limited to ~2 lines with vertical scroll; long tag names ellipsized.
• **Session panel minimum width.** Panel and resize drag enforce 560px minimum; restored width on reopen is clamped to 560px so the panel never opens narrower than minimum.
• **Session panel sort button UX.** Replaced labeled "Sort" with a right-aligned icon-only `codicon-sort-precedence` toggle; icon flips vertically when reverse sort is active.
• **Publish script: colorama auto-install.** When the `colorama` package is missing, the publish script now installs it automatically for Windows terminal color support instead of requiring a manual `pip install colorama`.
• **Publish script: Open VSX.** Pipeline now publishes to Open VSX (open-vsx.org) after the VS Code Marketplace (Step 14). Required for visibility in Cursor and VSCodium. Requires `OVSX_PAT`; script checks credentials and guides with token URL and first-time `npx ovsx create-namespace saropa -p <token>`.

### Fixed

• **Context menu text wrapping and bottom cropping.** Menu and flyout submenus use `white-space: nowrap` and `width: max-content` so labels stay on one line. Menu position is clamped to the viewport so it is never cropped when right-clicking near the bottom or right edge.
• **Project Logs path separator selection.** The " · " between the title and path is no longer highlighted when selecting the path (separator in own element with `user-select: none`).
• **Footer version link did not open About panel.** Clicking the version in the footer opened the About panel but the same event bubbled to document and triggered the panel's "outside click" close, so the panel closed immediately. Added `stopPropagation()` on the version-link click so the About panel stays open.
• **Three blue colors unified.** Notice and framework now share `--vscode-charts-blue` (#2196f3) for severity bar, line tint, and notice line text; link/info accent (#3794ff) unchanged.
• **CPU spike with huge log files.** Opening a file is capped at `saropaLogCapture.maxLines` (default 100k); footer shows "Showing first X of Y lines" when truncated.
• **Severity bar vs emoji dot.** Viewer shows only the gutter severity bar; emoji dot (🟢🟠🔴) appears only in "Copy with decorations" and only when "Severity dot (copy only)" is checked.
• **Session panel closes when clicking a tag chip.** `rebuildSessionTagChips` replaces innerHTML during the click handler, detaching the event target before the document-level "close on outside click" listener runs its `contains()` check. Added `stopPropagation()` to the chip click handler.
• **Context menu submenus not visible.** Submenu flyout panels (Search, Actions, Options) were clipped by `overflow-y: auto` on the parent menu container. Removed the overflow constraint so absolute-positioned submenus can render outside the menu bounds.
• **False-positive CRITICAL badge on instructional text.** Lines containing "fatal" in non-error context (e.g. "To make this warning fatal" or `debugZoneErrorsAreFatal`) were incorrectly badged as CRITICAL. Tightened heuristics to require all-caps `FATAL` or "fatal" followed by an error-type noun (error, exception, crash, signal, fault).
• **Severity bar missing on stack traces.** Stack headers and stack frames had no severity bar dots because `renderItem()` returned early before the bar class was computed. Moved bar computation earlier so stack items get dots whose color matches their text (framework frames get blue, app frames get error red).
• **Repeat notifications at end of session.** "Repeated #N (…)" lines no longer appear as the last visible content before a session boundary marker — the original line is restored instead.
• **Blank lines tracked as repeats.** Empty or whitespace-only lines no longer trigger repeat detection, preventing meaningless "Repeated #N (…)" notifications.

---

## [2.0.13]

We fixed the severity bar and timeline: centering, connectors, and consistent colors in the session list.

### Fixed

• **Severity bar centering.** Connector bars between dots were 0.5px off-center (2px bar at left:11 vs 7px dot centered at 12.5px). Widened connectors to 3px so both center at 12.5px.
• **Unconnected line tails.** Removed the full-height background line (`#viewport::before`) that extended above the first dot and below the last dot. The colored connector segments now provide the timeline without visual overflow.
• **Bar colors mismatched session panel.** Level-bar dots used `--vscode-debugConsole-*` variables (dark amber for warning) while severity dots in the session panel used `--vscode-charts-*` (bright yellow). Unified all five shared levels (error, warning, performance, framework, info) to use the `--vscode-charts-*` palette.
• **Timeline broken across color transitions.** Dots of different severity levels were not connected, leaving gaps in the timeline. Connector logic now bridges all adjacent dots regardless of color, stopping only at markers.

---

## [2.0.12]

We add a Performance panel (current session and cross-session trends), group the context menu into submenus, add tooltips across the UI, and modularize more of the codebase.

### Added

• **Performance panel.** New sidebar panel (graph-line icon) with two tabs: Current session shows grouped perf events (PERF traces, Choreographer jank, GC, timeouts) with click-to-navigate; Trends tab shows cross-session aggregated table with SVG line chart for tracking operation duration over time.
• **Performance fingerprinting.** New `perf-fingerprint.ts` module scans log files for named PERF traces, Choreographer frame skips, GC events, and timeouts, producing fingerprints stored in session metadata for cross-session trend analysis.
• **Cross-session performance aggregation.** New `perf-aggregator.ts` module reads perf fingerprints from all session metadata files and computes trends (improving/degrading/stable) by comparing first-half to second-half averages.
• **Shared metadata loader.** Extracted common metadata file loading (`parseSessionDate`, `filterByTime`, `listMetaFiles`, `loadMeta`) into `metadata-loader.ts`, eliminating duplication between `cross-session-aggregator.ts` and `perf-aggregator.ts`.
• **Expanded performance classification.** Lines containing `PERF` prefix and `GC freed`/`GC concurrent` are now classified as performance level (purple), in addition to existing Choreographer/ANR/jank patterns.
• **Context menu sub-menus.** Grouped Search, Actions, and Options into collapsible sub-menus to reduce clutter when right-clicking a log line (was ~17 flat items, now ≤10 top-level). The Options sub-menu provides quick toggles for word wrap, line prefix, and visual spacing. Submenus auto-flip left when the menu opens near the right viewport edge.
• **Tooltips for all icons across all screens.** Session list icons (recording dot, completed, log file), severity count dots (errors, warnings, performance, framework, info), bookmark icons (file, bookmark/note), trash item icons, and all close buttons (decoration settings, export modal, filters panel, options panel, edit modal, context peek) now show descriptive tooltips on hover.

### Fixed

• **Context line spacing when filtering.** Visual spacing now uses the previous _visible_ line (not the previous array element) to calculate gaps, fixing non-uniform spacing caused by hidden/filtered lines. Gap is placed above context groups (not between context and match line), keeping context lines visually grouped with the line they provide context for.
• **Severity dot gutter visual clutter.** Reduced dot size (9→7 px), connector bars (5→2 px), and dimmed the timeline to 40% opacity so the three gutter layers no longer compete visually.
• **Repeat notification visual clutter.** Removed redundant emoji dot from repeat notifications (decorations handle dots). Original line is now hidden when a repeat is detected, eliminating the visual gap. Empty previews show an ellipsis fallback. Fixed `trimData()` invalidating the repeat tracker's line index after splice.
• **Severity dot connectors broken by unclassified lines.** Consecutive same-color dots separated by lines without a severity classification (e.g. separator lines, context lines) were not visually connected. The connector logic now scans forward for the nearest dot instead of only checking the immediately adjacent DOM element, and bridges intermediate no-dot lines with a colored bar.
• **Level Filters fly-up panel unreadable.** The panel was nested inside `#footer` (which has `position: sticky`), trapping it in the footer's stacking context. Moved it out of the footer so `position: fixed` works against the viewport. Also switched background to `--vscode-editorWidget-background` with a solid `#1e1e1e` fallback for themes that don't define menu variables.

### Changed

• **Modularized performance panel script.** Extracted current-session scan/render logic (regex patterns, classification, group rendering) from `viewer-performance-panel.ts` into `viewer-performance-current.ts`. Parent reduced: 330→232 lines.
• **Modularized log session split logic.** Extracted `performFileSplit()` and `getPartFileName()` from `log-session.ts` into `log-session-split.ts`. Parent reduced: 305→274 lines.
• **Modularized session event bus.** Extracted `LineData`, `LineListener`, `SplitListener` types and `EarlyOutputBuffer` class from `session-manager.ts` into `session-event-bus.ts`. Re-exported for backward compatibility. Parent reduced: 301→277 lines.
• **Modularized level filter code.** Split into focused modules: `viewer-level-classify.ts` (classification patterns + `classifyLevel()`), `viewer-level-events.ts` (DOM event wiring), `viewer-styles-level.ts` (all level filter CSS). Original files reduced: `viewer-level-filter.ts` 299→185, `viewer-styles-ui.ts` 292→132.
• **Modularized analysis panel streams.** Extracted 8 async `run*` stream functions from `analysis-panel.ts` into `analysis-panel-streams.ts` with a `StreamCtx` interface to stay within the 4-parameter limit.
• **Modularized config file utilities.** Extracted `isTrackedFile`, `readTrackedFiles`, `getFileTypeGlob`, `shouldRedactEnvVar` from `config.ts` into `config-file-utils.ts`. Re-exported from the original module for backward compatibility.
• **Modularized bug report sections.** Extracted 21 section formatting functions from `bug-report-formatter.ts` into `bug-report-sections.ts`.
• **Modularized Crashlytics API queries.** Extracted `fetchJson`, `queryTopIssues`, `matchIssues`, `updateIssueState`, `getCrashEvents`, and related functions from `firebase-crashlytics.ts` into `crashlytics-api.ts`.
• **Modularized analysis panel styles.** Extracted `getAnalysisScript()` from `analysis-panel-styles.ts` into `analysis-panel-script.ts`.
• **Modularized insights panel script.** Extracted webview script from `insights-panel.ts` into `insights-panel-script.ts`.
• **Modularized context menu HTML.** Extracted `getContextMenuHtml()` from `viewer-context-menu.ts` into `viewer-context-menu-html.ts`.
• **Modularized exclusion chip styles.** Extracted exclusion chip CSS from `viewer-styles-options.ts` into `viewer-styles-exclusion-chips.ts`.
• **Modularized viewport rendering.** Extracted `renderViewport()` and helpers from `viewer-data.ts` into `viewer-data-viewport.ts`.
• **Modularized options panel events.** Extracted event wiring from `viewer-options-panel-script.ts` into `viewer-options-events.ts`.
• **Modularized export init script.** Extracted `initExportModal()` and wiring from `viewer-export-script.ts` into `viewer-export-init.ts`.
• **Modularized source tag UI.** Extracted tag chip rendering and interaction from `viewer-source-tags.ts` into `viewer-source-tags-ui.ts`.

---

## [2.0.11]

We focus on performance and stability: config is cached, the file split race is fixed, Find in Files is batched, and the test/dev scripts are updated.

### Fixed

• **Session-manager test failing.** Category-filter test patched `getConfig` via `require()` but the import binding in session-manager was already cached. Switched to `refreshConfig()` with direct config objects.
• **Garbled Unicode in publish script output.** `subprocess.run` defaulted to cp1252 on Windows, corrupting Mocha's ✓/✗ characters. Added explicit `encoding="utf-8"` to the `run()` helper.
• **Hot-path config reads.** `getConfig()` was called on every DAP message (30+ `cfg.get()` calls each time). Now cached in `SessionManagerImpl` and refreshed on settings change.
• **File split race condition.** `performSplit()` was fired without await, so `appendLine()` could write to a closing stream. Added a `splitting` guard flag.
• **Inline decoration thrashing.** `editor.setDecorations()` was called per log line with a source reference. Now debounced at 200ms.
• **Package root FS walks on every editor switch.** `detectPackageRoot` checked up to 8 manifest files per directory level on every `onDidChangeActiveTextEditor`. Results are now cached.
• **Unbounded `seenToolKeys` growth in AI watcher.** The dedup Set now clears at 10K entries to prevent memory leaks during long Claude sessions.
• **Memory spike in Find in Files.** `searchLogFilesConcurrent` read all log files simultaneously via `Promise.all()`. Now batched (5 files at a time).
• **Redundant config reads in settings change handler.** Three separate `getConfig()` calls collapsed to one.

### Changed

• **Dev script reports use daily subfolders.** `scripts/modules/report.py` `save_report()` now writes publish/analyze reports into `reports/yyyymmdd/` date subfolders, matching the extension's existing date-folder convention for debug capture logs.

---

## [2.0.10]

We show Claude Code AI activity (tool calls, prompts, warnings) inline in the log viewer and stream it in real time.

### Added

• **AI Activity Integration.** Show Claude Code AI activity (tool calls, user prompts, system warnings) interleaved with debug output in the log viewer. When a debug session starts, the extension scans the most recent Claude Code JSONL session file for recent AI activity and streams new entries in real time. AI lines appear with distinct colored left borders and `[AI ...]` prefixes, filterable via the existing category system.
  - New settings under `saropaLogCapture.aiActivity.*`: `enabled`, `autoDetect`, `lookbackMinutes`, `showPrompts`, `showReadOperations`, `showSystemWarnings`
  - Auto-detection: when `autoDetect` is true (default), the feature activates silently if `~/.claude/projects/<slug>/` exists for the workspace
  - Streaming deduplication: Claude Code writes multiple JSONL lines per assistant message during streaming; the parser keeps only the final (most complete) version, and the watcher tracks emitted entries to prevent duplicates across reads
  - New modules: `ai-jsonl-types.ts`, `ai-jsonl-parser.ts`, `ai-session-resolver.ts`, `ai-watcher.ts`, `ai-line-formatter.ts`
  - New viewer styles: `viewer-styles-ai.ts` — category-specific colors (cyan for prompts, yellow for edits, magenta for bash, orange for warnings)
  - Translations added for all 6 locale files (EN, DE, ES, JA, KO, ZH-CN)

---

## [2.0.9]

We split a few files into smaller modules to stay under the 300-line limit; behavior is unchanged.

### Changed

• **Module splits to stay under 300-line limit.** Extracted cohesive logic into five new files to keep every source file within the ESLint `max-lines` threshold (code lines only, blank lines and comments excluded):
  - `viewer-styles-info.ts` — session info panel CSS, split from `viewer-styles-content.ts`
  - `viewer-script-keyboard.ts` — keydown handler, split from `viewer-script.ts`
  - `crashlytics-io.ts` — CLI runner and event cache I/O, split from `firebase-crashlytics.ts`
  - `extension-lifecycle.ts` — debug session start/stop subscriptions, split from `extension.ts`
  - `viewer-message-handler.ts` — webview message dispatcher, split from `log-viewer-provider.ts`

---

## [2.0.8]

We added localized manifest files for Chinese, Japanese, Korean, Spanish, and German so the extension works better in more locales.

### Added

• **Machine-translated locale files.** Added `package.nls.zh-cn.json`, `package.nls.ja.json`, `package.nls.ko.json`, `package.nls.es.json`, and `package.nls.de.json` with 128 translated keys each, covering all manifest-visible strings. Corrections welcome at language@saropa.com.

### Changed

• **README language badge.** Added a language support badge (EN | ZH | JA | KO | ES | DE) to the README header so multilingual support is visible at a glance on the marketplace listing.
• **Marketplace keywords.** Added `multilingual`, `localization`, and `i18n` to `package.json` keywords for better search discoverability.

### Fixed

• **`verify-nls.js` ref deduplication.** Deduplicate `%key%` refs via `Set` before comparison; switch membership checks to `Set.has()` (O(1)) to prevent false double-reporting if a key appears twice in `package.json`.
• **README config table.** Added missing `organizeFolders` and `includeSubfolders` settings (both added in v2.0.7) to the configuration reference table.

---

## [2.0.7]

We auto-organize legacy logs into date folders, put new sessions in date subfolders, and run NLS verification as part of compile.

### Added

• **Auto-organize legacy log files.** New `organizeFolders` setting (on by default) automatically moves flat log files with a `yyyymmdd_` prefix into date-based subfolders on session start. Companion `.meta.json` sidecars are moved alongside their log files.
• **NLS verification in compile chain.** `npm run compile` now runs `verify-nls` before building, preventing NLS key drift on every build.

### Changed

• **Date-based log subfolders.** New log sessions are now written to `reports/yyyymmdd/` subfolders (e.g. `reports/20260218/`) instead of directly into the `reports/` root. File retention and session history already scan subfolders, so existing workflows are unaffected.

---

## [2.0.6]

We moved all user-visible strings into NLS for localization and added a verify-nls script to catch key drift.

### Added

• **Manifest localization support.** Extracted 127 user-visible strings from `package.json` into `package.nls.json` using VS Code's `%key%` reference mechanism. Enables future translation via locale-specific `package.nls.{locale}.json` files.
• **NLS key alignment verification script.** New `npm run verify-nls` command checks that all `%key%` references in `package.json` have matching entries in every `package.nls*.json` file, reporting missing and orphan keys.

---

## [2.0.5]

We show a five-dot severity breakdown in the session list, add a configurable minimap width, surface the Crashlytics cache in the session tree, and move all views to the bottom panel.

### Added

• **Full severity dot breakdown in session list.** Each session now shows five colored dot counters: red (errors), yellow (warnings), purple (performance), blue (framework), and green (info). Framework lines are detected via logcat tags and launch boilerplate; info is all remaining lines.
• **Minimap width setting.** New `minimapWidth` preference lets you choose small (40px), medium (60px, default), or large (90px) for the scrollbar minimap.

### Changed

• **Crashlytics cache visible in session history.** Cached crash event files are now stored in `reports/crashlytics/` (was `.crashlytics/`), making them searchable, comparable, and visible in the session tree.
• **Moved all views to bottom panel.** Log Viewer, Crashlytics, Play Vitals, and About panels now appear in the bottom panel (next to Terminal) instead of the sidebar.
• **Crashlytics, Recurring Errors, and About are now icon-bar panels.** All three are integrated into the Log Viewer webview as slide-out panels accessible from the icon bar, matching the existing Sessions/Trash/Bookmarks pattern. No more separate editor tabs or sidebar views.
• **Wider timeline connector bars.** The vertical bars joining consecutive same-color severity dots are now 5px wide (was 3px), staying centered on the dots.
• **Performance dot color changed from blue to purple.** The performance severity dot in the session list is now purple to free up blue for framework lines.

### Removed

• **Severity distribution bar in session list.** Removed the thin horizontal bar under each session entry; the five colored dot counters now convey a complete line-type breakdown.

### Fixed

• **gcloud CLI not detected on Windows.** The `execFile` call lacked `shell: true`, so Windows couldn't execute `gcloud.cmd` batch files, causing a false "Google Cloud CLI not found in PATH" error in the Crashlytics setup panel.
• **Line hover background matches compressed line height.** Added explicit `height: calc(1em * line-height)` on `.line` elements so the hover background always matches the virtual-scroll row height, preventing it from bleeding into adjacent lines at compressed settings.
• **Copy icon vertically centered on line.** The floating copy-to-clipboard icon now vertically centers on the hovered line instead of using a fixed offset.
• **Copy icon no longer overlaps scrollbar minimap.** Increased the right-edge clearance of the floating copy-to-clipboard button so it stays within the log content area.

---

## [2.0.4]

We add an About Saropa sidebar panel with a project list and links, and move the views to the activity bar.

### Added

• **About Saropa sidebar panel.** New info panel in the sidebar showing a short blurb about Saropa and clickable links to project websites (Marketplace, GitHub, saropa.com).
• **Full project catalogue in About panel.** Lists all Saropa projects (Contacts, Log Capture, Claude Guard, saropa_lints, saropa_dart_utils) and a Connect section with GitHub, Medium, Bluesky, and LinkedIn links. Each entry has a badge line (platform, stats) and a description synced with ABOUT_SAROPA.md.

### Changed

• **Moved views to activity bar.** All Saropa panels (Log Viewer, Crashlytics, Recurring Errors, About) now appear in the left activity bar sidebar instead of the bottom panel area, fixing the cramped layout.
• **Updated README panel references.** Replaced "bottom panel next to Output/Terminal" wording with activity bar sidebar location.

---

## [2.0.3]

We show detailed errors when Crashlytics setup fails, rewrote the minimap with canvas, and fixed the copy icon and timeline.

### Added

• **Crashlytics setup diagnostics.** The Crashlytics panel now shows actual error details when setup fails instead of generic hints. Captures gcloud CLI errors (not found, not logged in, permission denied), HTTP status codes from the Firebase API (401/403/404), and network timeouts. A "Last checked" timestamp shows when the last diagnostic ran. All diagnostic steps are logged to the "Saropa Log Capture" output channel for advanced troubleshooting.
• **Minimap info markers setting.** New `saropaLogCapture.minimapShowInfoMarkers` setting (off by default) controls whether info-level (green) markers appear on the scrollbar minimap. Reduces visual noise for most users while letting those who want full coverage opt in.

### Changed

• **Minimap rewritten with canvas rendering.** The scrollbar minimap now paints markers onto a `<canvas>` element instead of creating individual DOM `<div>` elements. Uses `prefixSums` from the scroll-anchor system for pixel-accurate positioning, supports HiDPI displays, and eliminates innerHTML rebuilds for better performance.

### Fixed

• **Copy icon no longer overlaps scrollbar minimap.** Increased the right-edge clearance of the floating copy-to-clipboard button so it stays within the log content area.
• **Timeline dots no longer shift on hover.** Replaced transform-based vertical centering with margin-based centering to eliminate sub-pixel jitter when hovering log lines.
• **Same-color timeline dots are now connected by a colored vertical bar.** Consecutive log lines with the same severity level show a colored connector bar between their dots, making runs of same-level output visually distinct.

---

## [2.0.2]

We fixed the timeline dots, added a Saropa prefix to panel titles, improved the Insights panel and session list, and made historical logs open at the top.

### Fixed

• **Timeline dots: stacking and alignment.** The severity dot timeline in the log gutter now renders correctly — dots are single-color (no line bleed-through), always paint above the timeline line, and the whole construct is indented from the left edge.
• **Panel titles: added "Saropa" prefix.** All webview panels opened in the main VS Code editor now include the "Saropa" prefix for discoverability (e.g. "Saropa Cross-Session Insights", "Saropa Log Timeline").
• **Insights panel: refresh no longer resets position.** Clicking Refresh, changing the time range, or closing an error no longer moves the panel back to the Beside column.
• **Insights panel: production data loading indicator.** The "Checking production data..." spinner now reliably stops via a settled guard, reduced timeout (10 s), and output channel logging for diagnostics.
• **Panels no longer auto-restore on startup.** Registered no-op serializers for all singleton webview panels so VS Code does not restore them when reopening a project.
• **Session panel: removed spark bar.** The small grey "relative density" bar after severity dots was too small to convey useful information and confused users. Removed entirely.
• **Session panel: severity dot alignment.** Colored severity dots now vertically center-align with their count numbers using flex layout instead of fragile `vertical-align`.
• **Session panel: severity bar improved.** The proportional error/warning/perf bar is now full-width instead of a tiny 40px inline bar, and its tooltip shows a descriptive breakdown (e.g. "5 errors, 3 warnings") instead of a generic total.
• **Historical log files now open at the top.** Previously, opening an old log file from session history would scroll to the bottom. The viewer now starts at line 1 for file views, while live capture sessions continue to auto-scroll.

---

## [2.0.1]

In this release we add a Reset All Settings command, a Crashlytics setup wizard, filterable crash categories in Insights, and search in the Insights panel.

### Added

• **Reset All Settings command:** New "Saropa Log Capture: Reset All Settings to Defaults" command in the command palette resets every extension setting to its default value in one step.
• **Crashlytics setup wizard:** The Crashlytics sidebar panel now shows an interactive 3-step setup wizard instead of plain text hints. Step 1 links to the Google Cloud CLI install page, step 2 opens a VS Code terminal to run the auth command, and step 3 offers a file picker to locate `google-services.json` (or a link to configure settings manually). A billing tip reassures users that Crashlytics API access is free. "Check Again" button and auto-refresh on terminal close.
• **Clickable URLs in setup hints:** Setup hint URLs in the analysis panel (GitHub CLI, Firebase) are now rendered as clickable links instead of plain text.
• **Filterable crash categories in Insights:** Toggle chips (FATAL, ANR, OOM, NATIVE) above the recurring errors list let you isolate specific crash types. All/None buttons for quick toggling. Errors without a category are always visible.
• **Search in Insights panel:** Filter input in the header filters both Hot Files and Recurring Errors by keyword. Debounced at 150ms. Composes with category chip filtering.

### Changed

• **Refactor:** Extracted Crashlytics production bridge logic from `insights-panel.ts` into `insights-crashlytics-bridge.ts` for maintainability.

### Fixed

• **Stale gcloud cache on refresh:** The "Check Again" button now clears all cached state (gcloud availability, token, issue list) so users can recover after installing gcloud or re-authenticating without reloading VS Code.

---

## [2.0.0]

In this release we add Google Play Vitals, Firebase Crashlytics, ANR analysis, a recurring errors sidebar, a dedicated Trash panel, source scope filter, and a bunch of analysis and bug-report improvements.

<!-- cspell:ignore SIGSEGV -->

### Added

• **Google Play Console deep link:** New `saropaLogCapture.playConsole.appUrl` setting for a custom Play Console URL. If set, the "Open Play Console" button in the Vitals panel navigates directly to your app's Vitals page instead of the generic homepage.
• **Target device metadata:** Debug adapter type and target device are now stored in session `.meta.json`. Device is detected from Flutter launch output ("Launching ... on DEVICE") and launch config keys (`deviceId`, `device`, `deviceName`).
• **Environment distribution in Insights:** Cross-Session Insights panel now shows debug adapter, platform, and SDK version distribution across sessions in a collapsible "Environment" section.
• **ANR thread analysis:** Thread dump grouping now detects potential ANR patterns (main thread Runnable while other threads are Waiting/Blocked). Blocking threads get a warning badge and the summary line flags "ANR pattern detected".
• **Thread-aware bug report export:** Bug report stack trace extraction now continues past thread headers instead of stopping. Multi-thread traces include `--- threadName ---` separators in the exported markdown.
• **Package name auto-detection:** Detects Android package name from `google-services.json`, `AndroidManifest.xml`, or `pubspec.yaml`. Cached for 5 minutes. Override via `saropaLogCapture.firebase.packageName` setting. Enables scoping of Play Vitals and Crashlytics queries.
• **Crash category sub-classification:** Fingerprinted errors are now classified into categories: FATAL, ANR, OOM, NATIVE, or non-fatal. Categories are detected from error text patterns (e.g. `OutOfMemoryError` → OOM, `SIGSEGV` → NATIVE). Colored badges appear in the Insights panel and Recurring Errors sidebar.
• **Thread dump grouping:** When multiple consecutive thread headers are detected in log output (common in ANR dumps and `kill -3`), a "Thread dump (N threads)" summary marker is injected before the dump for visual grouping. Each thread's frames remain individually visible.
• **Google Play Vitals panel:** New opt-in sidebar panel showing crash rate and ANR rate from the Google Play Developer Reporting API. Displays rates with color-coded good/bad indicators against Google Play's bad-behavior thresholds (crash > 1.09%, ANR > 0.47%). Enable via `saropaLogCapture.playConsole.enabled` setting. Requires Play Console access and gcloud auth.
• **Relative time in session history:** Sessions within the last 24 hours show an approximate relative time after the timestamp — e.g. "4:13pm (2 hrs ago)", "(just now)", "(5 min ago)". Appears in both the Project Logs panel and the sidebar tree view. Omitted for sessions older than 24 hours.
• **Dedicated Trash panel:** Trash is now a standalone icon bar panel (between Info and Options) instead of a toggle inside the Project Logs panel. Shows trashed sessions with metadata and severity dots, supports right-click context menu (restore, delete permanently), and has an "Empty Trash" header button. Badge on the icon bar shows the trashed session count. Removed the confusing trashcan icon from the VS Code view title bar.
• **Pre-production ANR risk scoring:** New `anr-risk-scorer.ts` module scans debug session body text for patterns that predict ANRs (choreographer warnings, GC pauses, jank, dropped frames, ANR keywords) and produces a 0-100 risk score with low/medium/high levels. Score is computed on session finalization and stored in `.meta.json` sidecar. Sessions with ANR patterns show `ANR: N` in the Project Logs tree description and tooltip.
• **Debug-to-Crashlytics error bridge:** Cross-Session Insights panel now automatically matches recurring error patterns against production Crashlytics issues. Matching errors show a production impact badge (`Production: N events, N users`) via progressive webview update. Bridges the gap between development-time error detection and production crash data.
• **App version capture:** Detects app version from `pubspec.yaml`, `build.gradle`, or `package.json` during session finalization. Stored in `.meta.json` sidecar. Used for version range display on recurring errors.
• **Version range on recurring errors:** Insights panel shows `v1.2.0 → v1.4.1` on recurring error patterns, tracking the first and last app version where each error appeared.
• **Thread header parsing:** Recognizes Java/Android thread dump headers (`"main" tid=1 Runnable`, `--- main ---`) in log output and styles them as link-colored italic text in the viewer.
• **Error status lifecycle:** Recurring errors in the Insights panel can be closed (dimmed) or muted (hidden) via action buttons. Status persists in `.error-status.json`. Re-open restores visibility.
• **Recurring Errors sidebar panel:** Always-visible panel showing top error patterns across all sessions with triage actions (Close/Mute/Re-open). Auto-refreshes after session finalization. Links to the full Insights panel.
• **Source Scope filter:** Android Studio-style scope filtering in the Filters panel. Narrow log output by Workspace folder, Package, Directory, or File based on the active editor. DAP source paths are threaded from the debug adapter through to the webview. Package detection walks up from the file to find the nearest manifest (`pubspec.yaml`, `package.json`, `Cargo.toml`, etc.). Scope context updates automatically when switching editor tabs. "Hide unattributed" checkbox controls visibility of lines without DAP source paths. Integrates with filter badge count, preset reset, and panel sync.
• **Firebase Crashlytics:** Analysis panel queries Firebase Crashlytics REST API for matching production crashes. Shows crash issue title, event count, and affected users. Clicking an issue card fetches the latest crash event and renders classified stack frames inline (APP/FW badges, clickable app frames open source). Console deep link opens Firebase Console in browser. Auth via `gcloud` CLI with 30-minute token caching; config auto-detected from `google-services.json` or overridden via `saropaLogCapture.firebase.projectId` / `.appId` settings. Crash event detail is cached to `reports/.crashlytics/` to avoid repeated API calls. Gracefully degrades with actionable setup hints when gcloud or config is missing.
• **Expanded code tag detection:** Detects method names (`_logDebugError`, `dbActivityAdd`) and constructor calls (`ResizeImage()`, `Image()`) in addition to class names. Generic lifecycle methods (`build`, `dispose`, `initState`, etc.) are blacklisted to reduce noise. Section renamed from "Class Tags" to "Code Tags".
• **Tag chip "Show all" toggle:** Log Tags and Code Tags sections now show the top 20 chips by count, with a "Show all (N)" toggle to reveal the full list.
• **Session panel discoverability:** Six improvements to the Project Logs panel for better navigation when many sessions share similar names after datetime stripping:
  - Drag-resizable panel width (handle on left edge, persisted in display options)
  - Session duration in subtitle (computed from header Date and footer SESSION END timestamps)
  - Error/warning/performance colored dot counts (scanned from file body, cached in `.meta.json` sidecar)
  - Dim "(latest)" suffix on the newest session per unique display name
  - "Latest only" toggle filters to one-per-name for quick access
  - Inline correlation tag chips (replaces QuickPick) with All/None controls for filtering sessions by tag
• **Correlation tags documentation:** New `docs/correlation-tags.md` explaining what tags are, how they're generated, how to filter, and how to rescan.
• **Configurable icon bar position:** New `saropaLogCapture.iconBarPosition` setting (`"left"` or `"right"`, default `"left"`). The icon bar and all slide-out panels now default to the left side of the viewer, matching VS Code's activity bar convention. Changes apply instantly without reload.
• **Lint violation integration:** Bug reports now include a "Known Lint Issues" section sourced from Saropa Lints' structured export (`reports/.saropa_lints/violations.json`). Violations are matched to stack trace files, sorted by impact and proximity, and rendered as a markdown table with source attribution and staleness warning. Critical violations surface in the executive summary as high-relevance findings.
• **ANR badge:** Performance-level log lines containing ANR-specific keywords (`ANR`, `Application Not Responding`, `Input dispatching timed out`) now display an orange stopwatch badge. Separates ANR signals from general jank/fps/choreographer noise. ANR count also tracked in session severity metadata.
• **Time-windowed insights:** Cross-Session Insights panel now includes a time range dropdown (All time, Last 30 days, Last 7 days, Last 24 hours) that filters which sessions are included in the aggregation. Session dates are parsed from log filenames.
• **Impact-weighted error sorting:** Recurring errors in the Insights panel are now sorted by impact score (sessions × occurrences) instead of session count alone, matching Android Vitals' event×user ranking.
• **Insights refresh timestamp:** Cross-Session Insights panel header now shows data age ("just now", "42s ago", "3m ago") alongside the session/file/error summary, giving confidence in data freshness.
• **Crashlytics issue list cache:** Top issues API response is cached in memory for 5 minutes to avoid redundant API calls during repeated analyses. Explicit refresh (sidebar button or auto-refresh timer) bypasses the cache.
• **Generalized production error bridge:** Cross-Session Insights panel now matches ALL recurring error patterns against Crashlytics production issues (previously ANR-only). Uses word extraction from both example lines and normalized text for broader matching.
• **Package-hint file resolution:** Stack frame file resolution now extracts Dart package names and Java package paths from frame text and passes them to `findInWorkspace()` for more accurate disambiguation in monorepo/multi-package workspaces. Wired through the analysis panel and bug report collector.
• **Crashlytics aggregate device/OS distribution:** Crash detail cards now query the Crashlytics stats endpoint for aggregate device model and OS version distribution across all events, rendered as a collapsible bar chart. Fetched asynchronously after the initial crash detail render.
• **Session error density sparklines:** Project Logs panel now shows a tiny relative heat bar per session indicating error density (total issues / line count) compared to sibling sessions. Color reflects dominant severity (red for errors, yellow for warnings, blue for performance). Width normalizes against the densest session in the list.

### Improved

• **Snappier panel transitions:** All slide-out panel animations reduced from 300ms to 150ms for a more responsive feel.
• **Crashlytics crash detail loading feedback:** Clicking an issue card in the Crashlytics sidebar now shows a pulsing "Loading crash details..." message while the API call is in flight, replacing the previous silent wait.
• **Parallelized file operations:** File retention enforcement, documentation token scanning, referenced file analysis, and session shutdown now run concurrently (`Promise.all` / `Promise.allSettled`) instead of sequential loops. File retention startup with 100+ files improves from ~3s to ~200ms.
• **Split failure logging:** Log file split errors are now logged to the extension host console instead of silently swallowed.

### Changed

• **Project Logs panel auto-opens** when the sidebar first loads, so the session list is immediately visible alongside the active log.
• **ESLint `max-lines` excludes blank lines and comments:** The 300-line file limit now uses `skipBlankLines: true` and `skipComments: true`, so readability is never sacrificed for the metric.
• **ESLint config hardened:** Enforces `max-params: 4`, `max-depth: 3`, `no-explicit-any`, `no-unused-vars` (with `_` prefix pattern), `prefer-const`, and correctness rules. Functions exceeding 4 parameters refactored to use option objects (`FileLinkOptions`, `ViewerHtmlOptions`, `ShellOptions`, `BookmarkInput`, `EditLineInput`, `SessionActionContext`).

### Fixed

• **Filter presets test:** Fixed "Errors Only" preset test to check `levels` instead of removed `searchPattern` field.
• **Copy includes UI chrome:** Ctrl+C near the bottom of the log viewer included footer, search panel, and session history text. Native text selection is now confined to the viewport via CSS `user-select`, and native click-drag selections are routed through the VS Code clipboard API.
• **Tag chips not rendering:** Tag chip containers in the Filters panel were permanently empty — `syncFiltersPanelUi()` now calls `rebuildTagChips()` and `rebuildClassTagChips()` when opening the panel.
• **Quick Filters presets broken:** "Errors Only" preset used DAP `categories: ['stderr']` which hides all Flutter output (category is `"console"`). Presets now use `levels` field for severity-based filtering. Also fixed monkey-patch on `applyFilter` that immediately reset the active preset during application.
• **Preset save losing levels:** `promptSavePreset()` parameter type now includes `levels` so saving a preset after applying a level-based filter preserves the level configuration.
• **Crashlytics sidebar shows no issues:** `matchIssues()` filtered out all results when called without error tokens (sidebar panel use case). Skips token filter when no tokens provided.
• **CodeLens event counts always zero:** `buildIndexFromCache()` never incremented `totalEvents`. Fixed accumulation to properly count events per issue.
• **AI summary model selection:** Hardcoded `gpt-4o` family name is not a VS Code Language Model API family. Uses `selectChatModels()` without family filter.
• **XSS in Crashlytics panel:** Inline `onclick` handlers with interpolated issue IDs replaced with `data-*` attributes and delegated click handlers.

---

## [1.2.0]

We add a related-lines timeline in the analysis panel, referenced files with blame, GitHub PR/issues context, and progress indicators with timeouts.

### Added

• **Related lines:** When analyzing a tagged log line (e.g. HERO-DEBUG), all lines sharing that source tag are shown as a diagnostic timeline with clickable line navigation and source file references.
• **Referenced files:** Source files referenced across related lines are analyzed with git blame, annotations, and recent change detection — providing multi-file context instead of single-file analysis.
• **GitHub context:** Queries `gh` CLI for PRs touching affected files, issues matching error tokens, and blame-to-PR mapping that identifies which PR likely introduced the bug. Auto-detects `gh` availability with actionable setup hints.
• **Enhanced token search:** Token search, docs scan, and symbol resolution now use enriched tokens from ALL related lines, not just the analyzed line.
• **Analysis panel progress:** Header progress bar with "X/N complete" counter, per-section spinner text updates showing sub-step descriptions (e.g. "Running git blame...", "Querying language server..."), and smooth CSS transitions. Bar turns green and fades on completion.

### Fixed

• **Analysis panel timeout:** Line analysis spinners no longer hang indefinitely when VS Code APIs (symbol resolution, docs scan, token search) are unresponsive. Each analysis stream now has a 15-second timeout; timed-out sections show a clear "Analysis timed out" message instead of spinning forever.

---

## [1.1.3]

We add a dedicated Filters panel and tag search, show session metadata in Project Logs, and retire the Session History tree in favor of the webview panel.

### Added

• **Filters panel:** Moved all filter controls (Quick Filters, Output Channels, Log Tags, Class Tags, Noise Reduction) from the Options panel into a dedicated Filters panel with its own icon bar button. Options panel now contains only Display, Layout, Audio, and Actions.
• **Tag search in Filters panel:** Search input at the top of the Filters panel filters tag chips by label text across both Log Tags and Class Tags sections, making it easy to find specific tags among many.
• **Session metadata in Project Logs:** Each session item now shows line count (e.g. "2,645 lines") and all tag types (#manual, ~auto, @correlation) in the meta line, matching the Session History tree view.
• **Tag filtering in Project Logs:** "Tags" button in the session panel toolbar opens the correlation tag QuickPick to filter sessions by tag.

### Removed

• **Session History tree view:** The native tree view has been removed. All session management (browse, rename, tag, trash, export, filter) is now in the Project Logs webview panel.

### Fixed

• **Logcat prefix tag detection:** ALL-CAPS prefixes (e.g. `MY_APP`, `NET_UTIL`) in logcat message bodies are now detected before bracket tags, fixing cases where a bracket tag later in the line would shadow the prefix.

---

## [1.1.2]

We add a Class Tags filter, a session context menu (rename, tag, export, trash), a Trash section in Project Logs, and search in the options panel.

### Added

• **Class Tags filter:** Detects PascalCase class names (e.g. `AppBadgeService.load()`, `_EventBadgeWrapperState._loadBadgeCount`) in log lines and stack traces. Classes appearing 2+ times show as filterable chips in a new "Class Tags" section of the filters panel, with toggle, solo, all/none controls matching the existing Log Tags UX.
• **Session context menu:** Right-click any session in the Project Logs panel for Open, Rename, Tag, Export (HTML/CSV/JSON/JSONL), Copy Deep Link, Copy File Path, Move to Trash, Restore, and Delete Permanently.
• **Trash section in Project Logs panel:** Trashed sessions appear in a visible "Trash" section with count badge, "Empty Trash" button, and a toggle to show/hide the section. Trash is visible by default.
• **Options panel search filter:** Type-to-filter input at the top of the options panel to quickly find settings by keyword. Sections and rows that don't match are hidden in real time; clearing the input restores all options.

### Added (tests)

• **Config tests:** `isTrackedFile`, `shouldRedactEnvVar`, `getFileTypeGlob` — file type matching, env var redaction patterns, glob generation.
• **Deduplication tests:** `Deduplicator` process/flush/reset, time window expiry, count formatting.
• **Flood guard tests:** `FloodGuard` check/reset, suppression threshold, suppressed count reporting.
• **Level classifier tests:** `classifyLevel` for stderr, logcat prefixes, strict/loose error detection, all severity levels. `isActionableLevel` for all levels.
• **Error fingerprint tests:** `normalizeLine` (ANSI, timestamps, UUIDs, hex, paths), `hashFingerprint` determinism and format.
• **Analysis relevance tests:** `scoreRelevance` for blame, line history, cross-session, correlation, docs, annotations, affected files, section levels. `daysAgo` parsing.
• **Line analyzer tests:** `extractAnalysisTokens` for error classes, HTTP statuses, URL paths, quoted strings, class methods, source refs, deduplication. `extractAnalysisToken` convenience wrapper.
• **Bug report formatter tests:** `formatBugReport` structure, stack trace formatting (app/fw frames), log context, environment tables, optional sections (blame, git history, cross-session, affected files), singular/plural.

### Fixed

• **Copy icon not pinned to viewer edge:** Replaced per-line `.copy-icon` spans with a single floating `#copy-float` overlay positioned at the right edge of the log content area. The icon now stays pinned to the viewer's far right regardless of content width or scroll position, with a 150ms hover grace period for mouse-to-icon transitions.

### Changed

• **Publish script version bump prompt:** When package.json version is not ahead of the CHANGELOG max, the script now offers to bump the patch version interactively instead of failing.

---

## [1.1.1]

We restored the Session History panel (it was accidentally hidden) and added a Trash button to the Log Viewer toolbar.

### Fixed

• **Session History panel hidden:** Removed `"when": "false"` that permanently hid the Session History tree view, preventing access to trash, tag filtering, and session management.

### Added

• **Trash button in Log Viewer:** Trash icon in the Log Viewer toolbar sends the currently-viewed file to trash directly, without needing the Session History context menu.

### Changed

• **Line count moved to right side of footer:** Line count now appears right-aligned next to the filter badge, preventing layout jumps when filename or status text changes. When filters are active, shows visible/total format (e.g. "4/500 lines").

---

## [1.1.0]

We add level text colors and a toggle, clickable inline tag links with solo-filter, sub-tag detection for logcat, and keyword-scope highlight rules.

### Fixed

• **Level text coloring lost when decorations enabled:** Line text coloring (error=red, warning=gold, etc.) was suppressed whenever decorations were on (the default). Decoupled text colors from the decoration toggle so both work together.
• **Tag link color not visible:** Inline tag colors were overridden by ANSI color spans and level CSS. Switched to CSS custom properties (`--tag-clr`) with `!important` for guaranteed visibility. Replaced conflicting palette color (`#dcdcaa` matched debug-level yellow).

### Added

• **Level text colors toggle:** New "Level text colors" checkbox in decoration settings panel (on by default). Controls whether lines are colored by severity level.
• **Info-level line color:** Lines classified as `info` (including logcat `I/` lines) now render in blue (`#3794ff`) instead of the default foreground.
• **Logcat V/ reclassified as debug:** Verbose logcat lines now get the same dim yellow treatment as `D/` lines instead of being uncolored.
• **Keyword-scope highlight rules:** Highlight rules now support `"scope": "keyword"` to color only the matched text within a line (instead of the entire line). Configure via `saropaLogCapture.highlightRules` in settings.
• **Clickable inline tag links:** Source tags (logcat tags, bracket tags) are now rendered as colored, clickable elements directly in log lines. Hover to see the tag name; click to solo-filter the view to only that tag's lines (click again to clear). Colors are auto-assigned per tag from an 8-color palette.
• **Sub-tag detection for generic logcat tags:** Lines from generic sources like `I/flutter` now extract more specific sub-tags from the message body. Patterns like `HERO-DEBUG` (ALL-CAPS prefix) and `[Awesome Notifications]` (bracket tag) are promoted to first-class filterable tags instead of being lumped under "flutter".
• **Dual-tag support for logcat prefix tags:** When a sub-tag is detected (e.g., `HERO-DEBUG` from `I/flutter`), both the sub-tag and the parent logcat tag (`flutter`) now appear as filterable tag chips. Both tags render as colored links in log lines. A line is hidden only when all its tags are hidden, so filtering by either tag keeps its lines visible.

---

## [1.0.1]

Patch release with minor fixes and alignment.

---

## [1.0.0]

We call this 1.0: subfolder scanning, session trash (retention uses trash instead of delete), bug report and minimap fixes, affected files in reports, and a lot of UX improvements.

### Fixed

• **Bug report preview rendering:** Code blocks were broken in the preview panel because the inline code regex consumed backticks from triple-backtick fences. Fixed by processing code blocks before inline code and restricting inline code to single lines.
• **Bug report source file resolution:** Absolute file paths (e.g. `D:\src\project\lib\file.dart`) were passed to a workspace glob search that never matched, silently preventing all source code, git blame, git history, import, and line-range sections from appearing. Now tries the absolute path directly before falling back to filename search.
• **Minimap drag-stuck scrolling:** Dragging the minimap and releasing the mouse outside the webview left scroll handlers permanently attached, causing erratic scrolling on subsequent mouse movement. Replaced mouse events with Pointer Capture API so `pointerup` always fires regardless of cursor position.
• **Minimap marker positioning:** Severity markers could cluster at the top of the minimap when the panel height was measured before layout settled. Added minimum-height guard (retries when panel < 50 px), trailing-edge debounce, visibility-change rebuild, double-RAF init, and replaced CSS `height: 100%` with `align-self: stretch` for reliable flex height resolution.

### Added

• **Subfolder scanning (`includeSubfolders`):** New setting (default true) makes the Project Logs panel, search, comparison, delete, insights, and file retention scan subdirectories under the reports directory. Shared `readTrackedFiles()` utility replaces per-module scanning logic. Depth-limited to 10 levels; dot-directories are skipped.
• **Trash can for session files:** Sessions can be moved to trash (sidecar flag) instead of permanently deleted. Toggle trash visibility with the eye icon in the Session History toolbar. "Empty Trash" permanently deletes all trashed files after a modal confirmation. Context menu shows "Move to Trash" on live sessions and "Restore from Trash" on trashed ones.
• **Retention uses trash:** File retention (`maxLogFiles`) now marks excess files as trashed instead of deleting them, and excludes already-trashed files from the count. Default changed from 10 to 0 (off) so auto-cleanup is opt-in.
• **Line count in Project Logs tree:** Each session now shows its line count before the file size in the tree description (e.g. `Dart · 4:13pm · 1,234 lines · 24.5 KB`). Active sessions show a `●` indicator after the count. Count is parsed from the session footer when available, with a newline-count fallback. Tooltips and split group summaries also include line counts.
• **Metadata cache:** Session history tree caches parsed file metadata keyed on URI+mtime+size, avoiding redundant file reads for unchanged log files.
• **Adaptive tree refresh debounce:** File-change events during active recording are debounced (3s / 10s / 30s scaling with line count) to avoid excessive tree rebuilds. New `treeRefreshInterval` setting allows a fixed override.
• **Affected Files section:** Bug reports now analyze up to 5 additional source files from the stack trace (beyond the primary error line). Each file shows git blame and recent commit history. Files are deduplicated and analyzed in parallel.
• **Marketplace link:** Bug report header links to the VS Code Marketplace listing.
• **Footer promotion:** Bug report footer recommends Saropa Lints and links to saropa.com.
• **Affected file count scoring:** Executive summary reports when an error spans 3+ source files.
• **Sources section:** Bug report header now lists all file and web sources (log file, analyzed source files, referenced docs, git remote URL).

### Improved

• **Code extraction:** Moved header parsing, description, and tooltip helpers from `session-history-provider.ts` into dedicated `session-history-helpers.ts` for better modularity and line budget.
• **Copy button:** Renamed from "Copy to Clipboard" to "Copy Markdown" for clarity.
• **Save filename:** Default save filename includes timestamp, `saropa_log_capture` branding, project name, and error subject (e.g. `20260207_184603_saropa_log_capture_contacts_email_panel_bug_report.md`).
• **Preview link rendering:** Markdown `[text](url)` links now render as `<a>` tags in the bug report preview.
• **Preview heading support:** Added `###` (h3) rendering for per-file subsection headings.

---

## [0.3.1]

We add a session navigation bar, correlation tags and error fingerprints, Cross-Session Insights, Generate Bug Report, and logcat-aware level classification.

### Added

• **Session navigation bar:** When viewing a historical log file, a "Session N of M" navigation bar appears with Previous/Next buttons to step through sessions by modification time. Hides during live capture, re-appears on session end. Follows the split-nav breadcrumb pattern and handles split file groups as single units.
• **Correlation tags:** Sessions are automatically scanned on finalization for source file references and error class names. Tags like `file:handler.dart` and `error:SocketException` appear in the session history description (prefixed with `@`). A manual "Rescan Correlation Tags" command is available in the session context menu.
• **Filter sessions by tag:** New "Filter Sessions by Tag" command in the session history toolbar. Shows a multi-select quick pick of all correlation tags across sessions; selecting tags filters the history tree to only matching sessions.
• **Error fingerprints:** Sessions are scanned for error lines on finalization. Errors are normalized (timestamps, UUIDs, numbers removed) and hashed for cross-session grouping. Stored in sidecar metadata.
• **Analyze Across Sessions:** New context menu item on log lines. Extracts tokens (source files, error classes, URLs, etc.) from the line and searches all past sessions, showing results grouped by token type with workspace context (git history, source annotations).
• **Cross-Session Insights panel:** New command in the session history toolbar. Aggregates data across all sessions to show hot files (most-referenced source files) and recurring error patterns with session/occurrence counts.
• **Generate Bug Report:** Right-click an error line → "Generate Bug Report" packages all evidence into structured markdown: error + fingerprint, stack trace (app vs framework), log context, environment, source code, git history, and cross-session matches. Auto-copied to clipboard and shown in a preview panel.
• **Insights drill-down:** Click a recurring error in the Insights Panel to expand all occurrences grouped by session. Uses fuzzy regex matching so errors with different timestamps/IDs match across sessions. Click any match to jump to that line.
• **Session Timeline:** Right-click a session in Session History → "Show Timeline" to see an SVG chart plotting errors, warnings, and performance issues over time. Click a dot to navigate to that line. Auto-buckets dense sessions for smooth rendering.
• **Executive summary:** Analysis panel now shows a "Key Findings" banner with 2–4 relevance-scored insights (recent blame, recurring error, nearby annotations, doc references). Low-relevance sections auto-collapse.
• **Root cause correlation:** When a crash line was recently modified, the analysis compares the git blame date against the error's cross-session first appearance. A match within 3 days produces "Error likely introduced by commit `abc1234`".
• **Stack trace deep-dive:** Stack frames below an error are parsed and displayed with APP/FW badges. Click an app-code frame to expand inline source preview and git blame. Framework frames are dimmed.
• **Error trend chart:** Recurring errors show a compact SVG bar chart of occurrences per session, turning "Seen 5 times across 3 sessions" into a scannable timeline.
• **Bug report blame section:** Generated bug reports now include a Git Blame section and use the error's cross-session first-seen date for root cause correlation scoring in the Key Findings summary.

### Improved

• **Logcat-aware level classification:** Android logcat prefixes (`E/`, `W/`, `I/`, `D/`, `V/`, `F/`) are now used as the primary level signal. Previously, text pattern matching could override the prefix — e.g. `I/CCodecConfig: query failed` was misclassified as 'error' due to the word "failed". Now the logcat prefix takes priority, preventing false error/warning classifications on framework info/debug lines. Content-type patterns (performance, TODO) still refine `D/`/`V/`/`I/` lines.

### Added

• **Deemphasize Framework Levels setting:** New `saropaLogCapture.deemphasizeFrameworkLevels` option (default: off). When enabled, framework log lines (`fw=true`) no longer show error/warning text coloring — resolving the visual mismatch where framework `E/` lines showed red text but a blue severity bar. The log level prefix is just the opinion of the code author; framework `E/` logs are often handled internally with no user impact.

### Fixed

• **"App Only: OFF" not capturing all debug output:** With default settings, debug adapters that send output under non-standard DAP categories (e.g. Flutter system logs) were silently dropped because `captureAll` defaulted to `false`. Changed the default to `true` so all Debug Console output is captured regardless of category, matching the "never lose data" design principle.
• **Exclusions bypassed when `captureAll` enabled:** The `captureAll` setting previously bypassed both category filtering and exclusion filtering. Now it only bypasses category filtering — user-configured exclusions always apply independently.
• **Early debug output missed on session start:** The DAP tracker activates synchronously but session initialization is async (disk I/O). Output events arriving during this window were silently dropped. Added an early event buffer that captures events before the session is registered and replays them once initialization completes.
• **Timestamp/milliseconds/elapsed checkboxes disabled:** The Timestamp, Show milliseconds, and Elapsed time decoration toggles under Line prefix were non-interactive due to a `timestampsAvailable` flag that could disable them. Removed the mechanism so these toggles are always user-controllable.

---

## [0.2.9]

We add strict/loose level detection, double-click to solo a level, a hover copy icon on lines, and fix sidebar state, scroll jumps, and search behavior.

### Improved

• **Context lines visual separation:** When level filtering shows context lines around matches, the first context line in each group now displays a subtle dashed separator. Context lines no longer show level coloring, tint, or severity bars — they appear uniformly dimmed to clearly distinguish them from matched lines.

### Added

• **Level detection mode (`saropaLogCapture.levelDetection`):** New setting to control how aggressively lines are classified as errors. `"strict"` (default) requires keywords in label positions (`Error:`, `[ERROR]`, `TypeError:`) and only applies bug/critical/transient badges to error-level lines. `"loose"` matches keywords anywhere in the text but excludes common descriptive compounds (e.g. "error handling", "error recovery"). Both modes are smarter than the previous behavior, which flagged lint descriptions like "complicates error handling" as errors.
• **Double-click to solo a level filter:** Double-clicking a footer level dot now disables all other levels, isolating that single level.
• **Hover copy icon on log lines:** A copy icon appears on the far right of each log line on hover. Clicking it copies the line's plain text to the clipboard and shows a brief "Copied" toast. Works on regular lines, stack headers, and stack frames (not markers). Uses `visibility`/`pointer-events` instead of `display` to avoid codicon CSS specificity conflicts.

### Changed

• **Footer dots hidden when count is zero:** Level filter dots in the footer are now hidden for levels with no matching log lines, reducing visual noise.
• **Bottom padding in log viewer:** Added padding below the last log line so it's easier to select text near the end of the content.

### Fixed

• **Double-click solo level not toggleable:** Double-clicking a footer level dot to solo a level worked, but double-clicking the same dot again did not restore all levels. Now toggles back to all levels when the solo'd dot is double-clicked again.
• **Sidebar state lost on tab switch:** Switching from the Saropa Log Capture panel to another bottom panel tab (Problems, Output, Terminal, etc.) and back reset the entire viewer — deselecting the file, clearing filters, losing scroll position, and resetting all options. The sidebar webview was being fully disposed and recreated on each tab switch. Added `retainContextWhenHidden` to the webview provider registration so VS Code keeps the DOM alive when the panel is hidden.
• **Mousewheel scrolling jumps to start/end:** Fast mouse wheel scrolling with acceleration caused the log viewer to jump to the very start or end instead of scrolling naturally. Chromium's CSS scroll anchoring couldn't find stable anchor nodes after virtual scrolling DOM rebuilds, misadjusting `scrollTop`. Fixed by disabling `overflow-anchor` and intercepting wheel events with manual `scrollTop` control, matching the approach already used by the minimap.
• **Click-to-source spawns new editor groups:** Clicking a source link in the sidebar log viewer opened the file in a new editor group each time because `ViewColumn.Active` resolved to the sidebar webview instead of an editor column. Now targets the last-focused text editor's group, falling back to the first group.
• **Horizontal scrollbar hidden in no-wrap mode:** The log viewer's scrollbar-hiding CSS (`scrollbar-width: none`, `::-webkit-scrollbar { display: none }`) suppressed all scrollbars including horizontal. Vertical scrollbar is now hidden via `width: 0` (minimap replaces it) while the horizontal scrollbar is properly styled and visible when word-wrap is off.
• **Search text erased while typing in highlight mode:** Every debounced keystroke called `clearSearchFilter()` → `recalcAndRender()` even though highlight mode never sets `searchFiltered` flags — triggering a full O(n) height recalc, prefix-sum rebuild, and viewport render that was entirely unnecessary. Added a `searchFilterDirty` flag so `clearSearchFilter()` short-circuits when there is nothing to clear, and removed the unconditional input-clearing in `openSearch()`.
• **Search mode toggle does not apply:** Switching from highlight to filter mode required retyping the query because `toggleSearchMode()` guarded `updateSearch()` behind `searchInputEl.value` — which was empty if the input had been cleared by the bug above. The guard has been removed so the mode switch always re-runs the search.

---

## [0.2.8]

We add a bookmark count badge and instant bookmark add, and fix minimap and context menu positioning.

### Added

• **Bookmark count badge:** The bookmarks icon in the icon bar now displays a count badge showing the total number of bookmarks. Hidden when count is zero, caps at "99+".

### Changed

• **Instant bookmark adding:** "Bookmark Line" in the context menu now adds the bookmark immediately with no modal prompt. Notes can be added afterwards from the bookmarks panel via the edit button.
• **Removed standalone "Add Note" from context menu:** The separate "Add Note" menu item has been removed. Notes are now exclusively managed through bookmarks — add a bookmark first, then edit its note from the bookmarks panel.

### Fixed

• **Minimap markers stacked at top:** All severity markers rendered at position 0 because percentage-based CSS `top` didn't resolve against the flex-stretched container height. Switched to pixel-based positioning computed from `clientHeight`, and added `height: 100%` to the minimap container.
• **Minimap empty for info-level content:** Files where most lines lacked error/warning keywords (e.g. lint reports) produced no minimap markers because info-level lines were excluded. Info-level lines now show subtle green markers for files under 5,000 visible lines.
• **Minimap not updating on panel resize:** Added a `ResizeObserver` on the minimap element so pixel positions recalculate when the panel is resized.
• **Context menu clipped at top of viewport:** Right-clicking the top row pushed the menu above the webview (negative `top`), hiding most items. Menu position is now clamped to viewport edges, and `max-height` with `overflow-y: auto` ensures all items are scrollable when space is tight.
• **Invisible footer level dots:** The footer's colored level indicators (info, warning, error, etc.) were invisible because CSP nonces in `style-src` silently disabled `'unsafe-inline'`, blocking inline `style` attributes. Moved all inline visual styles to CSS classes so they load via the nonce-tagged `<style>` block instead.

---

## [0.2.7]

We fixed the Find in Files icon, moved Bookmarks into the icon bar panel, and made Pop Out available only from the title bar.

### Fixed

• **Find in Files icon missing:** Replaced invalid `codicon-search-view` (not in codicons 0.0.44) with `codicon-list-filter` so the icon bar button renders correctly.

### Changed

• **Bookmarks panel moved to icon bar:** Bookmarks are now a slide-out panel inside the Log Viewer (accessible via the bookmark icon in the icon bar) instead of a separate native tree view. The native tree view, its commands, and menu entries have been removed.
• **Pop Out moved to title bar only:** Removed the Pop Out button from the webview icon bar. Pop Out is now accessible only from the native view title bar action, matching standard VS Code panel conventions.
• **Session panel Tidy icon:** Replaced `codicon-text-size` with `codicon-edit` on the Tidy toggle button. The "Aa" glyph had more visual mass than the calendar, tree, and arrow icons on adjacent buttons.

---

## [0.2.6]

We add configurable file types, Find in Files across logs, a Bookmarks panel, a context lines slider, and a bunch of viewer fixes.

### Added

• **Configurable file types (`saropaLogCapture.fileTypes`):** The session history, search, file retention, delete, and comparison features now recognize configurable file extensions beyond `.log`. Default: `.log`, `.txt`, `.md`, `.csv`, `.json`, `.jsonl`, `.html`. Drop a `.txt` or `.md` into the reports directory and it appears in the session list. The setting is an array of dot-prefixed extensions; reload the window after changes.
• **Find in Files panel (Ctrl+Shift+F):** New "Find in Files" icon in the activity bar searches all log files in the reports directory concurrently. Shows matched files with match count badges. Click a file to open it and jump to the first match; click again to cycle through subsequent matches. Supports case-sensitive, whole-word, and regex toggles matching the in-file search options. Results update with 300ms debounce as you type.
• **Bookmarks panel:** New "Bookmarks" tab in the Saropa Log Capture panel. Right-click any log line and choose "Bookmark Line" to save it with an optional note. Bookmarks are grouped by file, persist across sessions via workspace state, and clicking a bookmark navigates back to that line. Includes search/filter, edit note, delete individual or all bookmarks with confirmation dialogs.
• **Context lines slider in level flyup:** The level filter fly-up menu now includes a slider (0–10) to adjust how many preceding context lines are shown when filtering by level. Replaces the static VS Code setting default for real-time control.
• **Source link context menu:** Right-clicking a filename/source reference (e.g. `lib/main.dart:42`) now shows file-specific actions: Open File, Copy Relative Path, and Copy Full Path. Previously showed the browser's default Cut/Copy/Paste menu.
• **Copy Line and Copy All in context menu:** Right-click a log line to see Copy Line and Copy All at the top of the menu. Decorated variants (Copy Line Decorated, Copy All Decorated) include the level emoji, sequence counter, and timestamp prefix.
• **Inline Go to Line (Ctrl+G):** Replaced the VS Code input box round-trip with an inline overlay that scrolls instantly while typing. Numbers-only input, Escape reverts to original position, Enter confirms. Animated slide-down appearance.

### Fixed

• **Right-click line detection:** Log line elements were missing `data-idx` attributes, so the context menu could never identify which line was right-clicked. All line-specific menu items (Copy Line, Pin, etc.) now appear correctly.
• **Ctrl+A selecting footer:** Added `user-select: none` to the footer bar so Ctrl+A only selects log content, not the status bar.
• **False "performance" classification:** Removed overly generic `slow` and `lag` keywords from the performance-level regex. Words like "slow-cooked" in normal log data no longer trigger the performance filter.
• **Unformatted line counts:** Footer line count, level filter dot counts, fly-up circle counts, and VS Code status bar now display comma-separated numbers (e.g., `12,868` instead of `12868`).
• **Level filter dots hard to see:** Increased dot size from 9px to 10px with `min-width`/`min-height` guarantees and wider gap (1px → 3px) between dot and count for clearer visibility.
• **Footer filename not actionable:** Clicking the log filename in the footer now reveals and selects the file in the Session History tree view. The filename shows a dotted underline and turns blue on hover to indicate it is clickable.
• **Minimap markers not updating:** Markers now show for all non-info severity levels (error, warning, performance, todo, debug, notice) with distinct colors. Added direct `scheduleMinimap()` calls in the data flow so the minimap rebuilds reliably when new lines arrive or data is cleared, independent of the monkey-patch hook on `renderViewport`.
• **Minimap click vs drag:** Clicking the minimap immediately entered drag mode, so any mouse movement after a click caused unwanted scrolling. Now a single click navigates to that position and stops; drag mode only activates after 3px of movement while holding the mouse button.
• **Minimap drag scrolling broken:** Dragging the minimap caused erratic viewer movement because `suppressScroll` was reset immediately, allowing the RAF-debounced scroll handler to fire mid-drag and trigger `renderViewport` DOM changes that destabilized the scroll position. Now `suppressScroll` stays true for the entire drag operation, with viewport rendering done synchronously in `scrollToMinimapY`.
• **Minimap scroll mapping used stale height:** Click and drag positions were mapped using `minimapCachedHeight` which could be 120ms stale. Now uses a `mmHeight()` helper that falls back to the always-current `totalHeight` global.
• **Minimap wheel deltaMode not handled:** Forwarded `deltaY` as raw pixels regardless of `e.deltaMode`, so line-mode or page-mode scroll events barely moved the content. Now multiplies by `ROW_HEIGHT` or `clientHeight` for modes 1 and 2.
• **Minimap markers hidden behind viewport indicator:** Added `z-index: 1` to `.minimap-marker` so colored severity markers paint above the semi-transparent viewport overlay.

---

## [0.2.5]

We add a right-click context menu, Go to Line (Ctrl+G), keyboard and scroll font zoom, and search/match persistence.

### Added

• **Right-click context menu:** Custom context menu on log lines with Copy (line text), Search Codebase, Search Past Sessions, Open Source File, Show Context, Pin Line, Add Note, Add to Watch List, and Add to Exclusions. Global actions (Copy selection, Select All) appear regardless of click target. Line-specific items auto-hide when right-clicking empty space.
• **Show Context in context menu:** The inline peek (surrounding context lines) is now triggered via right-click → "Show Context" instead of double-click. Double-click now performs native word selection as expected.
• **Go to Line (Ctrl+G):** Opens a VS Code input box to jump to a specific line number. Scrolls the virtual viewport to the target line.
• **Page Up / Page Down:** PgUp and PgDn keys scroll the log content by 80% of the viewport height.
• **Keyboard font zoom:** Ctrl+= / Ctrl+- adjust font size by 1px. Ctrl+0 resets to 13px default.
• **Ctrl+scroll zoom:** Hold Ctrl and scroll the mouse wheel to increase/decrease font size.
• **Ctrl+A scoped to log content:** Ctrl+A selects only the visible log lines in the viewport, not the entire webview UI (icon bar, panels, footer).
• **Tab navigation and focus indicators:** Icon bar buttons are now keyboard-navigable via Tab. Focus-visible outlines use `--vscode-focusBorder` for accessibility.
• **Search match persistence:** Closing the search panel no longer clears match positions. Reopening restores the previous query and match index, so F3 continues from where you left off.
• **CSS animations throughout the viewer:** Context menu fades in with a subtle scale, level flyup slides up from the footer, log line hover backgrounds transition smoothly, footer buttons blend on hover, filter badges pop in when activated, search current-match pulses on navigation, minimap viewport glides instead of jumping, inline peek slides open, jump-to-bottom button fades in, and pinned items slide in from the left. All pure CSS with short durations (0.08–0.4s) to feel responsive without sluggishness.

### Removed

• **Source preview hover popup:** Removed the floating tooltip that appeared when hovering over source links in stack traces. The popup was easily triggered accidentally and obscured log content. Single-click on source links (or right-click → Open Source File) already navigates to the file.
• **Watch count chips in footer:** Removed the red/yellow keyword watch chips from the viewer footer. They duplicated the level classification counts and confused the UX. Watch counts remain visible in the VS Code status bar.
• **Minimap toggle:** The scrollbar minimap is now always on — there is no reason not to have it. Removed the `opt-minimap` checkbox from the Options panel, the `toggleMinimap()` function, and the `minimap-active` CSS class. Native scrollbar is always hidden; the minimap panel is the only scrollbar.

### Changed

• **Clickable level filter dots:** Each colored dot in the footer now directly toggles its level filter on click (e.g., click the red dot to hide/show errors). Previously, clicking anywhere on the dots opened the fly-up menu.
• **Level dot counts:** Footer dots now show live counts next to each dot when > 0, so you can see at a glance how many errors, warnings, etc. exist.
• **Fly-up menu trigger:** The fly-up filter menu (with Select All/None and text labels) is now opened by clicking the "All"/"3/7" label text instead of the dots.
• **Status bar opens log file:** Clicking the status bar line count now opens the active log file in the editor instead of just focusing the sidebar viewer tab. Follows the "counts are promises" principle — if the bar shows a count, clicking reveals the underlying data.
• **Inline exclusion input:** Exclusion patterns can now be added directly in the Options panel via a text input + Add button. Replaces the previous "Configure in Settings" link that opened VS Code's JSON settings.
• **Visual spacing enabled by default:** Breathing room between log sections is now on by default for easier reading. Toggle off via the options panel.
• **Word wrap disabled by default:** Log lines no longer wrap by default, preserving original formatting. Toggle on via the options panel or press W.
• **Double-click restores native behavior:** Removed the double-click handler that opened the inline peek context modal. Double-click now selects words normally, matching standard text editor behavior.

### Fixed

• **App-only filter had no effect on regular log lines:** The "App only (hide framework)" toggle only hid framework stack frames (`    at ...` lines), ignoring regular output. Android logcat lines (`D/FlutterJNI`, `D/FirebaseSessions`, `I/Choreographer`, etc.) passed through unfiltered. Extended line classification to detect Android logcat tags and launch boilerplate, stored `fw` flag on all line items, and rewired the toggle to use `recalcHeights()` so it composes with all other filters. `I/flutter` lines (app output) remain visible while framework/system noise is hidden.
• **Severity bar never showed framework color:** `renderItem()` checked `item.isFramework` (never set) instead of `item.fw` for the severity bar CSS class.
• **Scrollbar minimap redesigned as always-on interactive panel:** The minimap was an invisible 8px overlay hidden behind the opaque native scrollbar. Redesigned as a 60px wide always-on flex-sibling panel that replaces the native scrollbar entirely. Supports click-to-scroll (centers viewport on clicked position), drag-to-scroll, and mouse wheel forwarding. Shows a draggable viewport indicator.
• **Minimap markers for hidden lines:** Error/warning markers were generated for all lines regardless of filter state, creating phantom marks at wrong positions for lines with `height === 0` (filtered, collapsed). Now skips hidden lines and stack-frame lines (previously every frame in a stack trace generated its own red marker).
• **Minimap missing performance markers:** Only errors and warnings were shown. Added purple markers for performance-level lines using `--vscode-editorOverviewRuler-infoForeground`.
• **Scroll position redesign:** Complete rewrite of the virtual scrolling system. Toggling filters, collapsing stack traces, or changing font size no longer jumps the view to a random position — the first visible line stays anchored. Auto-scroll to bottom no longer causes double-render feedback loops. Prefix-sum array replaces O(n) linear scans with O(log n) binary search for viewport calculations. Stack frame height lookup is now O(1) via cached group headers instead of O(n²) nested scans. Row height is measured from the DOM instead of hardcoded, so spacer heights stay correct after font/line-height changes. Trimming old lines (50K limit) now adjusts scroll position by the removed height.
• **Footer level label blank:** The static "Levels" label next to the filter dots gave no indication of active state. Now shows "All" when all 7 levels are enabled, "N/7" when partially filtered, or "None" when all disabled. Footer dots also gained `flex-shrink: 0` to prevent collapsing in the flex layout.
• **"All" not highlighted in level flyup:** The All/None links in the level flyup had no active state, making it unclear whether all levels were enabled. Both links now highlight (using VS Code button colors) when their respective state is active.
• **Level flyup text center-aligned:** Button text in the level flyup defaulted to browser center alignment, making labels hard to scan. Added explicit left alignment (`justify-content: flex-start`, `text-align: left`) while keeping counts right-aligned.
• **Level flyup missing title:** The flyup opened directly into All/None links with no context. Added a "Level Filters" title header above the links to clarify purpose and resolve "levels vs filters" terminology confusion.

---

## [0.2.4]

We aligned the search UI with VS Code (icons, history arrows) and removed the clear button.

### Changed

• **Search toggles match VS Code:** Match Case, Match Whole Word, and Use Regular Expression buttons now use codicon icons (`codicon-case-sensitive`, `codicon-whole-word`, `codicon-regex`) positioned inline inside the search input, matching VS Code's native search layout. Active state uses VS Code's `--vscode-inputOption-*` theme variables.
• **Search history arrow navigation:** Up/Down arrow keys in the search input cycle through recent search terms, matching VS Code and terminal conventions. Clickable history list below the input is retained.

### Removed

• **Clear search button:** Removed the `×` clear button from the search input. Use Escape to close (which clears), or select-all and delete.

---

## [0.2.3]

We fixed stats not resetting on file load, redesigned the level flyup, and made the filter badge open the level flyup.

### Fixed

• **Stats counters not resetting on file load:** Level counts (e.g., "125 info") accumulated across sessions because the stats script only listened for 'reset' messages, not 'clear'. Now resets on both, fixing phantom counts that misled users about current file content.
• **Filter badge stretches footer:** Added `line-height: 1` to `.filter-badge` to prevent the badge from being taller than the footer bar.

### Changed

• **Level flyup redesigned:** Level filter circles now show left-aligned rows with emoji, text label, and count (e.g., `🔴 Error 2`). All/None links restyled as bordered buttons. Flyup min-width increased for labels.
• **Level dot trigger visible:** Footer level dots enlarged from 7px to 9px, inactive opacity raised from 0.2 to 0.3, and "Levels" text label added for discoverability. Hover shows border to signal interactivity.
• **Filter badge opens level flyup:** When the only active filter is a level filter, clicking the badge now opens the level flyup instead of the options panel. Mixed filters still open options.
• **Footer filename opens Project Logs:** Clicking the footer text (line count + filename) now opens the Project Logs session panel.

---

## [0.2.2]

We add a pop-out viewer, session display options (Dates, Tidy, Days, Sort), source location and elapsed time in logs, and fix CSP/codicon issues.

### Fixed

• **Line prefix sub-options misplaced:** Decoration sub-options (severity dot, counter, timestamp, etc.) appeared below the minimap checkbox instead of under their parent "Line prefix" checkbox. Moved to correct position and changed from show/hide to always-visible with disabled styling when line prefix is off.
• **Inline context option non-functional:** Removed the "Show inline context (file >> function)" option — context data was only extracted for stack frames, so it never worked for regular log lines.
• **Audio preview CSP blocked:** Preview sound buttons did nothing because the Content Security Policy `media-src` used the audio directory URI instead of the webview's `cspSource` authority. Fixed to use `cspSource` for consistent resource authorization.
• **Codicon icons invisible in webview:** The v0.2.1 CSP fix added `font-src` but the codicon font was never loaded — webviews are sandboxed and don't inherit VS Code's fonts. Now bundles `@vscode/codicons` and loads the stylesheet via a `<link>` tag, with `style-src` extended to allow it. Fixes all icons in the icon bar, context menu, and session panel.

### Added

• **Source location in log files:** New `includeSourceLocation` setting (off by default) appends the originating file and line number to each log line, e.g. `[app.ts:42]`. Requires the debug adapter to supply source info in DAP OutputEvents.
• **Elapsed time in log files:** New `includeElapsedTime` setting (off by default) prefixes each log line with the delta since the previous line, e.g. `[+125ms]`. Useful for spotting performance gaps.
• **Verbose DAP protocol logging:** New `verboseDap` setting (off by default) logs all raw DAP protocol messages (requests, responses, events) to the log file. Directional prefixes distinguish outgoing (`[dap->]`), incoming (`[dap<-]`), and event (`[dap:event]`) messages. JSON payloads are truncated at 500 characters.
• **Pop-out viewer:** New icon-bar button (link-external icon) and command (`Saropa Log Capture: Pop Out Viewer to New Window`) that opens the log viewer as a floating editor panel, movable to a second monitor. The pop-out coexists with the sidebar — both receive the same live data via a broadcast architecture. Closing and reopening the pop-out preserves the connection. Also available from the view title bar.
• **Session display options:** Four toggle buttons in the Project Logs panel header control how session filenames are displayed: **Dates** (show/hide leading and trailing datetime patterns — hidden by default), **Tidy** (normalize to Title Case with spaces — enabled by default), **Days** (group sessions under colored day headings like "Tue, 3rd Mar 2026" — enabled by default), and **Sort** (toggle between newest-first and oldest-first with a dynamic arrow icon). All options persist per-workspace via `workspaceState`. The same transforms apply to both the webview session panel and the native tree view. The panel stays open when selecting a file.
• **File modification date+time in session list:** Session items now show the file's last-modified date and time (e.g. "Feb 2, 4:13pm") before the file size in the metadata line. When day headings are shown, only the time is displayed to avoid redundancy.
• **Seconds trimmed from session filenames:** Filenames like `20260202_143215_session.log` are automatically displayed as `20260202_1432_session.log` for compactness. Always applied, independent of the display option toggles.

### Changed

• **Session info moved to icon bar:** The ℹ️ session info button is now in the right-side icon bar (between Search and Options) instead of the header bar. Click to open a slide-out panel showing full session metadata. Uses the same mutual-exclusion pattern as the other icon bar panels. The compact prefix line at the top of the log content is unchanged.
• **Header bar removed:** The viewer header bar (filename + collapse toggle) is removed entirely. The log filename and extension version now appear in the footer status text as `·`-separated segments (e.g., `● 42 lines · dart_session.log · v0.2.2`), reclaiming vertical space.
• **Marketplace banner image 404:** README banner pointed to the wrong GitHub repository (`saropa_lints`). Corrected URL to `saropa-log-capture`.
• **README: invite contributions:** Added GitHub activity badges (stars, forks, last commit, issues, license), a feedback callout linking to the issue tracker, an expanded Contributing section with quick-start steps and issue-reporting guidance, a Documentation table linking to CONTRIBUTING.md / CHANGELOG.md / ROADMAP.md / STYLE_GUIDE.md, and a footer with project links.

---

## [0.2.1]

We fixed icons in dark mode, the search panel toggle, the minimap disappearing on scroll, and split the status bar into pause and count.

### Fixed

• **Icon bar icons invisible in dark mode:** The Content Security Policy blocked the codicon font from loading (`default-src 'none'` with no `font-src`). Now passes `webview.cspSource` to the CSP so VS Code can inject its icon font.
• **Search mode toggle resets search text and breaks filter/clear:** Clicking any button inside the search panel (mode toggle, regex, case, clear) could trigger the document-level click-outside handler, closing the panel and clearing state. Toggle buttons were especially affected because `textContent` assignment detaches the original click target text node, making `contains()` fail. Fixed by stopping event propagation at the search bar boundary so internal clicks never reach the outside-click handler.
• **Scrollbar minimap disappears on scroll:** The minimap was positioned absolute inside the scrollable `#log-content` container, causing it to scroll away with the content. Wrapped `#log-content` in a non-scrolling `#log-content-wrapper` and moved the minimap to the wrapper so it stays viewport-fixed.

### Changed

• **Status bar split into two items:** The status bar is now two separate clickable items: a pause/resume icon that toggles capture state, and a text display (line count + watch counts) that focuses the sidebar viewer panel. Follows the VS Code convention where clicking a count reveals the associated view.
• **Watch chips are clickable:** Footer watch count chips (e.g., "error: 4") now open the search panel pre-filled with the keyword and navigate to the first match. Adds pointer cursor and hover effect to signal interactivity.
• **Native Session History tree view hidden:** The separate tree view below the Log Viewer is replaced by the in-webview Project Logs panel accessible from the icon bar.
• **Session panel renamed:** "Sessions" panel renamed to "Project Logs" with matching icon bar tooltip.
• **Icon bar sessions icon:** Changed from history (clock) to files icon to better represent project log files.
• **Dev script rewritten as publish pipeline:** `scripts/dev.py` now supports a gated analyze-then-publish workflow (16 steps) with `--analyze-only` for local dev builds and full publish to VS Code Marketplace + GitHub releases. Retains all original dev toolkit features (VS Code extension installs, global npm packages, version sync, local .vsix install prompts).
• **Dev script split into modules:** `scripts/dev.py` (1756 lines) refactored into 9 focused modules under `scripts/modules/` (constants, display, utils, checks_prereqs, checks_environment, checks_project, publish, report, install) with a layered dependency graph and no circular imports. `dev.py` remains the entry point with CLI parsing and orchestration.

---

## [0.2.0]

We add an icon bar with Session History and Options panels, simplify the footer, and add historical file timestamps and the level flyup.

### Added

• **Icon bar:** VS Code activity-bar-style vertical icon bar on the right edge of the log viewer with icons for Session History, Search, and Options. Clicking an icon toggles its slide-out panel with mutual exclusion (only one panel open at a time). Uses codicon icons with an active indicator bar matching VS Code's activity bar pattern.
• **Session history panel:** New in-webview slide-out panel listing past log sessions from the reports directory. Shows filename, debug adapter, file size, and date. Clicking a session loads it into the viewer. Active (recording) sessions are highlighted. Panel refreshes on each open.

### Changed

• **Footer simplified:** Removed Search and Options buttons from the footer — these are now accessible from the icon bar. The footer retains line count, level filter dots, watch chips, and filter badge.
• **Body layout restructured:** The webview body is now a flex-row containing the main content column and the icon bar column, instead of a single flex-column.

### Added

• **Historical log file timestamps:** Opening a log file from Session History now parses the `[HH:MM:SS.mmm]` timestamps from each line (using the `Date:` header for the date component), enabling elapsed time and timestamp decorations on historical files. Previously timestamps were discarded during file loading.
• **Timestamp availability gating:** Time-related decoration options (Timestamp, Show milliseconds, Elapsed time) are automatically disabled and grayed out when viewing a log file that has no parsed timestamps. Re-enabled when switching to a file with timestamps or starting a live session.
• **Session history timestamp icons:** Sessions in the history tree now show a `history` icon (clock) when the file contains timestamps, or an `output` icon (plain text) when it does not. Active recording sessions retain the red `record` icon. Tooltip includes "Timestamps: Yes/No".

### Fixed

• **Warning and Performance level toggles had no visual feedback:** The button IDs used abbreviated names (`level-warn-toggle`, `level-perf-toggle`) but `toggleLevel()` constructed IDs from the full level name (`level-warning-toggle`, `level-performance-toggle`). The `getElementById` returned null, so the `active` class never toggled. Also fixed the same stale IDs in `resetLevelFilters()`.
• **Visual spacing option had no visible effect:** The spacing logic ran after early returns for markers, stack-headers, and stack-frames — so it never applied to those item types. CSS selectors were also scoped to `.line` only. Moved computation before early returns, broadened conditions to trigger on any level change, separator lines, markers, and new stack traces, and widened CSS selectors to all element types.
• **Level circle counts invisible in dark mode:** The `.level-circle` buttons didn't set an explicit `color`, so count numbers used the browser default (black) instead of the VS Code theme foreground. Added `color: inherit` so counts adapt to light and dark themes.
• **Session Info modal persists across session loads:** The `clear` handler dismissed the context peek but not the Session Info modal. Once opened, the modal stayed visible every time a new log was selected. Now `hideSessionInfoModal()` is called on clear.
• **Search input unresponsive during typing:** `updateSearch()` ran synchronously on every keystroke — iterating all lines for regex matching, height recalculation, and DOM rendering — blocking the browser from repainting the input. Characters appeared not to register on large log files. Search is now debounced (150 ms) so characters appear instantly.
• **Search filter persists after clearing text:** Removing all search text or closing the search panel while in highlight mode left stale `searchFiltered` flags on lines, hiding them until a manual filter reset. Now always clears the search filter regardless of search mode.

### Changed

• **Level filters moved to fly-up menu:** The 7 inline level-circle buttons in the footer are replaced by a compact row of colored dots. Clicking the dots opens a fly-up popup with the full toggle buttons plus Select All / Select None links. The popup stays open while toggling and closes on click-away or Escape.
• **Exclusions UX overhaul:** Replaced the bare "Enable exclusions" checkbox with a richer section. The toggle label now shows the pattern count (e.g. "Exclusions (3)"). Each configured pattern is displayed as a removable chip below the toggle. Chips dim when exclusions are toggled off. When no patterns are configured, an empty state with a "Configure in Settings" link is shown. Removing a chip persists the change to workspace settings.

### Added

• **Per-file level filter persistence:** Level filter toggle state is saved per log file in workspace storage. When switching between files or reloading, each file's filter state is automatically restored.
• **Tooltips on all options panel controls:** Every checkbox, slider, dropdown, and button in the Options panel now has a descriptive `title` attribute that explains what the option does on hover.
• **Search clear button:** An × button appears inside the search input when text is present, following standard textbox conventions. Click to clear and reset the search.
• **Search history:** Last 10 search terms shown below the input when the search panel opens. Click any term to re-run that search. Persists across webview reloads via webview state.
• **Scroll position memory per file:** When switching between log files, the viewer remembers where you were scrolled to. Positions are saved when not at the bottom; files you were following at the bottom stay at the bottom on return.
• **Whole-line coloring for all severity levels:** Previously only error and warning lines received a background tint; all other levels (info, performance, todo, debug, notice) were ignored, making the feature appear broken. Now all 7 levels get a distinct tint color. Opacity increased from 8% to 6–12% (14–20% on hover) so the effect is actually visible.

---

## [0.1.15]

We fixed scroll flickering and layout thrashing and narrowed transition scope for smoother rendering.

### Fixed

• **Scroll flickering from ResizeObserver loop:** The `ResizeObserver` on `#log-content` called `renderViewport(true)` unconditionally, bypassing the visible-range bail-out check. Every DOM replacement triggered another resize observation, creating a feedback loop. Now RAF-debounced and uses `renderViewport(false)` so no-op re-renders are skipped.
• **Layout thrashing in scroll handler:** `jumpBtn.style.display` write was sandwiched between DOM reads and `renderViewport`'s internal reads, forcing a synchronous reflow on every scroll frame. Moved the write after all reads complete.
• **Broad `transition: all` causing render stutter:** `#viewer-header` and `#error-badge` used `transition: all 0.2s ease`, keeping the compositor busy animating layout properties during re-renders. Replaced with specific property transitions (`min-height`, `padding`, `border-bottom` for header; `background` for badge).

---

## [0.1.14]

Development build.

---

## [0.1.13]

We slimmed the footer, added a filter badge, reorganized the options panel (Quick Filters, Output Channels, Log Tags, etc.), added a scrollbar minimap option, and fixed mouse wheel scroll.

### Changed

• **Footer UI consolidation:** Slimmed footer to just: line count, level circles, filter badge, search button, and options button. Removed 7 toggle buttons (wrap, exclusions, app-only, decorations, audio, minimap, export) that are now in the options panel.
• **Category filter redesign:** Replaced the `<select multiple>` dropdown with dynamic checkboxes in the new Output Channels section of the options panel.
• **Source tags moved to options panel:** Source tag chip strip removed from above the log content. Tags now live in a Log Tags section inside the options panel with the same All/None toggle and count chips.
• **Options panel reorganized:** Consolidated all settings into logical sections — Quick Filters (presets + reset), Output Channels, Log Tags, Noise Reduction (exclusions + app-only), Display, Layout, Audio, and Actions (export).
• **Footer buttons use text labels:** Export and Search buttons now show text instead of emoji (💾 → "Export", 🔍 → "Search").
• **Clearer footer status text:** Replaced ambiguous "Viewing: 24 lines" with just "24 lines". Recording shows "● 24 lines" (red dot), paused shows "⏸ 24 lines".
• **Merged stats + level filters:** The separate stats counters (🔴 4, 🟠 95) and level filter circles (🟢🟠🔴🟣⚪🟤🟦) are now a single set of circles that show counts AND act as toggle filters.

### Added

• **Filter badge:** Footer shows an active filter count badge (e.g. "3 filters") that opens the options panel when clicked. Auto-updates via hooks on `recalcHeights()` and `toggleAppOnly()`.
• **Reset all filters button:** Quick Filters section includes a "Reset all filters" button that clears every filter type (levels, categories, exclusions, app-only, source tags, search) in one click.
• **`setExclusionsEnabled()` function:** Presets can now programmatically enable/disable exclusions (was missing, causing presets to silently fail for exclusion state).
• **Scrollbar minimap option in Options panel:** New "Scrollbar minimap" checkbox in the Display section.
• **Decoration sub-options in Options panel:** Added "Show milliseconds" and "Severity bar (left border)" checkboxes for feature parity with the decoration settings popover.
• **STYLE_GUIDE.md:** Documents UI patterns, font sizes, button styles, spacing, color conventions, and anti-patterns for the log viewer webview.

### Fixed

• **Options panel reading undefined `exclusionsActive`:** The exclusion checkbox was reading a non-existent `exclusionsActive` variable instead of `exclusionsEnabled`, causing the checkbox to never reflect actual state.
• **Preset "None" not resetting filters:** Selecting "None" in the preset dropdown now calls `resetAllFilters()` instead of just clearing the preset name.
• **Duplicate `#export-btn` CSS:** Was defined in both `viewer-styles-modal.ts` (14px) and `viewer-styles-overlays.ts` (10px). Consolidated into a single `.footer-btn` class.
• **Mouse wheel scroll hijacking:** A custom `wheel` event listener intercepted native scrolling, applied a 0.5x multiplier, and called `preventDefault()` — killing browser-native smooth/inertia scrolling and causing choppy, erratic scroll behavior. Removed the handler so `#log-content` uses standard `overflow-y: auto` scrolling.

### Removed

• **Dead code:** Removed unused `exclusionsActive` variable, dead `getPresetDropdownHtml()` export, and orphaned `#preset-select` CSS from overlay styles.

---

## [0.1.12]

Development build.

---

## [0.1.11]

We added a close button to the source preview, fixed the decoration counter, added a session info modal, fixed viewer scroll and minimap performance, and made search a slide-out panel.

### Fixed

• **Source preview popup not dismissible:** The hover preview over stack trace source links had no close affordance — it only auto-hid when the mouse moved away. Added a close button (×), Escape key, and click-outside dismissal.
• **Decoration counter showing `#&nb` instead of numbers:** `padStart(5, '&nbsp;')` used the 6-character literal HTML entity as a JavaScript padding string, causing truncated gibberish. Now pads with Unicode non-breaking space (`\u00a0`).
• **Inconsistent datetime in log filenames:** Filename format now uses compact datetime (`YYYYMMDD_HHMMSS_name.log`) for uniqueness and consistency. Rename and metadata parsing handle both legacy (`HH-MM`, `HH-MM-SS`) and current (`HHMMSS`) formats.
• **Session info expander always blank:** The collapsible session header never displayed data because (1) header lines were stripped before reaching the webview and (2) the JavaScript hook referenced a non-existent `handleSetContent` function. Redesigned as a compact prefix line at the top of the log content (showing adapter, project, config, date) with an ℹ️ icon button in the header bar that opens a modal with full session metadata. Now works for both live sessions and historical file loads.
• **Viewer flickering and inability to scroll:** The scrollbar minimap wrapped `renderViewport` with `setTimeout(updateMinimap, 50)` on every call, including scroll-only renders. This created a feedback loop (scroll → render → 50ms minimap DOM rebuild → layout recalc → scroll) that caused constant flickering and unwanted auto-scrolling to bottom via the ResizeObserver. Fixed by only scheduling minimap rebuilds on data changes (`force=true`), debouncing rapid updates, and using cached heights for the scroll handler.
• **Scrollbar minimap O(n²) performance:** Minimap marker placement re-iterated all preceding lines for each marker to compute cumulative height. Replaced with a single O(n) pre-computed array. The scroll-time viewport indicator now uses cached total height (O(1)) instead of recalculating on every frame.

### Added

• **Copy File Path:** Right-click a session in Session History and select "Copy File Path" to copy the full filesystem path to clipboard.

### Refactored

• **Split oversized commands module:** Extracted session comparison commands from `commands.ts` (305 lines) into `commands-comparison.ts` to comply with the 300-line file limit.

### Changed

• **Decorations enabled by default:** The `saropaLogCapture.showDecorations` setting now defaults to `true` so new users see line prefixes (severity dot, counter, timestamp) out of the box.
• **Emoji toggle buttons:** Replaced text-based footer toggles (`Deco: OFF`, `Audio: OFF`, `Minimap: ON`) with emoji buttons (🎨, 🔔/🔕, 🗺️). Active state shown at full opacity; inactive at 35% opacity. Tooltips explain current state and action.
• **Clearer options panel label:** Renamed "Show decorations" to "Line prefix (🟢 #N T00:00:00)" so users can see exactly what the toggle controls.
• **Search is now a slide-out panel:** Converted the inline search bar to a toggleable slide-out panel from the right edge, matching the options panel pattern. Added a 🔍 toolbar button in the footer. Keyboard shortcuts (Ctrl+F, F3, Escape) still work. Search and options panels are mutually exclusive — opening one closes the other.
• **Version inline with filename:** Version string now sits immediately after the filename in the header bar instead of floating as a separate right-aligned element.

---

## [0.1.10]

_Regex and export fixes; script fault isolation and global error handler for webview stability._

### Fixed

• **Viewer blank due to regex SyntaxError:** An invalid character class range in `isSeparatorLine` (`[=\\-+...]` produced range `\` to `+` with start > end) caused a SyntaxError that killed the entire webview script block. Fixed by moving `-` to end of character class.
• **Double-escaped regexes in viewer scripts:** `extractContext` in data helpers and decoration-stripping regexes in the export script used `\\\\s`/`\\\\d` which produced literal `\s`/`\d` instead of whitespace/digit classes. Fixed to single-escaped.
• **Export join produced literal `\n`:** `lines.join('\\\\n')` in export script produced literal backslash-n instead of newline. Fixed to `\\n`.
• **Session file loading race condition:** Loading a historical log file while webview was re-resolving (tab switch) could silently fail. Added generation counter and pending-load retry.

### Added

• **Script fault isolation:** Split the single `<script>` block (33 concatenated scripts) into separate `<script>` blocks per feature. A SyntaxError in one feature no longer kills the entire viewer.
• **Global error handler:** New first-loaded script catches uncaught errors, shows a visible red banner in the webview, and reports errors to the extension host via `console.warn`.
• **Build-time syntax validation test:** New test extracts all `<script>` blocks from the generated HTML and validates each with `new Function()`, catching SyntaxErrors before release.

---

## [0.1.9]

Development build.

---

## [0.1.8]

We fixed the options panel not responding to clicks, duplicate elements, missing escapeHtml, the audio path, and the split breadcrumb part number.

### Fixed

• **Options panel button unresponsive:** The slide-out options panel used `right: -25%` to hide off-screen, but with `min-width: 280px` it remained partially visible in narrow sidebar viewports (z-index 250), silently intercepting clicks on footer buttons including the options toggle. Changed to `right: -100%` with `pointer-events: none` when closed.
• **Duplicate error breakpoint elements:** `getErrorBreakpointHtml()` was called twice in the viewer HTML template, creating duplicate `error-badge` and `error-modal` elements with the same IDs. Removed the stray call outside the footer.
• **Missing `escapeHtml()` in webview:** The function was called by repeat notifications, edit modal, and session header scripts but was only defined in the TypeScript extension host (not injected into the webview). Added the function to the webview data helpers script.
• **Dead audio mute code:** Removed `audioMuted` variable, `toggleAudioMute()`, and `updateAudioMuteButton()` which referenced a nonexistent `audio-mute-toggle` element with no corresponding HTML or event wiring.
• **Split breadcrumb shows wrong part number:** `setSplitInfo(totalParts, totalParts)` passed `totalParts` for both arguments, so the breadcrumb always showed "Part N of N" after a split instead of the actual current part number. Now passes the correct `partNumber`.
• **Audio files never loaded (doubled path):** `initAudio()` appended `/audio/` to a URI that already pointed to the `audio/` directory, creating an invalid path like `audio/audio/swipe_low.mp3`. Removed the redundant segment.
• **Version string type assertion:** `as string ?? ''` made TypeScript treat the version as always a string, so the nullish fallback was unreachable. Replaced with `String(... ?? '')` for safe runtime conversion.

### Added

• **Version display in viewer header:** The extension version number (e.g., "v0.1.7") now appears in the log viewer header bar.

## [0.1.6]

We classify errors as CRITICAL, TRANSIENT, or BUG and let you filter or break on critical issues.

<!-- cspell:ignore ECONNREFUSED -->

### Added

• **Smart Error Classification:** Automatically classifies error log lines into three categories: 🔥 CRITICAL (NullPointerException, AssertionError, FATAL, etc.), ⚡ TRANSIENT (TimeoutException, SocketException, ECONNREFUSED, etc.), and 🐛 BUG (TypeError, ReferenceError, SyntaxError, etc.). Visual badges appear inline before the log message. Two new settings: `saropaLogCapture.suppressTransientErrors` (default: false) hides expected transient errors via filtering, and `saropaLogCapture.breakOnCritical` (default: false) triggers VS Code notifications when critical errors appear. Helps quickly identify severe issues vs. expected network hiccups.

## [0.1.5]

_Stack trace preview mode, milliseconds in timestamps, audio volume and rate limiting, inline tag parsing, session info header, repeat notifications, and layout/export options._

### Added

• **Stack Trace Preview Mode:** Stack traces now show first 3 non-framework frames by default (collapsible preview mode) instead of completely collapsed. Click the header to cycle through: preview → fully expanded → fully collapsed → preview. Framework frames are filtered out in preview mode. Toggle indicator shows ▷ (preview), ▼ (expanded), or ▶ (collapsed).
• **Milliseconds Display:** Added "Show milliseconds" checkbox to decoration settings panel (⚙ gear button). When enabled, timestamps show `.000` milliseconds after the seconds (e.g., `T14:32:15.234`). Works with existing timestamp decoration toggle.
• **Audio Volume Control:** Expanded audio options panel with volume slider (0-100%, default 30%), rate limiting selector (none/0.5s/1s/2s/5s/10s), and preview sound buttons (🔴 Error / 🟠 Warning) to test settings. Volume and rate limiting apply immediately. Rate limiting prevents audio spam by enforcing minimum time between sounds of the same level.
• **Inline Tag Parsing:** Extended source tag filter to extract `[TagName]` patterns anywhere in log lines (not just at the start). Tags like `[API]`, `[Database]`, `[Auth]` are now automatically detected and added to the collapsible Sources panel for filtering. Works alongside existing Android logcat and bracket prefix patterns.
• **Session Info Header:** Collapsible session metadata block appears at the top of the viewer (below split breadcrumb) when loading log files. Shows project name, debug adapter type, configuration name, platform, VS Code version, and extension version. Parsed from the context header block in log files. Click to expand/collapse. Hidden for live sessions (only shows when loading files).
• **Real-Time Repeat Notifications:** Duplicate log lines now show immediate repeat notifications instead of being batched. Shows `"🔴 Repeated log #5 (Connection Refused...)"` with first 85 characters of message preview. Uses smart hash-based detection (`level::message`) instead of exact string matching. Repeat counter resets when a new unique message arrives. 3-second detection window (configurable).
• **Multi-Level Classification:** Added three new log levels with automatic detection and filtering:
  • **TODO Level** (⚪ White): Detects TODO, FIXME, HACK, XXX in logs for task tracking
  • **Debug/Trace Level** (🟤 Brown): Detects breadcrumb, trace, debug keywords for diagnostic logging
  • **Notice Level** (🟦 Blue Square): Detects notice, note, important for informational highlights
  - Each level has dedicated toggle button in footer, checkbox in options panel, color styling, and emoji indicator. All levels work with existing filter presets and context line display.
• **Inline Context Metadata:** Extracts and displays file path, function name, and line number from stack traces as inline breadcrumbs. Shows shortened file paths (last 2 segments) and function names in format `utils/auth.ts:42 » login()`. Toggle on/off via "Show inline context" checkbox in options panel. Automatically parses common stack trace formats (V8, Mozilla, etc.) and displays context for both stack headers and frames.
• **Per-Level Export/Save:** Export filtered logs to file with preset templates or custom level selection. Templates include "Errors Only", "Warnings + Errors", "Production Ready", "Full Debug", and "Performance Analysis". Export options allow including/excluding timestamps, decorations, and ANSI codes. Preview shows line count before export. Accessible via 💾 button in footer.
• **Layout Improvements:** Four new customization features for better readability:
  • **Font Size Adjustment:** Slider control (10-20px) in options panel to adjust log font size independently of VS Code editor settings
  • **Line Height Adjustment:** Slider control (1.0-2.5) in options panel to adjust vertical spacing between log lines
  • **Severity Bar Mode:** Colored left borders (3px) for each log level instead of/alongside emoji dots. Creates continuous vertical bars for consecutive same-level lines. Toggle via decoration settings panel
  • **Visual Spacing (Breathing Room):** Heuristic spacing adds 8px margins before/after key transitions: level changes to errors/warnings, before/after markers. Helps separate logical sections without adding actual newlines. Toggle in options panel

### Refactored

• **File Size Compliance:** Split 6 oversized UI modules (630-391 lines each) into 17 smaller modules (all under 300 lines). Improved code organization by extracting logical sections: modal styles, decoration styles, search/UI components, helper functions, and HTML/script templates. No functional changes — behavior, API surface, and build output are identical.

## [0.1.4]

We add error breakpoints (visual and audio alerts), search case/word toggles, live stats, an edit-line modal, a scrollbar minimap, and a bunch of viewer improvements.

### Added

• **Error Breakpoints:** Configurable visual and audio alerts when errors appear in logs. Features: flash red border around viewer, play alert sound, increment error counter badge (clickable to clear), and optional modal popup. Toggle on/off via footer button. Detects errors via `stderr` category or error keywords (`error`, `exception`, `failed`, `fatal`, `panic`, `critical`). Only triggers once per batch to avoid spam.
• **Search Enhancements:** Added case sensitivity toggle (Aa/AA) and whole word match toggle (\b) to search bar. Both buttons show bold text when active and work in combination with existing regex mode toggle.
• **Live Statistics Counters:** Real-time running totals displayed in footer showing counts for errors (🔴), warnings (🟠), performance issues (🟣), and framework/info logs (🟢). Updates incrementally as lines arrive and resets on session reset.
• **Enhanced Performance Detection:** Extended performance pattern matching to detect Choreographer frame skips (`skipped N frames`), `choreographer`, `doing too much work`, `gc pause`, `anr`, and `application not responding` patterns for better Android/Flutter debugging.
• **Edit Line Modal:** Right-click any log line and select "Edit Line" to open a modal with editable textarea. Changes are saved back to the log file with proper validation. Shows warning badge when debug session is active to prevent concurrent write conflicts. Reloads viewer after successful edit.
• **Scrollbar Minimap:** Visual overview overlay on the scrollbar (8px wide, right edge) showing search match locations (yellow marks), current match (bright orange), error locations (red marks), warning locations (orange marks), and viewport position indicator. Updates automatically when searching or scrolling. Toggle on/off via footer button.
• **Copy All to Clipboard:** Added Ctrl+Shift+A keyboard shortcut and `copyAllToClipboard()` function to copy all visible log lines to clipboard in plain text format.
• **Copy to Search:** Added "Copy to Search" action to right-click context menu. Opens search bar and populates it with the clicked line's text, automatically running the search.
• **ASCII Art Detection:** Enhanced separator line detection to recognize box-drawing characters (─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬) in addition to standard ASCII patterns (===, ---, +---). Lowered threshold to 60% for better detection. Detected separators are styled in yellow with reduced opacity.
• **Minimap Toggle Button:** Added "Minimap: ON/OFF" button to footer for controlling scrollbar minimap visibility.

### Fixed

• **Session History Empty Viewer:** Fixed issue where selecting log files from session history panel resulted in empty viewer. Added retry loop to wait for webview initialization before loading file content (up to 1 second wait).
• **Level Filter Visual Feedback:** Enhanced inactive level filter buttons with three visual indicators: reduced opacity (0.25), grayscale filter (0.8), and strike-through text. Makes toggle state immediately obvious.
• **Session History Sorting:** Fixed incorrect sorting of mixed-format filenames by sorting on file modification time instead of date strings. Ensures newest sessions always appear first regardless of filename format.
• **Double-Click Viewport Jumping:** Fixed random viewport jumping when double-clicking lines to open context peek. Replaced problematic `scrollIntoView` with proper scroll calculation that positions the peeked line consistently at the top of the view.

### Changed

• **Search Bar Width:** Increased minimum width of search input to 200px to prevent it from becoming too narrow when multiple toggle buttons are present.
• **Session State Tracking:** Extension now tracks debug session active/inactive state and currently displayed file URI. Viewer receives `sessionState` messages to enable intelligent warnings and safe file editing.

## [0.1.3]

We add a source tag filter, full Debug Console capture, line decorations, level filter, inline peek, historical log viewing, and move the panel to the bottom.

### Refactored

• **File Size Compliance:** Split 12 TypeScript files that exceeded the 300-line limit into 29 files (12 original + 17 new extraction files). All source files now comply with the project's hard limit. No functional changes — behavior, API surface, and build output are identical.

### Changed

• **Enhanced Color Palette:** Updated ANSI color rendering to use VS Code's vibrant terminal color palette, matching the Debug Console appearance. Standard and bright colors (red, green, yellow, blue, cyan, magenta) are now significantly more vibrant and easier to distinguish.
• **Automatic Log Level Coloring:** Log lines are now automatically color-coded by severity — errors appear in red, warnings in yellow, and info lines use the default foreground color for better visual scanning.
• **Panel Location:** Moved the Log Viewer and Session History from the sidebar (Activity Bar) to the bottom panel, next to Output and Terminal tabs. Provides more horizontal space for log lines.

### Added

• **Source Tag Filter:** Collapsible "Sources" panel above the log lines that auto-discovers source tags from Android logcat prefixes (e.g. `D/FlutterJNI`, `I/flutter`) and bracket prefixes (e.g. `[log]`). Each tag appears as a chip with a line count; click to toggle visibility. Includes All/None bulk actions. Tags are grouped by name only (ignoring level prefix), sorted by frequency. Panel stays hidden until tags are detected. Composes with all existing filters (category, exclusion, level).
• **Full Debug Console Capture:** Added `saropaLogCapture.captureAll` setting and UI toggle ("App Only: OFF") to capture all Debug Console output, bypassing category and exclusion filters. When enabled, all system, framework, and app logs are captured. Toggle via the viewer or settings.
• **Line Decorations:** Added `saropaLogCapture.showDecorations` setting and footer "Deco" toggle to prefix each viewer line with a colored severity dot (🟢/🟠/🔴), sequential counter (#N), and wall-clock timestamp. A gear button (⚙) opens a settings popover to toggle individual parts and enable "Whole line" coloring mode (subtle background tint by severity). Viewer-only — log files are not modified.
• **Level Filter:** Added All/Errors/Warn+ segmented buttons in the footer to filter log lines by severity. Configurable context lines (`saropaLogCapture.filterContextLines`) shown dimmed around matches.
• **Inline Peek:** Double-click any log line to expand an inline peek showing surrounding context lines. Press Escape to dismiss. Configurable range via `saropaLogCapture.contextViewLines`.
• **Expanded Highlight Rules:** Default highlight patterns now include Fatal, TODO/FIXME, Hack/Workaround, Deprecated, Info, and Debug in addition to Error, Warning, and Success.
• **Historical Log Viewing:** Opening a session from Session History now loads it into the panel viewer instead of as a raw text file.
• **Developer Toolkit** (`scripts/dev.py`): One-click script replacing `init_environment.py` and `build_and_install.py`. Runs the full pipeline automatically: prerequisites, deps, compile, quality checks, package .vsix. Interactive prompts only at the end (install via CLI, open report). Features Saropa ASCII logo, colored output, per-step timing bar chart, and automatic reports to `reports/`.

### Fixed

• **ANSI Color Rendering:** Updated Content Security Policy to allow inline styles (`'unsafe-inline'`), fixing blocked ANSI color rendering in the log viewer and session comparison views. Colors from debug output now display correctly.
• **Viewer Controls:** Fixed all non-working buttons and controls (Excl ON, App Only, All/Errors/Warn+, Preset dropdown, category filter, Deco toggle, settings panel) by removing inline event handlers that were blocked by Content Security Policy. Converted all `onclick`/`onchange` handlers to proper `addEventListener` calls.
• **Historical Log Viewing:** Skips context header block, parses `[category]` prefixes for proper stderr coloring, detects markers, and sends lines in async batches to avoid UI freezing. Footer shows "Viewing:" instead of "Recording:" for historical files.
• **Filter Coordination:** Category, exclusion, and level filters now respect each other's state via shared `recalcHeights()`. Previously, applying one filter could override another's visibility decisions.
• **Inline Peek on Double-Click:** Fixed DOM index mapping when lines have gap markers or annotations — `querySelectorAll` now counts only line-level elements.
• **Inline Peek on Clear:** Peek is now closed when the viewer is cleared, preventing stale content.
• **Context Line Settings:** Setting `filterContextLines` or `contextViewLines` to 0 is now honored (previously treated as default due to falsy-zero).
• **Success Highlight:** Pattern now matches "successfully" and "successful" in addition to "success", "passed", and "succeeded".
• **Config Timing:** Highlight rules and presets are cached and sent when the webview initializes, so historical file views get proper coloring even without a prior debug session.

## [0.1.0]

First public release: auto-capture, live viewer, session history, export, filtering, and the rest of the basics.

### Core Features

• **Auto-capture**: Debug Console output saved to `.log` files automatically when debugging starts
• **Live sidebar viewer**: Real-time log streaming with virtual scrolling (100K+ lines)
• **ANSI color support**: Full color rendering in viewer, raw codes preserved in files
• **Click-to-source**: Click `file.ts:42` patterns to jump to source; Ctrl+Click for split editor
• **Collapsible stack traces**: Auto-detected and grouped; press `A` for app-only mode
• **Search**: Ctrl+F with regex support, F3/Shift+F3 navigation, match highlighting
• **Session history**: Browse past sessions with metadata (adapter type, size, date)

### Session Management

• **Rename sessions**: Right-click to set display names (also renames file on disk)
• **Tag sessions**: Add `#tags` for organization; auto-tags with `~prefix` from content patterns
• **Annotations**: Press `N` to annotate lines; persisted and exported
• **Pin lines**: Press `P` to pin important lines to sticky header
• **Deep links**: Share `vscode://` URLs that open specific sessions and lines

### Export Options

• **HTML export**: Static or Interactive with search, filters, and theme toggle
• **CSV export**: Structured columns (timestamp, category, level, line_number, message)
• **JSON export**: Array of log entry objects with full metadata
• **JSONL export**: Line-delimited JSON for streaming tools

### Filtering & Search

• **Category filter**: Filter by DAP category (stdout, stderr, console)
• **Exclusion patterns**: Hide lines matching string or `/regex/` patterns
• **Keyword watch**: Track patterns with live counters, flash alerts, and badges
• **Filter presets**: Save and apply filter combinations; built-in presets included
• **Cross-session search**: Search all log files via Quick Pick

### Visual Features

• **Highlight rules**: Color lines matching patterns (configurable colors, labels)
• **Elapsed time**: Show `+Nms` between lines; slow gaps highlighted
• **JSON rendering**: Embedded JSON shown as collapsible pretty-printed elements
• **Inline decorations**: Show log indicators next to source lines in editor

### Advanced Features

• **Session comparison**: Side-by-side diff view with color highlighting
• **Session templates**: Save/load project-specific configurations (Flutter, Node.js, Python built-in)
• **Auto file split**: Split by line count, size, keywords, duration, or silence
• **Flood protection**: Suppress rapid repeated messages (>100/sec)
• **Deduplication**: Identical rapid lines grouped as `Message (x54)`

### Infrastructure

- Context header with launch.json config, VS Code version, OS, adapter type
- Status bar with live line counter and watch hit counts
- File retention with configurable `maxLogFiles`
- Gitignore safety check on first run
- First-run walkthrough for new users

## [0.0.1]

Initial project scaffold.
