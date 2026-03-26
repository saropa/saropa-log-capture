
![Saropa Log Capture banner](https://raw.githubusercontent.com/saropa/saropa-log-capture/main/images/banner.png)

```text
      F5 debug  ──►  output  ──►  saved to  reports/*.log
                                        │
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  VIEWER (what VS Code doesn't give you) │
                    │  · Search all logs (regex, history)     │
                    │  · Click  file.dart:42  →  open source  │
                    │  · Filter by error / warning / level    │
                    │  · Keep many sessions, compare two      │
                    │  · Export HTML, CSV, or share .slc      │
                    └─────────────────────────────────────────┘
```

In VS Code, when you stop debugging or switch target, the Debug Console is cleared. Everything you printed is gone. This extension saves that output to log files and adds a viewer so you can keep sessions, search them, compare runs, and click a log line to jump to the source line. No setup: install, hit F5, logs are captured for any adapter (Dart, Node, Python, C++, Go, etc.).

**What you get that VS Code doesn't:**

- **Logs saved to files** — Debug Console is cleared on stop; here output goes to `reports/*.log` and stays.
- **Click to source** — Click `file.ts:42` in the log to open that file and line (Ctrl+Click for split).
- **Search** — Regex search over the log, with history; search across all sessions.
- **Filter by level** — Show only errors, or warnings, or hide noise; filter by tag (e.g. logcat tags).
- **Keep and compare sessions** — Open any past session; diff two logs side by side.
- **Big logs** — Virtual scroll over 100K+ lines without freezing.
- **Pop-out viewer** — Move the viewer to a second monitor.
- **Export** — Current view or full session as HTML, CSV, JSON, a shareable `.slc` bundle, or push to Grafana Loki.
- **Tail any log** — Open any workspace `.log` file and watch new lines live.
- **Run navigation** — For Flutter: jump between runs (launch, hot restart, hot reload) inside one log.
- **Error alerts** — Optional sound or flash when errors appear; errors classified (e.g. crash vs timeout).
- **Session context** — Optional: lockfile hash, Git state, env snapshot, test results in each log header.

The viewer is built for real use: virtual scrolling, severity filters, run navigation for Flutter, side-by-side diff. You can tail any workspace log, export filtered views or full sessions, or attach optional adapters (lockfile, Git, env, test results, crash dumps) to session headers.

<!-- GitHub Activity -->
[![GitHub stars](https://img.shields.io/github/stars/saropa/saropa-log-capture?style=social)](https://github.com/saropa/saropa-log-capture)
[![GitHub forks](https://img.shields.io/github/forks/saropa/saropa-log-capture?style=social)](https://github.com/saropa/saropa-log-capture)
[![GitHub last commit](https://img.shields.io/github/last-commit/saropa/saropa-log-capture)](https://github.com/saropa/saropa-log-capture/commits)
[![GitHub issues](https://img.shields.io/github/issues/saropa/saropa-log-capture)](https://github.com/saropa/saropa-log-capture/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Languages](https://img.shields.io/badge/UI%20languages-11%20locales-blue)](https://github.com/saropa/saropa-log-capture#translations)
[![Coverage](https://img.shields.io/badge/coverage-50%25%2B-brightgreen)](https://github.com/saropa/saropa-log-capture/actions)

> Feedback or ideas? [Open an issue](https://github.com/saropa/saropa-log-capture/issues/new).

**Who is this for?**
- Developers who keep, search, and export debug output
- Anyone who’s lost Debug Console history when a session ended

---

## Overview

- **Logs saved, not lost:** VS Code clears the Debug Console when you stop; this extension writes output to files and gives you a viewer that handles 100K+ lines (virtual scroll), click-to-source, and theme support.
- **No config:** Install, start debugging (F5); logs are captured automatically. Works with any debug adapter.
- **Viewer:** Click source links in logs to jump to code (Ctrl+Click for split). Pop-out to a second monitor. Run navigator (Run 1 of N) for Flutter hot restart/reload. Error classification and optional sound/flash on errors. Tail any workspace `.log` file live. Export filtered views or full sessions as `.slc` bundles. Optional adapters add lockfile hash, Git, env, test/coverage/crash data to session headers.

---

## Features

<details>
<summary><strong>Click to expand full feature list</strong></summary>

### Capture & Storage
- **Auto-capture:** Debug Console output is saved to `.log` files automatically.
- **Deduplication:** Identical rapid lines grouped as `Message (x54)`.
- **Flood protection:** Suppresses >100/sec repeated messages.
- **File retention:** Oldest logs auto-deleted when limit exceeded.
- **Auto file split:** Split logs by line count, size, keywords, duration, or silence.
- **Context header:** Each log file starts with session metadata.
- **Integration adapters:** Opt-in adapters add header lines and meta per session; status bar shows which contributed. Configure via `saropaLogCapture.integrations.adapters`. Adapters: Packages (lockfile hash), Build/CI (file or GitHub/Azure/GitLab API; tokens via command palette), Git (describe, uncommitted, stash), Environment snapshot, Test results (file or JUnit XML), Code coverage (lcov/Cobertura), Crash dumps (scan at session end; optional copy into session folder), Windows Event Log (Application/System, Windows only), Docker (container inspect/logs at session end), Performance (system snapshot, optional sampling, optional profiler file copy and debug process memory), Terminal output (capture Integrated Terminal to sidecar), WSL/Linux logs (dmesg, journalctl), Application/file logs (tail configured paths during session, write `basename.<label>.log` sidecars; viewer **Sources** filter includes `external:<label>`; commands to add a path and open sidecars); optional **unified session log** (`integrations.unifiedLog.writeAtSessionEnd`) writes `basename.unified.jsonl` for one-file sharing; open it in the viewer with the same Sources filter, Security/audit (Windows Security channel, app audit file), Database query logs (correlate by request ID), HTTP/network (request log, HAR), Browser/DevTools (browser console log file), Drift Advisor (built-in session-end pull from Drift `getSessionSnapshot()` or `.saropa/drift-advisor-session.json` when adapter enabled; meta/sidecar; Open in Drift Advisor on drift-perf/drift-query lines when extension installed). See Options → Integrations… (opens a dedicated screen with descriptions, performance notes, and when-to-disable for each adapter).
- **ANSI preservation:** Raw ANSI codes kept in files for external tools.
- **Gitignore safety:** Offers to add log dir to `.gitignore` on first run.
- **Full Debug Console Capture:** Toggle "App Only" or set `saropaLogCapture.captureAll` to capture all output including system/framework logs.
- **AI Activity (opt-in):** When enabled, Claude Code AI activity (tool calls, prompts, system warnings) can be streamed into the log viewer interleaved with debug output; AI lines have distinct colored borders and `[AI ...]` prefixes, filterable by category. Settings under `saropaLogCapture.aiActivity.*`; auto-detects `~/.claude/projects/` when `autoDetect` is on.

### Viewer
- **Live sidebar viewer:** Real-time output with virtual scrolling (100K+ lines), auto-scroll, and theme support (click the Saropa icon on the activity bar). Virtual scroll rebuilds only when the visible line range changes (stable when filters hide most lines); tail-follow uses hysteresis so it does not thrash near the end of the log.
- **Icon bar:** Activity-bar-style vertical icon bar with icons for Project Logs, Find in Files, filters, bookmarks, trash, Options, and Pop Out. In-log search lives in the **session bar** (not a slide-out): **Ctrl+F** focuses the field; **case / whole word / regex** show while the field is focused or has text (or always if **`saropaLogCapture.viewerAlwaysShowSearchMatchOptions`** is on). **Compress lines** (hide blanks + collapse consecutive duplicates) is a toggle on the **log pane** (top-left), also available under Options → Layout. Clicking an icon toggles its slide-out panel where applicable. Optional text labels: click the bar background (not an icon) to show or hide labels; preference is remembered.
- **Session log navigation:** **Log *n* of *N*** in the session bar uses **chevron-only** prev/next buttons (full wording in tooltips for screen readers).
- **Drift SQL N+1 hint:** Bursts of the same normalized `Drift: Sent …` query with different `with args` payloads may insert a synthetic insight row (confidence label + **Focus DB** / **Find fingerprint** / **Static sources** — workspace index search for possible call sites; suggestive only). Sample lines: `examples/drift-n-plus-one-sample-lines.txt`.
- **Slow query burst marker (DB_08):** When **`database`**-tagged lines include replay/capture **`[+Nms]`** durations, five or more “slow” queries (default ≥ 50ms) inside a 2s window insert a green **Slow query burst** marker; click scrolls to the completing line. Settings: `saropaLogCapture.viewerSlowBurst*`. Sample: `examples/drift-slow-burst-sample-lines.txt`.
- **Signals strip (DB_14):** When the log has enough correlated signal (recent errors, N+1 insights, or high-volume SQL fingerprints), a compact **Signals** panel above the log shows template bullets with optional confidence labels and line links to evidence; dismiss is per log until clear. QA notes: `examples/root-cause-hypotheses-sample.txt`.
- **Drift SQL repeat collapse:** For **`database`**-tagged lines, duplicate suppression keys normalized SQL fingerprints (same shape, different args = one streak) and uses **verb-specific** minimum repeat counts before collapsing (reads vs transactions vs DML). **SQL repeated** summary rows can be **expanded** for arg samples and timestamps without turning off compression. Settings: `saropaLogCapture.repeatCollapse*`. QA notes: `examples/drift-repeat-collapse-thresholds.txt`.
- **Top SQL Patterns (filters):** Fingerprint chips for repeated Drift SQL shapes (with **Other SQL** for rare shapes). Settings: `saropaLogCapture.viewerSqlPatternChipMinCount`, `viewerSqlPatternMaxChips`. QA: `examples/sql-fingerprint-guardrails-sample.txt`.
- **DB insights sub-toggles & session SQL compare (`DB_15` / `DB_10`):** When **database insights** are on, optional settings turn **N+1**, **slow burst**, and **baseline volume** hints on or off independently. Compare-two-sessions can set a SQL baseline from the other file; the viewer may show **Slow A / B / Δ slow** when scans use duration brackets and the slow threshold. QA: `examples/session-comparison-drift-sql-qa.txt` and `examples/README.md`.
- **Pop-out viewer:** Click the pop-out icon to open the viewer as a floating window, movable to a second monitor. Both the sidebar and pop-out receive live data simultaneously. You can also open the Saropa Log Capture tab in a new window (e.g. right‑click tab → Open in New Window); clicking a session there shows the log in that window.
- **Click-to-source:** Click `file.ts:42` in logs to jump to source; Ctrl+Click for split editor.
- **Collapsible stack traces:** Stack frames are grouped and collapsed by default. Click to cycle through preview (first 3 app frames), expanded, and collapsed.
- **Source hover preview:** Hover source links for code context popup.
- **Insert markers:** Press M to add visual separators in logs.
- **Inline peek:** Double-click any log line to expand surrounding context inline. Press Escape to dismiss.
- **Pin lines:** Press P to pin important lines above scroll area.
- **Line annotations:** Press N to annotate a log line.
- **JSON rendering:** Embedded JSON shown as collapsible pretty-printed blocks.
- **ASCII art detection:** Box-drawing and separator characters styled for readability.
- **Scroll position memory:** Viewer remembers scroll position per file when switching between logs.
- **Tail mode:** Command **Saropa Log Capture: Open Tailed File** opens any workspace file matching `saropaLogCapture.tailPatterns` (default `**/*.log`); the viewer appends new lines as the file grows.
- **Run navigation:** Logs with multiple app runs (e.g. Flutter launch, hot restart, hot reload) show "Run 1 of N" with Prev/Next in the title bar; run separators (bar with run number, time range, duration, issue counts) appear above each run in the list.
- **Explain with AI:** Right-click a log line (or selection) → **Explain with AI** to get an explanation from the VS Code Language Model (e.g. GitHub Copilot). Requires **Saropa Log Capture > AI: Enabled** in Settings. Context includes surrounding lines, stack trace, and optional integration data; responses are cached and a progress notification is shown while the request runs.

### Search & Filter
- **In-log search:** Compact field on the **session bar** (with prev/next log and context). Match case, whole word, regex, match navigation, and highlight vs filter mode; recent terms when the field is focused and empty. Optional **`viewerAlwaysShowSearchMatchOptions`** keeps the three match toggles always visible.
- **Category filter:** Filter by DAP category (stdout, stderr, console).
- **Level filter:** Colored dots in footer open a fly-up menu with toggle buttons for all 7 severity levels, plus Select All / Select None. Per-file level state is persisted.
- **Source tag filter:** Auto-discovers logcat tags (e.g. `D/FlutterJNI`) and bracket prefixes (e.g. `[log]`, `[API]`). Click chips to toggle visibility.
- **Exclusion filter:** Patterns shown as removable chips in the Options panel. Chip count badge on the toggle label.
- **Keyword watch:** Track patterns with live counters, flash alerts, and badges. Watch chips in the footer are clickable—opens search pre-filled with the keyword.
- **Filter presets:** Save and apply filter combinations; built-in presets included (e.g. Errors Only, Just debug output, Complete (all sources)).
- **Source filter:** When a log has multiple streams (e.g. Debug Console + Terminal sidecar), the Filters panel shows a **Sources** section to show only Debug output, only Terminal, or both.
- **Cross-session search:** Search all log files via Quick Pick.

### Error Intelligence
- **Smart error classification:** Errors auto-classified as CRITICAL (NullPointerException, FATAL, etc.), TRANSIENT (TimeoutException, ECONNREFUSED, etc.), or BUG (TypeError, SyntaxError, etc.) with inline badges. Configurable detection mode (`strict` / `loose`) controls how aggressively keywords are matched.
- **Error breakpoints:** Visual and audio alerts when errors appear—flash border, sound, counter badge, optional modal popup.
- **Multi-level classification:** Seven severity levels—Error, Warning, Info, Performance, TODO, Debug/Trace, and Notice—each auto-detected with dedicated colors and filters.

### Insight (Cases, Recurring, Hot files, Performance)
- **Insight panel:** Single icon-bar panel (lightbulb), one scroll, no tabs. Accordion sections: **Active Cases** (investigations—create and open named collections of sessions/files; top 3 + View All), **Recurring errors** (aggregated error patterns across sessions; top 5; Export summary), **Frequently modified files** (hot files across sessions; collapsed by default), and **Performance** (when a log is open: **Current**, **Trends**, **Log**, **Database**, and **Errors** — Drift SQL session rollup + simple timeline; Flutter/Dart memory lines, when context-gated, appear in a **Memory** group under Current). Context-aware: with no log selected you see Cases, Recurring, and Hot files; with a log selected Performance moves to the top. Project Logs shows only the session list; create and manage investigations from Insight → Cases. Session bar **Performance** chip opens Insight and focuses the Performance section.

### Display & Layout
- **Line decorations:** Severity dots, sequential counters, timestamps (with optional milliseconds), session elapsed time (e.g. 5m 15s), and whole-line coloring for all severity levels. Configurable in the Options panel; Timestamp and Session elapsed can be toggled from the right-click context menu (Options → Timestamp / Session elapsed). Blank lines do not show a severity dot (the vertical bar continues); counter on blank lines is optional via **Decoration settings** → **Show line number on blank lines** (off by default) so Go to Line matches file references.
- **Severity bar mode:** Colored left borders by log level as an alternative/complement to dot indicators.
- **Visual spacing:** Heuristic breathing room before/after level changes, markers, and stack traces.
- **Font size / line height:** Adjustable via sliders in the Options panel.
- **Elapsed time:** Show `+Nms` between lines; slow gaps highlighted.
- **Scrollbar minimap:** Visual overview showing search matches, errors, warnings, and viewport position.
- **Highlight rules:** Color lines matching patterns (configurable colors, labels). Defaults include Fatal, TODO/FIXME, Hack/Workaround, Deprecated, Info, Debug.
- **Options panel actions:** Reset to default (viewer options only) and Reset extension settings (all extension settings to defaults).

### Session Management
- **Project Logs panel:** Slide-out panel listing past sessions with filename, debug adapter, file size, date, and timestamp availability. Ctrl/Cmd-click to select multiple sessions; context menu applies to the selection (copy links/paths, export, tag, open, replay). Active sessions highlighted with a recording icon. **Orange dot** = log has new lines since you last viewed it; **red dot** = log updated in the last minute. Date filter dropdown: All time, Last 7 days, Last 30 days (persisted with display options).
- **Insight: Cases, Recurring, Hot files, Performance:** One **Insight** panel, one scroll (no tabs). Accordion sections: **Cases** = named investigations—pin sessions and files, search and export. **Recurring** = aggregated error patterns. **Frequently modified files** = hot files across sessions. **Performance** = perf data when a log is open (moves to top; includes **Errors** tab with time-bucketed error/warning chart and spike detection). Command **Open Insight** opens the panel; Add to Investigation and create/open investigation focus the Cases section.
- **Historical log viewing:** Open sessions into the panel viewer with parsed timestamps, proper coloring, and async loading. **Session replay:** Right-click a session in Project Logs → **Replay** to play it back with optional timing; use the **Replay** button in the footer bar or the icon bar to show the horizontal replay panel (play/pause, scrubber, speed).
- **Session renaming/tagging:** Right-click to rename or tag sessions. Auto-tags by content patterns.
- **Session comparison:** Side-by-side diff view with color highlighting.
- **Session templates:** Save/load project-specific configurations (Flutter, Node.js, Python built-in).
- **Deep links:** Share `vscode://` URLs to open logs/lines. **Share Investigation** (Gist, export .slc, Copy deep link, LAN, etc.) lets teammates open the investigation in VS Code. **To open a shared .slc file:** Investigation panel → **Open .slc file** (or Command Palette → **Import .slc Bundle**) → select the file. Secret gists don’t expire; delete from GitHub (Your gists → open gist → Delete) when no longer needed.

### Export
- **Per-level export:** Right-click in the log content and choose **Export current view…** to open the export modal. Export filtered logs with preset templates (Errors Only, Warnings + Errors, Production Ready, Full Debug, Performance Analysis) or custom level selection. Options for timestamps, decorations, and ANSI codes.
- **HTML export:** Static or interactive with search, filters, and theme toggle.
- **CSV / JSON / JSONL export:** Structured export formats for external tools.
- **.slc session bundle:** Export to `.slc` ZIP; **Import .slc Bundle** (Ctrl+Shift+P → type the name) restores sessions or opens a shared investigation; in the file dialog, pick the .slc file. Investigation panel **Share**: Gist, export .slc, Copy deep link (local file), LAN, etc.
- **Export to Loki:** Push current or selected session to Grafana Loki. Enable `saropaLogCapture.loki.enabled`, set `saropaLogCapture.loki.pushUrl`, and store your API key with **Saropa Log Capture: Set Loki API Key**. Available from command palette and session context menu.
- **Hover copy icon:** Hover any log line to reveal a copy button on the right edge. Click to copy the line's plain text to clipboard with a "Copied" toast confirmation.
- **Multi-format copy:** Shift+click to select, Ctrl+C for text, Ctrl+Shift+C for markdown, Ctrl+Shift+A for all lines. **Copy as snippet (GitHub/GitLab):** context menu wraps selection in `` ```log `` … `` ``` `` for pasting into issues.
- **Copy to Search:** Right-click a line to open search pre-filled with its text.
- **Source link context menu:** Right-click a filename reference to Open File, Copy Relative Path, or Copy Full Path.

### Status Bar & Audio
- **Status bar:** Two separate items—a pause/resume icon that toggles capture, and a text display (line count + watch counts) that focuses the viewer panel.
- **Live statistics:** Real-time counters for errors, warnings, performance issues, and other levels in the footer.
- **Audio alerts:** Configurable alert sounds for errors and warnings with volume slider, rate limiting, and preview buttons.
- **Real-time repeat notifications:** Immediate notification when duplicate lines are detected, with message preview and repeat counter.

### Infrastructure
- **Project index:** A lightweight index under `.saropa/index/` speeds up analysis by indexing project docs (e.g. `docs/`, `bugs/`), root markdown files, and completed session metadata. The Analysis panel and doc-matching use it when enabled. Command **Saropa Log Capture: Rebuild Project Index** to refresh manually; settings under `saropaLogCapture.projectIndex.*` (sources, includeReports, maxFilesPerSource, refreshInterval). Add `.saropa/` to `.gitignore` to keep tooling artifacts (index and caches such as Crashlytics) out of version control.
- **Script fault isolation:** Each viewer feature runs in a separate script block—a SyntaxError in one feature won't break the rest.
- **App-only stack traces:** Press A to hide framework/library frames.
- **Stack deduplication:** Identical stacks collapsed with count badge.
- **Session summary:** End-of-session stats notification.

</details>

---

## Requirements

- **VS Code** ^1.108.1 (or a Cursor/Open VSX–compatible editor). The extension declares `engines.vscode: "^1.108.1"` in `package.json`.

## Remote development (SSH, WSL, Dev Containers)

The extension runs in the **workspace** context, so when you open a folder via **Remote - SSH**, **Remote - WSL**, or **Dev Containers**, it runs on the remote host or inside the container. Capture, session storage, session history, and the log viewer all work there: logs are stored on the remote filesystem, and the viewer loads them from the same environment.

- **Supported:** [Remote - SSH](https://code.visualstudio.com/docs/remote/ssh), [WSL](https://code.visualstudio.com/docs/remote/wsl), [Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers).
- **Recommendation:** Use a **relative** log directory (e.g. `reports` or `.logs`) in remote workspaces so logs stay under the workspace. An absolute `saropaLogCapture.logDirectory` is resolved on the extension host (the remote), which is fine but less portable.
- **No extra setup:** Install the extension; when you open a remote folder and start debugging, capture and viewer behave the same as on a local workspace.

## Installation & Quick Start

1. Install the extension from the VS Code Marketplace
2. Start a debug session (F5)
3. Output is automatically captured to the `reports/` directory
4. Click the **Saropa Log Capture** icon on the activity bar to view output in real time

**Testing the extension (F5):** Use **VS Code** (not Cursor) to run the Extension Development Host: **File → Open Folder** → this repo, then press **F5**. Cursor may not load the extension when used as the F5 host. To run the test suite in the IDE, install the recommended **Extension Test Runner** and use the Testing view; see Contributing for details.

---

## Usage

### Full Debug Console Capture ("App Only: OFF")

By default, Saropa Log Capture filters out some system/framework logs for clarity. To capture **all** Debug Console output (including system, framework, and app logs):

- Toggle "App Only: OFF" in the Log Viewer panel
- Or, set `saropaLogCapture.captureAll` to `true` in your VS Code settings

This is useful for troubleshooting, framework debugging, or when you want a complete record of all debug output. Toggle back to "App Only: ON" to restore filtering.

### Power Shortcuts (Panel Viewer)

Open **Options** → **Keyboard shortcuts…** in the viewer for the full reference (power shortcuts and Command Palette commands). Double-click a power shortcut row to rebind it; double-click a command row to open Keyboard Shortcuts for that command. Overrides are stored in `saropaLogCapture.viewerKeybindings`.

| Key           | Action                              |
| ------------- | ----------------------------------- |
| Ctrl+F        | Open search panel                   |
| F3 / Shift+F3 | Next / previous search match        |
| Escape        | Close search panel / inline peek    |
| Space         | Toggle pause/resume                 |
| W             | Toggle word wrap                    |
| M             | Insert marker                       |
| P             | Pin/unpin center line               |
| Shift+Click   | Select line range                   |
| Ctrl+C        | Copy selection as plain text        |
| Ctrl+Shift+C  | Copy selection as markdown          |
| Ctrl+Shift+A  | Copy all visible lines to clipboard |
| N             | Annotate center line                |
| A             | Toggle app-only stack trace mode    |
| Double-click  | Open inline peek with context lines |
| Home          | Scroll to top                       |
| End           | Scroll to bottom                    |

---

## Key Commands

| Command                                              | Description                                       |
| ---------------------------------------------------- | ------------------------------------------------- |
| `Saropa Log Capture: Start Capture`                  | Start capturing to a new log file                 |
| `Saropa Log Capture: Stop Capture`                   | Stop capturing and finalize the file              |
| `Saropa Log Capture: Pause/Resume Capture`           | Toggle capture on/off                             |
| `Saropa Log Capture: Insert Marker`                  | Insert a visual separator into the log            |
| `Saropa Log Capture: Open Active Log File`           | Open the current log file in the editor           |
| `Saropa Log Capture: Open Log Folder`                | Reveal the log directory in the file explorer     |
| `Saropa Log Capture: Clear Current Session`          | Reset the line counter                            |
| `Saropa Log Capture: Delete Log File`                | Delete log files from the reports directory       |
| `Saropa Log Capture: Split Log File Now`             | Manually split the current log file               |
| `Saropa Log Capture: Search Log Files`               | Search across all log files with Quick Pick       |
| `Saropa Log Capture: Apply Filter Preset`            | Apply a saved filter preset                       |
| `Saropa Log Capture: Save Current Filters as Preset` | Save current filter state as a named preset       |
| `Saropa Log Capture: Toggle Inline Log Decorations`  | Toggle inline log decorations in the editor       |
| `Saropa Log Capture: Compare Sessions`               | Side-by-side diff of two log sessions             |
| `Saropa Log Capture: Apply Session Template`         | Apply a saved session template                    |
| `Saropa Log Capture: Save Settings as Template`      | Save current settings as a reusable template      |
| `Saropa Log Capture: Open Tailed File`               | Open a workspace log file and tail it live        |
| `Saropa Log Capture: Import .slc Bundle`             | Import a `.slc` session bundle into the log dir   |
| `Saropa Log Capture: Configure integrations`         | Quick Pick to enable/disable integration adapters |
| `Saropa Log Capture: Getting Started`                | Open the Getting Started walkthrough              |

---

## Configuration

All settings are prefixed with `saropaLogCapture.`

<details>
<summary><strong>Click to expand settings table</strong></summary>

| Setting                         | Default                                                                     | Description                                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                       | `true`                                                                      | Enable/disable automatic log capture. Also toggled in Options → Capture.                                                                                                                                                  |
| `categories`                    | `["console","stdout","stderr"]`                                             | DAP output categories to capture                                                                                                                                                      |
| `maxLines`                      | `100000`                                                                    | Maximum lines per log file                                                                                                                                                            |
| `viewerMaxLines`                | `0`                                                                         | Max lines shown in viewer (0 = 50,000). Cannot exceed `maxLines`. Reduce for large files.                                                                                             |
| `includeTimestamp`              | `true`                                                                      | Prefix each line with a timestamp                                                                                                                                                     |
| `includeSourceLocation`         | `false`                                                                     | Include source file and line number in log lines                                                                                                                                      |
| `includeElapsedTime`            | `false`                                                                     | Show elapsed time since previous line in log files                                                                                                                                    |
| `format`                        | `"plaintext"`                                                               | Output format (plaintext only for now)                                                                                                                                                |
| `logDirectory`                  | `"reports"`                                                                 | Where to save log files (relative to workspace root)                                                                                                                                  |
| `autoOpen`                      | `false`                                                                     | Open log file when debug session ends                                                                                                                                                 |
| `maxLogFiles`                   | `10`                                                                        | Max log files to retain (0 = unlimited)                                                                                                                                               |
| `organizeFolders`               | `true`                                                                      | Move flat log files into `yyyymmdd/` date subfolders on session start                                                                                                                 |
| `includeSubfolders`             | `true`                                                                      | Include log files from date subfolders in session history, search, and analysis                                                                                                       |
| `gitignoreCheck`                | `true`                                                                      | Offer to add log directory to .gitignore on first run                                                                                                                                 |
| `redactEnvVars`                 | `[]`                                                                        | Env var patterns to redact from headers. **Tip:** Redact secrets (e.g. `API_KEY`, `SECRET_*`, `*_TOKEN`) by adding matching patterns so they never appear in session context headers. |
| `captureAll`                    | `false`                                                                     | Capture all Debug Console output, bypassing filters                                                                                                                                   |
| `exclusions`                    | `[]`                                                                        | Patterns to exclude from viewer (string or `/regex/`)                                                                                                                                 |
| `showDecorations`               | `true`                                                                      | Show severity dots, counters, and timestamps on lines                                                                                                                                 |
| `viewerAlwaysShowSearchMatchOptions` | `false`                                                                | Always show case / whole word / regex toggles in the session-bar search; when off, they appear only while the field is focused or has text                                          |
| `filterContextLines`            | `3`                                                                         | Context lines shown around level-filter matches                                                                                                                                       |
| `contextViewLines`              | `10`                                                                        | Context lines shown in inline peek on double-click                                                                                                                                    |
| `watchPatterns`                 | `[{keyword:"error",...},{keyword:"exception",...},{keyword:"warning",...}]` | Keywords to watch with alert type                                                                                                                                                     |
| `showElapsedTime`               | `false`                                                                     | Show elapsed time between consecutive log lines                                                                                                                                       |
| `slowGapThreshold`              | `1000`                                                                      | Elapsed time threshold (ms) for highlighting slow gaps                                                                                                                                |
| `suppressTransientErrors`       | `false`                                                                     | Hide expected transient errors (timeout, socket, etc.)                                                                                                                                |
| `breakOnCritical`               | `false`                                                                     | Show notification when critical errors appear                                                                                                                                         |
| `levelDetection`                | `"strict"`                                                                  | Error detection mode: `strict` (label positions) or `loose` (keywords anywhere)                                                                                                       |
| `verboseDap`                    | `false`                                                                     | Log all raw DAP protocol messages to the log file                                                                                                                                     |
| `diagnosticCapture`            | `false`                                                                     | Log capture pipeline events (session/buffer/write) to the Saropa Log Capture output channel; use when log files are empty to debug                                                                 |
| `highlightRules`                | *(3 built-in rules)*                                                        | Pattern-based line coloring rules                                                                                                                                                     |
| `filterPresets`                 | `[]`                                                                        | Saved filter presets for quick application                                                                                                                                            |
| `autoTagRules`                  | `[]`                                                                        | Rules for auto-tagging sessions by content patterns                                                                                                                                   |
| `splitRules.maxLines`           | `0`                                                                         | Split file after N lines (0 = disabled)                                                                                                                                               |
| `splitRules.maxSizeKB`          | `0`                                                                         | Split file after N KB (0 = disabled)                                                                                                                                                  |
| `splitRules.keywords`           | `[]`                                                                        | Split when keyword or `/regex/` matched                                                                                                                                               |
| `splitRules.maxDurationMinutes` | `0`                                                                         | Split after N minutes (0 = disabled)                                                                                                                                                  |
| `splitRules.silenceMinutes`     | `0`                                                                         | Split after N minutes of silence (0 = disabled)                                                                                                                                       |
| `tailPatterns`                  | `["**/*.log"]`                                                              | Glob patterns for **Open Tailed File** (workspace-relative)                                                                                                                           |
| `projectIndex.enabled`         | `true`                                                                      | Enable project-wide indexing of docs and session metadata (`.saropa/index/`) for faster analysis and doc matching                                                                     |

</details>

---

## Extension API

Other VS Code extensions can consume a typed API from Saropa Log Capture:

```typescript
import * as vscode from 'vscode';

// In your extension's activate():
const ext = vscode.extensions.getExtension('saropa.saropa-log-capture');
if (!ext) { return; }
const api = ext.isActive ? ext.exports : await ext.activate();

// Subscribe to live log lines
context.subscriptions.push(
    api.onDidWriteLine((line) => {
        if (line.category === 'stderr') {
            console.log(`Error: ${line.text}`);
        }
    }),
);

// Session lifecycle
context.subscriptions.push(
    api.onDidStartSession((session) => {
        console.log(`Capture started: ${session.projectName}`);
    }),
);

// Write lines into the active capture session
api.writeLine('Slow query detected (1250ms)', {
    category: 'drift-perf',
    timestamp: queryEndTime,
});

// Query current state
const info = api.getSessionInfo();
if (info?.isActive) {
    api.insertMarker('My extension checkpoint');
}

// Register an integration provider
context.subscriptions.push(
    api.registerIntegrationProvider({
        id: 'my-extension',
        isEnabled: () => true,
        onSessionStartSync: () => [{
            kind: 'header',
            lines: ['My Extension: active'],
        }],
    }),
);
```

See [api-types.ts](src/api-types.ts) for the full type definitions.

---

## Known Limitations

- **Empty or near-empty log files:** If the Debug Console has output but the open log shows only a header or one line, use **Prev/Next** in the viewer (output may be in the other log from the same run) and enable `diagnosticCapture` to inspect the pipeline. See [Runbook: Missing or empty log files](bugs/010_runbook-missing-or-empty-logs.md).
- **Viewer line cap:** When opening a log file, the viewer shows the first N lines. The cap is `saropaLogCapture.viewerMaxLines` (0 = default 50,000) and cannot exceed `saropaLogCapture.maxLines` (default 100,000). Set `viewerMaxLines` lower to reduce memory for very large files. The footer shows "Showing first X of Y lines" when truncated. The full file is kept on disk up to `maxLines`.
- **Debug Console only:** The main capture stream is from the VS Code Debug Console (DAP). To also capture Integrated Terminal output, enable the `terminal` integration adapter — terminal output is written to a `.terminal.log` sidecar at session end.

### Keyboard shortcuts and accessibility

**Accessibility:** The webview viewer is built for keyboard and assistive tech use. The main content has a `main` landmark; the icon bar is a `toolbar`; the log area has `role="log"` and a live region that announces line-count updates when filtering or loading. Slide-out panels (Options, Project Logs, etc.) have `region` landmarks and labeled controls; when you open a panel, focus moves into it, and **Escape** or the panel’s Close button returns focus to the icon bar. Native controls (buttons, selects, range inputs) are focusable and operable with Enter/Space. Replay controls, session/split navigation, and level filters are labeled. VS Code’s webview hosts this UI, so focus behavior at the editor boundary follows the host. For a full audit and remaining work, see [bugs/028_plan-webview-accessibility.md](bugs/028_plan-webview-accessibility.md) and [bugs/028_webview-a11y-audit.md](bugs/028_webview-a11y-audit.md).

**Keyboard shortcuts** (when the log viewer has focus):

| Shortcut                             | Action                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| **Ctrl+F** / **F3**                  | Open search panel                                                   |
| **Ctrl+Shift+F**                     | Find in Files                                                       |
| **Ctrl+G**                           | Go to line                                                          |
| **Escape**                           | Close search, options, go-to-line, peek, or session panel           |
| **Ctrl+C**                           | Copy selection; if no selection, copy current line (when supported) |
| **Ctrl+Shift+C**                     | Copy selection as Markdown                                          |
| **Ctrl+Shift+A**                     | Copy full log to clipboard                                          |
| **Ctrl+A**                           | Select all (in viewer)                                              |
| **Ctrl++** / **Ctrl+-** / **Ctrl+0** | Increase / decrease / reset font size                               |
| **Space**                            | Toggle pause (live capture)                                         |
| **W**                                | Toggle word wrap                                                    |
| **Home** / **End**                   | Jump to top / bottom                                                |
| **Page Up** / **Page Down**          | Scroll by page                                                      |
| **M**                                | Insert marker at current position                                   |
| **P**                                | Pin line at center                                                  |
| **N**                                | Add annotation to line at center                                    |
| **Ctrl+scroll**                      | Zoom font size (when not over an input)                             |

On macOS use **Cmd** instead of **Ctrl**. Open **Options** → **Keyboard shortcuts…** in the viewer for the full shortcut and Command Palette reference.

---

## Contributing

Great tools are built by communities, not companies. Contributions and feedback are welcome.

If you think a feature is:

- **Broken** — tell us what happened, we'll fix it
- **Missing** — propose it, or better yet, submit a PR
- **Confusing** — help us improve the docs or UX

### How to contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for developer setup, code quality standards, and contribution guidelines.

**Quick start:**

1. Fork the repository
2. Create a feature branch
3. Run `npm run compile` to verify your changes
4. Open a Pull Request

**Testing the extension (F5):**  
Open this repo in **VS Code** (not Cursor): **File → Open Folder** → select the repo, then press **F5**. A second VS Code window opens (Extension Development Host) with the extension loaded. Click the **Saropa Log Capture** icon in the activity bar (left) to open the viewer. If you use Cursor, the F5 host may still be Cursor and the extension may not load; use VS Code for reliable testing.

**Running the extension test suite (integrated):**  
Install the recommended extension **Extension Test Runner** (ms-vscode.extension-test-runner). It discovers the repo’s `.vscode-test.mjs` and shows tests in the **Testing** view (beaker icon). You can run and debug tests from there. Alternatively: **Terminal → Run Task… → Extension Tests**, or run `npm test` in the terminal. On Windows, if you see “Error mutex already exists”, delete the folder `.vscode-test/user-data` and run tests again.

**Reporting issues:**

- Include steps to reproduce and your debug adapter (Dart, Node, Python, etc.)
- Mention your VS Code version and OS
- If possible, attach a sample log file

### Discussing ideas

Not sure if something is a bug or a feature request? [Open a discussion issue](https://github.com/saropa/saropa-log-capture/issues/new). We're happy to talk through ideas.

### Translations

The extension ships localized UI strings for 11 locales: Chinese (Simplified & Traditional), German, Spanish, French, Italian, Japanese, Korean, Portuguese (Brazil), and Russian. If you spot a mistranslation or awkward phrasing, corrections are welcome — email [language@saropa.com](mailto:language@saropa.com) with the language, the incorrect string, and your suggested fix.

---

## Documentation

Four top-level docs (plus `CHANGELOG_ARCHIVE.md` for older releases):

| Document                                                 | Description                                             |
| -------------------------------------------------------- | ------------------------------------------------------- |
| [CONTRIBUTING.md](CONTRIBUTING.md)                       | Developer setup, code standards, and how to contribute  |
| [CHANGELOG.md](../CHANGELOG.md)                             | Version history and release notes                       |
| [ROADMAP.md](ROADMAP.md)                                 | Planned features, project review, and direction         |
| [STYLE_GUIDE.md](STYLE_GUIDE.md)                         | Code style conventions and patterns                     |

---

## License

MIT — see [LICENSE](LICENSE). Use it however you like.

---

Built by [Saropa](https://saropa.com). Questions? Ideas? [Open an issue](https://github.com/saropa/saropa-log-capture/issues) — we'd love to hear from you.

[GitHub](https://github.com/saropa/saropa-log-capture) | [Issues](https://github.com/saropa/saropa-log-capture/issues) | [Saropa](https://saropa.com)
