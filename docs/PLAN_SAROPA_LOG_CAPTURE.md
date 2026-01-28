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

<!-- cspell:ignore laggy -->
8. **Performance is a Feature** — Virtual scrolling for 100K+ lines. Batched UI updates (200ms). Streaming file writes.

---

## Remaining Features

### Tier 4: Differentiators

| # | Feature | Description |
|---|---|---|
| 70 | Multi-session side-by-side | Compare two sessions in split WebviewPanel with synchronized scrolling |
| 72 | Color diff | Unique lines per session highlighted in comparison view |
| 74 | .slc session bundle | ZIP export containing logs + metadata + annotations + pins |
| 75 | .slc import | Drag-and-drop import, appears in session history |
| 76 | Export formats | CSV, JSON, JSONL export options |
| 83 | **Saved filter presets** | Save level + keyword + category combos as named presets |

### Tier 5: Ecosystem

| # | Feature | Description |
|---|---|---|
| 85 | Session templates | Save project-specific config bundles (watch, exclusions, highlights, splits) + starter templates for Flutter/Node/Python |
| 86 | First-run walkthrough | VS Code Walkthrough API with 6 guided steps |
| 87 | Quick actions context menu | Right-click → search codebase, create GitHub issue, add to watch |
| 89 | Tail mode | Watch workspace .log files (file watcher, configurable globs) |
| 90 | Remote workspace / SSH | Enterprise environment support |
| 91 | Inline code decorations | Show log output next to source line (Console Ninja approach) |
| 92 | External log service integration | Logz.io, Loki, Datadog export |

---

## Feature Details

### Saved Filter Presets (Task 83)

Save combinations of viewer filters as named presets for one-click application.

**Example presets:**
- "Errors Only" → category: stderr, keyword: `/error|exception/i`
- "SQL Queries" → keyword: `/SELECT|INSERT|UPDATE|DELETE/i`
- "Network Debug" → keyword: `/fetch|axios|http|API/i`

**Implementation:**
- Dropdown in viewer toolbar: `[Preset: None ▼]`
- "Save Current Filters as Preset..." option
- Presets stored in workspace settings: `saropaLogCapture.filterPresets`
- Quick-switch via dropdown or command palette

**Settings schema:**
```jsonc
"saropaLogCapture.filterPresets": [
  {
    "name": "Errors Only",
    "categories": ["stderr"],
    "searchPattern": "/error|exception/i",
    "exclusions": []
  }
]
```

### Multi-Session Comparison (Tasks 70-72)

Compare two debug sessions side by side in a dedicated editor panel.

**Features:**
- WebviewPanel (editor area, not sidebar)
- Two scrollable log panels
- Synchronized scrolling by timestamp proximity (toggle)
- Color diff: lines unique to session A highlighted left, unique to B highlighted right
- Shared lines (identical output) shown in neutral color

**Use case:** Before/after a code change, reproducing vs non-reproducing runs, regression hunting.

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

### Session Templates (Task 85)

Save project-specific configurations as reusable templates.

**A template saves:**
- Watch keywords and alert types
- Exclusion filters
- Filter presets
- Auto-tag rules
- File split rules
- Highlight rules

**Features:**
- Templates scoped to workspace (`.vscode/saropaLogCapture/templates/`)
- Quick-switch via command palette or toolbar dropdown
- Built-in starter templates: Flutter, Node.js, Python
- Export/import as JSON for sharing

### First-Run Walkthrough (Task 86)

VS Code Walkthrough API for guided onboarding.

**Steps:**
1. "Start a debug session" — explains auto-capture
2. "Find your log file" — shows where files are saved
3. "Use the sidebar viewer" — introduces the viewer panel
4. "Search and filter" — shows search, level filter, word wrap
5. "Watch for keywords" — explains keyword watching
6. "Customize your setup" — links to settings

### Quick Actions Context Menu (Task 87)

Right-click context menu with powerful actions beyond copy and pin.

**Actions:**
- Search codebase for log line text or class/function name
- Open source file (if source info available)
- Create GitHub issue (pre-fill with error text, stack trace, session metadata)
- Search previous sessions for this exact text
- Add keyword from this line to watch list
- Add pattern to exclusion filters

### Tail Mode (Task 89)

Extend beyond debug console to watch any .log file in the workspace.

**Features:**
- File watcher on configured glob patterns
- Stream file changes to the viewer
- Configurable: `saropaLogCapture.tailPatterns: ["*.log", "logs/**/*.txt"]`

### Remote Workspace Support (Task 90)

Support for SSH Remote, WSL, and Dev Containers.

### Inline Code Decorations (Task 91)

Console Ninja-style: show log output directly next to the source line that generated it.

### External Log Service Integration (Task 92)

Export sessions to cloud log platforms: Logz.io, Grafana Loki, Datadog.

---

## Marketplace Icon

The extension has two icons:

### Sidebar Icon (`images/sidebar-icon.svg`) ✓

Activity bar icon — already implemented. SVG, 24x24, monochrome using `currentColor`.

### Marketplace Icon (`images/icon.png`) ✓

Extension icon for marketplace — already implemented. PNG, 256x256, colorful on dark background.
