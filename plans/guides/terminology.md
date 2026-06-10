# Terminology — Saropa Log Capture

Canonical dictionary for user-facing text. All UI labels, tooltips, command
titles, descriptions, documentation, and changelog entries **must** use the
terms below. Internal code names (variable/class/file names) may differ — those
are noted in the "Code term" column.

When adding a new user-facing string, check this file first.

---

## Core Concepts

| User-facing term | Code term | Definition |
|------------------|-----------|------------|
| **Log** (or **log file**) | `session` | A single captured debug output file (`.log`) stored in the `reports/` directory. Never say "session" in UI text. |
| **Log viewer** | `viewer`, `webview` | The main interactive panel that displays log content with search, filters, decorations, and keyboard shortcuts. |
| **Logs** | `session list`, `session panel` | The sidebar panel listing all saved logs with file size, date, tags, and severity indicators. Never say "Project Logs" — just "Logs". |
| **Log part** | `part`, `.log.1` | A segment of a split log file when it exceeds the max-lines limit (e.g. `output.log.2`). Navigate with Shift+[ / Shift+]. |
| **Run** | `run` | A single app execution within a log. Multiple runs occur on hot restart / hot reload. Shown as "Run 1 of N" separators. |

## Organization & Sharing

| User-facing term | Code term | Definition |
|------------------|-----------|------------|
| **Collection** | `collection` | A named group of related logs and files for investigating a specific bug, feature, or incident. Never say "investigation" or "case" in UI text. |
| **Bundle** | `.slc`, `slc-bundle` | A `.slc` ZIP file containing a collection's logs plus metadata. Used for sharing with teammates. |
| **Tag** | `tag`, `correlationTag` | A label on a log. Three kinds: manual (user-applied), auto-tag (rule-based pattern match), and correlation (auto-extracted from file paths or error types). |
| **Bookmark** | `bookmark` | A saved reference to a specific log line. Persists across viewer reloads. Created with Ctrl+B. |
| **Marker** | `marker` | A user-inserted visual separator line in a log. Can include an optional text label. Created with M key. |

## Detection & Analysis

| User-facing term | Code term | Definition |
|------------------|-----------|------------|
| **Signal** | `signal` | An automatically detected pattern in log output — errors, warnings, performance anomalies, N+1 queries, ANR risk, SQL fingerprints. Grouped in the Signals panel. |
| **App line** | `app`, `!fw` | A log line originating from user code (not framework/library code). |
| **Framework line** | `fw` | A log line from framework or system code (e.g. `D/FlutterJNI`, `I/Choreographer`). Coloring can be deemphasized via settings. |
| **Stack trace** | `stackGroup` | Consecutive `at file:line` frames, grouped and collapsed by default. Click to cycle: preview (first 3 app frames) / expanded / collapsed. |

## Viewing & Filtering

| User-facing term | Code term | Definition |
|------------------|-----------|------------|
| **Decoration** | `decoration`, `deco` | Visual enhancement on a log line: severity dot, line number, timestamp, elapsed time (`+Nms`). Each type toggleable independently. |
| **Exclusion** | `exclusion` | A string or regex pattern that hides matching log lines. Managed as removable chips in the filter drawer. |
| **Quick filter** | `filterPreset` | A saved combination of level, search, and exclusion state for rapid reapplication. |
| **Pin** | `pin` | A log line hoisted above the scrollable area for continuous visibility. Created with P key. |
| **Watch pattern** | `watchPattern` | A keyword or regex monitored during live capture. Triggers a flash, badge, or counter when matched. |

## Capture & Replay

| User-facing term | Code term | Definition |
|------------------|-----------|------------|
| **Capture** | `tracker`, `capture` | The process of recording debug output to a log file during an F5 session. Toggled on/off from the status bar. |
| **Replay** | `replay` | Playing back a saved log with optional timing to simulate live capture. |
| **Sidecar file** | `sidecar` | An auxiliary file alongside the main log: metadata (`.meta.json`), terminal output (`.terminal.log`), logcat (`.logcat.log`). |
| **Adapter** | `adapter` | An opt-in integration module that captures supplementary context during capture (git state, test results, crash dumps). |

## Reporting

| User-facing term | Code term | Definition |
|------------------|-----------|------------|
| **Bug report** | `bugReport`, `report` | A markdown export containing filtered log content, signal findings, and metadata. Generated from a collection or log context menu. |
| **Deep link** | `deepLink` | A shareable `vscode://` URL that opens a specific log and/or line in the recipient's VS Code. |
| **Gist** | `gist` | A GitHub Gist (public or secret) used to share a collection via URL. |

## UI Panels

| User-facing term | Code term | Definition |
|------------------|-----------|------------|
| **Signals** | `signals panel` | Cross-log view of all detected signals — errors, warnings, performance, SQL patterns. |
| **Collections** | `collections panel` | Panel for managing named collections — rename, merge, open, delete. |
| **Trash** | `trash panel` | Holding area for deleted logs before permanent removal. Restorable until emptied. |
| **Source Classes** | `source tags`, `code origins` | Filter-drawer tab showing auto-extracted class and method names from log lines, with visibility toggles. Never say "Code Origins". |

---

## Banned Terms

These terms **must not** appear in user-facing text:

| Banned | Use instead | Why |
|--------|-------------|-----|
| session | **log** | Internal implementation term. Users see log files, not "sessions". |
| Project Logs | **Logs** | Unnecessary qualifier. The panel is just "Logs". |
| Code Origins | **Source Classes** | Misleading — the panel shows class/method names, not generic "code". |
| filter preset | **Quick Filter** | Internal term. Users see "Quick Filter" in commands and menus. |
| investigation | **collection** | Legacy term from an earlier design. |
| case / active case | **collection** | Legacy term. |
| webview | **viewer** or **log viewer** | VS Code implementation detail. |
