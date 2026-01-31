
![Saropa Log Capture banner](https://raw.githubusercontent.com/saropa/saropa_lints/main/images/banner.png)

# Saropa Log Capture

> **Never lose your debug output again.**

Saropa Log Capture automatically saves all VS Code Debug Console output to persistent log files, with a fast, feature-rich panel viewer. Works with **any** debug adapter (Dart, Node.js, Python, C++, Go, and more). No setup required—just hit F5 and your logs are safe.

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

- **Auto-capture:** Debug Console output is saved to `.log` files automatically.
- **Live panel viewer:** Real-time output with virtual scrolling, auto-scroll, and theme support (located in the bottom panel next to Output and Terminal).
- **Click-to-source:** Click `file.ts:42` in logs to jump to source.
- **Search:** Ctrl+F to search, F3/Shift+F3 to navigate matches.
- **Category filter:** Filter by DAP category (stdout, stderr, console).
- **Insert markers:** Press M to add visual separators in logs.
- **Collapsible stack traces:** Stack frames are grouped/collapsed by default.
- **Session history:** Browse past log sessions with metadata.
- **HTML export:** Export logs to styled HTML (interactive/static).
- **Context header:** Each log file starts with session metadata.
- **Deduplication:** Identical rapid lines grouped as `Message (x54)`.
- **Flood protection:** Suppresses >100/sec repeated messages.
- **File retention:** Oldest logs auto-deleted when limit exceeded.
- **Gitignore safety:** Offers to add log dir to `.gitignore` on first run.
- **ANSI preservation:** Raw ANSI codes kept for external tools.
- **Keyword watch:** Track keywords (error, exception, etc.) with live counters and alerts.
- **Pin lines:** Press P to pin important lines above scroll area.
- **Exclusion filter:** Hide lines matching string/regex patterns.
- **Level filter:** All/Errors/Warn+ segmented buttons to filter by severity, with configurable context lines shown dimmed around matches.
- **Line decorations:** Colored severity dots, sequential counters, and timestamps on each line. Gear button opens settings popover for toggling parts and whole-line coloring mode.
- **Inline peek:** Double-click any log line to expand surrounding context inline. Press Escape to dismiss.
- **Multi-format copy:** Shift+click to select, Ctrl+C for text, Ctrl+Shift+C for markdown.
- **Session renaming/tagging:** Right-click to rename or tag sessions.
- **Historical log viewing:** Open sessions from Session History into the panel viewer with proper coloring and async loading.
- **Line annotations:** Press N to annotate a log line.
- **Elapsed time:** Show `+Nms` between lines, highlight slow gaps.
- **Expanded highlight rules:** Default patterns include Fatal, TODO/FIXME, Hack/Workaround, Deprecated, Info, and Debug.
- **Full Debug Console Capture:** Toggle "App Only: OFF" or set `saropaLogCapture.captureAll` to capture all output.
- **App-only stack traces:** Press A to hide framework/library frames.
- **Stack deduplication:** Identical stacks collapsed with count badge.
- **Status bar:** Live line counter, keyword hits, pause/resume toggle.
- **Cross-session search:** Search all logs via Quick Pick.
- **JSON rendering:** Embedded JSON shown as collapsible pretty-printed blocks.
- **Auto file split:** Split logs by line count, size, keywords, duration, or silence.
- **Session summary:** End-of-session stats notification.
- **Source hover preview:** Hover source links for code context.
- **Deep links:** Share `vscode://` URLs to open logs/lines.
- **Auto-tags:** Sessions auto-tagged by content patterns.

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
| Ctrl+F         | Open search bar                        |
| F3 / Shift+F3  | Next / previous search match            |
| Escape         | Close search bar / inline peek         |
| Space          | Toggle pause/resume                    |
| W              | Toggle word wrap                       |
| M              | Insert marker                          |
| P              | Pin/unpin center line                  |
| Shift+Click    | Select line range                      |
| Ctrl+C         | Copy selection as plain text            |
| Ctrl+Shift+C   | Copy selection as markdown              |
| N              | Annotate center line                   |
| A              | Toggle app-only stack trace mode        |
| Double-click   | Open inline peek with context lines     |
| Home           | Scroll to top                          |
| End            | Scroll to bottom                       |

---

## Key Commands

| Command                                      | Description                                 |
|----------------------------------------------|---------------------------------------------|
| `Saropa Log Capture: Start Capture`          | Start capturing to a new log file           |
| `Saropa Log Capture: Stop Capture`           | Stop capturing and finalize the file        |
| `Saropa Log Capture: Pause/Resume Capture`   | Toggle capture on/off                       |
| `Saropa Log Capture: Insert Marker`          | Insert a visual separator into the log      |
| `Saropa Log Capture: Open Active Log File`   | Open the current log file in the editor     |
| `Saropa Log Capture: Open Log Folder`        | Reveal the log directory in the file explorer |
| `Saropa Log Capture: Clear Current Session`  | Reset the line counter                      |
| `Saropa Log Capture: Delete Log File`        | Delete log files from the reports directory |
| `Saropa Log Capture: Split Log File Now`     | Manually split the current log file         |
| `Saropa Log Capture: Search Log Files`       | Search across all log files with Quick Pick |

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
| `format`                       | `"plaintext"` | Output format (plaintext only for now)                |
| `logDirectory`                 | `"reports"` | Where to save log files (relative to workspace root)     |
| `autoOpen`                     | `false`     | Open log file when debug session ends                    |
| `maxLogFiles`                  | `10`        | Max log files to retain (0 = unlimited)                  |
| `gitignoreCheck`               | `true`      | Offer to add log directory to .gitignore on first run    |
| `redactEnvVars`                | `[]`        | Env var patterns to redact from headers                  |
| `captureAll`                   | `false`     | Capture all Debug Console output, bypassing filters      |
| `exclusions`                   | `[]`        | Patterns to exclude from viewer (string or `/regex/`)    |
| `showDecorations`              | `false`     | Show severity dots, counters, and timestamps on lines    |
| `filterContextLines`           | `2`         | Context lines shown around level-filter matches          |
| `contextViewLines`             | `5`         | Context lines shown in inline peek on double-click       |
| `watchPatterns`                | `[{keyword:"error"},{keyword:"exception"},{keyword:"warning"}]` | Keywords to watch for with alert type |
| `showElapsedTime`              | `false`     | Show elapsed time between consecutive log lines          |
| `slowGapThreshold`             | `1000`      | Elapsed time threshold (ms) for highlighting slow gaps   |
| `splitRules.maxLines`          | `0`         | Split file after N lines (0 = disabled)                  |
| `splitRules.maxSizeKB`         | `0`         | Split file after N KB (0 = disabled)                     |
| `splitRules.keywords`          | `[]`        | Split when keyword or `/regex/` matched                  |
| `splitRules.maxDurationMinutes`| `0`         | Split after N minutes (0 = disabled)                     |
| `splitRules.silenceMinutes`    | `0`         | Split after N minutes of silence (0 = disabled)          |

</details>

---

## Known Limitations

- Panel viewer caps at 50,000 lines for performance (file on disk keeps all lines up to `maxLines`).
- Screenshots must be added manually before publishing.

---

## Advanced & Development

- See [CLAUDE.md](CLAUDE.md) for architecture and workflow details
- See [CONTRIBUTING.md](CONTRIBUTING.md) for developer setup and contribution guidelines
- See [CHANGELOG.md](CHANGELOG.md) for version history

---

## License

MIT
