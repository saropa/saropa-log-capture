# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

**VS Code Marketplace** - [marketplace.visualstudio.com / saropa.saropa-log-capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

**Open VSX Registry** - [open-vsx.org / extension / saropa / saropa-log-capture](https://open-vsx.org/extension/saropa/saropa-log-capture)

**GitHub Source Code** - [github.com / saropa / saropa-log-capture](https://github.com/saropa/saropa-log-capture)

**Published version**: See field "version": "x.y.z" in [package.json](./package.json)

Each version (and [Unreleased]) has a short commentary line in plain language—what this release is about for humans. Only discuss user-facing features; vary the phrasing.

For older versions (pre-3.0.0), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).

---

## [Unreleased]

### Fixed

• **Text selection during tailing** — Selecting text in the log viewer while the log is being written to no longer fails: the viewport uses the existing hysteresis so it skips a full DOM re-render when the visible line range is unchanged, preserving the user’s selection. Spacer heights are still updated so scroll height stays correct.

### Changed

• **Jump-to-top / jump-to-bottom buttons** — Buttons are now positioned on the right side of the log area so they do not cover the scrollbar minimap or the native vertical scrollbar when it is enabled. Right offset uses CSS variables `--mm-w` and `--scrollbar-w` so layout stays correct for all minimap sizes and scrollbar settings.

### Added

• **Show scrollbar setting** — New setting `saropaLogCapture.showScrollbar` (default: false) controls whether the native vertical scrollbar is shown in the log viewer. When off, the minimap is the only scroll indicator; when on, the native scrollbar is visible (10px) and the jump buttons keep clear of it.

---

## [3.8.0]

### Fixed

• **Row selection on right-click** — Shift-click row selection in the log viewer no longer disappears when opening the context menu. The viewport re-render after right-click now re-applies the selection highlight so Copy Line, Hide Selection, and other selection-based actions work as expected.

• **Stack trace icons** — Collapsible stack headers in the log viewer now show the correct Unicode triangles (▶ ▼ ▷) instead of the literal escape text `\u25b6` / `\u25bc` / `\u25b7`.

• **Context menu submenu cropped at top** — When the right-click menu was opened near the top of the view (e.g. under a toolbar), the Copy & Export (and other) submenu flyout could have its top cut off. The menu now applies a vertical offset so submenu content stays below a safe viewport margin; when the menu is also near the bottom, the existing “open upward” behavior still wins.

### Added

• **Code quality metrics (Phase 3)** — **Show code quality for frame:** right-click a stack frame in the log viewer → **Show code quality** to open a popover with line coverage %, lint warnings/errors, and doc density for that file. **Open quality report:** open the session’s `basename.quality.json` sidecar from the context menu or command palette. **Heatmap:** stack frame lines show a subtle coverage tint (green/yellow/red) when quality badges are enabled. **Bug reports:** new setting `saropaLogCapture.integrations.codeQuality.includeInBugReport` (default false) adds a "Code Quality (referenced files)" section for files with low coverage or lint issues. The viewer receives `meta.integrations.codeQuality` when loading a log. Plan [100](bugs/history/20260318/100_code-quality-metrics.md) implemented.

• **Regression hints** — Correlate errors with Git history for "Introduced in commit X". **Blame-based:** for a source line (e.g. from a stack frame), show "Last changed in commit X" with optional link in the Analysis panel source section and in the error hover. **First-seen:** for recurring errors, show "Introduced in commit X" on Insights recurring cards (and "Recurring in this log") when the first session where the error appeared had Git integration (commit stored in session meta). Commit links respect `saropaLogCapture.integrations.git.commitLinks`. New module: `regression-hint-service` (blame + first-seen session→commit); Git provider now stores `commit` at session start and in session-end meta. Plan [034](bugs/history/20260318/034_plan-regression-hints.md) implemented.

• **Smart bookmarks** — When you open a log file, the extension can suggest adding a bookmark at the first error (or first warning) line if that line is not already bookmarked. One suggestion per file per session; notification shows "First error at line N. Add bookmark?" with **Add bookmark** and **Dismiss**. Settings: `saropaLogCapture.smartBookmarks.suggestFirstError` (default true), `saropaLogCapture.smartBookmarks.suggestFirstWarning` (default false). Plan [038](bugs/history/20260318/038_plan-smart-bookmarks.md) implemented.

---

## [3.7.1]

Stabilizes Project Logs and extension development by fixing a crash, wiring proposed APIs correctly, and aligning Insight → Insights naming.

### Fixed

• **Session panel crash** — Project Logs no longer throws "escapeHtmlText is not defined". Shared helpers `escapeAttr` and `escapeHtmlText` are defined once in the session panel bootstrap; inlined fragments (rendering, events) use them. A runtime test runs the same script combination the webview uses and dispatches a sessionList message to catch missing dependencies.

• **Extension development** — Launch configs include `--enable-proposed-api=saropa.saropa-log-capture` so F5 can use the terminal proposed API when enabled locally. **Publishing:** The extension no longer declares `enabledApiProposals` in `package.json`, so it can be published to the Marketplace. Terminal capture (integrated terminal output) uses the proposed API when available and is skipped gracefully when not (try/catch in `terminal-capture.ts`).

### Changed

• Rename **Insight** menu and panel labels to **Insights** (lightbulb icon in the viewer and command palette entry) for consistency with cross-session Insights terminology.

### Administration

• **Modularized 4 files over 300-line limit.** Split to satisfy the project’s 300-line file limit. No behavior or API changes. New/updated modules: `investigation-commands-helpers` (resolve/pick investigation, format insight payload); `session-manager-internals` (applyStartResult, broadcast/watcher helpers); `session-manager-stop` (buildStopSessionDeps); `viewer-insight-panel-script-part-a/b/c` (Insight panel IIFE fragments); `viewer-styles-insight-layout`, `viewer-styles-insight-sections`, `viewer-styles-insight-hero`. Entry points unchanged: `commands-investigation`, `session-manager`, `viewer-insight-panel-script`, `viewer-styles-insight`.

---

## [3.7.0]

Major UX release focused on webview accessibility, a unified Insights panel, smarter Flutter/Dart memory classification, and modularizing large files.

### Added

• **Webview accessibility (a11y)** — Viewer: main landmark on primary content, `aria-live` on line-count so filter/load updates are announced; level flyup "All"/"None" are buttons for keyboard use. Options, Project Logs, and Integrations panels: `role="region"` and `aria-label` on containers; key controls labeled. Focus moves into Options and Project Logs on open and returns to the icon bar on close (Escape or Close). README documents keyboard and screen-reader use; audit at `bugs/028_webview-a11y-audit.md`. Plan [028](bugs/028_plan-webview-accessibility.md) in progress (focus trap and remaining panels pending).

• **Unified Insight panel (single view)** — One scroll, no tabs. The **Insight** panel (icon bar, lightbulb) is a single narrative: **Active Cases** (top 3 + View All), **Recurring errors** (top 5), **Frequently modified files** (collapsed), **Environment** (platforms, SDK, debug adapters; collapsed), and **Performance** (when a log is open). Context-aware: with no log selected you see Cases, Recurring, Hot files, Environment; with a log selected **Performance** (with scope label "Current log: &lt;filename&gt;") and **Recurring in this log** (filtered to errors that appear in the current session) move to the top. **Inline add-to-case:** "+" on each recurring card and hot file opens the Cases section so you can add a session. **requestInsightData** returns errors, statuses, hot files, platforms, sdkVersions, debugAdapters, **recurringInThisLog**, **errorsInThisLog**, and **errorsInThisLogTotal** (when a log is open). **currentLogChanged** triggers refresh of performance and insight data. **14 UX enhancements:** empty states (Cases, Recurring, Hot files); loading states; "This log" single empty message; keyboard nav on section headers (Arrow Up/Down, Enter/Space); scroll into view after add-to-case and create-case; Session details hint; recurring/errors text truncation with full tooltip; "Top 3 of N" for errors-in-log; cases list "N source(s) · Updated X ago"; hero 0/0 and no-data message; sparkline "Session trend" label; export confirmation. Plan 041 (Unified Insight Model) implemented; see `bugs/history/20260317/041_plan-unify-investigation-recurring-performance.md`.

• **Flutter/Dart memory classification** — Memory-related log lines (e.g. memory pressure, heap/VM gen, leak hints) are classified as **Performance** and shown in the Performance panel **Memory** group only when the line has Flutter/Dart context (logcat `I/flutter`/`D/dart` or `package:flutter`/`package:dart`) and a high-confidence phrase (`Memory: N`, memory pressure/usage/leak, old/new gen, retained N, leak detected, potential leak). Reduces false positives from generic "memory"/"heap" in other runtimes. Heuristics are best-effort; see `bugs/001_integration-specs-index.md`.

### Administration

• **Modularized 11 files over 300-line limit.** Split into smaller modules to satisfy ESLint `max-lines` (300, excluding blanks/comments). No behavior or API changes. New modules: `commands-export-insights`, `commands-export-helpers`; `log-session-helpers` (extended); `investigation-search-file`, `investigation-store-io`, `investigation-store-workspace`; `session-manager-routing`, `session-manager-start`, `session-manager-stop`; `viewer-content-body`, `viewer-content-scripts`; `viewer-message-handler-actions`, `viewer-message-handler-investigation`; `log-viewer-provider-state`; `viewer-performance-trends`, `viewer-performance-session-tab`; `viewer-replay-timing`, `viewer-replay-controls`; `viewer-session-panel-investigations`, `viewer-session-panel-events`. Callers still import from the original entry files where applicable.

---

## [3.6.2]

Empty log fixes (late-start fallback for Dart run, 30s recent-child window, runbook and diagnostic message); Project Logs recent-updates indicators and last-viewed tracking; investigation UX improvements.

### Added

• **Late-start fallback** — when output is buffered and no log session exists (e.g. Dart run or Cursor never fired `onDidStartDebugSession`), the extension starts capture using the active debug session so logs are still written.

• **Recent-child alias window** — parent/child fallback now aliases when exactly one owner was created in the last 30s (was 15s) to reduce two-file races for Dart/Flutter.

• **Recent-updates indicators in Project Logs** — Session list shows an **orange** dot for logs that have new lines since you last viewed them, and a **red** dot for logs updated in the last minute. "Last viewed" is updated when you open a session from the list or panel; the list refreshes periodically while a session is recording so the red indicator stays accurate. Active (recording) session continues to use the recording icon only.

• **Investigation UX** — In Project Logs, clicking "+ Create Investigation..." now shows an inline name field in the panel (instead of the VS Code input at the top of the window) so focus stays where the user is looking. Create/Cancel buttons and Enter/Escape keyboard support; loading state ("Creating…") prevents double-submit. Short hint under the Investigations header explains: "Pin sessions and files to search and export together." README clarifies how Investigations differ from Recurring (error-pattern analysis) and Performance (perf analysis).

### Documentation

• Runbook [010](bugs/010_runbook-missing-or-empty-logs.md): clearer steps when a log file is empty or near-empty (enable `diagnosticCapture` to inspect the pipeline; runbook reorganized with first steps up front).

---

## [3.6.1]

Empty log file fixes and capture safeguards: replay all early output, single- and multi-session fallbacks, race guard, buffer timeout warning, and optional diagnosticCapture.

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

Enhanced error analysis with hover popups and inline triage controls.

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

Replay controls redesigned for a cleaner, less intrusive UX.

### Changed

• **Replay panel is now horizontal and anchored to the bottom-right** of the log area, replacing the tall vertical strip that obscured content.

• **Top/Bottom jump buttons moved to the left side** so they no longer overlap the scrollbar minimap.

• **Replay button added to the viewer footer** (before the version number) for quick access without the floating toggle.

### Removed

• **Removed the floating replay toggle button** that overlapped the top-right corner. Replay is now triggered from the footer button or the icon bar.

## [3.5.3]

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

### Fixed

• **Publish script spawns unwanted windows on Windows.** Extension listing now reads the filesystem (`~/.vscode/extensions/`, `~/.cursor/extensions/`) instead of calling `code --list-extensions` / `cursor --list-extensions`, which spawned persistent editor windows. Added `CREATE_NO_WINDOW` flag to all subprocess calls to suppress cmd.exe console flashes. Marketplace browser open after publish is now prompted instead of automatic.

### Added

• **Getting Started walkthrough command.** Added `Saropa Log Capture: Getting Started` command to open the VS Code walkthrough directly, plus an "About Saropa" step with ecosystem and company info. The walkthrough auto-opens on first install.

• **OWASP Security Context in bug reports.** Bug reports now include a "Security Context" section when crash-related files have OWASP-mapped lint violations, showing categories (M1–M10, A01–A10) with affected rules. OWASP findings also appear in Key Findings.

### Fixed

• **Stray .meta.json files polluting user projects.** A fallback code path wrote `.meta.json` sidecar files next to arbitrary files across workspace folders instead of using the central metadata store. Removed the sidecar write path entirely — all metadata now goes through `.session-metadata.json` only. On activation the extension scans for and deletes orphan `.meta.json` sidecars that match its format, cleaning up affected projects automatically.

## [3.5.1]

Replay controls now live in a compact floating vertical panel instead of a full-width horizontal bar.

### Added

• **Create Bug Report File.** Right-click selected lines in the log viewer and choose "Create Bug Report File" to auto-create a comprehensive `.md` report. Includes selected text, session info, full decorated output (in a collapsible block), cross-session analysis, environment details, and user-fillable sections. Also available from the Command Palette (without selection).

• **`saropaLogCapture.reportFolder` setting.** Configure where bug report files are created (default: `bugs/`, relative to workspace root).

### Changed

• **Replay bar: collapsible vertical layout.** The replay controls (play/pause/stop, mode, speed, scrubber) are now a floating vertical panel toggled by an icon in the top-right corner of the log area. The bar is hidden by default — no more wasted vertical space when you're not replaying. The vertical scrubber stretches to fill the available height.

## [3.5.0]

Track elapsed session time with T+ decorations in the log viewer, and get instant codebase context from project health scores and lint breakdowns in bug reports.

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

Auto-hide patterns let you permanently suppress matching log lines with a right-click, plus a management modal to review and remove patterns.

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

Tames the overflowing context menu by grouping copy and export actions into a submenu, and splits six files that exceeded the 300-line limit into focused modules.

• **Viewer context menu: Copy & Export submenu.** The right-click menu was too long and could overflow the screen. Copy, Copy Line, Copy All, Copy All Decorated, Copy as snippet, Copy with source, Select All, and Export current view are now under a **Copy & Export** submenu; **Copy to Search** is in the same submenu after a separator. Behavior and visibility rules are unchanged; existing tests pass.

• **Modularized files over 300-line limit.** Split investigation commands (share/export into `investigation-commands-share.ts`, `investigation-commands-export.ts`), l10n strings into `l10n/strings-a.ts` and `l10n/strings-b.ts`, .slc bundle logic into `slc-types.ts`, `slc-session-files.ts`, `slc-session.ts`, and `slc-investigation.ts`, Build/CI API fetchers into `build-ci-api.ts`, and viewer-styles (Crashlytics setup/diagnostic, options integrations/shortcuts) into dedicated style modules. No behavior changes; existing tests and public API unchanged.

---

## [3.4.0]

In this version we add paginated Project Logs and Export Insights Summary; improve Crashlytics setup and Share Investigation (LAN, file links, Gist docs); introduce Explain with AI, Share Investigation (Gist/LAN/upload/shared folder), Build/CI API sources, and performance/crash-dump options; fix empty logs (replay and single-session fallback), session summary Open Log, CSP unsafe-inline, replay speeds and bar visibility, viewer in new window, and session list time display; and consolidate Marketplace URL config, viewer decorations, and correlations into the Session Timeline.

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

Auto-correlation across debug, HTTP, perf, and terminal in the Session Timeline; Git line history and commit links in session meta; and Investigation Mode Phase 3–4 (export/import, bug-report context, and UX polish).

### Added

• **Auto-correlation detection.** When the Session Timeline is opened, the extension detects related events across sources (debug, HTTP, perf, terminal) within a configurable time window. Correlated events show a link badge (▶) in the timeline and in the log viewer; clicking the badge highlights all related events. New **Correlations** sidebar view lists detected correlations for the last opened timeline session with "Jump to event" links. Settings: `correlation.enabled`, `correlation.windowMs`, `correlation.minConfidence`, `correlation.types`, `correlation.maxEvents`. Detection runs after timeline load with a brief "Detecting correlations…" phase when enabled.

• **Git: line history in session meta and commit links.** When `integrations.git.includeLineHistoryInMeta` is enabled, at session end the extension parses the log for file:line references (Dart, JS/TS, Java-style stack traces), runs `git blame` for each (capped at 20, 2s timeout per blame), and stores a `lineHistory` array in session meta. New setting `integrations.git.commitLinks` (default `true`) resolves commit hashes to web URLs (GitHub, GitLab, Bitbucket) and adds them to line history meta and to the blame status bar when opening source from a log line. Blame display shows a brief "Git blame…" loading message until the result is ready.

• **Investigation Mode: Export, import, and integration (Phase 3).** Investigations can be exported as `.slc` bundles (manifest v3) with all pinned sources and sidecars; import recreates the investigation in the workspace. Bug reports now include an optional "Investigation Context" section (name, pinned sources table, recent search, notes) when an investigation is active. "Generate Bug Report" in the investigation panel produces a report from investigation context. Export and import show notification progress.

• **Investigation Mode: UX polish (Phase 4).** Project Logs panel shows an "Investigations" section with list and "Create Investigation…"; clicking an investigation opens it, creating sets active. Session context menu includes "Add to Investigation". New command "New Investigation from Sessions…" multi-selects sessions and creates an investigation with them. All new user-facing strings are localized (en + placeholder in other locales).

---

## [3.2.1]

Fixes empty log file when Flutter/Dart child session starts before parent so a single file captures all debug output.

### Fixed

• **Flutter/Dart: empty log file when child session starts before parent.** When the Dart VM (child) debug session started before the Flutter (parent) session, the extension created a second log file for the parent that never received output. The parent now reuses the child's log session so a single file captures all debug output.

---

## [3.2.0]

Investigation Mode Phase 2 (cross-source search), Cursor IDE compatibility warning, empty state watermark, file info panel, and empty-line decoration fix.

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

Modularized six oversized files, fixed replay bar when log is empty, and aligned @types/vscode with engine for packaging.

### Changed

• **Modularized 6 files exceeding 300-line limit.** Split `extension-activation.ts`, `context-loader.ts`, `investigation-panel.ts`, `timeline-panel.ts`, `viewer-panel-handlers.ts`, and `viewer-context-popover.ts` into smaller focused modules. Extracted types, handlers, scripts, and styles into dedicated files. No behavior changes — pure refactoring.

### Fixed

• **Replay bar no longer appears when log is empty.** Added defense-in-depth guards to prevent the replay controls from showing "0 / 0" when no log lines are loaded. The replay icon and bar now require lines to exist before becoming visible, and the state is re-evaluated after file load completes.

• **Aligned `@types/vscode` with `engines.vscode` for packaging.** Downgraded `@types/vscode` from `^1.110.0` to `^1.105.0` to match the engine constraint, fixing vsce packaging error on Cursor-compatible builds.

---

## [3.1.2]

Enables Cursor IDE compatibility by lowering the VS Code engine requirement to 1.105.0.

### Changed

• **Lowered VS Code engine requirement to 1.105.0.** Enables installation in Cursor IDE (which uses VS Code 1.105.1). The extension does not use any APIs requiring 1.108+.

---

## [3.1.1]

Failed release (reverted) — the engine change was incorrectly applied and had to be redone in 3.1.2.

~~### Changed~~

• ~~**Lowered VS Code engine requirement to 1.105.0.** Enables installation in Cursor IDE (which uses VS Code 1.105.1). The extension does not use any APIs requiring 1.108+.~~

---

## [3.1.0]

Major feature release: unified timeline view correlates all log sources on one time axis, context popovers show related data around any log line, and you can now hide/unhide lines manually.

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

Exposes a public API so other VS Code extensions can subscribe to log events and inject lines, plus reduces VS Code window spawns during publish.

### Fixed

• **Publish script spawns fewer VS Code windows on Windows.** Removed extension-cache clearing that forced a redundant `code --list-extensions` call, reducing VS Code window spawns from 4 to 3 (with one missing extension) or from 3 to 2 (happy path). Remaining CLI calls now print a notification before spawning so the user knows what is happening.

### Added

• **Public extension API.** Other VS Code extensions can now consume a typed API via `vscode.extensions.getExtension('saropa.saropa-log-capture')?.exports`. Exposes live line events (`onDidWriteLine`), session lifecycle events (`onDidStartSession` / `onDidEndSession`), file split events, `getSessionInfo()`, `insertMarker()`, `writeLine()`, and `registerIntegrationProvider()`.

• **`writeLine()` public API method.** Consuming extensions can write structured log lines into the active capture session via `api.writeLine(text, { category, timestamp })`. Lines go through the same pipeline as DAP output: exclusion rules, flood protection, deduplication, watch patterns, viewer display, and all export formats. No-op when no session is active.

• **User-configurable settings for Performance, Terminal, and Linux Logs integrations.** Added `package.json` setting definitions so these adapters' options (snapshot timing, terminal selection, WSL distro, etc.) appear in VS Code's Settings UI.

## [3.0.5]

Streamlines the session UI — metadata moves to a tooltip, the replay bar tucks behind an icon, and severity connectors fade back so the dots stand out.

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

Fixes multi-line severity inheritance and localized strings showing raw keys, adds scroll-to-top and find-in-files sorting, and improves Project Logs list performance.

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

Automated release to publish accumulated fixes; no user-facing changes beyond what shipped in 3.0.2.

## [3.0.2]

In this release we add eight new integration adapters (performance, terminal, WSL, security, and more), one-click export to Grafana Loki, session replay with timing, and full support for remote workspaces (SSH, WSL, Dev Containers).

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

We improved the docs and added ARCHITECTURE.md, made config and JSON parsing safer, and tightened deep links and split rules.

### Added

• **System-wide code comments and ARCHITECTURE.md.** Deep comment pass across entry, activation, capture pipeline, config, integrations, handlers, analysis, export, storage, and UI: file-level JSDoc, section comments (`// --- ... ---`), and inline "why" comments. New `ARCHITECTURE.md` describes high-level flow (DAP → tracker → SessionManager → LogSession + Broadcaster), lifecycle, config, and comment conventions.

• **Config validation and safe JSON.** `config-validation.ts`: clamp, ensureBoolean, ensureEnum, ensureStringArray, ensureNonNegative, ensureNonEmptyString; MAX_SAFE_LINE and MAX_SESSION_FILENAME_LENGTH for deep links. `safe-json.ts`: safeParseJSON and parseJSONOrDefault for defensive parsing. Config and integration-config use validation; session-metadata and error-status-store use parseJSONOrDefault; build-ci and test-results use safeParseJSON. Unit tests for config-validation and safe-json.

• **Deep link and split-rules hardening.** Deep links: session name validated (no path traversal, length cap); line number clamped to 1..MAX_SAFE_LINE; generateDeepLink trims and uses safe default. parseSplitRules accepts null/undefined and clamps numeric settings to safe maxima.

### Fixed

• **ESLint curly.** Added braces to single-line `if` bodies in config, integration-config, deep-links, file-splitter, and viewer-message-handler for consistency.

• **Integration config.** Crashlytics and Windows Events `leadMinutes`/`lagMinutes` now correctly preserve user value `0` (was replaced by default); added `configNonNegative` helper to avoid duplication.

---

## [3.0.0]

In this release we add tail mode for live file watching, .slc session bundle export/import, a configurable viewer line cap, session date filter, copy-as-snippet for GitHub/GitLab, and accessibility improvements, plus a lot of refactoring under the hood.

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

For older versions (pre-3.0.0), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).
