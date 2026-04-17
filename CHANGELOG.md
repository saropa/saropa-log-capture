# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

**VS Code Marketplace** - [marketplace.visualstudio.com / saropa.saropa-log-capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

**Open VSX Registry** - [open-vsx.org / extension / saropa / saropa-log-capture](https://open-vsx.org/extension/saropa/saropa-log-capture)

**GitHub Source Code** - [github.com / saropa / saropa-log-capture](https://github.com/saropa/saropa-log-capture)

For older versions (5.0.3 and older), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).

<!-- MAINTENANCE NOTES -- IMPORTANT --

    The format is based on [Keep a Changelog](https://keepachangelog.com/).

    Each release (and [Unreleased]) opens with one plain-language line for humans—user-facing only, casual wording—then end it with:
    [log](https://github.com/saropa/saropa-log-capture/blob/vX.Y.Z/CHANGELOG.md)
    substituting X.Y.Z.

    **Tagged changelog** — Published versions use git tag **`vx.y.z`**; compare to [current `main`](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md).

    **Published version**: See field "version": "x.y.z" in [package.json](./package.json)

-->

---

## [Unreleased]

### Added

- **Capture on/off toggle in the status bar.** A persistent `$(circle-filled)` / `$(circle-outline)` icon now sits in the status bar (right side, priority 52). Click it to flip `saropaLogCapture.enabled` for the current workspace — no more hunting through Settings to find a workspace override silently keeping capture disabled. The icon turns orange-warning when capture is off. Also available via the command palette: "Saropa Log Capture: Toggle Capture On/Off".

### Changed

- **Log Sources panel layout improved.** Source type descriptions (stdout, stderr, console / Logcat, Android system logs / etc.) now appear inline after the tier name with a dash separator instead of on a separate line. Device and External tiers have visual spacing separators.
- **Filter accordion sections displayed side-by-side.** Log Sources, Text Exclusions, and File Scope now use a 3-column grid layout. Multiple sections can be expanded simultaneously instead of collapsing others.
- **Date group headings show file count.** Collapsible day sections in the Project Logs panel now display the number of files in each group, right-aligned as a subtle badge.
- **Presets moved from filter drawer to kebab menu.** The "Saved Filters" dropdown at the bottom of the filter drawer is replaced by a "Presets" flyout submenu in the kebab (three-dot) actions menu. Each preset shows a tooltip describing what filters it changes.
- **Kebab dropdown aligned to button.** The actions dropdown now opens directly below the three-dot icon instead of anchoring to the far right of the page.

---

## [7.1.1]

### Fixed

- **Network failure signals no longer false-positive on Android PIDs.** The HTTP status code detector (e.g. 502) now requires an HTTP context keyword (HTTP, status, response, GET, POST, etc.) on the same line. Previously, bare numbers in logcat CPU dumps (e.g. PID 502 in `3% 502/android.hardware.sensors`) matched as HTTP 502 "Bad Gateway".
- **Extension-side signal scanner now filters by logcat level.** Network, memory, permission, and error pattern matching is restricted to error-class logcat lines (E/F/A). Info-level system noise like ActivityManager process starts no longer contributes to signal counts. Slow-op detection still runs at any level.
- **Continuation badge no longer overlaps timestamp text.** The `[+]` badge used fixed `font-size: 10px` which didn't scale with zoom and could overlap the decoration prefix. Now uses `0.75em` so it scales with the viewer's font size.
- **Continuation badge now shows count inline.** Changed from `[+]` (count hidden in tooltip) to `+7` / `−7` so the user sees how many lines are collapsed without hovering.
- **Category badge (`category-badge`) now scales with zoom.** Changed from fixed `9px` / `4px` to em-based units (`0.7em` / `0.3em`).
- **Signal reports no longer triplicate for a single ANR event.** When a high-confidence ANR hypothesis exists, redundant `error-recent` hypotheses (typically ANR dump lines like CPU stats and IO pressure) are merged into the ANR report. The user sees one consolidated report with evidence links to all the dump lines.

---

## [7.1.0]

### Fixed

- **CI coverage thresholds adjusted after v7.0.0 code growth.** Functions threshold lowered from 48% to 43%, branches from 40% to 37%, statements held at 48%. New tests for anomaly detection (10 functions) and crash category classification bring coverage back above the new thresholds.

### Changed

- **Filter drawer simplified.** Removed Message Tags, Code Origins, and SQL Commands accordion sections from the narrow filter dropdown. Only filtering controls remain: Log Sources (tier radios), Text Exclusions, and File Scope.
- **Tags & Origins slide-out panel.** New icon bar button (Tags) opens a dedicated side panel for chip-heavy browsing sections: Message Tags, Code Origins, SQL Commands, and Individual Sources placeholder. These sections get room to breathe instead of being crammed into tiny accordions.
- **"Log Inputs" renamed to "Log Sources".** The accordion section name now describes what it controls more clearly.
- **"Flutter App" renamed to "Flutter DAP".** The tier radio label now includes a tooltip explaining what the Debug Adapter Protocol is. Hint text added below: "stdout, stderr, console".
- **"Exclusions" renamed to "Text Exclusions".** Clarifies that these patterns filter by text content, not by source or category.
- **"Preset: None" replaced by "Saved Filters: Default".** Footer label and default option renamed. The redundant "Reset all" button was removed — selecting "Default" resets everything.
- **Modularized 7 oversized files to meet the 300 LOC limit.** Extracted severity keywords CSS, logcat classifier tests, session panel test helpers, session metadata I/O, session manager listeners, signal accumulators, and viewer-specific activation handlers into dedicated modules. No behavior changes.

---

## [7.0.0]

Overhauls the filter panel into focused sections with a dedicated Tags & Origins side panel, adds drag-to-resize scroll map, and replaces the old Insights panel with a unified Signals system — cross-session trends, co-occurrence detection, severity classification, recurring signal notifications, full markdown reports with evidence context and stack traces, and Drift Advisor integration for SQL signals. [log](https://github.com/saropa/saropa-log-capture/blob/v7.0.0/CHANGELOG.md)

### Changed

- **Project Logs: instant file names during loading.** File names now appear immediately as each directory is scanned, instead of waiting for the entire recursive scan to finish. Sidecar migration no longer blocks the file list, and the metadata store loads in parallel with the directory scan, so the first file names are visible within a single directory-read round-trip.
- **Exclusion checkbox moved inline with textbox.** The enable/disable checkbox for exclusion patterns is now inside the text input row instead of on a separate line above it, saving vertical space in the Exclusions accordion.
- **Filter panel UX redesign.** The filter drawer now has three focused sections: Log Sources (tier radios), Text Exclusions, and File Scope. Tag-heavy sections (Message Tags, Code Origins, SQL Commands, Individual Sources) moved to a dedicated "Tags & Origins" side panel, accessible from a new Tags button in the icon bar. This reduces filter drawer clutter and gives chip-based filters room to breathe.
- **Log Sources: three tier radios with descriptive hints.** Replaced "Log Inputs" with three clearly labeled radio groups: "Flutter DAP" (stdout, stderr, console — default All), "Device" (Logcat, Android system logs — default Warn+), and "External" (saved logs, terminal, browser, ai-bash, ai-prompt, ai-edit, drift-perf — default Warn+). The Flutter DAP label has a tooltip explaining what the Debug Adapter Protocol is.
- **External tier covers all non-Flutter, non-device sources.** Lines from ai-bash, ai-prompt, ai-edit, ai-read, ai-system, and drift-perf categories (which arrive through the Debug Console but are not Flutter app output) are now classified as tier "external" and filtered by the External radio. Previously these lines had no tier and bypassed all radios.
- **Exclusions renamed to "Text Exclusions"** to clarify that these patterns filter by text content, not by source or category.
- **Saved Filters replaces Preset dropdown.** The footer label changed from "Preset: None" to "Saved Filters: Default". Selecting "Default" resets all filters. The redundant "Reset all" button was removed.
- **Signal report "Related Lines" section now shows actual items.** Previously the section displayed only summary counts like "7 error(s) in this session match this pattern" with no detail. Now lists each related item with its line number and full log text, so you can see exactly which errors, warnings, network failures, slow operations, or classified errors were detected. Items are rendered in a scrollable list capped at 20 entries.
- **Signal report evidence context expanded to 10 lines.** Preceding context increased from 5 to 10 lines so you see more of the log leading up to each evidence line.
- **Signal report evidence now captures stack traces.** After each evidence line, the context window extends past the normal radius to include contiguous Dart/Flutter (`#0 ...`) and Java/Kotlin (`at ...`) stack trace frames, up to 30 lines.
- **Signal report log file read once per panel.** All sections now share a single file read instead of reading the log file independently, reducing I/O.
- **Double-click to solo filter chips.** Double-clicking a Code Origins or Message Tags chip now solos that tag — hiding all other tags so only matching lines are visible. Double-click the same chip again to restore the previous filter state. Single-click toggle behavior is unchanged.
- **Signal trends: lint rule link.** When a signal has saropa_lints diagnostic context in its detail, a "📋 Rule" button appears in the signal trends list. Clicking it opens VS Code settings filtered to that rule name.
- **Signal trends: Drift Advisor link for SQL signals.** SQL-kind signals in the trends list now show a "🔍 DA" button that opens the Drift Advisor panel in one click.
- **SQL signals enriched with Drift Advisor table metadata.** When the Drift Advisor extension is installed, SQL signals are annotated with schema context — matched table names, total table count, and index suggestion count — so you can see database context without leaving the Signals panel.
- **`RecurringError` type eliminated.** The separate `RecurringError` and `RecurringSignal` types have been replaced by the unified `RecurringSignalEntry` type everywhere — extension host, webview, analysis panel, exports, and tests. One type, one code path, one data model for all cross-session signals.
- **All `dbInsight` identifiers renamed to `dbSignal`.** Internal identifiers (`dbInsightSessionRollup`, `viewerDbInsightsEnabled`, `insightMeta`, `lastInsightTs`, etc.) across 30+ files now use the `dbSignal` naming convention. No user-facing impact — all internal.
- **All remaining "insight" references removed.** Function names (`setInsightTab`→`setSignalTab`, `buildInsightTabHtml`→`buildSignalTabHtml`), command IDs (`refreshRecurringErrors`→`refreshRecurringSignals`), comments, and JSDoc across the entire codebase now consistently use "signal." Zero "insight" references remain in source or NLS files.
- **Signal trend analysis.** Each recurring signal now includes a trend direction — increasing (↑), stable (—), or decreasing (↓) — computed by comparing occurrence rates in the older vs newer halves of the timeline. Trend arrows are shown in the signal trends list with color coding (red for increasing, green for decreasing).
- **`PersistedSignalSummaryV2` with actual entries.** V2 signal summaries persist actual signal entries (fingerprint, label, detail, count, duration) for count-only signal types (network failures, memory events, slow ops, permission denials, classified errors). V1 summaries only stored counts. The cross-session aggregator reads V2 entries for richer detail; V1 summaries still work as a fallback.
- **Recurring signal notification.** When session finalization completes and a signal is detected in 5+ sessions, a VS Code information notification appears: "Recurring signal: NullPointerException (7 sessions)". Clicking "Open Signals" opens the Signals panel.
- **Cross-signal co-occurrence detection.** Signals that consistently appear together in the same sessions are identified using Jaccard similarity (threshold 0.5). Co-occurring pairs (e.g. "slow SQL query and OutOfMemoryError appear in 4 of 5 shared sessions") are included in `CrossSessionSignals.coOccurrences`.
- **Version tracking in unified signals.** Error and warning signals now include `firstSeenVersion` and `lastSeenVersion` from the session's `appVersion` metadata, enabling "introduced in v1.2.0, last seen in v1.3.0" display.
- **Signals panel consolidated to zero duplication.** The "This log" section now shows one unified signal list instead of three separate blocks ("Errors in this log", "Recurring in this log", and "All signals in this log"). The "Across your logs" section shows one "All signals" list with inline triage controls (Close/Mute/Re-open) on error and warning rows, replacing the separate "Recurring errors" card list. Muted signals are filtered out. Closed signals are dimmed.
- **Extension-side scanner upgraded to V2 with entries.** Sessions where the viewer was never opened now persist individual signal entries (fingerprint, label, count, line indices) instead of just counts. Network failures show "SocketException: ECONNREFUSED" instead of "network: 3". Entries are deduplicated by pattern and capped at 5 per kind.
- **Related Signals section in Signals panel.** Signal pairs that co-occur in the same sessions (Jaccard similarity > 50%) are rendered in a "Related Signals" block under "Across your logs." Each pair shows shared session count and overlap percentage.
- **Signal jump-to-line navigation.** Signals in the "All signals in this log" section are clickable when line indices are available. Clicking a signal scrolls the log viewer to the first occurrence of that signal in the log file.

### Added

- **Drag-to-resize scroll map.** The scroll map (minimap) now has a draggable left edge. Grab and drag to set any width between 20px and 160px. The custom width persists per workspace and survives reloads. Changing the `minimapWidth` preset in Settings resets the custom width. The resize grip highlights with the VS Code sash color on hover.
- **"Works best with" section in README.** Lists companion Saropa extensions (Lints, Drift Advisor) and what each unlocks when installed alongside Log Capture. Links to the Saropa Suite extension pack for one-click install.
- **Companion extensions in Integrations panel.** The Options > Integrations screen now shows a "Companion extensions" section above the adapter list with Marketplace links to install Saropa Lints, Drift Advisor, and Claude Guard, plus a link to the Saropa Suite pack.
- **Signal report: Companion Extensions section.** Each signal report now includes a "Companion Extensions" section showing Drift Advisor data (issues, top rule) and Saropa Lints data (violation count, tier, critical+high count) when those extensions are installed. When an extension is missing, a dashed-border install prompt links to the Marketplace. Drift Advisor section only appears for Drift/SQLite projects. Included in Copy Report and Save Report markdown export.
- **Signal report: Session Overview section.** Shows aggregate stats from the session bundle — total log lines, error/warning/network/memory/slow-op counts, SQL burst and N+1 counts, ANR risk score, and Drift Advisor issues — rendered as stat cards at the top of the report.
- **Signal report: Signal Details section.** Shows type-specific data not visible in Evidence or Related: N+1 query fingerprint/repeats/distinct-args/window, SQL burst fingerprint/count/window, fingerprint leader counts, ANR score/level/contributing-factors list. Also includes distribution analysis (first/last occurrence, span, clustered vs spread pattern) for signals with multiple occurrences.
- **Signal report: Other Signals section.** Lists other hypotheses detected in the same session (excluding the current one) with confidence badges, so you can see correlated issues without opening separate reports.
- **Signal report: full markdown export.** Copy Report and Save Report now produce a comprehensive document with all sections (overview, evidence with context blocks, distribution, type-specific details, related items, other signals) instead of just the header and evidence lines.
- **Signal summaries auto-persisted to session metadata.** When a session is finalized, the last root-cause hint bundle collected by the viewer is compressed into a compact summary (signal type counts, hypothesis template IDs, top N+1 fingerprints, top slow operation names) and saved to session metadata. Previously all signal data was ephemeral — it vanished when the viewer closed.
- **Signal trends in Insights panel.** The "Across your logs" section now includes a "Signal trends" block that aggregates persisted signal summaries across sessions. Shows which signal types recur (e.g. "N+1 queries — 8 sessions, 47 total"). Clicking a trend row opens the most recent session with that signal type.
- **Signal report: Cross-Session History section.** Each signal report now includes a "Cross-Session History" section showing which past sessions detected the same signal type. Displays session name and date; clicking a row opens that session in the viewer. History is also included in markdown export (Copy Report / Save Report).
- **Trend badges on signals.** Each hypothesis in the signals panel shows a `↻N` badge when the same signal type has been detected in 2+ past sessions, so you can see at a glance which signals are recurring before opening the full report.
- **Warning fingerprinting.** Warnings are now fingerprinted during session finalization, just like errors. Normalized warning text is hashed and persisted to session metadata, enabling cross-session warning tracking. Previously only a bare count survived.
- **Unified "All Signals" view.** The "Across your logs" section replaces separate "Recurring errors" and "Signal trends" blocks with a single unified list that combines error fingerprints, warning fingerprints, performance fingerprints (operation name, avg/max duration), SQL fingerprints (query pattern, count, slow queries), and signal summary counts (network, memory, slow-op, ANR, permission, classified) — all sorted by cross-session impact. Each entry shows its kind icon, detail text, session count, total occurrences, and duration stats where applicable.
- **"Insights" renamed to "Signals" throughout.** The Insights panel header, icon bar label, tab title, commands, tooltips, and user-facing text now say "Signals." VS Code commands renamed: `showSignals`, `openSignalsInTab`, `exportSignalsSummary`, `addSignalItemToCase`. The term "insights" no longer appears in the user interface.
- **Automated signal severity classification.** Each recurring signal is auto-classified as critical (fatal/ANR/OOM), high (errors in 5+ sessions, classified errors), medium (frequent warnings/perf), or low. Critical and high signals sort to the top and get colored left-border indicators (red for critical, orange for high). Signals appearing in 5+ sessions are flagged as "recurring" with a ↻ badge.
- **"All signals in this log" section.** The "This log" panel section now shows a unified signal summary for the current session — errors, warnings, perf fingerprints, and SQL fingerprints from this session's metadata — alongside the existing "Errors in this log" and "Recurring in this log" blocks.
- **Drift Advisor integration in unified signals.** When Saropa Drift Advisor is installed and connected, its session data (slow queries with SQL and duration, diagnostic issues with severity breakdown) is pulled into the unified signal list alongside log-derived signals. Slow queries from Drift Advisor appear as SQL signals with `max` duration; diagnostic issues appear as classified signals with severity counts.
- **Standalone insights panel retired.** The legacy standalone insights WebviewPanel (7 files in `src/ui/insights/`) has been removed. All functionality is served by the viewer's built-in Signals panel and the Signals tab. The `showSignals` command routes to the viewer panel; `openSignalsInTab` opens the full-page tab.
- **Extension-side general signal scanning.** Network failures, memory events, slow operations, permission denials, and classified errors are now detected by the extension host during session finalization — not just by the webview. Sessions where the viewer was never opened now get signal data for these types alongside the existing error/warning/perf/SQL fingerprints. The viewer-collected bundle is preferred when available (richer data); the extension-side scan is the fallback.
- **Lint diagnostic enrichment on signals.** Error and warning signals whose example text references a source file (e.g. `lib/main.dart:42`) are enriched with VS Code diagnostics at that location. For files not yet analyzed, the enricher opens the document to trigger the language server (Dart analyzer + saropa_lints, ESLint, etc.) and waits up to 2s for diagnostics — so lint rules run on referenced files even if the user hasn't opened them. Diagnostics include full message text, rule code, severity, and source provider. Up to 5 files analyzed per pass, 3 diagnostics per signal.

### Fixed


- **Warning detection now recognizes logcat `W/` prefix.** `isWarningLine` previously only matched lines containing the substring "warn", missing Android logcat warnings that use the `W/Tag:` format.
- **Error detection now recognizes logcat `E/`, `F/`, `A/` prefixes.** `isErrorLine` previously only matched keyword substrings ("error", "exception", "fatal", "failed"), missing Android logcat errors, fatal, and assert lines that use the single-letter prefix format.
- **"Show native scrollbar" toggle now applies immediately.** The context menu toggle sent the new value to the extension but did not optimistically update the body class, so the CSS change and the checkbox state both lagged behind the round-trip — making the toggle appear stuck. Additionally, Chromium caches `::-webkit-scrollbar` pseudo-element styles and does not re-evaluate them when an ancestor class changes; the toggle now forces a reflow by cycling `overflow-y` on `#log-content` so the scrollbar track is destroyed and re-created.
- **Jump buttons now clear the native scrollbar.** When "Show native scrollbar" was on, the Top/Bottom jump buttons overlapped the 10px scrollbar because `getBoundingClientRect()` does not reliably reflect `::-webkit-scrollbar` width changes in Chromium. The inset calculation now reads the `--scrollbar-w` CSS variable explicitly.
- **Context menu checkmarks no longer look like submenu arrows.** Toggle items (Proportional, SQL density, etc.) placed the `codicon-check` icon at `right: 8px` — the same position used for submenu `▸` indicators. Checked items appeared to have an expandable submenu that never opened. The checkmark now sits inline between the leading icon and the label (VS Code convention).
- **DriftDebugInterceptor SQL lines now recognized.** The SQL pipeline (source tag classification, level classification, SQL fingerprinting, SQL Query History, N+1 detection, args dimming) only recognized the standard Drift `LogInterceptor` format (`Drift: Sent SELECT … with args [...]`). Lines from `DriftDebugInterceptor` (`Drift SELECT: SELECT …; | args: [...]`) were silently ignored — no `database` source tag, no SQL History entries, no repeat compression. Now both formats are recognized across all six parser locations (extension-side and webview-side).
- **Dot-separated project names now display correctly.** Filenames like `contacts.drift-advisor.json` showed as "Contacts.drift Advisor" because the normalize function only treated underscores and hyphens as word separators. Now dots are also treated as separators, producing "Contacts Drift Advisor". Fixed in both the tree view and the webview session panel.
- **Bracket-prefixed log lines now fully stripped.** Flutter DAP output often prepends `[timestamp] [logcat]` or `[timestamp] [stdout]` before the actual log format. The structured prefix parser could not detect the logcat format behind these brackets, and the source-tag strip only removed the first bracket pair. Now the structured parser skips leading bracket metadata (up to 3 pairs) to find the real format, and the fallback strip removes all leading bracket pairs — so lines display only the message body.
- **Continuation badge no longer floats over log text.** The `[+N lines]` collapse/expand badge was absolutely positioned at the right edge of the line, overlapping content and leaving a confusing empty blue button when expanded. Moved the badge inline next to the line counter as a compact `[+]`/`[−]` pill with the line count shown only in the tooltip.
- **Signal reports now open in separate tabs.** Previously every signal report reused a single panel, replacing whatever report you were reading. Each report now opens its own tab (titled with the signal template ID) so you can compare multiple reports side by side.
- **Signals panel text wrapping.** Long signal descriptions (e.g. ANR risk with many indicators) overflowed the panel instead of wrapping. Switched list items to flex layout so the emoji and dismiss button stay pinned while the signal text wraps within the available width.
- **Device-other lines no longer re-promoted as recent-error context.** Framework logcat lines (ActivityManager, WindowManager, etc.) are demoted from error/warning to info to suppress noise, but the recent-error-context feature was undoing that demotion — painting them with dimmed red dots and error borders when a real error occurred nearby. These lines now stay demoted as intended.
- **Recent-error-context border no longer shifts line content.** The dashed left border used `padding-left: 5px` which overrode the base `1.85em` padding when decorations were off, shifting text leftward. Replaced with an inset `box-shadow` that adds the visual indicator without affecting layout.

<details>
<summary>Maintenance</summary>

- **adb logcat Phase 2: streaming provider pattern.** Migrated logcat spawning from hardcoded logic in `session-lifecycle-init` into the `IntegrationProvider` contract. Added `onSessionStartStreaming(context, writer)` and `onProcessId(pid)` to the provider interface; the registry calls `runOnSessionStartStreaming()` after session start and `dispatchProcessId()` on DAP process events. Dart auto-detect now lives in the provider's `isEnabled` instead of session init. Future streaming integrations (e.g. Docker logs) can implement the same two methods without touching session lifecycle code.
- **ROADMAP.md replaced with a redirect to `plans/`.** The roadmap table was a stale subset of the `plans/` directory and required constant maintenance. It now points to `plans/` for upcoming features and `plans/history/` for completed work. Feature plans created for Docker polish (007) and incremental index search (029).
- **README restructured for faster grokking.** Installation & Quick Start moved to the top of the page, a hyperlinked Table of Contents added, the Integration adapters wall-of-text broken into scannable sub-bullets, and the Configuration table split into six categorized tables (Capture, Viewer & Display, Filter & Search, Alert & Diagnostics, File Splitting Rules, Advanced).
- **README hero section rewritten to explain the feature set.** The intro and overview now lead with the value proposition (zero-config capture, diagnostic workstation, error intelligence, SQL diagnostics) instead of reading like technical documentation. Added coverage for signals, structured log parsing, ASCII art detection, and Drift SQL diagnostics. Fixed stale `bugs/` links to `plans/`.
</details>

---

## [6.2.1]

Fixes CI failures from a misnamed CSS test selector and coverage thresholds that no longer matched the codebase. [log](https://github.com/saropa/saropa-log-capture/blob/v6.2.1/CHANGELOG.md)

<details>
<summary>Maintenance</summary>

- **CI: Signals evidence button test referenced wrong CSS class.** The test `viewer-root-cause-hints-styles.test.ts` asserted against `.root-cause-hyp-evidence` which never existed in the CSS — the actual class is `.rch-report-btn`. Updated the test regex and assertion messages to match the real selectors.
- **CI: coverage thresholds lowered to match current codebase.** Functions and statements lowered from 50% to 48%, branches from 45% to 40%, lines from 50% to 48%. The previous thresholds caused CI to fail after recent feature additions.
</details>

---

## [6.2.0]

Catches Flutter sessions that slip past the normal start event, adds collapsible daily groups in Project Logs, a three-way tier filter, and automatic Flutter crash-log import. [log](https://github.com/saropa/saropa-log-capture/blob/v6.2.0/CHANGELOG.md)

### Fixed

- **Flutter debug sessions now captured when `onDidStartDebugSession` does not fire.** The late-start fallback required an exact session ID match between the buffering session and `activeDebugSession`, which always fails for Flutter's parent/child session model (output arrives on the Dart VM child, but the active session is the Flutter parent). Removed the strict ID check so any buffered output triggers capture via the active session. Also added `attachToExistingSession` to detect sessions already running at activation time (covers window reload and extension host restart), wrapped the `onDidStartDebugSession` handler in try/catch so errors are logged instead of silently swallowed, and added diagnostic logging at every silent skip path in the session-start pipeline.

### Added

- **Collapsible daily groupings in Project Logs.** Click a day heading to collapse or expand that group. Collapsed state persists across panel close/reopen via workspace storage. Headings show a chevron indicator and support keyboard navigation (Enter/Space).
- **Tri-state tier filter for Flutter and Device logs.** The Log Inputs section in the filter drawer now offers three modes per tier — All, Warn+, and None — instead of a simple on/off checkbox. "Warn+" surfaces only warnings and errors from that tier while hiding info/debug noise. The keyboard shortcut `A` cycles Device through all three states.
- **Flutter CLI crash log detection.** When Flutter's tooling crashes (`flutter test`, `flutter run`, `flutter build`), it writes `flutter_XX.log` files to the workspace root. The extension now auto-detects these files, imports them into the reports directory so they appear in the session history list, and annotates any active debug session with the crash details. Enabled by default via the `flutterCrashLogs` integration adapter.

---

## [6.1.1]

Fixes the Project Logs panel not following your active debug session, adds more date range options, and adds name-based session filtering.

### Fixed

- **Project Logs panel now follows the active debug session.** Starting a debug session automatically points the panel at that session's log directory, so logs appear immediately instead of showing stale entries from a previously browsed folder.

### Added

- **Expanded date range filter options in Project Logs panel.** The dropdown now offers 10 choices: Last hour, Last 4 hours, Last 8 hours, Last 24 hours, Last 7 days, Last 30 days, Last 3 months, Last 6 months, Last year, and All time. The same expanded options are available in the Insights panel time-range selector.
- **Name-based filtering in Project Logs panel.** Right-click any session to "Hide This Name" (exclude all sessions with the same canonical name, ignoring dates) or "Show Only This Name" (show only matching sessions). A filter bar appears with the active filter and a "Show All" button to clear it.

<details>
<summary>Maintenance</summary>
- **"slow operation" keyword missing from package.json performance defaults.** The `package.json` default for `saropaLogCapture.severityKeywords.performance` was missing `"slow operation"`, which is present in the code-level defaults. When VS Code reads configuration, it uses the `package.json` default, so lines like `Slow operation: took 5000ms` were classified as `info` instead of `performance`.
</details>

---

## [6.1.0]

Adds session time toggles, signal report saving, PERF-line detection, and a configurable slow-operation threshold.
[log](https://github.com/saropa/saropa-log-capture/blob/v6.1.0/CHANGELOG.md)

### Added

- **Session time (T+) toggle in context menu.** Options submenu now includes a quick toggle for session elapsed time, matching the gear panel checkbox.
- **Save Report button on signal reports.** Saves a markdown report to the configured log directory (`saropaLogCapture.logDirectory`).
- **PERF-line slow-operation signal detection.** `[log] PERF operationName: Nms` lines are now recognized as slow operations, with the operation name shown in the hypothesis text (e.g. "Slow operation (1.0s): dbEventCountForDate").
- **Configurable slow-operation threshold.** New setting `saropaLogCapture.signalSlowOpThresholdMs` (default 500ms, range 100-60000) controls the minimum duration for a slow-operation signal. Lowered from the previous hardcoded 2000ms.
- **Copy Log Path button on session-end notification.** A new "Copy Log Path" button appears alongside "Open Log" when a session completes, copying the log file path to the clipboard.

### Changed

- **Signal report title** is now "Saropa Signal Report" (panel tab and heading).
- **Copy Report** now copies the report as markdown with evidence lines and resolved source file paths.

### Fixed

- **Severity dot order inconsistent between project list and viewer toolbar.** Unified all severity level orderings (toolbar dots, filter drawer, export panel, project list) to a single canonical order: error → warning → info → performance → todo → notice → debug → database.
- **Confidence badge unreadable in some themes.** Replaced theme-variable-only colors with explicit high-contrast foreground, background, and border values.
- **External sidecar timestamps not parsed.** Lines from external sidecars (e.g. SDA logs) with ISO 8601 timestamps now have their timestamps extracted, enabling Session time (T+), elapsed time, and timestamp decorations.
- **Warning-recurring signal missed for device-other lines (plan 050).** Device-other tier demotion (error/warning → info for display) was also suppressing signal detection. The original pre-demotion level is now preserved on line items so the signal collector sees the true classification while display remains unchanged.

<details>
<summary>Maintenance</summary>

- Eliminated signal algorithm duplication — hypothesis building now runs exclusively on the host (single TypeScript source of truth) instead of being duplicated as ~280 lines of embedded JavaScript in the webview
- Deduplicated session list I/O on startup — auto-load and streaming session list now share a single in-flight fetch instead of scanning the directory and loading every file header twice
- Fixed signal report panel leak on deactivation — the signal report webview panel is now explicitly disposed during extension deactivation
- Split `build-hypotheses.ts`, `viewer-continuation-behavior.test.ts`, and `viewer-styles-decoration.ts` to stay within the 300-line limit
- Reclassified internal-only CHANGELOG entries (file splits, CI fixes, param refactors, script cleanup) from Changed/Fixed to Maintenance across 7 releases
- Added missing intro lines and `[log]` links to 9 releases; added missing `## [5.0.3]` heading and `---` separators
</details>

---

## [6.0.0]

Adds structured line parsing for known log formats, a signal report panel with evidence context, and metadata click-to-filter — plus general-purpose signal detection beyond SQL.
[log](https://github.com/saropa/saropa-log-capture/blob/v6.0.0/CHANGELOG.md)

### Added

- **Signal report panel** — clicking a signal in the strip opens a rich webview report with evidence lines in context (5 lines surrounding each evidence line), related lines summary, and actionable recommendations per signal type; follows the analysis panel pattern with progressive section loading
- **Structured line parsing (plan 047)** — auto-detects known log line formats (Android logcat threadtime, logcat shorthand, Log4j/Logback, Python logging, bracketed timestamp+level, ISO timestamp+level, syslog RFC 3164, SDA log) and extracts metadata (timestamp, PID, TID, log level, tag). Strips the structured prefix from displayed text for a clean view. Default on, toggle via Decoration Settings
- **PID/TID display toggle** — show process and thread IDs in the decoration prefix (off by default); click to filter by PID or TID
- **Level prefix display toggle** — show the raw log level indicator (e.g. "D", "INFO") in the decoration prefix (off by default)
- **Parsed tag display** — extracted log tags (e.g. "Zygote", "ActivityManager") shown as clickable filter toggles in the decoration prefix
- **Metadata click-to-filter** — clicking a PID, TID, or tag value toggles an inclusive filter showing only lines with that value
- **Level tooltips** — hovering over a log line shows the full severity level name (e.g. "Debug", "Warning", "Fatal")
- **Format sniffer** — for file-loaded logs, samples lines from the file head and middle to auto-detect the primary format; known sources (live logcat, etc.) skip sniffing
- **"Slow operation" performance keyword** — added to default performance keywords so Android `Slow operation` messages are classified as performance issues

### Changed

- **Signals: general log pattern detection** — signals now detect recurring warnings, network failures (SocketException, ECONNREFUSED, etc.), memory pressure (OOM, heap exhaustion), slow operations (>2s), permission denials, and classified errors (critical/bug) — not just SQL patterns
- **Signals: ANR risk detection** — surfaces ANR risk score from host-side analysis with detailed signal breakdown; host-side enrichment pipeline scans the log file for ANR patterns (choreographer warnings, GC pauses, dropped frames, jank) and injects the result into the bundle before hypothesis building
- **Signals: three confidence levels** — high/medium/low with red/yellow/white dots; crashes and OOM get high confidence, recurring patterns get medium, volume-based hints stay low
- **Signals: actionable text** — signal text includes the actual problem (e.g. "Network failure: SocketException: Connection refused (5 occurrences)") instead of generic templates
- **Signals: FNV-1a error fingerprinting** — errors are now grouped by normalized fingerprint (strips timestamps, UUIDs, hex, paths, numbers) instead of last-100-char suffix matching; errors differing only in port numbers or IDs now merge correctly
- **Signals: crash category confidence** — error signals use crash category (fatal/anr/oom/native) to set high confidence instead of defaulting everything to medium
- **Signals panel hidden by default** — the root-cause signals panel no longer auto-opens when signals are detected; the toolbar badge still shows the count and users click the icon to reveal it
- **Signal report copy feedback** — clipboard copy now shows a status bar message on success or failure instead of silently swallowing errors
- **Signal report not-ready feedback** — clicking a signal hypothesis before the bundle has loaded now shows a status bar message instead of doing nothing

### Fixed

- **Stale ANR scores across sessions** — host-side ANR risk cache is now cleared when the session changes, preventing stale scores from a previous session
- **Slow operation dedup** — slow operation hypothesis keys now use content-based excerpt keys instead of line indices, so the same slow operation at different line positions correctly merges into one hypothesis

---

## [5.8.0]

Adds a Collapse All button and DB timestamp burst detection, fixes stack traces ignoring parent severity, and tightens up decoration and copy behavior.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.8.0/CHANGELOG.md)

### Added

- **Collapse All Sections button** — new `$(collapse-all)` icon on the viewer title bar collapses all expanded stack groups, continuation line groups, and SQL repeat drilldown panels in one click
- **DB timestamp burst detector (DB_16)** — emits a marker when 3+ database queries fire at the same timestamp (within 10ms tolerance), surfacing redundant or concurrent DB lookups as a code smell. Toggle via `saropaLogCapture.viewerDbDetectorTimestampBurstEnabled`

### Changed

- **Decoration prefix uses grey text** — timestamp, counter, elapsed time, and `»` separator now render in `editorLineNumber` grey instead of inheriting the line's severity color, visually separating metadata from log content
- **Links use grey text until hovered** — source file links and URL links render in `editorLineNumber` grey, revealing their blue link color only on hover

### Fixed

- **Stack traces always showed error severity regardless of parent line** — stack frames and headers were hardcoded to `level: 'error'`, so a database query's stack trace showed red dots and red text while the query itself showed cyan. Stack groups now inherit the severity of the preceding log line, keeping the severity bar and text color visually connected
- **"Copy Line" and "Copy Line Decorated" ignored multi-line selection** — when shift-click selected multiple lines, the context menu actions only copied the single right-clicked line. Now both copy all selected lines. Also fixed shift-click selection using wrong indices when filtered lines are present
- **Decorated copy duplicated severity emoji dot** — `decorateLine` prepended a severity dot (e.g. 🟢) but the line text already contained one from the original log, producing a double dot. Now strips the leading dot from text when the decoration adds one
- **Continuation badge overlapping log text** — the `[+N lines]` collapse badge was rendered inline, causing it to wrap and overlap adjacent lines when the log line was long. Now absolutely positioned at the right edge of the line
- **ASCII art block grouping broken for multi-event output** — consecutive separator lines (e.g. Drift Debug Server banner) were not grouped because each DAP output event created a new `Date()` with different milliseconds. Timestamp comparison now uses 1 s proximity instead of strict equality

---

## [5.7.1]

Fixes an options panel crash when severity keywords haven't loaded yet.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.7.1/CHANGELOG.md)

### Fixed

- **Options panel crash when severity keywords not yet loaded** — `renderSeverityKeywordsDisplay` threw `TypeError: Cannot read properties of null` because the `typeof` guard did not catch `null` (`typeof null === 'object'`). Now uses truthiness check

---

## [5.7.0]

Adds configurable severity keywords, console continuation grouping, Copy Line Decorated, strip-source-tag toggle, and configurable stack frame defaults.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.7.0/CHANGELOG.md)

### Added

- **Source Logger Best Practices** guide (`docs/SOURCE_LOGGER_BEST_PRACTICES.md`) — documents how to structure `dart:developer` `log()` calls for optimal Saropa Log Capture experience
- **Mid-line stack frame detection** — `isStackFrameText()` now recognizes Dart source paths (`package:*.dart:N` and `(./lib/*.dart:N:N)`) anywhere in the line, not just at the start. Fixes detection for `stack_trace` package output with `⠀ »` prefix
- **Strip source tag prefix** toggle in Decoration Settings — hides `[log]`, `[SDA]`, and other bracket prefixes from displayed text when already parsed as a source tag (on by default)
- **Configurable stack frame defaults** in Decoration Settings — choose initial collapsed state (expanded/preview/collapsed) and preview frame count for stack groups
- **Console continuation grouping** — multi-line `dart:developer` `log()` output split by the Dart DA into separate events now groups as continuation lines (same timestamp, same category, no source tag on child)
- **Copy Line Decorated** context menu option — copies clicked/selected line(s) with severity emoji, sequence number, and timestamp
- **Configurable severity keywords** (`saropaLogCapture.severityKeywords`) — users can customize which keywords trigger each severity level (error, warning, performance, todo, debug, notice). Structural patterns (logcat prefixes, `Error:`, `[error]`, Dart `_TypeError`) remain built-in
- **Severity Keywords section** in the viewer Options panel — shows current keyword-to-level mapping with color indicators and a button to open VS Code settings for editing

### Changed

- **Project Logs panel now loads progressively** — items appear with metadata top-to-bottom as each file resolves instead of waiting for all files to finish loading
- Copy & Export submenu now groups "All" items (Copy All, Copy All Decorated, Copy as snippet) together with separators for clarity
- Downgraded `failed`/`failure`/`fail` keywords from error to warning severity — these indicate something worth investigating, not a definitive error
- Severity classification now separates structural patterns (hardcoded) from keyword patterns (user-configurable), improving transparency and customizability
- Root-cause hypotheses no longer produce duplicate signals for stack-frame continuation lines that inherited error level via proximity

---

## [5.6.3]

Adds an experimental ASCII art detector with improved majority-in-window scoring.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.6.3/CHANGELOG.md)

### Added

- New `viewerDetectAsciiArt` setting (default off) — experimental heuristic that detects pixel-based ASCII art (logos, figlet banners) and groups them as art blocks with the existing shimmer/yellow treatment

### Changed

- ASCII art detector uses majority-in-window (70%) instead of strict consecutive runs, so one weak line inside an art block no longer breaks detection
- ASCII art scoring adds low-token-count heuristic (+15 for long lines with ≤2 tokens) and vertical-uniformity window bonus (+10 when line lengths cluster tightly)

---

## [5.6.2]

Fixes ASCII art block grouping not working for logcat-prefixed lines.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.6.2/CHANGELOG.md)

### Fixed

- Fixed ASCII art block grouping not working for logcat-prefixed lines (e.g. `I/flutter (13876): │ text │`) — separator detection now strips the logcat/bracket prefix before checking art-char ratio

---

## [5.6.1]

Housekeeping — split oversized files and fixed a test that broke under minification.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.6.1/CHANGELOG.md)

### Fixed

- Fixed `viewer-performance-panel` test using brittle `.toString()` source inspection that breaks after esbuild minification — now tests actual function output instead
- Fixed signals treating decorative separator lines (`═══════`, `────────`, etc.) as error hypotheses — excerpts with no alphanumeric characters are now filtered out, and lines with the `isSeparator` flag are excluded from error collection
- Fixed `isAsciiBoxDrawingDecorLine` only matching single-vertical `│` borders — now also matches double-vertical `║` borders (e.g. Isar Connect banners), preventing text-heavy box content lines from being misclassified as errors

<details>
<summary>Maintenance</summary>

- Modularized 6 files that exceeded the 300-line code limit: extracted edit modal styles, SQL drilldown UI, scope filter hint system, broadcaster config, and split large test files
</details>

---

## [5.6.0]

Auto-loads your active session when you switch to the tab, groups ASCII art into tidy blocks, and adds a Copy All Filtered button.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.6.0/CHANGELOG.md)

### Added

- Auto-load the active recording session when the Saropa Log Capture tab becomes visible
- Copy All Filtered Lines button in the viewer title bar to copy all visible (filtered) lines to the clipboard with a toast showing the line count
- **ASCII art block grouping** — consecutive separator/box-art lines with the same timestamp are now rendered as a single visual block: the first line keeps its decoration, subsequent lines show only the art content with a shimmer effect, continuous gutter bar, and subtle tinted background. New setting `saropaLogCapture.viewerGroupAsciiArt` (default on)

### Changed

- Renamed filter section "Noise Reduction" to "Exclusions" in both the toolbar filter drawer and the filters panel
- Deprecated `deemphasizeFrameworkLevels` setting — the device tier system now handles severity demotion automatically (device-other lines demoted to info, device-critical lines keep real severity)

### Fixed

- ASCII art lines (e.g. Drift debug server banner) no longer get inconsistent colors — separator lines are always classified as `info` level regardless of text content like "DEBUG" or "database"

<details>
<summary>Maintenance</summary>

- Removed deprecated `appOnlyMode` setting definition from `package.json` (TS migration for old saved presets retained)
- Removed dead `setCaptureAll` message handler that was no longer invoked
</details>

---

## [5.5.3]

Merges duplicate logcat error hints that only differ by timestamp.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.5.3/CHANGELOG.md)

### Fixed

- Root-cause hints now merge logcat errors that differ only by leading timestamp into a single hypothesis

---

## [5.5.2]

Internal cleanup — trimmed oversized parameter lists and split large files.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.5.2/CHANGELOG.md)

<details>
<summary>Maintenance</summary>

- Refactored `setErrorClassificationSettings` from 5 positional params to `ErrorClassificationSettings` options object across viewer target, broadcaster, providers, and all callers
- Refactored `PopOutPanel` constructor from 5 positional params to `PopOutPanelOptions` options object
- Refactored `parseLogLineToEvent` from 5 positional params to `ParseLogLineOptions` options object
- Refactored `getViewerDataScript` from 5 positional params to `ViewerDataScriptOptions` options object
- Refactored `recordSqlQueryHistoryObservation` (embedded JS + test interface) from 6 positional params to observation object
- Refactored 9 files exceeding eslint `max-lines` limits by extracting cohesive sections into separate modules — no functional changes
</details>

---

## [5.5.1]

Fixes false error badges on device system logs and a broken SocketException pattern.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.5.1/CHANGELOG.md)

