# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

**VS Code Marketplace** - [marketplace.visualstudio.com / saropa.saropa-log-capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

**Publish version**: See field "version": "x.y.z" in [package.json](./package.json)

---
## [Unreleased]

### Added
- **Translation rollout plan.** Added `docs/translation-rollout-plan.md` covering priority languages (zh-cn, ja, ko, es, de), translation method, per-language workflow, and trigger criteria for when to begin localization work.
- **Auto-organize legacy log files.** New `organizeFolders` setting (on by default) automatically moves flat log files with a `yyyymmdd_` prefix into date-based subfolders on session start. Companion `.meta.json` sidecars are moved alongside their log files.

### Changed
- **Date-based log subfolders.** New log sessions are now written to `reports/yyyymmdd/` subfolders (e.g. `reports/20260218/`) instead of directly into the `reports/` root. File retention and session history already scan subfolders, so existing workflows are unaffected.

---
## [2.0.6] - 2026-02-18

### Added
- **Manifest localization support.** Extracted 127 user-visible strings from `package.json` into `package.nls.json` using VS Code's `%key%` reference mechanism. Enables future translation via locale-specific `package.nls.{locale}.json` files.
- **NLS key alignment verification script.** New `npm run verify-nls` command checks that all `%key%` references in `package.json` have matching entries in every `package.nls*.json` file, reporting missing and orphan keys.

---
## [2.0.5] - 2026-02-16

### Added
- **Full severity dot breakdown in session list.** Each session now shows five colored dot counters: red (errors), yellow (warnings), purple (performance), blue (framework), and green (info). Framework lines are detected via logcat tags and launch boilerplate; info is all remaining lines.
- **Minimap width setting.** New `minimapWidth` preference lets you choose small (40px), medium (60px, default), or large (90px) for the scrollbar minimap.

### Changed
- **Crashlytics cache visible in session history.** Cached crash event files are now stored in `reports/crashlytics/` (was `.crashlytics/`), making them searchable, comparable, and visible in the session tree.
- **Moved all views to bottom panel.** Log Viewer, Crashlytics, Play Vitals, and About panels now appear in the bottom panel (next to Terminal) instead of the sidebar.
- **Crashlytics, Recurring Errors, and About are now icon-bar panels.** All three are integrated into the Log Viewer webview as slide-out panels accessible from the icon bar, matching the existing Sessions/Trash/Bookmarks pattern. No more separate editor tabs or sidebar views.
- **Wider timeline connector bars.** The vertical bars joining consecutive same-color severity dots are now 5px wide (was 3px), staying centered on the dots.
- **Performance dot color changed from blue to purple.** The performance severity dot in the session list is now purple to free up blue for framework lines.

### Removed
- **Severity distribution bar in session list.** Removed the thin horizontal bar under each session entry; the five colored dot counters now convey a complete line-type breakdown.

### Fixed
- **gcloud CLI not detected on Windows.** The `execFile` call lacked `shell: true`, so Windows couldn't execute `gcloud.cmd` batch files, causing a false "Google Cloud CLI not found in PATH" error in the Crashlytics setup panel.
- **Line hover background matches compressed line height.** Added explicit `height: calc(1em * line-height)` on `.line` elements so the hover background always matches the virtual-scroll row height, preventing it from bleeding into adjacent lines at compressed settings.
- **Copy icon vertically centered on line.** The floating copy-to-clipboard icon now vertically centers on the hovered line instead of using a fixed offset.
- **Copy icon no longer overlaps scrollbar minimap.** Increased the right-edge clearance of the floating copy-to-clipboard button so it stays within the log content area.

---
## [2.0.4] - 2026-02-16

### Added
- **About Saropa sidebar panel.** New info panel in the sidebar showing a short blurb about Saropa and clickable links to project websites (Marketplace, GitHub, saropa.com).
- **Full project catalogue in About panel.** Lists all Saropa projects (Contacts, Home Essentials, Log Capture, Claude Guard, saropa_lints, saropa_dart_utils) and a Connect section with GitHub, Medium, Bluesky, and LinkedIn links. Each entry has a badge line (platform, stats) and a description synced with ABOUT_SAROPA.md.

### Changed
- **Moved views to activity bar.** All Saropa panels (Log Viewer, Crashlytics, Recurring Errors, About) now appear in the left activity bar sidebar instead of the bottom panel area, fixing the cramped layout.
- **Updated README panel references.** Replaced "bottom panel next to Output/Terminal" wording with activity bar sidebar location.

---
## [2.0.3] - 2026-02-16

### Added
- **Crashlytics setup diagnostics.** The Crashlytics panel now shows actual error details when setup fails instead of generic hints. Captures gcloud CLI errors (not found, not logged in, permission denied), HTTP status codes from the Firebase API (401/403/404), and network timeouts. A "Last checked" timestamp shows when the last diagnostic ran. All diagnostic steps are logged to the "Saropa Log Capture" output channel for advanced troubleshooting.
- **Minimap info markers setting.** New `saropaLogCapture.minimapShowInfoMarkers` setting (off by default) controls whether info-level (green) markers appear on the scrollbar minimap. Reduces visual noise for most users while letting those who want full coverage opt in.

### Changed
- **Minimap rewritten with canvas rendering.** The scrollbar minimap now paints markers onto a `<canvas>` element instead of creating individual DOM `<div>` elements. Uses `prefixSums` from the scroll-anchor system for pixel-accurate positioning, supports HiDPI displays, and eliminates innerHTML rebuilds for better performance.

### Fixed
- **Copy icon no longer overlaps scrollbar minimap.** Increased the right-edge clearance of the floating copy-to-clipboard button so it stays within the log content area.
- **Timeline dots no longer shift on hover.** Replaced transform-based vertical centering with margin-based centering to eliminate sub-pixel jitter when hovering log lines.
- **Same-color timeline dots are now connected by a colored vertical bar.** Consecutive log lines with the same severity level show a colored connector bar between their dots, making runs of same-level output visually distinct.

---
## [2.0.2] - 2026-02-15

### Fixed
- **Timeline dots: stacking and alignment.** The severity dot timeline in the log gutter now renders correctly — dots are single-color (no line bleed-through), always paint above the timeline line, and the whole construct is indented from the left edge.
- **Panel titles: added "Saropa" prefix.** All webview panels opened in the main VS Code editor now include the "Saropa" prefix for discoverability (e.g. "Saropa Cross-Session Insights", "Saropa Log Timeline").
- **Insights panel: refresh no longer resets position.** Clicking Refresh, changing the time range, or closing an error no longer moves the panel back to the Beside column.
- **Insights panel: production data loading indicator.** The "Checking production data..." spinner now reliably stops via a settled guard, reduced timeout (10 s), and output channel logging for diagnostics.
- **Panels no longer auto-restore on startup.** Registered no-op serializers for all singleton webview panels so VS Code does not restore them when reopening a project.
- **Session panel: removed spark bar.** The small grey "relative density" bar after severity dots was too small to convey useful information and confused users. Removed entirely.
- **Session panel: severity dot alignment.** Colored severity dots now vertically center-align with their count numbers using flex layout instead of fragile `vertical-align`.
- **Session panel: severity bar improved.** The proportional error/warning/perf bar is now full-width instead of a tiny 40px inline bar, and its tooltip shows a descriptive breakdown (e.g. "5 errors, 3 warnings") instead of a generic total.
- **Historical log files now open at the top.** Previously, opening an old log file from session history would scroll to the bottom. The viewer now starts at line 1 for file views, while live capture sessions continue to auto-scroll.

---
## [2.0.1] - 2026-02-10

### Added
- **Reset All Settings command:** New "Saropa Log Capture: Reset All Settings to Defaults" command in the command palette resets every extension setting to its default value in one step.
- **Crashlytics setup wizard:** The Crashlytics sidebar panel now shows an interactive 3-step setup wizard instead of plain text hints. Step 1 links to the Google Cloud CLI install page, step 2 opens a VS Code terminal to run the auth command, and step 3 offers a file picker to locate `google-services.json` (or a link to configure settings manually). A billing tip reassures users that Crashlytics API access is free. "Check Again" button and auto-refresh on terminal close.
- **Clickable URLs in setup hints:** Setup hint URLs in the analysis panel (GitHub CLI, Firebase) are now rendered as clickable links instead of plain text.
- **Filterable crash categories in Insights:** Toggle chips (FATAL, ANR, OOM, NATIVE) above the recurring errors list let you isolate specific crash types. All/None buttons for quick toggling. Errors without a category are always visible.
- **Search in Insights panel:** Filter input in the header filters both Hot Files and Recurring Errors by keyword. Debounced at 150ms. Composes with category chip filtering.

### Changed
- **Refactor:** Extracted Crashlytics production bridge logic from `insights-panel.ts` into `insights-crashlytics-bridge.ts` for maintainability.

### Fixed
- **Stale gcloud cache on refresh:** The "Check Again" button now clears all cached state (gcloud availability, token, issue list) so users can recover after installing gcloud or re-authenticating without reloading VS Code.

---
## [2.0.0] - 2026-02-10

<!-- cspell:ignore SIGSEGV -->
### Added
- **Google Play Console deep link:** New `saropaLogCapture.playConsole.appUrl` setting for a custom Play Console URL. If set, the "Open Play Console" button in the Vitals panel navigates directly to your app's Vitals page instead of the generic homepage.
- **Target device metadata:** Debug adapter type and target device are now stored in session `.meta.json`. Device is detected from Flutter launch output ("Launching ... on DEVICE") and launch config keys (`deviceId`, `device`, `deviceName`).
- **Environment distribution in Insights:** Cross-Session Insights panel now shows debug adapter, platform, and SDK version distribution across sessions in a collapsible "Environment" section.
- **ANR thread analysis:** Thread dump grouping now detects potential ANR patterns (main thread Runnable while other threads are Waiting/Blocked). Blocking threads get a warning badge and the summary line flags "ANR pattern detected".
- **Thread-aware bug report export:** Bug report stack trace extraction now continues past thread headers instead of stopping. Multi-thread traces include `--- threadName ---` separators in the exported markdown.
- **Package name auto-detection:** Detects Android package name from `google-services.json`, `AndroidManifest.xml`, or `pubspec.yaml`. Cached for 5 minutes. Override via `saropaLogCapture.firebase.packageName` setting. Enables scoping of Play Vitals and Crashlytics queries.
- **Crash category sub-classification:** Fingerprinted errors are now classified into categories: FATAL, ANR, OOM, NATIVE, or non-fatal. Categories are detected from error text patterns (e.g. `OutOfMemoryError` → OOM, `SIGSEGV` → NATIVE). Colored badges appear in the Insights panel and Recurring Errors sidebar.
- **Thread dump grouping:** When multiple consecutive thread headers are detected in log output (common in ANR dumps and `kill -3`), a "Thread dump (N threads)" summary marker is injected before the dump for visual grouping. Each thread's frames remain individually visible.
- **Google Play Vitals panel:** New opt-in sidebar panel showing crash rate and ANR rate from the Google Play Developer Reporting API. Displays rates with color-coded good/bad indicators against Google Play's bad-behavior thresholds (crash > 1.09%, ANR > 0.47%). Enable via `saropaLogCapture.playConsole.enabled` setting. Requires Play Console access and gcloud auth.
- **Relative time in session history:** Sessions within the last 24 hours show an approximate relative time after the timestamp — e.g. "4:13pm (2 hrs ago)", "(just now)", "(5 min ago)". Appears in both the Project Logs panel and the sidebar tree view. Omitted for sessions older than 24 hours.
- **Dedicated Trash panel:** Trash is now a standalone icon bar panel (between Info and Options) instead of a toggle inside the Project Logs panel. Shows trashed sessions with metadata and severity dots, supports right-click context menu (restore, delete permanently), and has an "Empty Trash" header button. Badge on the icon bar shows the trashed session count. Removed the confusing trashcan icon from the VS Code view title bar.
- **Pre-production ANR risk scoring:** New `anr-risk-scorer.ts` module scans debug session body text for patterns that predict ANRs (choreographer warnings, GC pauses, jank, dropped frames, ANR keywords) and produces a 0-100 risk score with low/medium/high levels. Score is computed on session finalization and stored in `.meta.json` sidecar. Sessions with ANR patterns show `ANR: N` in the Project Logs tree description and tooltip.
- **Debug-to-Crashlytics error bridge:** Cross-Session Insights panel now automatically matches recurring error patterns against production Crashlytics issues. Matching errors show a production impact badge (`Production: N events, N users`) via progressive webview update. Bridges the gap between development-time error detection and production crash data.
- **App version capture:** Detects app version from `pubspec.yaml`, `build.gradle`, or `package.json` during session finalization. Stored in `.meta.json` sidecar. Used for version range display on recurring errors.
- **Version range on recurring errors:** Insights panel shows `v1.2.0 → v1.4.1` on recurring error patterns, tracking the first and last app version where each error appeared.
- **Thread header parsing:** Recognizes Java/Android thread dump headers (`"main" tid=1 Runnable`, `--- main ---`) in log output and styles them as link-colored italic text in the viewer.
- **Error status lifecycle:** Recurring errors in the Insights panel can be closed (dimmed) or muted (hidden) via action buttons. Status persists in `.error-status.json`. Re-open restores visibility.
- **Recurring Errors sidebar panel:** Always-visible panel showing top error patterns across all sessions with triage actions (Close/Mute/Re-open). Auto-refreshes after session finalization. Links to the full Insights panel.
- **Source Scope filter:** Android Studio-style scope filtering in the Filters panel. Narrow log output by Workspace folder, Package, Directory, or File based on the active editor. DAP source paths are threaded from the debug adapter through to the webview. Package detection walks up from the file to find the nearest manifest (`pubspec.yaml`, `package.json`, `Cargo.toml`, etc.). Scope context updates automatically when switching editor tabs. "Hide unattributed" checkbox controls visibility of lines without DAP source paths. Integrates with filter badge count, preset reset, and panel sync.
- **Firebase Crashlytics:** Analysis panel queries Firebase Crashlytics REST API for matching production crashes. Shows crash issue title, event count, and affected users. Clicking an issue card fetches the latest crash event and renders classified stack frames inline (APP/FW badges, clickable app frames open source). Console deep link opens Firebase Console in browser. Auth via `gcloud` CLI with 30-minute token caching; config auto-detected from `google-services.json` or overridden via `saropaLogCapture.firebase.projectId` / `.appId` settings. Crash event detail is cached to `reports/.crashlytics/` to avoid repeated API calls. Gracefully degrades with actionable setup hints when gcloud or config is missing.
- **Expanded code tag detection:** Detects method names (`_logDebugError`, `dbActivityAdd`) and constructor calls (`ResizeImage()`, `Image()`) in addition to class names. Generic lifecycle methods (`build`, `dispose`, `initState`, etc.) are blacklisted to reduce noise. Section renamed from "Class Tags" to "Code Tags".
- **Tag chip "Show all" toggle:** Log Tags and Code Tags sections now show the top 20 chips by count, with a "Show all (N)" toggle to reveal the full list.
- **Session panel discoverability:** Six improvements to the Project Logs panel for better navigation when many sessions share similar names after datetime stripping:
  - Drag-resizable panel width (handle on left edge, persisted in display options)
  - Session duration in subtitle (computed from header Date and footer SESSION END timestamps)
  - Error/warning/performance colored dot counts (scanned from file body, cached in `.meta.json` sidecar)
  - Dim "(latest)" suffix on the newest session per unique display name
  - "Latest only" toggle filters to one-per-name for quick access
  - Inline correlation tag chips (replaces QuickPick) with All/None controls for filtering sessions by tag
- **Correlation tags documentation:** New `docs/correlation-tags.md` explaining what tags are, how they're generated, how to filter, and how to rescan.
- **Configurable icon bar position:** New `saropaLogCapture.iconBarPosition` setting (`"left"` or `"right"`, default `"left"`). The icon bar and all slide-out panels now default to the left side of the viewer, matching VS Code's activity bar convention. Changes apply instantly without reload.
- **Lint violation integration:** Bug reports now include a "Known Lint Issues" section sourced from Saropa Lints' structured export (`reports/.saropa_lints/violations.json`). Violations are matched to stack trace files, sorted by impact and proximity, and rendered as a markdown table with source attribution and staleness warning. Critical violations surface in the executive summary as high-relevance findings.
- **ANR badge:** Performance-level log lines containing ANR-specific keywords (`ANR`, `Application Not Responding`, `Input dispatching timed out`) now display an orange stopwatch badge. Separates ANR signals from general jank/fps/choreographer noise. ANR count also tracked in session severity metadata.
- **Time-windowed insights:** Cross-Session Insights panel now includes a time range dropdown (All time, Last 30 days, Last 7 days, Last 24 hours) that filters which sessions are included in the aggregation. Session dates are parsed from log filenames.
- **Impact-weighted error sorting:** Recurring errors in the Insights panel are now sorted by impact score (sessions × occurrences) instead of session count alone, matching Android Vitals' event×user ranking.
- **Insights refresh timestamp:** Cross-Session Insights panel header now shows data age ("just now", "42s ago", "3m ago") alongside the session/file/error summary, giving confidence in data freshness.
- **Crashlytics issue list cache:** Top issues API response is cached in memory for 5 minutes to avoid redundant API calls during repeated analyses. Explicit refresh (sidebar button or auto-refresh timer) bypasses the cache.
- **Generalized production error bridge:** Cross-Session Insights panel now matches ALL recurring error patterns against Crashlytics production issues (previously ANR-only). Uses word extraction from both example lines and normalized text for broader matching.
- **Package-hint file resolution:** Stack frame file resolution now extracts Dart package names and Java package paths from frame text and passes them to `findInWorkspace()` for more accurate disambiguation in monorepo/multi-package workspaces. Wired through the analysis panel and bug report collector.
- **Crashlytics aggregate device/OS distribution:** Crash detail cards now query the Crashlytics stats endpoint for aggregate device model and OS version distribution across all events, rendered as a collapsible bar chart. Fetched asynchronously after the initial crash detail render.
- **Session error density sparklines:** Project Logs panel now shows a tiny relative heat bar per session indicating error density (total issues / line count) compared to sibling sessions. Color reflects dominant severity (red for errors, yellow for warnings, blue for performance). Width normalizes against the densest session in the list.

### Improved
- **Snappier panel transitions:** All slide-out panel animations reduced from 300ms to 150ms for a more responsive feel.
- **Crashlytics crash detail loading feedback:** Clicking an issue card in the Crashlytics sidebar now shows a pulsing "Loading crash details..." message while the API call is in flight, replacing the previous silent wait.
- **Parallelized file operations:** File retention enforcement, documentation token scanning, referenced file analysis, and session shutdown now run concurrently (`Promise.all` / `Promise.allSettled`) instead of sequential loops. File retention startup with 100+ files improves from ~3s to ~200ms.
- **Split failure logging:** Log file split errors are now logged to the extension host console instead of silently swallowed.

### Changed
- **Project Logs panel auto-opens** when the sidebar first loads, so the session list is immediately visible alongside the active log.
- **ESLint `max-lines` excludes blank lines and comments:** The 300-line file limit now uses `skipBlankLines: true` and `skipComments: true`, so readability is never sacrificed for the metric.
- **ESLint config hardened:** Enforces `max-params: 4`, `max-depth: 3`, `no-explicit-any`, `no-unused-vars` (with `_` prefix pattern), `prefer-const`, and correctness rules. Functions exceeding 4 parameters refactored to use option objects (`FileLinkOptions`, `ViewerHtmlOptions`, `ShellOptions`, `BookmarkInput`, `EditLineInput`, `SessionActionContext`).

### Fixed
- **Filter presets test:** Fixed "Errors Only" preset test to check `levels` instead of removed `searchPattern` field.
- **Copy includes UI chrome:** Ctrl+C near the bottom of the log viewer included footer, search panel, and session history text. Native text selection is now confined to the viewport via CSS `user-select`, and native click-drag selections are routed through the VS Code clipboard API.
- **Tag chips not rendering:** Tag chip containers in the Filters panel were permanently empty — `syncFiltersPanelUi()` now calls `rebuildTagChips()` and `rebuildClassTagChips()` when opening the panel.
- **Quick Filters presets broken:** "Errors Only" preset used DAP `categories: ['stderr']` which hides all Flutter output (category is `"console"`). Presets now use `levels` field for severity-based filtering. Also fixed monkey-patch on `applyFilter` that immediately reset the active preset during application.
- **Preset save losing levels:** `promptSavePreset()` parameter type now includes `levels` so saving a preset after applying a level-based filter preserves the level configuration.
- **Crashlytics sidebar shows no issues:** `matchIssues()` filtered out all results when called without error tokens (sidebar panel use case). Skips token filter when no tokens provided.
- **CodeLens event counts always zero:** `buildIndexFromCache()` never incremented `totalEvents`. Fixed accumulation to properly count events per issue.
- **AI summary model selection:** Hardcoded `gpt-4o` family name is not a VS Code Language Model API family. Uses `selectChatModels()` without family filter.
- **XSS in Crashlytics panel:** Inline `onclick` handlers with interpolated issue IDs replaced with `data-*` attributes and delegated click handlers.

---
## [1.2.0] - 2026-02-08

### Added
- **Related lines:** When analyzing a tagged log line (e.g. HERO-DEBUG), all lines sharing that source tag are shown as a diagnostic timeline with clickable line navigation and source file references.
- **Referenced files:** Source files referenced across related lines are analyzed with git blame, annotations, and recent change detection — providing multi-file context instead of single-file analysis.
- **GitHub context:** Queries `gh` CLI for PRs touching affected files, issues matching error tokens, and blame-to-PR mapping that identifies which PR likely introduced the bug. Auto-detects `gh` availability with actionable setup hints.
- **Enhanced token search:** Token search, docs scan, and symbol resolution now use enriched tokens from ALL related lines, not just the analyzed line.
- **Analysis panel progress:** Header progress bar with "X/N complete" counter, per-section spinner text updates showing sub-step descriptions (e.g. "Running git blame...", "Querying language server..."), and smooth CSS transitions. Bar turns green and fades on completion.

### Fixed
- **Analysis panel timeout:** Line analysis spinners no longer hang indefinitely when VS Code APIs (symbol resolution, docs scan, token search) are unresponsive. Each analysis stream now has a 15-second timeout; timed-out sections show a clear "Analysis timed out" message instead of spinning forever.

---
## [1.1.3] - 2026-02-08

### Added
- **Filters panel:** Moved all filter controls (Quick Filters, Output Channels, Log Tags, Class Tags, Noise Reduction) from the Options panel into a dedicated Filters panel with its own icon bar button. Options panel now contains only Display, Layout, Audio, and Actions.
- **Tag search in Filters panel:** Search input at the top of the Filters panel filters tag chips by label text across both Log Tags and Class Tags sections, making it easy to find specific tags among many.
- **Session metadata in Project Logs:** Each session item now shows line count (e.g. "2,645 lines") and all tag types (#manual, ~auto, @correlation) in the meta line, matching the Session History tree view.
- **Tag filtering in Project Logs:** "Tags" button in the session panel toolbar opens the correlation tag QuickPick to filter sessions by tag.

### Removed
- **Session History tree view:** The native tree view has been removed. All session management (browse, rename, tag, trash, export, filter) is now in the Project Logs webview panel.

### Fixed
- **Logcat prefix tag detection:** ALL-CAPS prefixes (e.g. `MY_APP`, `NET_UTIL`) in logcat message bodies are now detected before bracket tags, fixing cases where a bracket tag later in the line would shadow the prefix.

---
## [1.1.2] - 2026-02-08

### Added
- **Class Tags filter:** Detects PascalCase class names (e.g. `AppBadgeService.load()`, `_EventBadgeWrapperState._loadBadgeCount`) in log lines and stack traces. Classes appearing 2+ times show as filterable chips in a new "Class Tags" section of the filters panel, with toggle, solo, all/none controls matching the existing Log Tags UX.
- **Session context menu:** Right-click any session in the Project Logs panel for Open, Rename, Tag, Export (HTML/CSV/JSON/JSONL), Copy Deep Link, Copy File Path, Move to Trash, Restore, and Delete Permanently.
- **Trash section in Project Logs panel:** Trashed sessions appear in a visible "Trash" section with count badge, "Empty Trash" button, and a toggle to show/hide the section. Trash is visible by default.
- **Options panel search filter:** Type-to-filter input at the top of the options panel to quickly find settings by keyword. Sections and rows that don't match are hidden in real time; clearing the input restores all options.

### Added (tests)
- **Config tests:** `isTrackedFile`, `shouldRedactEnvVar`, `getFileTypeGlob` — file type matching, env var redaction patterns, glob generation.
- **Deduplication tests:** `Deduplicator` process/flush/reset, time window expiry, count formatting.
- **Flood guard tests:** `FloodGuard` check/reset, suppression threshold, suppressed count reporting.
- **Level classifier tests:** `classifyLevel` for stderr, logcat prefixes, strict/loose error detection, all severity levels. `isActionableLevel` for all levels.
- **Error fingerprint tests:** `normalizeLine` (ANSI, timestamps, UUIDs, hex, paths), `hashFingerprint` determinism and format.
- **Analysis relevance tests:** `scoreRelevance` for blame, line history, cross-session, correlation, docs, annotations, affected files, section levels. `daysAgo` parsing.
- **Line analyzer tests:** `extractAnalysisTokens` for error classes, HTTP statuses, URL paths, quoted strings, class methods, source refs, deduplication. `extractAnalysisToken` convenience wrapper.
- **Bug report formatter tests:** `formatBugReport` structure, stack trace formatting (app/fw frames), log context, environment tables, optional sections (blame, git history, cross-session, affected files), singular/plural.

### Fixed
- **Copy icon not pinned to viewer edge:** Replaced per-line `.copy-icon` spans with a single floating `#copy-float` overlay positioned at the right edge of the log content area. The icon now stays pinned to the viewer's far right regardless of content width or scroll position, with a 150ms hover grace period for mouse-to-icon transitions.

### Changed
- **Publish script version bump prompt:** When package.json version is not ahead of the CHANGELOG max, the script now offers to bump the patch version interactively instead of failing.

---
## [1.1.1] - 2026-02-08

### Fixed
- **Session History panel hidden:** Removed `"when": "false"` that permanently hid the Session History tree view, preventing access to trash, tag filtering, and session management.

### Added
- **Trash button in Log Viewer:** Trash icon in the Log Viewer toolbar sends the currently-viewed file to trash directly, without needing the Session History context menu.

### Changed
- **Line count moved to right side of footer:** Line count now appears right-aligned next to the filter badge, preventing layout jumps when filename or status text changes. When filters are active, shows visible/total format (e.g. "4/500 lines").

---
## [1.1.0] - 2026-02-08

### Fixed
- **Level text coloring lost when decorations enabled:** Line text coloring (error=red, warning=gold, etc.) was suppressed whenever decorations were on (the default). Decoupled text colors from the decoration toggle so both work together.
- **Tag link color not visible:** Inline tag colors were overridden by ANSI color spans and level CSS. Switched to CSS custom properties (`--tag-clr`) with `!important` for guaranteed visibility. Replaced conflicting palette color (`#dcdcaa` matched debug-level yellow).

### Added
- **Level text colors toggle:** New "Level text colors" checkbox in decoration settings panel (on by default). Controls whether lines are colored by severity level.
- **Info-level line color:** Lines classified as `info` (including logcat `I/` lines) now render in blue (`#3794ff`) instead of the default foreground.
- **Logcat V/ reclassified as debug:** Verbose logcat lines now get the same dim yellow treatment as `D/` lines instead of being uncolored.
- **Keyword-scope highlight rules:** Highlight rules now support `"scope": "keyword"` to color only the matched text within a line (instead of the entire line). Configure via `saropaLogCapture.highlightRules` in settings.
- **Clickable inline tag links:** Source tags (logcat tags, bracket tags) are now rendered as colored, clickable elements directly in log lines. Hover to see the tag name; click to solo-filter the view to only that tag's lines (click again to clear). Colors are auto-assigned per tag from an 8-color palette.
- **Sub-tag detection for generic logcat tags:** Lines from generic sources like `I/flutter` now extract more specific sub-tags from the message body. Patterns like `HERO-DEBUG` (ALL-CAPS prefix) and `[Awesome Notifications]` (bracket tag) are promoted to first-class filterable tags instead of being lumped under "flutter".
- **Dual-tag support for logcat prefix tags:** When a sub-tag is detected (e.g., `HERO-DEBUG` from `I/flutter`), both the sub-tag and the parent logcat tag (`flutter`) now appear as filterable tag chips. Both tags render as colored links in log lines. A line is hidden only when all its tags are hidden, so filtering by either tag keeps its lines visible.

---
## [1.0.1] - 2026-02-08

---
## [1.0.0] - 2026-02-07

### Fixed
- **Bug report preview rendering:** Code blocks were broken in the preview panel because the inline code regex consumed backticks from triple-backtick fences. Fixed by processing code blocks before inline code and restricting inline code to single lines.
- **Bug report source file resolution:** Absolute file paths (e.g. `D:\src\project\lib\file.dart`) were passed to a workspace glob search that never matched, silently preventing all source code, git blame, git history, import, and line-range sections from appearing. Now tries the absolute path directly before falling back to filename search.
- **Minimap drag-stuck scrolling:** Dragging the minimap and releasing the mouse outside the webview left scroll handlers permanently attached, causing erratic scrolling on subsequent mouse movement. Replaced mouse events with Pointer Capture API so `pointerup` always fires regardless of cursor position.
- **Minimap marker positioning:** Severity markers could cluster at the top of the minimap when the panel height was measured before layout settled. Added minimum-height guard (retries when panel < 50 px), trailing-edge debounce, visibility-change rebuild, double-RAF init, and replaced CSS `height: 100%` with `align-self: stretch` for reliable flex height resolution.

### Added
- **Subfolder scanning (`includeSubfolders`):** New setting (default true) makes the Project Logs panel, search, comparison, delete, insights, and file retention scan subdirectories under the reports directory. Shared `readTrackedFiles()` utility replaces per-module scanning logic. Depth-limited to 10 levels; dot-directories are skipped.
- **Trash can for session files:** Sessions can be moved to trash (sidecar flag) instead of permanently deleted. Toggle trash visibility with the eye icon in the Session History toolbar. "Empty Trash" permanently deletes all trashed files after a modal confirmation. Context menu shows "Move to Trash" on live sessions and "Restore from Trash" on trashed ones.
- **Retention uses trash:** File retention (`maxLogFiles`) now marks excess files as trashed instead of deleting them, and excludes already-trashed files from the count. Default changed from 10 to 0 (off) so auto-cleanup is opt-in.
- **Line count in Project Logs tree:** Each session now shows its line count before the file size in the tree description (e.g. `Dart · 4:13pm · 1,234 lines · 24.5 KB`). Active sessions show a `●` indicator after the count. Count is parsed from the session footer when available, with a newline-count fallback. Tooltips and split group summaries also include line counts.
- **Metadata cache:** Session history tree caches parsed file metadata keyed on URI+mtime+size, avoiding redundant file reads for unchanged log files.
- **Adaptive tree refresh debounce:** File-change events during active recording are debounced (3s / 10s / 30s scaling with line count) to avoid excessive tree rebuilds. New `treeRefreshInterval` setting allows a fixed override.
- **Affected Files section:** Bug reports now analyze up to 5 additional source files from the stack trace (beyond the primary error line). Each file shows git blame and recent commit history. Files are deduplicated and analyzed in parallel.
- **Marketplace link:** Bug report header links to the VS Code Marketplace listing.
- **Footer promotion:** Bug report footer recommends Saropa Lints and links to saropa.com.
- **Affected file count scoring:** Executive summary reports when an error spans 3+ source files.
- **Sources section:** Bug report header now lists all file and web sources (log file, analyzed source files, referenced docs, git remote URL).

### Improved
- **Code extraction:** Moved header parsing, description, and tooltip helpers from `session-history-provider.ts` into dedicated `session-history-helpers.ts` for better modularity and line budget.
- **Copy button:** Renamed from "Copy to Clipboard" to "Copy Markdown" for clarity.
- **Save filename:** Default save filename includes timestamp, `saropa_log_capture` branding, project name, and error subject (e.g. `20260207_184603_saropa_log_capture_contacts_email_panel_bug_report.md`).
- **Preview link rendering:** Markdown `[text](url)` links now render as `<a>` tags in the bug report preview.
- **Preview heading support:** Added `###` (h3) rendering for per-file subsection headings.

---
## [0.3.1] - 2026-02-07

### Added
- **Session navigation bar:** When viewing a historical log file, a "Session N of M" navigation bar appears with Previous/Next buttons to step through sessions by modification time. Hides during live capture, re-appears on session end. Follows the split-nav breadcrumb pattern and handles split file groups as single units.
- **Correlation tags:** Sessions are automatically scanned on finalization for source file references and error class names. Tags like `file:handler.dart` and `error:SocketException` appear in the session history description (prefixed with `@`). A manual "Rescan Correlation Tags" command is available in the session context menu.
- **Filter sessions by tag:** New "Filter Sessions by Tag" command in the session history toolbar. Shows a multi-select quick pick of all correlation tags across sessions; selecting tags filters the history tree to only matching sessions.
- **Error fingerprints:** Sessions are scanned for error lines on finalization. Errors are normalized (timestamps, UUIDs, numbers removed) and hashed for cross-session grouping. Stored in sidecar metadata.
- **Analyze Across Sessions:** New context menu item on log lines. Extracts tokens (source files, error classes, URLs, etc.) from the line and searches all past sessions, showing results grouped by token type with workspace context (git history, source annotations).
- **Cross-Session Insights panel:** New command in the session history toolbar. Aggregates data across all sessions to show hot files (most-referenced source files) and recurring error patterns with session/occurrence counts.
- **Generate Bug Report:** Right-click an error line → "Generate Bug Report" packages all evidence into structured markdown: error + fingerprint, stack trace (app vs framework), log context, environment, source code, git history, and cross-session matches. Auto-copied to clipboard and shown in a preview panel.
- **Insights drill-down:** Click a recurring error in the Insights Panel to expand all occurrences grouped by session. Uses fuzzy regex matching so errors with different timestamps/IDs match across sessions. Click any match to jump to that line.
- **Session Timeline:** Right-click a session in Session History → "Show Timeline" to see an SVG chart plotting errors, warnings, and performance issues over time. Click a dot to navigate to that line. Auto-buckets dense sessions for smooth rendering.
- **Executive summary:** Analysis panel now shows a "Key Findings" banner with 2–4 relevance-scored insights (recent blame, recurring error, nearby annotations, doc references). Low-relevance sections auto-collapse.
- **Root cause correlation:** When a crash line was recently modified, the analysis compares the git blame date against the error's cross-session first appearance. A match within 3 days produces "Error likely introduced by commit `abc1234`".
- **Stack trace deep-dive:** Stack frames below an error are parsed and displayed with APP/FW badges. Click an app-code frame to expand inline source preview and git blame. Framework frames are dimmed.
- **Error trend chart:** Recurring errors show a compact SVG bar chart of occurrences per session, turning "Seen 5 times across 3 sessions" into a scannable timeline.
- **Bug report blame section:** Generated bug reports now include a Git Blame section and use the error's cross-session first-seen date for root cause correlation scoring in the Key Findings summary.

### Improved
- **Logcat-aware level classification:** Android logcat prefixes (`E/`, `W/`, `I/`, `D/`, `V/`, `F/`) are now used as the primary level signal. Previously, text pattern matching could override the prefix — e.g. `I/CCodecConfig: query failed` was misclassified as 'error' due to the word "failed". Now the logcat prefix takes priority, preventing false error/warning classifications on framework info/debug lines. Content-type patterns (performance, TODO) still refine `D/`/`V/`/`I/` lines.

### Added
- **Deemphasize Framework Levels setting:** New `saropaLogCapture.deemphasizeFrameworkLevels` option (default: off). When enabled, framework log lines (`fw=true`) no longer show error/warning text coloring — resolving the visual mismatch where framework `E/` lines showed red text but a blue severity bar. The log level prefix is just the opinion of the code author; framework `E/` logs are often handled internally with no user impact.

### Fixed
- **"App Only: OFF" not capturing all debug output:** With default settings, debug adapters that send output under non-standard DAP categories (e.g. Flutter system logs) were silently dropped because `captureAll` defaulted to `false`. Changed the default to `true` so all Debug Console output is captured regardless of category, matching the "never lose data" design principle.
- **Exclusions bypassed when `captureAll` enabled:** The `captureAll` setting previously bypassed both category filtering and exclusion filtering. Now it only bypasses category filtering — user-configured exclusions always apply independently.
- **Early debug output missed on session start:** The DAP tracker activates synchronously but session initialization is async (disk I/O). Output events arriving during this window were silently dropped. Added an early event buffer that captures events before the session is registered and replays them once initialization completes.
- **Timestamp/milliseconds/elapsed checkboxes disabled:** The Timestamp, Show milliseconds, and Elapsed time decoration toggles under Line prefix were non-interactive due to a `timestampsAvailable` flag that could disable them. Removed the mechanism so these toggles are always user-controllable.

---
## [0.2.9] - 2026-02-05

### Improved
- **Context lines visual separation:** When level filtering shows context lines around matches, the first context line in each group now displays a subtle dashed separator. Context lines no longer show level coloring, tint, or severity bars — they appear uniformly dimmed to clearly distinguish them from matched lines.

### Added
- **Level detection mode (`saropaLogCapture.levelDetection`):** New setting to control how aggressively lines are classified as errors. `"strict"` (default) requires keywords in label positions (`Error:`, `[ERROR]`, `TypeError:`) and only applies bug/critical/transient badges to error-level lines. `"loose"` matches keywords anywhere in the text but excludes common descriptive compounds (e.g. "error handling", "error recovery"). Both modes are smarter than the previous behavior, which flagged lint descriptions like "complicates error handling" as errors.
- **Double-click to solo a level filter:** Double-clicking a footer level dot now disables all other levels, isolating that single level.
- **Hover copy icon on log lines:** A copy icon appears on the far right of each log line on hover. Clicking it copies the line's plain text to the clipboard and shows a brief "Copied" toast. Works on regular lines, stack headers, and stack frames (not markers). Uses `visibility`/`pointer-events` instead of `display` to avoid codicon CSS specificity conflicts.

### Changed
- **Footer dots hidden when count is zero:** Level filter dots in the footer are now hidden for levels with no matching log lines, reducing visual noise.
- **Bottom padding in log viewer:** Added padding below the last log line so it's easier to select text near the end of the content.

### Fixed
- **Double-click solo level not toggleable:** Double-clicking a footer level dot to solo a level worked, but double-clicking the same dot again did not restore all levels. Now toggles back to all levels when the solo'd dot is double-clicked again.
- **Sidebar state lost on tab switch:** Switching from the Saropa Log Capture panel to another bottom panel tab (Problems, Output, Terminal, etc.) and back reset the entire viewer — deselecting the file, clearing filters, losing scroll position, and resetting all options. The sidebar webview was being fully disposed and recreated on each tab switch. Added `retainContextWhenHidden` to the webview provider registration so VS Code keeps the DOM alive when the panel is hidden.
- **Mousewheel scrolling jumps to start/end:** Fast mouse wheel scrolling with acceleration caused the log viewer to jump to the very start or end instead of scrolling naturally. Chromium's CSS scroll anchoring couldn't find stable anchor nodes after virtual scrolling DOM rebuilds, misadjusting `scrollTop`. Fixed by disabling `overflow-anchor` and intercepting wheel events with manual `scrollTop` control, matching the approach already used by the minimap.
- **Click-to-source spawns new editor groups:** Clicking a source link in the sidebar log viewer opened the file in a new editor group each time because `ViewColumn.Active` resolved to the sidebar webview instead of an editor column. Now targets the last-focused text editor's group, falling back to the first group.
- **Horizontal scrollbar hidden in no-wrap mode:** The log viewer's scrollbar-hiding CSS (`scrollbar-width: none`, `::-webkit-scrollbar { display: none }`) suppressed all scrollbars including horizontal. Vertical scrollbar is now hidden via `width: 0` (minimap replaces it) while the horizontal scrollbar is properly styled and visible when word-wrap is off.
- **Search text erased while typing in highlight mode:** Every debounced keystroke called `clearSearchFilter()` → `recalcAndRender()` even though highlight mode never sets `searchFiltered` flags — triggering a full O(n) height recalc, prefix-sum rebuild, and viewport render that was entirely unnecessary. Added a `searchFilterDirty` flag so `clearSearchFilter()` short-circuits when there is nothing to clear, and removed the unconditional input-clearing in `openSearch()`.
- **Search mode toggle does not apply:** Switching from highlight to filter mode required retyping the query because `toggleSearchMode()` guarded `updateSearch()` behind `searchInputEl.value` — which was empty if the input had been cleared by the bug above. The guard has been removed so the mode switch always re-runs the search.

---
## [0.2.8] - 2026-02-03

### Added
- **Bookmark count badge:** The bookmarks icon in the icon bar now displays a count badge showing the total number of bookmarks. Hidden when count is zero, caps at "99+".

### Changed
- **Instant bookmark adding:** "Bookmark Line" in the context menu now adds the bookmark immediately with no modal prompt. Notes can be added afterwards from the bookmarks panel via the edit button.
- **Removed standalone "Add Note" from context menu:** The separate "Add Note" menu item has been removed. Notes are now exclusively managed through bookmarks — add a bookmark first, then edit its note from the bookmarks panel.

### Fixed
- **Minimap markers stacked at top:** All severity markers rendered at position 0 because percentage-based CSS `top` didn't resolve against the flex-stretched container height. Switched to pixel-based positioning computed from `clientHeight`, and added `height: 100%` to the minimap container.
- **Minimap empty for info-level content:** Files where most lines lacked error/warning keywords (e.g. lint reports) produced no minimap markers because info-level lines were excluded. Info-level lines now show subtle green markers for files under 5,000 visible lines.
- **Minimap not updating on panel resize:** Added a `ResizeObserver` on the minimap element so pixel positions recalculate when the panel is resized.
- **Context menu clipped at top of viewport:** Right-clicking the top row pushed the menu above the webview (negative `top`), hiding most items. Menu position is now clamped to viewport edges, and `max-height` with `overflow-y: auto` ensures all items are scrollable when space is tight.
- **Invisible footer level dots:** The footer's colored level indicators (info, warning, error, etc.) were invisible because CSP nonces in `style-src` silently disabled `'unsafe-inline'`, blocking inline `style` attributes. Moved all inline visual styles to CSS classes so they load via the nonce-tagged `<style>` block instead.

---
## [0.2.7] - 2026-02-03

### Fixed
- **Find in Files icon missing:** Replaced invalid `codicon-search-view` (not in codicons 0.0.44) with `codicon-list-filter` so the icon bar button renders correctly.

### Changed
- **Bookmarks panel moved to icon bar:** Bookmarks are now a slide-out panel inside the Log Viewer (accessible via the bookmark icon in the icon bar) instead of a separate native tree view. The native tree view, its commands, and menu entries have been removed.
- **Pop Out moved to title bar only:** Removed the Pop Out button from the webview icon bar. Pop Out is now accessible only from the native view title bar action, matching standard VS Code panel conventions.
- **Session panel Tidy icon:** Replaced `codicon-text-size` with `codicon-edit` on the Tidy toggle button. The "Aa" glyph had more visual mass than the calendar, tree, and arrow icons on adjacent buttons.

---
## [0.2.6] - 2026-02-03

### Added
- **Configurable file types (`saropaLogCapture.fileTypes`):** The session history, search, file retention, delete, and comparison features now recognize configurable file extensions beyond `.log`. Default: `.log`, `.txt`, `.md`, `.csv`, `.json`, `.jsonl`, `.html`. Drop a `.txt` or `.md` into the reports directory and it appears in the session list. The setting is an array of dot-prefixed extensions; reload the window after changes.
- **Find in Files panel (Ctrl+Shift+F):** New "Find in Files" icon in the activity bar searches all log files in the reports directory concurrently. Shows matched files with match count badges. Click a file to open it and jump to the first match; click again to cycle through subsequent matches. Supports case-sensitive, whole-word, and regex toggles matching the in-file search options. Results update with 300ms debounce as you type.
- **Bookmarks panel:** New "Bookmarks" tab in the Saropa Log Capture panel. Right-click any log line and choose "Bookmark Line" to save it with an optional note. Bookmarks are grouped by file, persist across sessions via workspace state, and clicking a bookmark navigates back to that line. Includes search/filter, edit note, delete individual or all bookmarks with confirmation dialogs.
- **Context lines slider in level flyup:** The level filter fly-up menu now includes a slider (0–10) to adjust how many preceding context lines are shown when filtering by level. Replaces the static VS Code setting default for real-time control.
- **Source link context menu:** Right-clicking a filename/source reference (e.g. `lib/main.dart:42`) now shows file-specific actions: Open File, Copy Relative Path, and Copy Full Path. Previously showed the browser's default Cut/Copy/Paste menu.
- **Copy Line and Copy All in context menu:** Right-click a log line to see Copy Line and Copy All at the top of the menu. Decorated variants (Copy Line Decorated, Copy All Decorated) include the level emoji, sequence counter, and timestamp prefix.
- **Inline Go to Line (Ctrl+G):** Replaced the VS Code input box round-trip with an inline overlay that scrolls instantly while typing. Numbers-only input, Escape reverts to original position, Enter confirms. Animated slide-down appearance.

### Fixed
- **Right-click line detection:** Log line elements were missing `data-idx` attributes, so the context menu could never identify which line was right-clicked. All line-specific menu items (Copy Line, Pin, etc.) now appear correctly.
- **Ctrl+A selecting footer:** Added `user-select: none` to the footer bar so Ctrl+A only selects log content, not the status bar.
- **False "performance" classification:** Removed overly generic `slow` and `lag` keywords from the performance-level regex. Words like "slow-cooked" in normal log data no longer trigger the performance filter.
- **Unformatted line counts:** Footer line count, level filter dot counts, fly-up circle counts, and VS Code status bar now display comma-separated numbers (e.g., `12,868` instead of `12868`).
- **Level filter dots hard to see:** Increased dot size from 9px to 10px with `min-width`/`min-height` guarantees and wider gap (1px → 3px) between dot and count for clearer visibility.
- **Footer filename not actionable:** Clicking the log filename in the footer now reveals and selects the file in the Session History tree view. The filename shows a dotted underline and turns blue on hover to indicate it is clickable.
- **Minimap markers not updating:** Markers now show for all non-info severity levels (error, warning, performance, todo, debug, notice) with distinct colors. Added direct `scheduleMinimap()` calls in the data flow so the minimap rebuilds reliably when new lines arrive or data is cleared, independent of the monkey-patch hook on `renderViewport`.
- **Minimap click vs drag:** Clicking the minimap immediately entered drag mode, so any mouse movement after a click caused unwanted scrolling. Now a single click navigates to that position and stops; drag mode only activates after 3px of movement while holding the mouse button.
- **Minimap drag scrolling broken:** Dragging the minimap caused erratic viewer movement because `suppressScroll` was reset immediately, allowing the RAF-debounced scroll handler to fire mid-drag and trigger `renderViewport` DOM changes that destabilized the scroll position. Now `suppressScroll` stays true for the entire drag operation, with viewport rendering done synchronously in `scrollToMinimapY`.
- **Minimap scroll mapping used stale height:** Click and drag positions were mapped using `minimapCachedHeight` which could be 120ms stale. Now uses a `mmHeight()` helper that falls back to the always-current `totalHeight` global.
- **Minimap wheel deltaMode not handled:** Forwarded `deltaY` as raw pixels regardless of `e.deltaMode`, so line-mode or page-mode scroll events barely moved the content. Now multiplies by `ROW_HEIGHT` or `clientHeight` for modes 1 and 2.
- **Minimap markers hidden behind viewport indicator:** Added `z-index: 1` to `.minimap-marker` so colored severity markers paint above the semi-transparent viewport overlay.

---
## [0.2.5] - 2026-02-02

### Added
- **Right-click context menu:** Custom context menu on log lines with Copy (line text), Search Codebase, Search Past Sessions, Open Source File, Show Context, Pin Line, Add Note, Add to Watch List, and Add to Exclusions. Global actions (Copy selection, Select All) appear regardless of click target. Line-specific items auto-hide when right-clicking empty space.
- **Show Context in context menu:** The inline peek (surrounding context lines) is now triggered via right-click → "Show Context" instead of double-click. Double-click now performs native word selection as expected.
- **Go to Line (Ctrl+G):** Opens a VS Code input box to jump to a specific line number. Scrolls the virtual viewport to the target line.
- **Page Up / Page Down:** PgUp and PgDn keys scroll the log content by 80% of the viewport height.
- **Keyboard font zoom:** Ctrl+= / Ctrl+- adjust font size by 1px. Ctrl+0 resets to 13px default.
- **Ctrl+scroll zoom:** Hold Ctrl and scroll the mouse wheel to increase/decrease font size.
- **Ctrl+A scoped to log content:** Ctrl+A selects only the visible log lines in the viewport, not the entire webview UI (icon bar, panels, footer).
- **Tab navigation and focus indicators:** Icon bar buttons are now keyboard-navigable via Tab. Focus-visible outlines use `--vscode-focusBorder` for accessibility.
- **Search match persistence:** Closing the search panel no longer clears match positions. Reopening restores the previous query and match index, so F3 continues from where you left off.
- **CSS animations throughout the viewer:** Context menu fades in with a subtle scale, level flyup slides up from the footer, log line hover backgrounds transition smoothly, footer buttons blend on hover, filter badges pop in when activated, search current-match pulses on navigation, minimap viewport glides instead of jumping, inline peek slides open, jump-to-bottom button fades in, and pinned items slide in from the left. All pure CSS with short durations (0.08–0.4s) to feel responsive without sluggishness.

### Removed
- **Source preview hover popup:** Removed the floating tooltip that appeared when hovering over source links in stack traces. The popup was easily triggered accidentally and obscured log content. Single-click on source links (or right-click → Open Source File) already navigates to the file.
- **Watch count chips in footer:** Removed the red/yellow keyword watch chips from the viewer footer. They duplicated the level classification counts and confused the UX. Watch counts remain visible in the VS Code status bar.
- **Minimap toggle:** The scrollbar minimap is now always on — there is no reason not to have it. Removed the `opt-minimap` checkbox from the Options panel, the `toggleMinimap()` function, and the `minimap-active` CSS class. Native scrollbar is always hidden; the minimap panel is the only scrollbar.

### Changed
- **Clickable level filter dots:** Each colored dot in the footer now directly toggles its level filter on click (e.g., click the red dot to hide/show errors). Previously, clicking anywhere on the dots opened the fly-up menu.
- **Level dot counts:** Footer dots now show live counts next to each dot when > 0, so you can see at a glance how many errors, warnings, etc. exist.
- **Fly-up menu trigger:** The fly-up filter menu (with Select All/None and text labels) is now opened by clicking the "All"/"3/7" label text instead of the dots.
- **Status bar opens log file:** Clicking the status bar line count now opens the active log file in the editor instead of just focusing the sidebar viewer tab. Follows the "counts are promises" principle — if the bar shows a count, clicking reveals the underlying data.
- **Inline exclusion input:** Exclusion patterns can now be added directly in the Options panel via a text input + Add button. Replaces the previous "Configure in Settings" link that opened VS Code's JSON settings.
- **Visual spacing enabled by default:** Breathing room between log sections is now on by default for easier reading. Toggle off via the options panel.
- **Word wrap disabled by default:** Log lines no longer wrap by default, preserving original formatting. Toggle on via the options panel or press W.
- **Double-click restores native behavior:** Removed the double-click handler that opened the inline peek context modal. Double-click now selects words normally, matching standard text editor behavior.

### Fixed
- **App-only filter had no effect on regular log lines:** The "App only (hide framework)" toggle only hid framework stack frames (`    at ...` lines), ignoring regular output. Android logcat lines (`D/FlutterJNI`, `D/FirebaseSessions`, `I/Choreographer`, etc.) passed through unfiltered. Extended line classification to detect Android logcat tags and launch boilerplate, stored `fw` flag on all line items, and rewired the toggle to use `recalcHeights()` so it composes with all other filters. `I/flutter` lines (app output) remain visible while framework/system noise is hidden.
- **Severity bar never showed framework color:** `renderItem()` checked `item.isFramework` (never set) instead of `item.fw` for the severity bar CSS class.
- **Scrollbar minimap redesigned as always-on interactive panel:** The minimap was an invisible 8px overlay hidden behind the opaque native scrollbar. Redesigned as a 60px wide always-on flex-sibling panel that replaces the native scrollbar entirely. Supports click-to-scroll (centers viewport on clicked position), drag-to-scroll, and mouse wheel forwarding. Shows a draggable viewport indicator.
- **Minimap markers for hidden lines:** Error/warning markers were generated for all lines regardless of filter state, creating phantom marks at wrong positions for lines with `height === 0` (filtered, collapsed). Now skips hidden lines and stack-frame lines (previously every frame in a stack trace generated its own red marker).
- **Minimap missing performance markers:** Only errors and warnings were shown. Added purple markers for performance-level lines using `--vscode-editorOverviewRuler-infoForeground`.
- **Scroll position redesign:** Complete rewrite of the virtual scrolling system. Toggling filters, collapsing stack traces, or changing font size no longer jumps the view to a random position — the first visible line stays anchored. Auto-scroll to bottom no longer causes double-render feedback loops. Prefix-sum array replaces O(n) linear scans with O(log n) binary search for viewport calculations. Stack frame height lookup is now O(1) via cached group headers instead of O(n²) nested scans. Row height is measured from the DOM instead of hardcoded, so spacer heights stay correct after font/line-height changes. Trimming old lines (50K limit) now adjusts scroll position by the removed height.
- **Footer level label blank:** The static "Levels" label next to the filter dots gave no indication of active state. Now shows "All" when all 7 levels are enabled, "N/7" when partially filtered, or "None" when all disabled. Footer dots also gained `flex-shrink: 0` to prevent collapsing in the flex layout.
- **"All" not highlighted in level flyup:** The All/None links in the level flyup had no active state, making it unclear whether all levels were enabled. Both links now highlight (using VS Code button colors) when their respective state is active.
- **Level flyup text center-aligned:** Button text in the level flyup defaulted to browser center alignment, making labels hard to scan. Added explicit left alignment (`justify-content: flex-start`, `text-align: left`) while keeping counts right-aligned.
- **Level flyup missing title:** The flyup opened directly into All/None links with no context. Added a "Level Filters" title header above the links to clarify purpose and resolve "levels vs filters" terminology confusion.

---
## [0.2.4] - 2026-02-02

### Changed
- **Search toggles match VS Code:** Match Case, Match Whole Word, and Use Regular Expression buttons now use codicon icons (`codicon-case-sensitive`, `codicon-whole-word`, `codicon-regex`) positioned inline inside the search input, matching VS Code's native search layout. Active state uses VS Code's `--vscode-inputOption-*` theme variables.
- **Search history arrow navigation:** Up/Down arrow keys in the search input cycle through recent search terms, matching VS Code and terminal conventions. Clickable history list below the input is retained.

### Removed
- **Clear search button:** Removed the `×` clear button from the search input. Use Escape to close (which clears), or select-all and delete.

---
## [0.2.3] - 2026-02-02

### Fixed
- **Stats counters not resetting on file load:** Level counts (e.g., "125 info") accumulated across sessions because the stats script only listened for 'reset' messages, not 'clear'. Now resets on both, fixing phantom counts that misled users about current file content.
- **Filter badge stretches footer:** Added `line-height: 1` to `.filter-badge` to prevent the badge from being taller than the footer bar.

### Changed
- **Level flyup redesigned:** Level filter circles now show left-aligned rows with emoji, text label, and count (e.g., `🔴 Error 2`). All/None links restyled as bordered buttons. Flyup min-width increased for labels.
- **Level dot trigger visible:** Footer level dots enlarged from 7px to 9px, inactive opacity raised from 0.2 to 0.3, and "Levels" text label added for discoverability. Hover shows border to signal interactivity.
- **Filter badge opens level flyup:** When the only active filter is a level filter, clicking the badge now opens the level flyup instead of the options panel. Mixed filters still open options.
- **Footer filename opens Project Logs:** Clicking the footer text (line count + filename) now opens the Project Logs session panel.

---
## [0.2.2] - 2026-02-02

### Fixed
- **Line prefix sub-options misplaced:** Decoration sub-options (severity dot, counter, timestamp, etc.) appeared below the minimap checkbox instead of under their parent "Line prefix" checkbox. Moved to correct position and changed from show/hide to always-visible with disabled styling when line prefix is off.
- **Inline context option non-functional:** Removed the "Show inline context (file >> function)" option — context data was only extracted for stack frames, so it never worked for regular log lines.
- **Audio preview CSP blocked:** Preview sound buttons did nothing because the Content Security Policy `media-src` used the audio directory URI instead of the webview's `cspSource` authority. Fixed to use `cspSource` for consistent resource authorization.
- **Codicon icons invisible in webview:** The v0.2.1 CSP fix added `font-src` but the codicon font was never loaded — webviews are sandboxed and don't inherit VS Code's fonts. Now bundles `@vscode/codicons` and loads the stylesheet via a `<link>` tag, with `style-src` extended to allow it. Fixes all icons in the icon bar, context menu, and session panel.

### Added
- **Source location in log files:** New `includeSourceLocation` setting (off by default) appends the originating file and line number to each log line, e.g. `[app.ts:42]`. Requires the debug adapter to supply source info in DAP OutputEvents.
- **Elapsed time in log files:** New `includeElapsedTime` setting (off by default) prefixes each log line with the delta since the previous line, e.g. `[+125ms]`. Useful for spotting performance gaps.
- **Verbose DAP protocol logging:** New `verboseDap` setting (off by default) logs all raw DAP protocol messages (requests, responses, events) to the log file. Directional prefixes distinguish outgoing (`[dap->]`), incoming (`[dap<-]`), and event (`[dap:event]`) messages. JSON payloads are truncated at 500 characters.
- **Pop-out viewer:** New icon-bar button (link-external icon) and command (`Saropa Log Capture: Pop Out Viewer to New Window`) that opens the log viewer as a floating editor panel, movable to a second monitor. The pop-out coexists with the sidebar — both receive the same live data via a broadcast architecture. Closing and reopening the pop-out preserves the connection. Also available from the view title bar.
- **Session display options:** Four toggle buttons in the Project Logs panel header control how session filenames are displayed: **Dates** (show/hide leading and trailing datetime patterns — hidden by default), **Tidy** (normalize to Title Case with spaces — enabled by default), **Days** (group sessions under colored day headings like "Tue, 3rd Mar 2026" — enabled by default), and **Sort** (toggle between newest-first and oldest-first with a dynamic arrow icon). All options persist per-workspace via `workspaceState`. The same transforms apply to both the webview session panel and the native tree view. The panel stays open when selecting a file.
- **File modification date+time in session list:** Session items now show the file's last-modified date and time (e.g. "Feb 2, 4:13pm") before the file size in the metadata line. When day headings are shown, only the time is displayed to avoid redundancy.
- **Seconds trimmed from session filenames:** Filenames like `20260202_143215_session.log` are automatically displayed as `20260202_1432_session.log` for compactness. Always applied, independent of the display option toggles.

### Changed
- **Session info moved to icon bar:** The ℹ️ session info button is now in the right-side icon bar (between Search and Options) instead of the header bar. Click to open a slide-out panel showing full session metadata. Uses the same mutual-exclusion pattern as the other icon bar panels. The compact prefix line at the top of the log content is unchanged.
- **Header bar removed:** The viewer header bar (filename + collapse toggle) is removed entirely. The log filename and extension version now appear in the footer status text as `·`-separated segments (e.g., `● 42 lines · dart_session.log · v0.2.2`), reclaiming vertical space.
- **Marketplace banner image 404:** README banner pointed to the wrong GitHub repository (`saropa_lints`). Corrected URL to `saropa-log-capture`.
- **README: invite contributions:** Added GitHub activity badges (stars, forks, last commit, issues, license), a feedback callout linking to the issue tracker, an expanded Contributing section with quick-start steps and issue-reporting guidance, a Documentation table linking to CONTRIBUTING.md / CHANGELOG.md / ROADMAP.md / STYLE_GUIDE.md, and a footer with project links.

---
## [0.2.1] - 2026-02-02

### Fixed
- **Icon bar icons invisible in dark mode:** The Content Security Policy blocked the codicon font from loading (`default-src 'none'` with no `font-src`). Now passes `webview.cspSource` to the CSP so VS Code can inject its icon font.
- **Search mode toggle resets search text and breaks filter/clear:** Clicking any button inside the search panel (mode toggle, regex, case, clear) could trigger the document-level click-outside handler, closing the panel and clearing state. Toggle buttons were especially affected because `textContent` assignment detaches the original click target text node, making `contains()` fail. Fixed by stopping event propagation at the search bar boundary so internal clicks never reach the outside-click handler.
- **Scrollbar minimap disappears on scroll:** The minimap was positioned absolute inside the scrollable `#log-content` container, causing it to scroll away with the content. Wrapped `#log-content` in a non-scrolling `#log-content-wrapper` and moved the minimap to the wrapper so it stays viewport-fixed.

### Changed
- **Status bar split into two items:** The status bar is now two separate clickable items: a pause/resume icon that toggles capture state, and a text display (line count + watch counts) that focuses the sidebar viewer panel. Follows the VS Code convention where clicking a count reveals the associated view.
- **Watch chips are clickable:** Footer watch count chips (e.g., "error: 4") now open the search panel pre-filled with the keyword and navigate to the first match. Adds pointer cursor and hover effect to signal interactivity.
- **Native Session History tree view hidden:** The separate tree view below the Log Viewer is replaced by the in-webview Project Logs panel accessible from the icon bar.
- **Session panel renamed:** "Sessions" panel renamed to "Project Logs" with matching icon bar tooltip.
- **Icon bar sessions icon:** Changed from history (clock) to files icon to better represent project log files.
- **Dev script rewritten as publish pipeline:** `scripts/dev.py` now supports a gated analyze-then-publish workflow (16 steps) with `--analyze-only` for local dev builds and full publish to VS Code Marketplace + GitHub releases. Retains all original dev toolkit features (VS Code extension installs, global npm packages, version sync, local .vsix install prompts).
- **Dev script split into modules:** `scripts/dev.py` (1756 lines) refactored into 9 focused modules under `scripts/modules/` (constants, display, utils, checks_prereqs, checks_environment, checks_project, publish, report, install) with a layered dependency graph and no circular imports. `dev.py` remains the entry point with CLI parsing and orchestration.

---
## [0.2.0] - 2026-02-02

### Added
- **Icon bar:** VS Code activity-bar-style vertical icon bar on the right edge of the log viewer with icons for Session History, Search, and Options. Clicking an icon toggles its slide-out panel with mutual exclusion (only one panel open at a time). Uses codicon icons with an active indicator bar matching VS Code's activity bar pattern.
- **Session history panel:** New in-webview slide-out panel listing past log sessions from the reports directory. Shows filename, debug adapter, file size, and date. Clicking a session loads it into the viewer. Active (recording) sessions are highlighted. Panel refreshes on each open.

### Changed
- **Footer simplified:** Removed Search and Options buttons from the footer — these are now accessible from the icon bar. The footer retains line count, level filter dots, watch chips, and filter badge.
- **Body layout restructured:** The webview body is now a flex-row containing the main content column and the icon bar column, instead of a single flex-column.

### Added
- **Historical log file timestamps:** Opening a log file from Session History now parses the `[HH:MM:SS.mmm]` timestamps from each line (using the `Date:` header for the date component), enabling elapsed time and timestamp decorations on historical files. Previously timestamps were discarded during file loading.
- **Timestamp availability gating:** Time-related decoration options (Timestamp, Show milliseconds, Elapsed time) are automatically disabled and grayed out when viewing a log file that has no parsed timestamps. Re-enabled when switching to a file with timestamps or starting a live session.
- **Session history timestamp icons:** Sessions in the history tree now show a `history` icon (clock) when the file contains timestamps, or an `output` icon (plain text) when it does not. Active recording sessions retain the red `record` icon. Tooltip includes "Timestamps: Yes/No".

### Fixed
- **Warning and Performance level toggles had no visual feedback:** The button IDs used abbreviated names (`level-warn-toggle`, `level-perf-toggle`) but `toggleLevel()` constructed IDs from the full level name (`level-warning-toggle`, `level-performance-toggle`). The `getElementById` returned null, so the `active` class never toggled. Also fixed the same stale IDs in `resetLevelFilters()`.
- **Visual spacing option had no visible effect:** The spacing logic ran after early returns for markers, stack-headers, and stack-frames — so it never applied to those item types. CSS selectors were also scoped to `.line` only. Moved computation before early returns, broadened conditions to trigger on any level change, separator lines, markers, and new stack traces, and widened CSS selectors to all element types.
- **Level circle counts invisible in dark mode:** The `.level-circle` buttons didn't set an explicit `color`, so count numbers used the browser default (black) instead of the VS Code theme foreground. Added `color: inherit` so counts adapt to light and dark themes.
- **Session Info modal persists across session loads:** The `clear` handler dismissed the context peek but not the Session Info modal. Once opened, the modal stayed visible every time a new log was selected. Now `hideSessionInfoModal()` is called on clear.
- **Search input unresponsive during typing:** `updateSearch()` ran synchronously on every keystroke — iterating all lines for regex matching, height recalculation, and DOM rendering — blocking the browser from repainting the input. Characters appeared not to register on large log files. Search is now debounced (150 ms) so characters appear instantly.
- **Search filter persists after clearing text:** Removing all search text or closing the search panel while in highlight mode left stale `searchFiltered` flags on lines, hiding them until a manual filter reset. Now always clears the search filter regardless of search mode.

### Changed
- **Level filters moved to fly-up menu:** The 7 inline level-circle buttons in the footer are replaced by a compact row of colored dots. Clicking the dots opens a fly-up popup with the full toggle buttons plus Select All / Select None links. The popup stays open while toggling and closes on click-away or Escape.
- **Exclusions UX overhaul:** Replaced the bare "Enable exclusions" checkbox with a richer section. The toggle label now shows the pattern count (e.g. "Exclusions (3)"). Each configured pattern is displayed as a removable chip below the toggle. Chips dim when exclusions are toggled off. When no patterns are configured, an empty state with a "Configure in Settings" link is shown. Removing a chip persists the change to workspace settings.

### Added
- **Per-file level filter persistence:** Level filter toggle state is saved per log file in workspace storage. When switching between files or reloading, each file's filter state is automatically restored.
- **Tooltips on all options panel controls:** Every checkbox, slider, dropdown, and button in the Options panel now has a descriptive `title` attribute that explains what the option does on hover.
- **Search clear button:** An × button appears inside the search input when text is present, following standard textbox conventions. Click to clear and reset the search.
- **Search history:** Last 10 search terms shown below the input when the search panel opens. Click any term to re-run that search. Persists across webview reloads via webview state.
- **Scroll position memory per file:** When switching between log files, the viewer remembers where you were scrolled to. Positions are saved when not at the bottom; files you were following at the bottom stay at the bottom on return.
- **Whole-line coloring for all severity levels:** Previously only error and warning lines received a background tint; all other levels (info, performance, todo, debug, notice) were ignored, making the feature appear broken. Now all 7 levels get a distinct tint color. Opacity increased from 8% to 6–12% (14–20% on hover) so the effect is actually visible.

---
## [0.1.15]

### Fixed
- **Scroll flickering from ResizeObserver loop:** The `ResizeObserver` on `#log-content` called `renderViewport(true)` unconditionally, bypassing the visible-range bail-out check. Every DOM replacement triggered another resize observation, creating a feedback loop. Now RAF-debounced and uses `renderViewport(false)` so no-op re-renders are skipped.
- **Layout thrashing in scroll handler:** `jumpBtn.style.display` write was sandwiched between DOM reads and `renderViewport`'s internal reads, forcing a synchronous reflow on every scroll frame. Moved the write after all reads complete.
- **Broad `transition: all` causing render stutter:** `#viewer-header` and `#error-badge` used `transition: all 0.2s ease`, keeping the compositor busy animating layout properties during re-renders. Replaced with specific property transitions (`min-height`, `padding`, `border-bottom` for header; `background` for badge).

---
## [0.1.14]

- Dev build

---
## [0.1.13]

### Changed
- **Footer UI consolidation:** Slimmed footer to just: line count, level circles, filter badge, search button, and options button. Removed 7 toggle buttons (wrap, exclusions, app-only, decorations, audio, minimap, export) that are now in the options panel.
- **Category filter redesign:** Replaced the `<select multiple>` dropdown with dynamic checkboxes in the new Output Channels section of the options panel.
- **Source tags moved to options panel:** Source tag chip strip removed from above the log content. Tags now live in a Log Tags section inside the options panel with the same All/None toggle and count chips.
- **Options panel reorganized:** Consolidated all settings into logical sections — Quick Filters (presets + reset), Output Channels, Log Tags, Noise Reduction (exclusions + app-only), Display, Layout, Audio, and Actions (export).
- **Footer buttons use text labels:** Export and Search buttons now show text instead of emoji (💾 → "Export", 🔍 → "Search").
- **Clearer footer status text:** Replaced ambiguous "Viewing: 24 lines" with just "24 lines". Recording shows "● 24 lines" (red dot), paused shows "⏸ 24 lines".
- **Merged stats + level filters:** The separate stats counters (🔴 4, 🟠 95) and level filter circles (🟢🟠🔴🟣⚪🟤🟦) are now a single set of circles that show counts AND act as toggle filters.

### Added
- **Filter badge:** Footer shows an active filter count badge (e.g. "3 filters") that opens the options panel when clicked. Auto-updates via hooks on `recalcHeights()` and `toggleAppOnly()`.
- **Reset all filters button:** Quick Filters section includes a "Reset all filters" button that clears every filter type (levels, categories, exclusions, app-only, source tags, search) in one click.
- **`setExclusionsEnabled()` function:** Presets can now programmatically enable/disable exclusions (was missing, causing presets to silently fail for exclusion state).
- **Scrollbar minimap option in Options panel:** New "Scrollbar minimap" checkbox in the Display section.
- **Decoration sub-options in Options panel:** Added "Show milliseconds" and "Severity bar (left border)" checkboxes for feature parity with the decoration settings popover.
- **STYLE_GUIDE.md:** Documents UI patterns, font sizes, button styles, spacing, color conventions, and anti-patterns for the log viewer webview.

### Fixed
- **Options panel reading undefined `exclusionsActive`:** The exclusion checkbox was reading a non-existent `exclusionsActive` variable instead of `exclusionsEnabled`, causing the checkbox to never reflect actual state.
- **Preset "None" not resetting filters:** Selecting "None" in the preset dropdown now calls `resetAllFilters()` instead of just clearing the preset name.
- **Duplicate `#export-btn` CSS:** Was defined in both `viewer-styles-modal.ts` (14px) and `viewer-styles-overlays.ts` (10px). Consolidated into a single `.footer-btn` class.
- **Mouse wheel scroll hijacking:** A custom `wheel` event listener intercepted native scrolling, applied a 0.5x multiplier, and called `preventDefault()` — killing browser-native smooth/inertia scrolling and causing choppy, erratic scroll behavior. Removed the handler so `#log-content` uses standard `overflow-y: auto` scrolling.

### Removed
- **Dead code:** Removed unused `exclusionsActive` variable, dead `getPresetDropdownHtml()` export, and orphaned `#preset-select` CSS from overlay styles.

---
## [0.1.12]  - 2026-02-01

- Dev Build

---
## [0.1.11]  - 2026-02-01

### Fixed
- **Source preview popup not dismissible:** The hover preview over stack trace source links had no close affordance — it only auto-hid when the mouse moved away. Added a close button (×), Escape key, and click-outside dismissal.
- **Decoration counter showing `#&nb` instead of numbers:** `padStart(5, '&nbsp;')` used the 6-character literal HTML entity as a JavaScript padding string, causing truncated gibberish. Now pads with Unicode non-breaking space (`\u00a0`).
- **Inconsistent datetime in log filenames:** Filename format now uses compact datetime (`YYYYMMDD_HHMMSS_name.log`) for uniqueness and consistency. Rename and metadata parsing handle both legacy (`HH-MM`, `HH-MM-SS`) and current (`HHMMSS`) formats.
- **Session info expander always blank:** The collapsible session header never displayed data because (1) header lines were stripped before reaching the webview and (2) the JavaScript hook referenced a non-existent `handleSetContent` function. Redesigned as a compact prefix line at the top of the log content (showing adapter, project, config, date) with an ℹ️ icon button in the header bar that opens a modal with full session metadata. Now works for both live sessions and historical file loads.
- **Viewer flickering and inability to scroll:** The scrollbar minimap wrapped `renderViewport` with `setTimeout(updateMinimap, 50)` on every call, including scroll-only renders. This created a feedback loop (scroll → render → 50ms minimap DOM rebuild → layout recalc → scroll) that caused constant flickering and unwanted auto-scrolling to bottom via the ResizeObserver. Fixed by only scheduling minimap rebuilds on data changes (`force=true`), debouncing rapid updates, and using cached heights for the scroll handler.
- **Scrollbar minimap O(n²) performance:** Minimap marker placement re-iterated all preceding lines for each marker to compute cumulative height. Replaced with a single O(n) pre-computed array. The scroll-time viewport indicator now uses cached total height (O(1)) instead of recalculating on every frame.

### Added
- **Copy File Path:** Right-click a session in Session History and select "Copy File Path" to copy the full filesystem path to clipboard.

### Refactored
- **Split oversized commands module:** Extracted session comparison commands from `commands.ts` (305 lines) into `commands-comparison.ts` to comply with the 300-line file limit.

### Changed
- **Decorations enabled by default:** The `saropaLogCapture.showDecorations` setting now defaults to `true` so new users see line prefixes (severity dot, counter, timestamp) out of the box.
- **Emoji toggle buttons:** Replaced text-based footer toggles (`Deco: OFF`, `Audio: OFF`, `Minimap: ON`) with emoji buttons (🎨, 🔔/🔕, 🗺️). Active state shown at full opacity; inactive at 35% opacity. Tooltips explain current state and action.
- **Clearer options panel label:** Renamed "Show decorations" to "Line prefix (🟢 #N T00:00:00)" so users can see exactly what the toggle controls.
- **Search is now a slide-out panel:** Converted the inline search bar to a toggleable slide-out panel from the right edge, matching the options panel pattern. Added a 🔍 toolbar button in the footer. Keyboard shortcuts (Ctrl+F, F3, Escape) still work. Search and options panels are mutually exclusive — opening one closes the other.
- **Version inline with filename:** Version string now sits immediately after the filename in the header bar instead of floating as a separate right-aligned element.

---
## [0.1.10]  - 2026-02-01

### Fixed
- **Viewer blank due to regex SyntaxError:** An invalid character class range in `isSeparatorLine` (`[=\\-+...]` produced range `\` to `+` with start > end) caused a SyntaxError that killed the entire webview script block. Fixed by moving `-` to end of character class.
- **Double-escaped regexes in viewer scripts:** `extractContext` in data helpers and decoration-stripping regexes in the export script used `\\\\s`/`\\\\d` which produced literal `\s`/`\d` instead of whitespace/digit classes. Fixed to single-escaped.
- **Export join produced literal `\n`:** `lines.join('\\\\n')` in export script produced literal backslash-n instead of newline. Fixed to `\\n`.
- **Session file loading race condition:** Loading a historical log file while webview was re-resolving (tab switch) could silently fail. Added generation counter and pending-load retry.

### Added
- **Script fault isolation:** Split the single `<script>` block (33 concatenated scripts) into separate `<script>` blocks per feature. A SyntaxError in one feature no longer kills the entire viewer.
- **Global error handler:** New first-loaded script catches uncaught errors, shows a visible red banner in the webview, and reports errors to the extension host via `console.warn`.
- **Build-time syntax validation test:** New test extracts all `<script>` blocks from the generated HTML and validates each with `new Function()`, catching SyntaxErrors before release.

---
## [0.1.9]  - 2026-02-01

- Development build

---
## [0.1.8] - 2026-02-01

### Fixed
- **Options panel button unresponsive:** The slide-out options panel used `right: -25%` to hide off-screen, but with `min-width: 280px` it remained partially visible in narrow sidebar viewports (z-index 250), silently intercepting clicks on footer buttons including the options toggle. Changed to `right: -100%` with `pointer-events: none` when closed.
- **Duplicate error breakpoint elements:** `getErrorBreakpointHtml()` was called twice in the viewer HTML template, creating duplicate `error-badge` and `error-modal` elements with the same IDs. Removed the stray call outside the footer.
- **Missing `escapeHtml()` in webview:** The function was called by repeat notifications, edit modal, and session header scripts but was only defined in the TypeScript extension host (not injected into the webview). Added the function to the webview data helpers script.
- **Dead audio mute code:** Removed `audioMuted` variable, `toggleAudioMute()`, and `updateAudioMuteButton()` which referenced a nonexistent `audio-mute-toggle` element with no corresponding HTML or event wiring.
- **Split breadcrumb shows wrong part number:** `setSplitInfo(totalParts, totalParts)` passed `totalParts` for both arguments, so the breadcrumb always showed "Part N of N" after a split instead of the actual current part number. Now passes the correct `partNumber`.
- **Audio files never loaded (doubled path):** `initAudio()` appended `/audio/` to a URI that already pointed to the `audio/` directory, creating an invalid path like `audio/audio/swipe_low.mp3`. Removed the redundant segment.
- **Version string type assertion:** `as string ?? ''` made TypeScript treat the version as always a string, so the nullish fallback was unreachable. Replaced with `String(... ?? '')` for safe runtime conversion.

### Added
- **Version display in viewer header:** The extension version number (e.g., "v0.1.7") now appears in the log viewer header bar.

## [0.1.6] - 2026-01-31

<!-- cspell:ignore ECONNREFUSED -->
### Added
- **Smart Error Classification:** Automatically classifies error log lines into three categories: 🔥 CRITICAL (NullPointerException, AssertionError, FATAL, etc.), ⚡ TRANSIENT (TimeoutException, SocketException, ECONNREFUSED, etc.), and 🐛 BUG (TypeError, ReferenceError, SyntaxError, etc.). Visual badges appear inline before the log message. Two new settings: `saropaLogCapture.suppressTransientErrors` (default: false) hides expected transient errors via filtering, and `saropaLogCapture.breakOnCritical` (default: false) triggers VS Code notifications when critical errors appear. Helps quickly identify severe issues vs. expected network hiccups.

## [0.1.5] - 2026-01-31

### Added
- **Stack Trace Preview Mode:** Stack traces now show first 3 non-framework frames by default (collapsible preview mode) instead of completely collapsed. Click the header to cycle through: preview → fully expanded → fully collapsed → preview. Framework frames are filtered out in preview mode. Toggle indicator shows ▷ (preview), ▼ (expanded), or ▶ (collapsed).
- **Milliseconds Display:** Added "Show milliseconds" checkbox to decoration settings panel (⚙ gear button). When enabled, timestamps show `.000` milliseconds after the seconds (e.g., `T14:32:15.234`). Works with existing timestamp decoration toggle.
- **Audio Volume Control:** Expanded audio options panel with volume slider (0-100%, default 30%), rate limiting selector (none/0.5s/1s/2s/5s/10s), and preview sound buttons (🔴 Error / 🟠 Warning) to test settings. Volume and rate limiting apply immediately. Rate limiting prevents audio spam by enforcing minimum time between sounds of the same level.
- **Inline Tag Parsing:** Extended source tag filter to extract `[TagName]` patterns anywhere in log lines (not just at the start). Tags like `[API]`, `[Database]`, `[Auth]` are now automatically detected and added to the collapsible Sources panel for filtering. Works alongside existing Android logcat and bracket prefix patterns.
- **Session Info Header:** Collapsible session metadata block appears at the top of the viewer (below split breadcrumb) when loading log files. Shows project name, debug adapter type, configuration name, platform, VS Code version, and extension version. Parsed from the context header block in log files. Click to expand/collapse. Hidden for live sessions (only shows when loading files).
- **Real-Time Repeat Notifications:** Duplicate log lines now show immediate repeat notifications instead of being batched. Shows `"🔴 Repeated log #5 (Connection Refused...)"` with first 85 characters of message preview. Uses smart hash-based detection (`level::message`) instead of exact string matching. Repeat counter resets when a new unique message arrives. 3-second detection window (configurable).
- **Multi-Level Classification:** Added three new log levels with automatic detection and filtering:
  - **TODO Level** (⚪ White): Detects TODO, FIXME, HACK, XXX in logs for task tracking
  - **Debug/Trace Level** (🟤 Brown): Detects breadcrumb, trace, debug keywords for diagnostic logging
  - **Notice Level** (🟦 Blue Square): Detects notice, note, important for informational highlights
  - Each level has dedicated toggle button in footer, checkbox in options panel, color styling, and emoji indicator. All levels work with existing filter presets and context line display.
- **Inline Context Metadata:** Extracts and displays file path, function name, and line number from stack traces as inline breadcrumbs. Shows shortened file paths (last 2 segments) and function names in format `utils/auth.ts:42 » login()`. Toggle on/off via "Show inline context" checkbox in options panel. Automatically parses common stack trace formats (V8, Mozilla, etc.) and displays context for both stack headers and frames.
- **Per-Level Export/Save:** Export filtered logs to file with preset templates or custom level selection. Templates include "Errors Only", "Warnings + Errors", "Production Ready", "Full Debug", and "Performance Analysis". Export options allow including/excluding timestamps, decorations, and ANSI codes. Preview shows line count before export. Accessible via 💾 button in footer.
- **Layout Improvements:** Four new customization features for better readability:
  - **Font Size Adjustment:** Slider control (10-20px) in options panel to adjust log font size independently of VS Code editor settings
  - **Line Height Adjustment:** Slider control (1.0-2.5) in options panel to adjust vertical spacing between log lines
  - **Severity Bar Mode:** Colored left borders (3px) for each log level instead of/alongside emoji dots. Creates continuous vertical bars for consecutive same-level lines. Toggle via decoration settings panel
  - **Visual Spacing (Breathing Room):** Heuristic spacing adds 8px margins before/after key transitions: level changes to errors/warnings, before/after markers. Helps separate logical sections without adding actual newlines. Toggle in options panel

### Refactored
- **File Size Compliance:** Split 6 oversized UI modules (630-391 lines each) into 17 smaller modules (all under 300 lines). Improved code organization by extracting logical sections: modal styles, decoration styles, search/UI components, helper functions, and HTML/script templates. No functional changes — behavior, API surface, and build output are identical.

## [0.1.4] - 2026-01-31

### Added
- **Error Breakpoints:** Configurable visual and audio alerts when errors appear in logs. Features: flash red border around viewer, play alert sound, increment error counter badge (clickable to clear), and optional modal popup. Toggle on/off via footer button. Detects errors via `stderr` category or error keywords (`error`, `exception`, `failed`, `fatal`, `panic`, `critical`). Only triggers once per batch to avoid spam.
- **Search Enhancements:** Added case sensitivity toggle (Aa/AA) and whole word match toggle (\b) to search bar. Both buttons show bold text when active and work in combination with existing regex mode toggle.
- **Live Statistics Counters:** Real-time running totals displayed in footer showing counts for errors (🔴), warnings (🟠), performance issues (🟣), and framework/info logs (🟢). Updates incrementally as lines arrive and resets on session reset.
- **Enhanced Performance Detection:** Extended performance pattern matching to detect Choreographer frame skips (`skipped N frames`), `choreographer`, `doing too much work`, `gc pause`, `anr`, and `application not responding` patterns for better Android/Flutter debugging.
- **Edit Line Modal:** Right-click any log line and select "Edit Line" to open a modal with editable textarea. Changes are saved back to the log file with proper validation. Shows warning badge when debug session is active to prevent concurrent write conflicts. Reloads viewer after successful edit.
- **Scrollbar Minimap:** Visual overview overlay on the scrollbar (8px wide, right edge) showing search match locations (yellow marks), current match (bright orange), error locations (red marks), warning locations (orange marks), and viewport position indicator. Updates automatically when searching or scrolling. Toggle on/off via footer button.
- **Copy All to Clipboard:** Added Ctrl+Shift+A keyboard shortcut and `copyAllToClipboard()` function to copy all visible log lines to clipboard in plain text format.
- **Copy to Search:** Added "Copy to Search" action to right-click context menu. Opens search bar and populates it with the clicked line's text, automatically running the search.
- **ASCII Art Detection:** Enhanced separator line detection to recognize box-drawing characters (─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬) in addition to standard ASCII patterns (===, ---, +---). Lowered threshold to 60% for better detection. Detected separators are styled in yellow with reduced opacity.
- **Minimap Toggle Button:** Added "Minimap: ON/OFF" button to footer for controlling scrollbar minimap visibility.

### Fixed
- **Session History Empty Viewer:** Fixed issue where selecting log files from session history panel resulted in empty viewer. Added retry loop to wait for webview initialization before loading file content (up to 1 second wait).
- **Level Filter Visual Feedback:** Enhanced inactive level filter buttons with three visual indicators: reduced opacity (0.25), grayscale filter (0.8), and strike-through text. Makes toggle state immediately obvious.
- **Session History Sorting:** Fixed incorrect sorting of mixed-format filenames by sorting on file modification time instead of date strings. Ensures newest sessions always appear first regardless of filename format.
- **Double-Click Viewport Jumping:** Fixed random viewport jumping when double-clicking lines to open context peek. Replaced problematic `scrollIntoView` with proper scroll calculation that positions the peeked line consistently at the top of the view.

### Changed
- **Search Bar Width:** Increased minimum width of search input to 200px to prevent it from becoming too narrow when multiple toggle buttons are present.
- **Session State Tracking:** Extension now tracks debug session active/inactive state and currently displayed file URI. Viewer receives `sessionState` messages to enable intelligent warnings and safe file editing.

## [0.1.3] - 2026-01-31

### Refactored
- **File Size Compliance:** Split 12 TypeScript files that exceeded the 300-line limit into 29 files (12 original + 17 new extraction files). All source files now comply with the project's hard limit. No functional changes — behavior, API surface, and build output are identical.

### Changed
- **Enhanced Color Palette:** Updated ANSI color rendering to use VS Code's vibrant terminal color palette, matching the Debug Console appearance. Standard and bright colors (red, green, yellow, blue, cyan, magenta) are now significantly more vibrant and easier to distinguish.
- **Automatic Log Level Coloring:** Log lines are now automatically color-coded by severity — errors appear in red, warnings in yellow, and info lines use the default foreground color for better visual scanning.
- **Panel Location:** Moved the Log Viewer and Session History from the sidebar (Activity Bar) to the bottom panel, next to Output and Terminal tabs. Provides more horizontal space for log lines.

### Added
- **Source Tag Filter:** Collapsible "Sources" panel above the log lines that auto-discovers source tags from Android logcat prefixes (e.g. `D/FlutterJNI`, `I/flutter`) and bracket prefixes (e.g. `[log]`). Each tag appears as a chip with a line count; click to toggle visibility. Includes All/None bulk actions. Tags are grouped by name only (ignoring level prefix), sorted by frequency. Panel stays hidden until tags are detected. Composes with all existing filters (category, exclusion, level).
- **Full Debug Console Capture:** Added `saropaLogCapture.captureAll` setting and UI toggle ("App Only: OFF") to capture all Debug Console output, bypassing category and exclusion filters. When enabled, all system, framework, and app logs are captured. Toggle via the viewer or settings.
- **Line Decorations:** Added `saropaLogCapture.showDecorations` setting and footer "Deco" toggle to prefix each viewer line with a colored severity dot (🟢/🟠/🔴), sequential counter (#N), and wall-clock timestamp. A gear button (⚙) opens a settings popover to toggle individual parts and enable "Whole line" coloring mode (subtle background tint by severity). Viewer-only — log files are not modified.
- **Level Filter:** Added All/Errors/Warn+ segmented buttons in the footer to filter log lines by severity. Configurable context lines (`saropaLogCapture.filterContextLines`) shown dimmed around matches.
- **Inline Peek:** Double-click any log line to expand an inline peek showing surrounding context lines. Press Escape to dismiss. Configurable range via `saropaLogCapture.contextViewLines`.
- **Expanded Highlight Rules:** Default highlight patterns now include Fatal, TODO/FIXME, Hack/Workaround, Deprecated, Info, and Debug in addition to Error, Warning, and Success.
- **Historical Log Viewing:** Opening a session from Session History now loads it into the panel viewer instead of as a raw text file.
- **Developer Toolkit** (`scripts/dev.py`): One-click script replacing `init_environment.py` and `build_and_install.py`. Runs the full pipeline automatically: prerequisites, deps, compile, quality checks, package .vsix. Interactive prompts only at the end (install via CLI, open report). Features Saropa ASCII logo, colored output, per-step timing bar chart, and automatic reports to `reports/`.

### Fixed
- **ANSI Color Rendering:** Updated Content Security Policy to allow inline styles (`'unsafe-inline'`), fixing blocked ANSI color rendering in the log viewer and session comparison views. Colors from debug output now display correctly.
- **Viewer Controls:** Fixed all non-working buttons and controls (Excl ON, App Only, All/Errors/Warn+, Preset dropdown, category filter, Deco toggle, settings panel) by removing inline event handlers that were blocked by Content Security Policy. Converted all `onclick`/`onchange` handlers to proper `addEventListener` calls.
- **Historical Log Viewing:** Skips context header block, parses `[category]` prefixes for proper stderr coloring, detects markers, and sends lines in async batches to avoid UI freezing. Footer shows "Viewing:" instead of "Recording:" for historical files.
- **Filter Coordination:** Category, exclusion, and level filters now respect each other's state via shared `recalcHeights()`. Previously, applying one filter could override another's visibility decisions.
- **Inline Peek on Double-Click:** Fixed DOM index mapping when lines have gap markers or annotations — `querySelectorAll` now counts only line-level elements.
- **Inline Peek on Clear:** Peek is now closed when the viewer is cleared, preventing stale content.
- **Context Line Settings:** Setting `filterContextLines` or `contextViewLines` to 0 is now honored (previously treated as default due to falsy-zero).
- **Success Highlight:** Pattern now matches "successfully" and "successful" in addition to "success", "passed", and "succeeded".
- **Config Timing:** Highlight rules and presets are cached and sent when the webview initializes, so historical file views get proper coloring even without a prior debug session.

## [0.1.0] - 2026-01-28

First public release on the VS Code Marketplace.

### Core Features

- **Auto-capture**: Debug Console output saved to `.log` files automatically when debugging starts
- **Live sidebar viewer**: Real-time log streaming with virtual scrolling (100K+ lines)
- **ANSI color support**: Full color rendering in viewer, raw codes preserved in files
- **Click-to-source**: Click `file.ts:42` patterns to jump to source; Ctrl+Click for split editor
- **Collapsible stack traces**: Auto-detected and grouped; press `A` for app-only mode
- **Search**: Ctrl+F with regex support, F3/Shift+F3 navigation, match highlighting
- **Session history**: Browse past sessions with metadata (adapter type, size, date)

### Session Management

- **Rename sessions**: Right-click to set display names (also renames file on disk)
- **Tag sessions**: Add `#tags` for organization; auto-tags with `~prefix` from content patterns
- **Annotations**: Press `N` to annotate lines; persisted and exported
- **Pin lines**: Press `P` to pin important lines to sticky header
- **Deep links**: Share `vscode://` URLs that open specific sessions and lines

### Export Options

- **HTML export**: Static or Interactive with search, filters, and theme toggle
- **CSV export**: Structured columns (timestamp, category, level, line_number, message)
- **JSON export**: Array of log entry objects with full metadata
- **JSONL export**: Line-delimited JSON for streaming tools

### Filtering & Search

- **Category filter**: Filter by DAP category (stdout, stderr, console)
- **Exclusion patterns**: Hide lines matching string or `/regex/` patterns
- **Keyword watch**: Track patterns with live counters, flash alerts, and badges
- **Filter presets**: Save and apply filter combinations; built-in presets included
- **Cross-session search**: Search all log files via Quick Pick

### Visual Features

- **Highlight rules**: Color lines matching patterns (configurable colors, labels)
- **Elapsed time**: Show `+Nms` between lines; slow gaps highlighted
- **JSON rendering**: Embedded JSON shown as collapsible pretty-printed elements
- **Inline decorations**: Show log indicators next to source lines in editor

### Advanced Features

- **Session comparison**: Side-by-side diff view with color highlighting
- **Session templates**: Save/load project-specific configurations (Flutter, Node.js, Python built-in)
- **Auto file split**: Split by line count, size, keywords, duration, or silence
- **Flood protection**: Suppress rapid repeated messages (>100/sec)
- **Deduplication**: Identical rapid lines grouped as `Message (x54)`

### Infrastructure

- Context header with launch.json config, VS Code version, OS, adapter type
- Status bar with live line counter and watch hit counts
- File retention with configurable `maxLogFiles`
- Gitignore safety check on first run
- First-run walkthrough for new users

## [0.0.1]

- Initial scaffold via `yo code`
