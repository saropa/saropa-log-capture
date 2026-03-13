# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

**VS Code Marketplace** - [marketplace.visualstudio.com / saropa.saropa-log-capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

**Open VSX Registry** - [open-vsx.org / extension / saropa / saropa-log-capture](https://open-vsx.org/extension/saropa/saropa-log-capture)

**GitHub Source Code** - [github.com / saropa / saropa-log-capture](https://github.com/saropa/saropa-log-capture)

**Published version**: See field "version": "x.y.z" in [package.json](./package.json)

For older versions (pre-3.0.0), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).

---

## [Unreleased]

### Added

• **Viewer icon bar: optional labels and bar-click toggle.** The log viewer’s vertical icon bar (Project Logs, Search, Bookmarks, etc.) can show text labels next to each icon. Click the bar background or the separator between icon groups (not on an icon) to toggle labels on or off. The choice is persisted in webview state so it survives reloads.

• **Project Logs: multi-select with Ctrl/Cmd-click.** In the Project Logs panel you can Ctrl-click (or Cmd-click on macOS) to select multiple sessions. The context menu then applies to all selected items: Copy Deep Links / Copy File Paths (newline-separated to clipboard), Export (one file per session), Tag (dialog per session), Open (each in turn), Replay (first selected). Single-item behavior is unchanged. Trash panel remains single-selection.

• **Capture diagnostics for empty logs.** New setting `saropaLogCapture.diagnosticCapture` (default `false`). When enabled, the extension logs capture pipeline events to the "Saropa Log Capture" output channel: new log session created, output buffered (no session yet), and output written to log (once per session).

• **Single-session output fallback.** If DAP output arrives under a session id that has no log session yet, but there is exactly one active log session, that output is now routed to that session and written to the log instead of being buffered indefinitely.

• **Replay all early output when creating the first session.** Output that arrives before any log session exists is buffered by session id. We used to replay only the buffer for the session that had just started, so output that had been tagged with a different id was never replayed and the log stayed empty. When we create the first log session we now replay every buffered session’s output into that session, so no early output is dropped.

• **Why it broke after v3.1.3:** The 3.1.3 refactor (modularization only) likely changed the order/timing of tracker registration and event delivery. Output then often arrived before a session existed or under a different session id; we only replayed the “just started” session’s buffer, so other output was dropped. The fixes above (replay all early output + single-session fallback) address that.

### Changed

• **Viewer: blank lines and decorations.** Blank lines are defined as lines whose text is empty or only whitespace (spaces, tabs, Unicode whitespace) via a single regex (`/^\s*$/`). Such lines never show the decoration prefix (counter, timestamp, chevron). When "Hide blank lines" is on, those same lines are hidden. When shown, blank lines keep the severity bar (inherited from the previous line) and line tint for visual continuity.

• **Viewer: clearer decoration labels and Timestamp in context menu.** The "Line prefix" option is renamed to **Line decorations (dot, number, time)** in both the right-click context menu and the Options panel so it’s clear it controls the severity dot, counter, and time in the left margin. A **Timestamp** toggle was added to the context menu (Options submenu) so per-line timestamps can be shown or hidden without opening the Options panel; turning Timestamp on from the menu enables line decorations if they were off.

• **Correlations: integrated into Session Timeline.** The correlations list no longer appears as a separate sidebar view. When you open a session timeline, detected correlations are shown in a block directly in the timeline panel (below the toolbar), with "Jump to event" links. The section is only shown when there are correlations for that session, keeping the timeline as the single place for events and correlation context.

### Added

• **Performance integration: profiler output copy and process memory.** New setting `integrations.performance.profilerOutputPath` (default empty): at session end, an external profiler file (e.g. `.cpuprofile`, `.trace`) is copied into the session folder when the path is set (supports `${workspaceFolder}`; 100 MB max). New setting `integrations.performance.processMetrics` (default `false`): when enabled, the extension captures the debug target process memory (MB) from the DAP `process` event and records it in the performance snapshot and session meta. Process memory is read at session end (Windows: PowerShell; Linux: `/proc/<pid>/status`; macOS: `ps`). If the adapter does not send a process ID or the read fails, the field is omitted.

• **Integrations: dedicated screen from Options.** The Options panel no longer lists all integration checkboxes inline. A single **Integrations…** button opens a dedicated Integrations screen (same slide-out, view switch) with back navigation. Each adapter now has a long description, a performance note, and when-to-disable guidance. This reduces clutter and makes it easier to choose adapters and understand cost.

• **Crash dumps: copy into session folder.** New setting `integrations.crashDumps.copyToSession` (default `false`). When enabled, discovered crash dump files are copied into the session output folder so the session is self-contained. Total copy size is capped at 500 MB; duplicate basenames get a numeric suffix. The sidecar JSON includes a `copiedTo` path per file and `copiedCount` in meta.

### Fixed

• **Session replay: more speeds, 0.5x display, and bar visibility.** Replay speed dropdown now includes 0.1x, 0.25x, 0.75x, and 10x (in addition to 0.5x, 1x, 2x, 5x). Selecting 0.5x (half speed) now correctly shows and applies the chosen speed instead of appearing unchanged. The replay bar (Play, Pause, Stop, Mode, Speed, scrubber) is now shown whenever a log file with lines is loaded, so replay options are visible without clicking the replay icon first; the bar remains visible after stopping replay. Default speed setting allows 0.1x–10x. Replay bar uses a short fade-in when shown.

• **Viewer in new window: clicks on sessions now open log content.** Opening the Saropa Log Capture tab in a new window (e.g. via "Open in New Window") left the session list visible but clicking a session did not show log content in that window. The sidebar log viewer is a WebviewView; VS Code resolves one view per window. The extension now tracks all resolved views and broadcasts load/postMessage to each, so the viewer in the window where you click receives the content. Batch timer and badge updates were adjusted for multi-view (stop timer only when the last view is removed; update badges on all views).

• **Session list file time display.** Time in the Project Logs session list was inconsistent: some entries showed relative time ("X hrs ago"), some showed clock time, and some showed nothing (e.g. when day headings were on and the file was older than 24 hours). The panel now always shows a time (relative when &lt; 24h, otherwise clock time). When session metadata has no valid mtime, the extension falls back to filesystem stat so the list always has a time when the file exists. Loading state is shown while the list is built after tree data changes.

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