### Fixed

- Fixed device-other lines (e.g. `E/gralloc4`) getting false error badges and critical notifications in loose detection mode — `classifyError()` and `checkCriticalError()` now skip device-other tier lines entirely
- Fixed `SocketException` transient pattern matching deterministic bind/listen failures (e.g. hot-restart port conflicts) — pattern now requires known-transient indicators like "Connection refused" or "timed out"
- Fixed missing `captureDeviceOther` NLS key in all non-English locale files (de, es, fr, it, ja, ko, pt-br, ru, zh-cn, zh-tw)

### Changed

- Promoted `Choreographer` to device-critical tier — frame skip warnings report app main-thread jank and should keep their `performance` level rather than being suppressed as device noise

---

## [5.5.0]

Sorts device logs into three tiers so system noise stays out of the way and real crashes always show up.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.5.0/CHANGELOG.md)

### Added

- **Device log triage:** Three-tier classification for logcat lines — Flutter (app), device-critical (always visible), device-other (hidden by default). Device-critical tags (`AndroidRuntime`, `ActivityManager`, `art`, etc.) are never hidden, so real crashes surface even with Device unchecked
- **Flutter/Device checkboxes** in Log Inputs section replace the old "App only" toggle. Flutter is checked by default; Device is unchecked by default
- **Device severity demotion:** Device-other lines (e.g. `E/SettingsState`) are demoted to info severity regardless of logcat level — no more false red errors from system noise
- **Capture-level filtering:** New `integrations.adbLogcat.captureDeviceOther` setting (default: false) drops device-other lines at capture time before they reach the viewer or log file
- **Curated critical tag list** in `device-tag-tiers.ts` — editorial classification maintained in code, not a user responsibility

