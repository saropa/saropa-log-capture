![Saropa Log Capture banner](https://raw.githubusercontent.com/saropa/saropa_lints/main/images/banner.png)

# Saropa Log Capture

Automatically capture VS Code Debug Console output to persistent log files on disk, with a real-time sidebar viewer. Works with **any** debug adapter (Dart, Node.js, Python, C++, Go, etc.).

## The Problem

VS Code's Debug Console is ephemeral. When a debug session ends, the output is gone. There is no built-in way to save it to a file. This has been [requested](https://github.com/microsoft/vscode/issues/77849) and [closed as out-of-scope](https://github.com/microsoft/vscode/issues/140859). No existing extension fills this gap.

## The Solution

This extension automatically captures Debug Console output to persistent `.log` files with a rich real-time viewer. Zero configuration required — it just works when you start debugging.

## Features

- **Auto-capture** -- Debug Console output is saved to `.log` files automatically when you start debugging. No configuration needed.
- **Live sidebar viewer** -- Watch captured output in real time with virtual scrolling, auto-scroll, and theme support.
- **Click-to-source** -- Click `file.ts:42` patterns in log output to jump directly to the source line. Ctrl+Click opens in a split editor.
- **Search** -- Press Ctrl+F to search log output with match highlighting and F3/Shift+F3 navigation.
- **Category filter** -- Filter output by DAP category (stdout, stderr, console) using the dropdown in the viewer footer.
- **Insert markers** -- Add visual separators to the log stream to mark test phases or debug attempts. Press M in the viewer.
- **Collapsible stack traces** -- Stack frames are grouped and collapsed by default. Click to expand.
- **Session history** -- Browse past log sessions in the sidebar tree view with metadata (adapter type, file size).
- **HTML export** -- Export any log session to a styled HTML file with ANSI colors preserved. Choose Interactive mode for search, filter, expand/collapse, and dark/light theme toggle.
- **Context header** -- Every log file starts with session metadata: launch config, VS Code version, OS, debug adapter type.
- **Deduplication** -- Identical rapid lines are grouped as `Message (x54)` instead of bloating the file.
- **Flood protection** -- Automatic suppression of rapid repeated messages (>100/sec) prevents lockups from noisy debug adapters.
- **File retention** -- Oldest log files auto-deleted when the configurable limit is exceeded.
- **Gitignore safety** -- On first run, offers to add the log directory to `.gitignore`.
- **ANSI preservation** -- Raw ANSI escape codes are kept in `.log` files for external tools like `less -R`.
- **Keyword watch** -- Track configurable keywords (error, exception, warning, or custom patterns) with live counters in the viewer footer and status bar. Flash animation alerts you to new hits.
- **Pin lines** -- Press P to pin important log lines to a sticky section above the scroll area. Click a pinned line to jump to it.
- **Exclusion filter** -- Hide lines matching string or regex patterns. Toggle exclusions on/off; hidden count shown in footer.
- **Multi-format copy** -- Shift+click to select lines, Ctrl+C for plain text, Ctrl+Shift+C for markdown fenced code block.
- **Session renaming** -- Right-click a session to give it a display name.
- **Session tagging** -- Add tags to sessions; displayed as `#tag` in the tree view.
- **Line annotations** -- Press N to annotate a log line. Annotations are shown inline and exported to HTML.
- **Elapsed time** -- Show `+Nms` between consecutive lines. Slow gaps highlighted with a dashed separator.
- **App-only stack traces** -- Press A to hide framework/library frames. Works with Dart, Node, Python, Go, Java, .NET.
- **Stack deduplication** -- Identical stack traces collapsed with `(xN)` count badge.
- **Status bar** -- Live line counter, keyword watch hit counts, and pause/resume toggle.
- **Cross-session search** -- Search across all log files via Quick Pick. Supports regex and case sensitivity.
- **JSON rendering** -- Embedded JSON objects/arrays are detected and shown as collapsible elements with pretty-printing.
- **Auto file split** -- Configure rules to automatically split log files by line count, size, keywords, duration, or silence.
- **Session summary** -- End-of-session notification shows stats: duration, lines, file size, watch hits.
- **Source hover preview** -- Hover over source links to see code context (3 lines before/after).
- **Deep links** -- Share `vscode://` URLs that open specific log sessions and lines. Copy from context menu.
- **Auto-tags** -- Automatically tag sessions based on content patterns like "BUILD FAILED" or `/Exception/`. Displayed as `~tag`.

## Getting Started

1. Install the extension
2. Start a debug session (F5)
3. Output is automatically captured to the `reports/` directory
4. Open the **Saropa Log Capture** sidebar to view output in real time

## Keyboard Shortcuts (in sidebar viewer)

| Key | Action |
|-----|--------|
| Ctrl+F | Open search bar |
| F3 / Shift+F3 | Next / previous search match |
| Escape | Close search bar |
| Space | Toggle pause/resume |
| W | Toggle word wrap |
| M | Insert marker |
| P | Pin/unpin center line |
| Shift+Click | Select line range |
| Ctrl+C | Copy selection as plain text |
| Ctrl+Shift+C | Copy selection as markdown |
| N | Annotate center line |
| A | Toggle app-only stack trace mode |
| Home | Scroll to top |
| End | Scroll to bottom |

## Commands

| Command | Description |
|---------|-------------|
| `Saropa Log Capture: Start Capture` | Start capturing to a new log file |
| `Saropa Log Capture: Stop Capture` | Stop capturing and finalize the file |
| `Saropa Log Capture: Pause/Resume Capture` | Toggle capture on/off |
| `Saropa Log Capture: Insert Marker` | Insert a visual separator into the log |
| `Saropa Log Capture: Open Active Log File` | Open the current log file in the editor |
| `Saropa Log Capture: Open Log Folder` | Reveal the log directory in the file explorer |
| `Saropa Log Capture: Clear Current Session` | Reset the line counter |
| `Saropa Log Capture: Delete Log File` | Delete log files from the reports directory |
| `Saropa Log Capture: Split Log File Now` | Manually split the current log file |
| `Saropa Log Capture: Search Log Files` | Search across all log files with Quick Pick |

## Settings

All settings are prefixed with `saropaLogCapture.`.

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable/disable automatic log capture |
| `categories` | `["console","stdout","stderr"]` | DAP output categories to capture |
| `maxLines` | `100000` | Maximum lines per log file |
| `includeTimestamp` | `true` | Prefix each line with a timestamp |
| `format` | `"plaintext"` | Output format (plaintext only for now) |
| `logDirectory` | `"reports"` | Where to save log files (relative to workspace root) |
| `autoOpen` | `false` | Open log file when debug session ends |
| `maxLogFiles` | `10` | Max log files to retain (0 = unlimited) |
| `gitignoreCheck` | `true` | Offer to add log directory to .gitignore on first run |
| `redactEnvVars` | `[]` | Env var patterns to redact from headers (e.g. `"API_KEY"`, `"SECRET_*"`) |
| `exclusions` | `[]` | Patterns to exclude from viewer (string or `/regex/`) |
| `watchPatterns` | `[{keyword:"error"},{keyword:"exception"},{keyword:"warning"}]` | Keywords to watch for with alert type (flash, badge, none) |
| `showElapsedTime` | `false` | Show elapsed time between consecutive log lines |
| `slowGapThreshold` | `1000` | Elapsed time threshold (ms) for highlighting slow gaps |
| `splitRules.maxLines` | `0` | Split file after N lines (0 = disabled) |
| `splitRules.maxSizeKB` | `0` | Split file after N KB (0 = disabled) |
| `splitRules.keywords` | `[]` | Split when keyword or `/regex/` matched |
| `splitRules.maxDurationMinutes` | `0` | Split after N minutes (0 = disabled) |
| `splitRules.silenceMinutes` | `0` | Split after N minutes of silence (0 = disabled) |

## Known Limitations

- The sidebar viewer caps at 50,000 lines for performance (the file on disk keeps all lines up to `maxLines`).
- Screenshots must be added manually before publishing.

## License

MIT
