# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

**VS Code Marketplace** - [marketplace.visualstudio.com / saropa.saropa-log-capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

**GitHub Source Code** - [github.com / saropa / saropa-log-capture](https://github.com/saropa/saropa-log-capture)

**Published version**: See field "version": "x.y.z" in [package.json](./package.json)

For older versions (pre-3.0.0), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).

---

## [3.1.0]

### Added

- **Unified Timeline View.** Correlate all data sources (debug console, terminal, HTTP, performance, Docker, browser, database, events) on a single time-synchronized view. Access via right-click session → Show Timeline. Features include: source filter checkboxes with color coding, time range scrubber with draggable handles and zoom controls (+/−/reset), minimap showing event density with click-to-navigate, virtual scrolling for 100k+ events, keyboard navigation (arrow keys + Enter), and export to JSON/CSV. Click any event to jump to the source log line or sidecar file.

- **Context Popover for integration data.** Right-click a log line → Actions → Show Integration Context to see a floating popover with performance, HTTP requests, terminal output, and Docker status from ±5 seconds around that line. Configurable time window via `saropaLogCapture.contextWindowSeconds` setting.

- **Volume slider plays preview sound.** When adjusting the audio volume slider in Options, a preview sound now plays after you stop dragging, so you can hear the actual volume level. Debounced to avoid spamming sounds while adjusting.

- **Hide Lines feature.** Manually hide log lines via right-click → Hide Lines submenu. Options include: Hide This Line (single row), Hide Selection (shift+click range), Hide All Visible (all currently shown lines), and corresponding Unhide actions. A footer counter shows "N hidden" with click-to-peek functionality — click to temporarily reveal hidden lines, click again to re-hide. New logs are never hidden by default.

### Fixed

- **Panel badge now clears when clicking in the log viewer.** The watch hits badge (showing unread error/warning counts) previously only cleared when the panel visibility changed. Now it also clears when you click anywhere in the already-visible panel.
- **Dart/Flutter exceptions now detected as errors.** Fixed detection of Dart internal error types like `_TypeError`, `_RangeError`, and `_FormatException` that weren't being marked red. Also added detection for `Null check operator used on a null value` messages. These patterns are now recognized even when the logcat prefix is `I/` (Info level), so exceptions in `I/flutter` output are properly highlighted as errors.
- **Severity bar now matches error/warning color for framework lines.** Framework log lines (e.g. `E/MediaCodec`) now show red/yellow/purple severity bars matching their log level, instead of always showing a blue "framework" bar. This makes errors from framework code visually consistent with the text color.
- **Context line spacing improved when filtering by level.** When double-clicking to show only errors (or other levels) with context lines, the visual gap now appears after the error group instead of before, creating cleaner visual grouping.
- **Replay controls hidden during recording and when empty.** The replay icon and playback bar are now hidden when a debug session is active or no log file is loaded. Clicking a session in Project Logs now shows the replay icon so users can start playback.
- **Dart/Flutter stack traces no longer show timestamps on each frame.** Stack frames using the `#0`, `#1`, `#2` format were not being detected, so each line displayed a redundant timestamp. Now the viewer correctly detects Dart, Python, and other stack frame formats, showing the timestamp only on the first line of the stack trace.

---

## [3.0.6]

### Fixed

- **Publish script spawns fewer VS Code windows on Windows.** Removed extension-cache clearing that forced a redundant `code --list-extensions` call, reducing VS Code window spawns from 4 to 3 (with one missing extension) or from 3 to 2 (happy path). Remaining CLI calls now print a notification before spawning so the user knows what is happening.

### Added

- **Public extension API.** Other VS Code extensions can now consume a typed API via `vscode.extensions.getExtension('saropa.saropa-log-capture')?.exports`. Exposes live line events (`onDidWriteLine`), session lifecycle events (`onDidStartSession` / `onDidEndSession`), file split events, `getSessionInfo()`, `insertMarker()`, `writeLine()`, and `registerIntegrationProvider()`.
- **`writeLine()` public API method.** Consuming extensions can write structured log lines into the active capture session via `api.writeLine(text, { category, timestamp })`. Lines go through the same pipeline as DAP output: exclusion rules, flood protection, deduplication, watch patterns, viewer display, and all export formats. No-op when no session is active.
- **User-configurable settings for Performance, Terminal, and Linux Logs integrations.** Added `package.json` setting definitions so these adapters' options (snapshot timing, terminal selection, WSL distro, etc.) appear in VS Code's Settings UI.

## [3.0.5]

Streamlines the session UI — metadata moves to a tooltip, the replay bar tucks behind an icon, and severity connectors fade back so the dots stand out.

### Added

- **Long-press session count copies session info.** Long-pressing the "Session X of Y" label copies all session metadata (date, project, debug adapter, etc.) to the clipboard.

### Fixed

- **Publish script no longer spawns multiple VS Code windows.** Cached the `code --list-extensions` CLI output so the editor is queried at most once per run instead of 3–4 times.

### Changed

- **Split 8 oversized files under 300-line limit.** Extracted cohesive modules from `session-lifecycle`, `session-manager`, `session-history-provider`, `viewer-handler-wiring`, `log-viewer-provider`, `viewer-context-menu`, `viewer-session-panel`, and `extension-activation` — no behavior changes.
- **Severity connector bars semi-transparent.** The vertical bars joining consecutive severity dots are now rendered at reduced opacity so they don't visually overpower the dots themselves.
- **Replay bar hidden behind icon.** The replay transport bar (play/pause/stop, speed, scrubber) is no longer always visible during replay. A replay icon appears in the icon bar when replay is active; click it to toggle the controls.
- **Session info moved to tooltip.** Session metadata (date, project, debug adapter, launch config, VS Code version, extension version, OS) is now shown as a tooltip on the session count label instead of a dedicated slide-out panel.
- **Session count always visible.** The "Session X of Y" label and Prev/Next buttons are now always shown (defaulting to "Session 1 of 1" for a single session) instead of hiding when there is no navigation.
- **Icon bar spacing.** Increased vertical gap between icon bar buttons from 2px to 3px for better visual balance after removing the Session Info icon.

### Removed

- **Session Info sidebar icon and panel.** The info icon (ℹ) and its full-height slide-out panel have been removed. The same information is now available via the session count tooltip.

---

## [3.0.4]

Fixes multi-line severity inheritance and localized strings showing raw keys, adds scroll-to-top and find-in-files sorting, and improves Project Logs list performance.

### Fixed

- **Continuation lines not inheriting severity level.** Multi-line log messages (e.g. Flutter `[ERROR:...]` followed by `See https://...`) now inherit the severity level from the preceding line when timestamps are within 2 seconds and the continuation has no explicit level markers.
- **Localized messages showing raw keys.** All `vscode.l10n.t()` calls used symbolic keys (e.g., `msg.gitignoreLogPrompt`) which displayed literally in English locale. Introduced `src/l10n.ts` helper that maps keys to English strings before passing through `vscode.l10n.t()`. Fixes 159 call sites across 26 source files. Also fixed 14 calls in `commands-export.ts` and `commands-session.ts` that incorrectly passed inline English text as positional substitution arguments. Re-keyed all 11 translation bundles to use English strings as lookup keys.

### Added

- **Scroll to Top button.** New "Top" button appears when scrolled past 50% of viewport height. Both Top and Bottom buttons hidden on small files (< 150% viewport height).
- **Find-in-files sort by match count.** Sort toggle in the find panel header reorders results by number of matches (most hits first).
- **Footer path gestures.** Footer now shows the relative path (or full path if outside workspace). Long-press copies the path to clipboard. Double-click opens the containing folder.

### Changed

- **Project Logs list performance.** Items-level cache with fetch deduplication eliminates redundant directory scans and metadata loads on repeat opens. Bulk central metadata read (`.session-metadata.json` read once per refresh, not once per file). Severity scan skipped when sidecar already has cached counts. Concurrency-limited batch loading (max 8 parallel file reads). Debounced webview session list requests (150ms).
- **Panel close buttons.** Replaced text `x` with codicon icons, restyled to match the refresh button size across all panels.
- **Panel widths.** All slide-out panels now share a single user-resizable width. The slot controls the width; all panels fill it via `width: 100%`. Resize handle updates only the slot (not individual panels). Persisted width applies immediately when the setting arrives, even if a panel is already open. Removed `max-width` constraints from Crashlytics, Recurring, Performance, Info, and Session panels.
- **Tidy mode improvements.** File extension stripped in tidy mode. Time extracted from filename and shown as 12-hour format (e.g. "10:19 AM"); hidden when it matches the session modified time. Severity dots moved inline with meta text. "N lines" text replaced by colored severity dots that sum to total line count (uncategorized lines shown as a dim "other" dot).
- **Tidy subfolder display.** Only shows subfolder prefix when basenames collide for disambiguation.
- **About panel changelog.** URL link moved above changelog content; changelog cleared on panel close.

### Fixed

- **Prev/Next session navigation.** Both buttons were navigating to the next session due to `safeLineIndex()` rejecting negative direction values.
- **Search tags textbox styling.** CSS ID mismatch (`#options-search` vs `#filters-search`) left the input unstyled.
- **Search mode toggle.** Toggle was resetting search text and missing active-state styling.
- **Find-in-files screen jump.** Session navigator CSS transition caused a visual jump when switching files.
- **Scroll-to-bottom button.** Button was inside the scroll container making it unclickable; moved to positioned wrapper with proper z-index.

## [3.0.3]

- Release publish

## [3.0.2]

In this release we add eight new integration adapters (performance, terminal, WSL, security, and more), one-click export to Grafana Loki, session replay with timing, and full support for remote workspaces (SSH, WSL, Dev Containers).

### Added

- **Eight new integration adapters.** Performance (system snapshot at session start, optional periodic sampling, Session tab in Performance panel), Terminal output (capture Integrated Terminal to sidecar; requires supported VS Code terminal API), WSL/Linux logs (dmesg and journalctl for WSL or remote Linux), Application/file logs (read last N lines from configured paths at session end), Security/audit (Windows Security channel with optional redaction, app audit file path), Database query logs (file mode: JSONL query log at session end), HTTP/network (request log JSONL at session end), Browser/DevTools (file mode: browser console JSONL/JSON at session end). All opt-in via `saropaLogCapture.integrations.adapters`. Config under `integrations.performance.*`, `integrations.terminal.*`, `integrations.linuxLogs.*`, `integrations.externalLogs.*`, `integrations.security.*`, `integrations.database.*`, `integrations.http.*`, `integrations.browser.*`. See [bugs/integration-specs-index.md](bugs/integration-specs-index.md) and [docs/integrations/TASK_BREAKDOWN_AND_EASE.md](docs/integrations/TASK_BREAKDOWN_AND_EASE.md).
- **Export to Loki (Grafana Loki).** One-click push of the current (or selected) log session to Grafana Loki. Enable via `saropaLogCapture.loki.enabled`, set `saropaLogCapture.loki.pushUrl` to your Loki push API URL (e.g. Grafana Cloud or `http://localhost:3100/loki/api/v1/push`). Store API key with command **Saropa Log Capture: Set Loki API Key** (Secret Storage). Command **Export to Loki** and session context menu **Export to Loki**; progress notification while pushing; labels `job=saropa-log-capture`, `session`, and optional `app_version` from metadata.
- **Remote workspace support (Task 90).** Extension runs in the workspace context for Remote - SSH, WSL, and Dev Containers (`extensionKind: workspace`). Save dialogs (export logs, save bug report) default to the workspace folder so the chosen path is on the remote when applicable. Integration providers (test-results, build-ci, code-coverage, environment-snapshot, crash-dumps) resolve workspace-relative paths via a shared `resolveWorkspaceFileUri` so paths work correctly in remote workspaces. README now includes a "Remote development (SSH, WSL, Dev Containers)" section.
- **Session replay.** Replay a saved log session with optional timing: lines appear in order with delay from per-line timestamps or `[+Nms]` elapsed prefixes (or fixed delay when absent). **Replay** is available from the Project Logs list (right-click a session → Replay) and from the command palette (**Saropa Log Capture: Replay Session**). Replay bar: Play, Pause, Stop; **Timed** (use line deltas) vs **Fast** (fixed short delay); speed (0.5x–5x); scrubber to seek. **Space** toggles play/pause. Settings: `replay.defaultMode`, `replay.defaultSpeed`, `replay.minLineDelayMs`, `replay.maxDelayMs`.
- **Copy with source: surrounding context lines.** New setting `saropaLogCapture.copyContextLines` (default 3, max 20). When using **Copy with source** from the log viewer context menu, the copied excerpt now includes this many log lines before and after the selection (or the right-clicked line), so stack traces and surrounding errors are included. Set to 0 to copy only the selection. NLS description in package.nls.json.

### Fixed

- **NLS verification.** Added missing manifest keys to all 10 localized package.nls.\*.json (de, es, fr, it, ja, ko, pt-br, ru, zh-cn, zh-tw): `command.exportToLoki.title`, `command.setLokiApiKey.title`, and `config.copyContextLines.description`, so `verify-nls` passes and publish can complete.

### Changed

- **Publish script: vsce login when PAT missing.** If marketplace PAT verification fails, the script now runs `vsce login saropa` interactively instead of only printing a manual command. Handles both first-time (PAT prompt only) and overwrite (y/N then PAT) flows; user sees a short hint if vsce asks to overwrite. No piped token so prompt order is correct in all cases.
- **Integration design docs.** Completed integration design documents (package-lockfile, build-ci, git-source-code, environment-snapshot, test-results, code-coverage, crash-dumps, windows-event-log, docker-containers) removed from `docs/integrations/`. Content is covered by: README there (points to Options, provider code, and bugs specs), [bugs/integration-specs-index.md](bugs/integration-specs-index.md) and `integration-spec-*.md`, provider JSDoc in `src/modules/integrations/providers/`, and CHANGELOG entries from when each was added (e.g. 2.0.19). That folder now holds design docs for **planned** integrations only.

---

## [3.0.1]

We improved the docs and added ARCHITECTURE.md, made config and JSON parsing safer, and tightened deep links and split rules.

### Added

- **System-wide code comments and ARCHITECTURE.md.** Deep comment pass across entry, activation, capture pipeline, config, integrations, handlers, analysis, export, storage, and UI: file-level JSDoc, section comments (`// --- ... ---`), and inline "why" comments. New `ARCHITECTURE.md` describes high-level flow (DAP → tracker → SessionManager → LogSession + Broadcaster), lifecycle, config, and comment conventions.
- **Config validation and safe JSON.** `config-validation.ts`: clamp, ensureBoolean, ensureEnum, ensureStringArray, ensureNonNegative, ensureNonEmptyString; MAX_SAFE_LINE and MAX_SESSION_FILENAME_LENGTH for deep links. `safe-json.ts`: safeParseJSON and parseJSONOrDefault for defensive parsing. Config and integration-config use validation; session-metadata and error-status-store use parseJSONOrDefault; build-ci and test-results use safeParseJSON. Unit tests for config-validation and safe-json.
- **Deep link and split-rules hardening.** Deep links: session name validated (no path traversal, length cap); line number clamped to 1..MAX_SAFE_LINE; generateDeepLink trims and uses safe default. parseSplitRules accepts null/undefined and clamps numeric settings to safe maxima.

### Fixed

- **ESLint curly.** Added braces to single-line `if` bodies in config, integration-config, deep-links, file-splitter, and viewer-message-handler for consistency.
- **Integration config.** Crashlytics and Windows Events `leadMinutes`/`lagMinutes` now correctly preserve user value `0` (was replaced by default); added `configNonNegative` helper to avoid duplication.

---

## [3.0.0]

In this release we add tail mode for live file watching, .slc session bundle export/import, a configurable viewer line cap, session date filter, copy-as-snippet for GitHub/GitLab, and accessibility improvements, plus a lot of refactoring under the hood.

### Added

- **Documentation standards and extension logging.** CONTRIBUTING documents file-level doc headers, JSDoc for public APIs, and inline comment guidelines. Shared extension logger (`extension-logger.ts`) with `setExtensionLogger()` at activation; `logExtensionError`, `logExtensionWarn`, `logExtensionInfo` used in edit/export, rename, deep links, and rebuild index. Cursor rules for documentation and error-handling/testing (`.cursor/rules/`).
- **Unit test coverage.** Tests for `EarlyOutputBuffer` (session-event-bus) and for file retention selection logic (`selectFilesToTrash`). CONTRIBUTING Testing section and `npm run test:coverage` (c8).
- **Parameter validation and assertion helper.** Viewer message handler validates `msg.type` and logs invalid messages; `assertDefined(ctx, 'ctx')` at dispatch entry. New `assert.ts` with `assertDefined` for required params.
- **Tail mode (Task 89).** New setting `saropaLogCapture.tailPatterns` (default `["**/*.log"]`) and command **Saropa Log Capture: Open Tailed File**. Pick a workspace file matching the patterns; the viewer opens it and appends new lines as the file grows (file watcher). NLS in all 11 locales.
- **Wow feature specs.** Full design docs for Consider for Wow: AI Explain this error, Session replay, One-click export to Loki/Grafana in `docs/wow-specs/`. ROADMAP §7 links to each spec.
- **.slc session bundle (Tasks 74–75).** **Export:** Command **Export as .slc Bundle** and session context menu **Export as .slc Bundle** save the current (or selected) session to a `.slc` ZIP containing main log, split parts, `manifest.json`, and `metadata.json`. Export shows a notification progress while building the bundle; split-part reads run in parallel. **Import:** Command **Import .slc Bundle** opens a file picker; selected `.slc` files are extracted into the workspace log directory with unique names, metadata merged into `.session-metadata.json`, then a single session list refresh and the last imported log opened in the viewer. Progress notification during import. NLS in all 11 locales and bundle.l10n. Unit tests for manifest validation (`isSlcManifestValid`). README Export section documents .slc bundle.
- **Configurable viewer line cap.** New setting `saropaLogCapture.viewerMaxLines` (default 0 = 50,000). When set, the viewer and file load are capped at `min(viewerMaxLines, maxLines)` to reduce memory for very large files. Applied in sidebar and pop-out viewer; NLS in all 11 locales.
- **Session list date filter.** Project Logs panel has a dropdown: "All time", "Last 7 days", "Last 30 days". Selection is persisted with session display options and filters sessions by `mtime` in the webview.
- **Unit tests for viewer line cap and session display.** Tests for `getEffectiveViewerLines` (default, custom cap, cap at maxLines) and for `buildViewerHtml` with `viewerMaxLines`; tests for `defaultDisplayOptions.dateRange` in session-display.
- **Copy as snippet (GitHub/GitLab).** Context menu item "Copy as snippet (GitHub/GitLab)" copies selection or visible lines wrapped in ` ```log ` … ` ``` ` for pasting into issues.
- **Minimal a11y (accessibility).** Icon bar has `role="toolbar"` and each button has `aria-label`; footer level filters, filter badge, version link, jump-to-bottom button, and copy-float have `aria-label` and/or `role="button"` where appropriate; level flyup toggle buttons have `aria-label`.
- **Viewer a11y (extended).** Log content region has `role="log"` and `aria-label="Log content"`; session/split nav buttons and context-lines slider have `aria-label`; split breadcrumb label has `aria-hidden`. Unit test asserts log region a11y in `buildViewerHtml`.

### Changed

- **File line limit (300 lines).** Split 10 files that exceeded the limit into smaller modules: commands (session, export, tools, deps), extension (activation), config (config-types), project-indexer (project-indexer-types), session-metadata (session-metadata-migration), log-viewer-provider (load, setup), viewer-provider-helpers (viewer-provider-actions), viewer-data-helpers (core, render), viewer-script (viewer-script-messages), pop-out-panel (uses shared dispatchViewerMessage). Behavior unchanged; structure only.
- **File retention.** Pure helper `selectFilesToTrash(fileStats, maxLogFiles)` extracted for testability; `enforceFileRetention` uses it.
- **Error handling.** Edit-line and export-log failures, session rename failures, and deep-link errors now log to the extension output channel before showing user messages.
- **Plan.md footer consolidation.** Plan marked closed: footer no longer has Excl/App Only/Preset/Categories/No Wrap/Export; those live in Filters panel, Options, or context menu. Status and current UX summarized at top of plan.
- **README Known Limitations.** Viewer line cap now documents `viewerMaxLines` (0 = 50k default) and that it cannot exceed `maxLines`; suggests setting it lower to reduce memory. Settings table includes `viewerMaxLines`. Keyboard shortcuts table and accessibility note added under Known Limitations; cross-link to docs/keyboard-shortcuts.md.
- **Requirements in README.** Documented VS Code ^1.108.1 (or Cursor/Open VSX–compatible editor) and link to `engines.vscode` in package.json.
- **Redaction tip.** README settings table now suggests redacting secrets (e.g. `API_KEY`, `SECRET_*`, `*_TOKEN`) via `redactEnvVars`.
- **About panel changelog URL.** Changelog link is built from extension id (`buildChangelogUrl(extensionId)`) instead of a hardcoded URL; callers pass `context.extension.id`.
- **Keyboard shortcuts doc.** `docs/keyboard-shortcuts.md` lists Power Shortcuts and Key Commands; linked from README and Documentation table.
- **Preset "last used".** Last applied filter preset name is stored in workspace state and re-applied when the viewer loads (sidebar and pop-out).
- **TypeScript.** Enabled `noImplicitReturns`, `noFallthroughCasesInSwitch`, and `noUnusedParameters` in tsconfig.json.
- **Filter presets schema.** Added `levels` and `appOnlyMode` to `saropaLogCapture.filterPresets` in package.json and all 11 package.nls.\* locale files.
- **Publish script (Step 10).** Added `--yes` to accept version and stamp CHANGELOG without prompting (non-interactive/CI). When stdin is not a TTY, version is accepted by default; clearer error suggests `--yes` if confirmation fails.
- **ROADMAP.** Marked resolved project-review issues (Known Limitations, integration index, tsconfig, filterPresets schema, F5 note, DAP-only doc) as fixed in §2. Completed items removed from §7; Do Soon (README cap, integration index, a11y) removed; Do Next and Consider for "Wow" renumbered 1–6.

### Fixed

- **README Known Limitations.** Updated to describe viewer line cap via `maxLines` and `viewerMaxLines`, and "Showing first X of Y lines" when truncated; added note that capture is Debug Console (DAP) only with link to Terminal output capture doc.
- **README Quick Start.** Added F5 testing note: use VS Code (not Cursor) for Extension Development Host.
- **Integration specs index.** `bugs/integration-specs-index.md` now marks implemented adapters (buildCi, git, environment, testResults, coverage, crashDumps, windowsEvents, docker) as Done; intro sentence clarifies Done = implemented, Pending = planned.

---

For older versions (pre-3.0.0), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).