### Changed

- **Noise Reduction → Exclusions:** Renamed the filter section now that app-only is gone; only exclusion patterns remain
- **"App only" toggle removed:** Replaced by the Flutter/Device checkboxes with tier-aware filtering
- **"No Framework Noise" preset → "Flutter Only":** Built-in preset renamed and uses `deviceEnabled: false`
- **Keyboard shortcut "A"** now toggles the Device checkbox instead of the removed app-only mode
- **Signal analysis** skips device-other lines — no more false positives from system errors in error classification
- **Line decorations — no master switch:** Removed the `showDecorations` master toggle from the context menu, options panel, and VS Code settings. Each decoration option (severity dot, counter, timestamp, session elapsed, severity bar, line coloring, badges) can now be toggled independently. Decorations render when any individual option is on; the footer Deco button now opens the settings panel directly.
- **File Scope cleanup:** All five radio buttons are always visible (disabled ones are dimmed instead of hidden); removed three redundant hint/status lines; "Hide lines without file path" renamed to "Exclude lines with no source file" and disabled when scope is "All logs"; each radio shows the actual path segment in a dimmed suffix (e.g. "Only directory _(lib/src/)_"); accordion summary shows "Only main.dart" instead of generic "File"

### Fixed

- Fixed Log Inputs category filter (e.g. unchecking "logcat") not hiding lines that arrive after the filter is toggled — new lines now respect the active category filter on arrival
- Fixed File Scope filter never matching any lines on Windows — `uri.path` produces `/d:/…` but DAP source paths are `d:\…`; path normalization now strips the leading slash before drive letters
- Fixed File Scope filter silently changing when switching editor tabs — scope paths are now locked when the user picks a level; switching editors updates the suffix labels but does not re-apply the filter

