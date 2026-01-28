# Saropa Log Capture — VS Code Extension

## The Problem

VS Code's Debug Console is ephemeral. When a debug session ends, the output is gone. There is no built-in way to save it to a file. This has been [requested](https://github.com/microsoft/vscode/issues/77849) and [closed as out-of-scope](https://github.com/microsoft/vscode/issues/140859). No existing extension fills this gap.

## The Solution

A VS Code extension that automatically captures Debug Console output to persistent log files on the developer machine, with a rich real-time log viewer built into the sidebar. Works with **any** debug adapter (Dart, Node, Python, C++, Go, etc.).

## Design Principles
<!-- cspell:ignore Wireshark -->
Derived from studying what makes legendary dev tools (Wireshark, Chrome DevTools, Charles Proxy, Postman, Sentry, Datadog, GitLens, Prettier) successful:

1. **Zero Friction** — Works immediately on install. No config file to create, no project setup, no onboarding wizard.

2. **One Problem, Perfectly** — This is NOT a logging framework, NOT a log analysis platform, NOT a monitoring tool. It does ONE thing: captures VS Code Debug Console output to persistent files with a good viewer.

3. **Progressive Disclosure** — Simple surface, power underneath. A new user sees: sidebar with scrolling log, status bar with line count, log file on disk. A power user discovers: regex search, keyword watch, custom highlight rules, session comparison, file split rules.

4. **Multiple Surfaces, One Data Stream** — The same captured log data appears in: the sidebar viewer (real-time), the status bar (summary), the file on disk (persistence), the session history (archive), notifications (alerts).

5. **Never Lose Data** — Every line captured is written to disk immediately (append, not batch-write-on-close). If VS Code crashes, the log file is intact up to the last line.

6. **Respect the Host** — Use native VS Code patterns: TreeView for history, WebviewView for the viewer, status bar for counters, `--vscode-*` CSS variables for theming.

7. **Power User Escape Hatch** — Every automated behavior has a manual override.

8. **Performance is a Feature** — Virtual scrolling for 100K+ lines. Batched UI updates (200ms). Streaming file writes.

---

## Remaining Features

### Tier 4: Differentiators

| # | Feature | Description |
|---|---|---|
| 74 | .slc session bundle | ZIP export containing logs + metadata + annotations + pins |
| 75 | .slc import | Drag-and-drop import, appears in session history |
| 76 | Export formats | CSV, JSON, JSONL export options |

### Tier 5: Ecosystem

| # | Feature | Description |
|---|---|---|
| 89 | Tail mode | Watch workspace .log files (file watcher, configurable globs) |
| 90 | Remote workspace / SSH | Enterprise environment support |
| 92 | External log service integration | Logz.io, Loki, Datadog export |

---

## Feature Details

### Session Import/Export (Tasks 74-76)

Full session portability — not just .log files, but complete sessions with metadata.

**.slc bundle (ZIP) contains:**
- Log file(s) including split parts
- Session metadata JSON (name, tags, timestamps, line count, error count)
- Annotations and pinned entries
- Split metadata (part info, split reasons)

**Additional formats:**
- CSV: timestamp, category, level, line_number, message columns
- JSON: structured array of log entry objects
- JSONL: line-delimited JSON for streaming tools

### Tail Mode (Task 89)

Extend beyond debug console to watch any .log file in the workspace.

**Features:**
- File watcher on configured glob patterns
- Stream file changes to the viewer
- Configurable: `saropaLogCapture.tailPatterns: ["*.log", "logs/**/*.txt"]`

### Remote Workspace Support (Task 90)

Support for SSH Remote, WSL, and Dev Containers.

### External Log Service Integration (Task 92)

Export sessions to cloud log platforms: Logz.io, Grafana Loki, Datadog.

---

## Marketplace Icon

The extension has two icons:

### Sidebar Icon (`images/sidebar-icon.svg`) ✓

Activity bar icon — already implemented. SVG, 24x24, monochrome using `currentColor`.

### Marketplace Icon (`images/icon.png`) ✓

Extension icon for marketplace — already implemented. PNG, 256x256, colorful on dark background.
