
![Saropa Log Capture banner](https://raw.githubusercontent.com/saropa/saropa-log-capture/main/images/banner.png)

# Saropa Log Capture

> **Never lose your debug output again.**

Saropa Log Capture automatically saves all VS Code Debug Console output to persistent log files, with a fast, feature-rich panel viewer. Works with **any** debug adapter (Dart, Node.js, Python, C++, Go, and more). No setup required—just hit F5 and your logs are safe.

<!-- GitHub Activity -->
[![GitHub stars](https://img.shields.io/github/stars/saropa/saropa-log-capture?style=social)](https://github.com/saropa/saropa-log-capture)
[![GitHub forks](https://img.shields.io/github/forks/saropa/saropa-log-capture?style=social)](https://github.com/saropa/saropa-log-capture)
[![GitHub last commit](https://img.shields.io/github/last-commit/saropa/saropa-log-capture)](https://github.com/saropa/saropa-log-capture/commits)
[![GitHub issues](https://img.shields.io/github/issues/saropa/saropa-log-capture)](https://github.com/saropa/saropa-log-capture/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Have feedback or ideas? Share them by [opening an issue](https://github.com/saropa/saropa-log-capture/issues/new) on GitHub!

**Who is this for?**
- Developers who need to keep, search, and export debug output
- Anyone frustrated by losing Debug Console logs after a session ends

---

## Overview

- Debug Console output is ephemeral in VS Code—this extension makes it persistent, searchable, and exportable.
- Zero config: install and start debugging, logs are captured automatically.
- Panel viewer (next to Output/Terminal) for real-time log viewing, search, filtering, and more.

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
- **ANSI preservation:** Raw ANSI codes kept in files for external tools.
- **Gitignore safety:** Offers to add log dir to `.gitignore` on first run.
- **Full Debug Console Capture:** Toggle "App Only" or set `saropaLogCapture.captureAll` to capture all output including system/framework logs.

### Viewer
- **Live panel viewer:** Real-time output with virtual scrolling (100K+ lines), auto-scroll, and theme support (located in the bottom panel next to Output and Terminal).
- **Icon bar:** Activity-bar-style vertical icon bar with icons for Project Logs, Search, Options, and Pop Out. Clicking an icon toggles its slide-out panel.
- **Pop-out viewer:** Click the pop-out icon to open the viewer as a floating window, movable to a second monitor. Both the sidebar and pop-out receive live data simultaneously.
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

### Search & Filter
- **Search panel:** Slide-out search with regex, case sensitivity, and whole word toggles. Search history (last 10 terms) shown on open. Clear button (×) in input.
- **Category filter:** Filter by DAP category (stdout, stderr, console).
- **Level filter:** Colored dots in footer open a fly-up menu with toggle buttons for all 7 severity levels, plus Select All / Select None. Per-file level state is persisted.
- **Source tag filter:** Auto-discovers logcat tags (e.g. `D/FlutterJNI`) and bracket prefixes (e.g. `[log]`, `[API]`). Click chips to toggle visibility.
- **Exclusion filter:** Patterns shown as removable chips in the Options panel. Chip count badge on the toggle label.
- **Keyword watch:** Track patterns with live counters, flash alerts, and badges. Watch chips in the footer are clickable—opens search pre-filled with the keyword.
- **Filter presets:** Save and apply filter combinations; built-in presets included.
- **Cross-session search:** Search all log files via Quick Pick.

### Error Intelligence
- **Smart error classification:** Errors auto-classified as CRITICAL (NullPointerException, FATAL, etc.), TRANSIENT (TimeoutException, ECONNREFUSED, etc.), or BUG (TypeError, SyntaxError, etc.) with inline badges.
- **Error breakpoints:** Visual and audio alerts when errors appear—flash border, sound, counter badge, optional modal popup.
- **Multi-level classification:** Seven severity levels—Error, Warning, Info, Performance, TODO, Debug/Trace, and Notice—each auto-detected with dedicated colors and filters.

### Display & Layout
- **Line decorations:** Severity dots, sequential counters, timestamps (with optional milliseconds), and whole-line coloring for all severity levels. Configurable in the Options panel.
- **Severity bar mode:** Colored left borders by log level as an alternative/complement to dot indicators.
- **Visual spacing:** Heuristic breathing room before/after level changes, markers, and stack traces.
- **Font size / line height:** Adjustable via sliders in the Options panel.
- **Elapsed time:** Show `+Nms` between lines; slow gaps highlighted.
- **Scrollbar minimap:** Visual overview showing search matches, errors, warnings, and viewport position.
- **Highlight rules:** Color lines matching patterns (configurable colors, labels). Defaults include Fatal, TODO/FIXME, Hack/Workaround, Deprecated, Info, Debug.

### Session Management
- **Project Logs panel:** In-webview slide-out panel listing past sessions with filename, debug adapter, file size, date, and timestamp availability. Active sessions highlighted with a recording icon.
- **Historical log viewing:** Open sessions into the panel viewer with parsed timestamps, proper coloring, and async loading.
- **Session renaming/tagging:** Right-click to rename or tag sessions. Auto-tags by content patterns.
- **Session comparison:** Side-by-side diff view with color highlighting.
- **Session templates:** Save/load project-specific configurations (Flutter, Node.js, Python built-in).
- **Deep links:** Share `vscode://` URLs to open logs/lines.

### Export
- **Per-level export:** Export filtered logs with preset templates (Errors Only, Warnings + Errors, Production Ready, Full Debug, Performance Analysis) or custom level selection. Options for timestamps, decorations, and ANSI codes.
- **HTML export:** Static or interactive with search, filters, and theme toggle.
- **CSV / JSON / JSONL export:** Structured export formats for external tools.
- **Multi-format copy:** Shift+click to select, Ctrl+C for text, Ctrl+Shift+C for markdown, Ctrl+Shift+A for all lines.
- **Copy to Search:** Right-click a line to open search pre-filled with its text.
- **Source link context menu:** Right-click a filename reference to Open File, Copy Relative Path, or Copy Full Path.

### Status Bar & Audio
- **Status bar:** Two separate items—a pause/resume icon that toggles capture, and a text display (line count + watch counts) that focuses the viewer panel.
- **Live statistics:** Real-time counters for errors, warnings, performance issues, and other levels in the footer.
- **Audio alerts:** Configurable alert sounds for errors and warnings with volume slider, rate limiting, and preview buttons.
- **Real-time repeat notifications:** Immediate notification when duplicate lines are detected, with message preview and repeat counter.

### Infrastructure
- **Script fault isolation:** Each viewer feature runs in a separate script block—a SyntaxError in one feature won't break the rest.
- **App-only stack traces:** Press A to hide framework/library frames.
- **Stack deduplication:** Identical stacks collapsed with count badge.
- **Session summary:** End-of-session stats notification.

</details>

---

## Installation & Quick Start

1. Install the extension from the VS Code Marketplace
2. Start a debug session (F5)
3. Output is automatically captured to the `reports/` directory
4. Open the **Saropa Log Capture** panel (bottom panel, next to Output/Terminal) to view output in real time

---

## Usage

### Full Debug Console Capture ("App Only: OFF")

By default, Saropa Log Capture filters out some system/framework logs for clarity. To capture **all** Debug Console output (including system, framework, and app logs):

- Toggle "App Only: OFF" in the Log Viewer panel
- Or, set `saropaLogCapture.captureAll` to `true` in your VS Code settings

This is useful for troubleshooting, framework debugging, or when you want a complete record of all debug output. Toggle back to "App Only: ON" to restore filtering.

### Power Shortcuts (Panel Viewer)

| Key            | Action                                 |
|----------------|----------------------------------------|
| Ctrl+F         | Open search panel                      |
| F3 / Shift+F3  | Next / previous search match           |
| Escape         | Close search panel / inline peek       |
| Space          | Toggle pause/resume                    |
| W              | Toggle word wrap                       |
| M              | Insert marker                          |
| P              | Pin/unpin center line                  |
| Shift+Click    | Select line range                      |
| Ctrl+C         | Copy selection as plain text           |
| Ctrl+Shift+C   | Copy selection as markdown             |
| Ctrl+Shift+A   | Copy all visible lines to clipboard    |
| N              | Annotate center line                   |
| A              | Toggle app-only stack trace mode       |
| Double-click   | Open inline peek with context lines    |
| Home           | Scroll to top                          |
| End            | Scroll to bottom                       |

---

## Key Commands

| Command                                              | Description                                      |
|------------------------------------------------------|--------------------------------------------------|
| `Saropa Log Capture: Start Capture`                  | Start capturing to a new log file                |
| `Saropa Log Capture: Stop Capture`                   | Stop capturing and finalize the file             |
| `Saropa Log Capture: Pause/Resume Capture`           | Toggle capture on/off                            |
| `Saropa Log Capture: Insert Marker`                  | Insert a visual separator into the log           |
| `Saropa Log Capture: Open Active Log File`           | Open the current log file in the editor          |
| `Saropa Log Capture: Open Log Folder`                | Reveal the log directory in the file explorer    |
| `Saropa Log Capture: Clear Current Session`          | Reset the line counter                           |
| `Saropa Log Capture: Delete Log File`                | Delete log files from the reports directory      |
| `Saropa Log Capture: Split Log File Now`             | Manually split the current log file              |
| `Saropa Log Capture: Search Log Files`               | Search across all log files with Quick Pick      |
| `Saropa Log Capture: Apply Filter Preset`            | Apply a saved filter preset                      |
| `Saropa Log Capture: Save Current Filters as Preset` | Save current filter state as a named preset      |
| `Saropa Log Capture: Toggle Inline Log Decorations`  | Toggle inline log decorations in the editor      |
| `Saropa Log Capture: Compare Sessions`               | Side-by-side diff of two log sessions            |
| `Saropa Log Capture: Apply Session Template`         | Apply a saved session template                   |
| `Saropa Log Capture: Save Settings as Template`      | Save current settings as a reusable template     |

---

## Configuration

All settings are prefixed with `saropaLogCapture.`

<details>
<summary><strong>Click to expand settings table</strong></summary>

| Setting                        | Default     | Description                                              |
|--------------------------------|-------------|----------------------------------------------------------|
| `enabled`                      | `true`      | Enable/disable automatic log capture                     |
| `categories`                   | `["console","stdout","stderr"]` | DAP output categories to capture |
| `maxLines`                     | `100000`    | Maximum lines per log file                               |
| `includeTimestamp`             | `true`      | Prefix each line with a timestamp                        |
| `includeSourceLocation`        | `false`     | Include source file and line number in log lines         |
| `includeElapsedTime`           | `false`     | Show elapsed time since previous line in log files       |
| `format`                       | `"plaintext"` | Output format (plaintext only for now)                |
| `logDirectory`                 | `"reports"` | Where to save log files (relative to workspace root)     |
| `autoOpen`                     | `false`     | Open log file when debug session ends                    |
| `maxLogFiles`                  | `10`        | Max log files to retain (0 = unlimited)                  |
| `gitignoreCheck`               | `true`      | Offer to add log directory to .gitignore on first run    |
| `redactEnvVars`                | `[]`        | Env var patterns to redact from headers                  |
| `captureAll`                   | `false`     | Capture all Debug Console output, bypassing filters      |
| `exclusions`                   | `[]`        | Patterns to exclude from viewer (string or `/regex/`)    |
| `showDecorations`              | `true`      | Show severity dots, counters, and timestamps on lines    |
| `filterContextLines`           | `3`         | Context lines shown around level-filter matches          |
| `contextViewLines`             | `10`        | Context lines shown in inline peek on double-click       |
| `watchPatterns`                | `[{keyword:"error",...},{keyword:"exception",...},{keyword:"warning",...}]` | Keywords to watch with alert type |
| `showElapsedTime`              | `false`     | Show elapsed time between consecutive log lines          |
| `slowGapThreshold`             | `1000`      | Elapsed time threshold (ms) for highlighting slow gaps   |
| `suppressTransientErrors`      | `false`     | Hide expected transient errors (timeout, socket, etc.)   |
| `breakOnCritical`              | `false`     | Show notification when critical errors appear            |
| `verboseDap`                   | `false`     | Log all raw DAP protocol messages to the log file        |
| `highlightRules`               | *(3 built-in rules)* | Pattern-based line coloring rules               |
| `filterPresets`                | `[]`        | Saved filter presets for quick application                |
| `autoTagRules`                 | `[]`        | Rules for auto-tagging sessions by content patterns      |
| `splitRules.maxLines`          | `0`         | Split file after N lines (0 = disabled)                  |
| `splitRules.maxSizeKB`         | `0`         | Split file after N KB (0 = disabled)                     |
| `splitRules.keywords`          | `[]`        | Split when keyword or `/regex/` matched                  |
| `splitRules.maxDurationMinutes`| `0`         | Split after N minutes (0 = disabled)                     |
| `splitRules.silenceMinutes`    | `0`         | Split after N minutes of silence (0 = disabled)          |

</details>

---

## Known Limitations

- Panel viewer caps at 50,000 lines for performance (file on disk keeps all lines up to `maxLines`).

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

**Reporting issues:**

- Include steps to reproduce and your debug adapter (Dart, Node, Python, etc.)
- Mention your VS Code version and OS
- If possible, attach a sample log file

### Discussing ideas

Not sure if something is a bug or a feature request? [Open a discussion issue](https://github.com/saropa/saropa-log-capture/issues/new). We're happy to talk through ideas.

---

## Documentation

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Developer setup, code standards, and how to contribute |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [ROADMAP.md](ROADMAP.md) | Planned features and project direction |
| [STYLE_GUIDE.md](STYLE_GUIDE.md) | Code style conventions and patterns |

---

## License

MIT — see [LICENSE](LICENSE). Use it however you like.

---

Built by [Saropa](https://saropa.com). Questions? Ideas? [Open an issue](https://github.com/saropa/saropa-log-capture/issues) — we'd love to hear from you.

[GitHub](https://github.com/saropa/saropa-log-capture) | [Issues](https://github.com/saropa/saropa-log-capture/issues) | [Saropa](https://saropa.com)