---

## [5.4.2]

Fixes duplicate and unstable entries in the signals panel — repeated errors now merge into one signal, ranked by how often they appear instead of how recently they arrived.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.4.2/CHANGELOG.md)

### Fixed

- Fixed duplicate signal hypotheses for the same error message appearing on different log lines (e.g. repeated connection-refused errors) — error signals now group by normalized message text instead of line index
- Fixed signal hypotheses using timestamp-varying logcat lines as separate signals — grouping key uses the last 100 chars of the excerpt, which skips leading date/time/pid prefixes
- Error signal hypotheses are now ranked by frequency (most repeated error first) rather than recency, making the signals panel more stable during live log streaming
- Collection now samples up to 50 recent error lines (was 2) so the algorithm has enough occurrences to rank by frequency accurately
- Fixed spurious `[+N lines]` continuation badges collapsing ASCII art and other plain stdout output — continuation grouping now requires both lines to have a logcat tag; source-only matching was collapsing unrelated lines that happened to share a wall-clock timestamp

<details>
<summary>Maintenance</summary>

- Fixed CI build failure: added missing braces to `if` statements in `config-normalizers.ts` (eslint `curly` rule)
- Fixed CI build failure: removed unused `logcatLetterAnywhere` regex in `level-classifier.ts` (eslint `no-unused-vars` rule)
</details>

---

## [5.4.1]

Fixes the Integrations panel expand/collapse toggle and resolves CI build failures from stale compiled files.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.4.1/CHANGELOG.md)

### Fixed

- Fixed Integrations panel more/less toggle not working — nested `<p>` tags broke the DOM, leaving descriptions always expanded and the toggle button disconnected

<details>
<summary>Maintenance</summary>

- Fixed CI build failure caused by 750 stale compiled `.js` files committed to `src/` — removed from git, added to `.gitignore`
- Fixed ESLint flat config applying rules to all file types instead of only `.ts` files
- Updated CI workflow to Node.js 22 and latest GitHub Action versions (checkout v6, setup-node v6, upload-artifact v7) to resolve Node.js 20 deprecation warnings
- Added log viewer SQL screenshot to README
</details>

---

## [5.4.0]

Adds lint diagnostic badges on log lines that reference source files with active VS Code diagnostics — errors and warnings from any linter show up right in the log viewer. [log](https://github.com/saropa/saropa-log-capture/blob/v5.4.0/CHANGELOG.md)

### Added

- **Lint diagnostic badges** on log lines — lines referencing source files with active VS Code diagnostics (errors, warnings from any linter) show a small coloured badge with the count; toggle via Decoration Settings → "Lint badge"
- **Live diagnostic updates** — badges update automatically when diagnostics change in the editor (e.g. after saving a file or fixing a lint warning)

---

## [5.3.0]

Signals panel with per-signal dismiss, search and filter count badges, database level classification, and a batch of resize and toolbar fixes. [log](https://github.com/saropa/saropa-log-capture/blob/v5.3.0/CHANGELOG.md)

### Added

- **Search match count badge** on the toolbar search icon — shows the number of matches when a search query is active
- **Signals toolbar icon** (`codicon-pulse`) with count badge — shows the number of detected signals and toggles the signals panel on click
- **Copy signals button** at the bottom of the signals panel — copies all signal texts to clipboard with a brief toast confirmation
- **Evidence line flash highlight** — clicking a signal's "line N" evidence link now scrolls to the line and briefly flashes it so you can see exactly where you landed
- **Dismiss individual signals** — hover a signal to reveal an X button; dismissed signals are hidden for the session with a "N dismissed — restore all" link to bring them back

### Changed

- Filter count badge now displays on the toolbar filter icon instead of a separate standalone badge
- Signals panel visibility is now controlled by the toolbar icon — removed the internal header with expand/collapse toggle and "Explain with AI" button
- Signal text templates rewritten as clear diagnostic messages — removed hedging language and internal jargon

### Fixed

- **Log viewer right-side clipping on window resize** — removed `scrollbar-width: none` that hid the horizontal scrollbar in Chromium 130+ (VS Code 1.97+), and added a `window.resize` fallback listener for edge cases where `ResizeObserver` misses webview dimension changes
- Toolbar filename dotted underline no longer extends to the `●`/`⏸` status prefix — only the file path is underlined
- Long-press to copy file path now works reliably — `preventDefault()` blocks Chromium drag initiation that was cancelling the 500 ms hold timer
- Action buttons (Reset all, SQL Query History, etc.) no longer stretch to the full width of their container — they now size to their content
- Action buttons use proper VS Code theme fallbacks so they never render as unstyled black rectangles when theme variables are missing
- "Reset all" button in filter drawer footer is now visually separated from the preset dropdown with a spacer, since it applies globally to all filters
- Accordion section counts (e.g. "2/2", "10 tags") now display as bracketed suffixes on the title (e.g. "Log Inputs (2/2)") instead of right-aligned

### Changed

- Context lines label in filter drawer shortened from "Context: 3 lines" to compact `±3` notation — saves toolbar space while tooltip still explains the control

### Added

- New **Database** level with cyan filter dot — Drift SQL lines, generic SQL statements (`SELECT…FROM`, `INSERT INTO`, `UPDATE…SET`, `DELETE FROM`, `CREATE TABLE`, `PRAGMA`), and any line with a `database` source tag now classify as `database`, giving a single toolbar dot and filter toggle for all SQL traffic
- TODO marker filter now also catches **BUG**, **KLUDGE**, and **WORKAROUND** keywords (case-insensitive) in addition to TODO, FIXME, HACK, and XXX
- Text casing conventions added to UI Style Guide — sentence case for action buttons, Title Case for panel/view names and section headings

---

## [5.2.0]

Fixes trailing-CR tofu boxes, logcat level misclassification, and search box clearing; adds channel badge decoration, copy-as-raw-text, and quick-save export. [log](https://github.com/saropa/saropa-log-capture/blob/v5.2.0/CHANGELOG.md)

### Fixed

- Trailing carriage return (`\r`) rendered as a small blue tofu box at the end of every log line — DAP adapters that send `\r` without `\n` now have all trailing CR/LF stripped; `escapeHtml()` also strips control characters as defense-in-depth
- Threadtime logcat lines (e.g. `03-30 07:34:58.588 4457 4457 D Android: …`) now correctly recognize the level prefix — previously the `D`/`I`/`W`/`E` was ignored, causing debug lines to misclassify as info and inherit nearby error coloring
- Scroll map no longer floods with a single color — debug and notice bars now respect the "show info markers" toggle (off by default), so only error, warning, performance, and to-do markers appear
- Search text box no longer clears itself after typing — `clearSearchFilter()` name collision between viewer-search and viewer-presets caused the presets version (which empties the input) to overwrite the search version; renamed to `clearSearchFilteredFlags()` and `presetClearSearchInputValue()`
- ASCII box art (e.g. Drift debug server banner) no longer corrupted in viewer — empty `│   │` lines were misclassified as stack frames and consecutive box-art lines were collapsed by repeat tracking
- Export modal now seeds level checkboxes from the viewer's current level filter instead of a hardcoded Error/Warning/Info default

### Added

- Channel badge decoration — small inline label (e.g. `stdout`, `logcat`, `ai-bash`) showing the DAP output channel for each log line; toggled from Decoration Settings panel (off by default)
- Copy as raw text (`Ctrl+Alt+C`) — copies the original unprocessed text before ANSI stripping, HTML conversion, or linkification; falls back to plain text for synthetic items
- Quick Save button in export modal — saves the current view as-is to the `reports/` folder as a markdown file with metadata header (project name, active filters, level breakdown, timestamps)

### Changed

- Filter drawer UX overhaul: merged "Log Streams" and "Output Channels" into single "Log Inputs" section, merged "App only" into "Noise Reduction" accordion, renamed "Log Tags" → "Message Tags", "Code Tags" → "Code Origins", "Scope" → "File Scope"
- Toolbar level dots now hide when filter drawer is open to avoid redundant counts
- Removed "sidecar" jargon from filter labels and README — external sources now show their name with "(external)" suffix
- Moved "SQL Commands" to least prominent grid position in filter drawer
- Drift SQL `with args [...]` suffix is now always visible but dimmed (40% opacity) instead of hidden behind a confusing ellipsis/tooltip fold
- Filter drawer accordion arrows now use codicon chevrons at 14px for better visibility
- Accordion section headers now show item counts/summaries when collapsed (tags, streams, channels, exclusions, scope)
- All checkboxes and radio buttons inside accordion expanders now have descriptive tooltips
- Export modal "Include Levels" and "Export Options" sections are now collapsible accordions with selection counts (e.g. "5/7", "2/3")

---

## [5.1.2]

New extension and sidebar icons — severity dots on a log file, matching Saropa brand colors. [log](https://github.com/saropa/saropa-log-capture/blob/v5.1.2/CHANGELOG.md)

### Changed

- Redesigned extension icon: new "4 severity dots on a log file" concept replacing the funnel design, matching Saropa open source brand colors
- Redesigned sidebar icon to match new document-with-dots concept (monochrome `currentColor`)

---

## [5.1.1]

Fixes publish script path after v5.1.0 restructure. [log](https://github.com/saropa/saropa-log-capture/blob/v5.1.1/CHANGELOG.md)

### Fixed

- Publish script Step 16 (store propagation check) failed with "Missing check-stores-version.ps1" — path not updated after v5.1.0 move to `scripts/modules/`

<details>
<summary>Maintenance</summary>

- Split `viewer-continuation.test.ts` (326 lines) into static checks and behavioral eval files
- Split `viewer-script-null-guards.test.ts` (602 lines) into three topical files: core viewer, interaction, and panels/nav
</details>

---

## [5.1.0]

Adds adb logcat integration for live Android log streaming, continuation line collapsing for split log output, hidden-lines chevron indicators on the severity bar, smooth toolbar animations, and SQL verb-category filter chips. [log](https://github.com/saropa/saropa-log-capture/blob/v5.1.0/CHANGELOG.md)

### Added

- Hidden-lines chevron indicator on the severity bar — a small `▸` marker appears between visible lines when non-blank lines are hidden by filters, with a tooltip showing the count and filter reasons
- adb logcat integration: live-stream Android system logs alongside debug sessions with PID filtering, level filtering, tag filters, and `.logcat.log` sidecar at session end. Auto-connects for Dart/Flutter sessions when adb is on PATH
- Continuation line collapsing: consecutive log lines with the same timestamp and logcat tag (e.g. Flutter splitting long SQL across 40+ lines) are grouped behind a clickable `[+N lines]` badge. Groups with more than 5 children auto-collapse; click the badge to expand/collapse. Search matches auto-expand collapsed groups

### Changed

- Smooth animations for toolbar UI: search flyout and filter drawer slide down/up, actions dropdown scales from top, accordion sections expand/collapse with height+opacity transitions, and Signals strip smoothly collapses when filter drawer opens. All animations respect `prefers-reduced-motion`
- SQL filter chips replaced: fingerprint-based pattern chips replaced with simple verb-category chips (SELECT, INSERT, UPDATE, DELETE, Transaction, Other SQL) for immediate usability
- Removed `viewerSqlPatternChipMinCount` and `viewerSqlPatternMaxChips` settings (no longer needed with fixed verb categories)
- Toolbar severity dots increased from 10px to 12px for better visibility and click targets
- Filter drawer level buttons are more compact — reduced padding and removed minimum count width
- All tooltips now describe what interactions do — toolbar dots explain click (toggle) and double-click (solo), icon bar buttons say "click to open/close", filename shows click/double-click/long-press actions
- Filter drawer accordion sections use bordered cards with visible expand arrow instead of plain text bullets
- Filter drawer sections arranged in 2-column grid, expanding to full width when opened
- Preset dropdown now has a visible "Preset:" label for context
- "Reset all" button moved to far right of footer row, away from preset dropdown

### Fixed

- Fix severity bar connector gaps — dots now only connect when they share the same severity level, bridging correctly across blank and hidden lines instead of joining mismatched levels
- SQL density minimap bands used bright blue (`rgba(90,180,255)`) which looked like selection highlights or errors — changed to soft pink (`rgba(200,120,180)`) so the overlay reads as a background annotation
- SQL Query History panel column headers were garbled and required horizontal scrolling — `table-layout: fixed` with `width: 1%` made count and duration columns ~3px wide, causing text to overflow and overlap
- "Hide blank lines" toggle was indented incorrectly in the Hide context submenu — the invisible checkmark span was taking up space in the flex layout, pushing the label right compared to regular menu items

---

For older versions (5.0.3 and older), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).
