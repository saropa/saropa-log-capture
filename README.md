# Saropa Log Capture

Automatically capture VS Code Debug Console output to persistent log files on disk, with a real-time sidebar viewer. Works with **any** debug adapter (Dart, Node.js, Python, C++, Go, etc.).

## Features

- **Auto-capture** -- Debug Console output is saved to `.log` files automatically when you start debugging. No configuration needed.
- **Live sidebar viewer** -- Watch captured output in real time with virtual scrolling, auto-scroll, and theme support.
- **Click-to-source** -- Click `file.ts:42` patterns in log output to jump directly to the source line. Ctrl+Click opens in a split editor.
- **Search** -- Press Ctrl+F to search log output with match highlighting and F3/Shift+F3 navigation.
- **Category filter** -- Filter output by DAP category (stdout, stderr, console) using the dropdown in the viewer footer.
- **Insert markers** -- Add visual separators to the log stream to mark test phases or debug attempts. Press M in the viewer.
- **Collapsible stack traces** -- Stack frames are grouped and collapsed by default. Click to expand.
- **Session history** -- Browse past log sessions in the sidebar tree view with metadata (adapter type, file size).
- **HTML export** -- Export any log session to a styled HTML file with ANSI colors preserved.
- **Context header** -- Every log file starts with session metadata: launch config, VS Code version, OS, debug adapter type.
- **Deduplication** -- Identical rapid lines are grouped as `Message (x54)` instead of bloating the file.
- **File retention** -- Oldest log files auto-deleted when the configurable limit is exceeded.
- **Gitignore safety** -- On first run, offers to add the log directory to `.gitignore`.
- **ANSI preservation** -- Raw ANSI escape codes are kept in `.log` files for external tools like `less -R`.
- **Keyword watch** -- Track configurable keywords (error, exception, warning, or custom patterns) with live counters in the viewer footer and status bar. Flash animation alerts you to new hits.
- **Status bar** -- Live line counter, keyword watch hit counts, and pause/resume toggle.

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
| `watchPatterns` | `[{keyword:"error"},{keyword:"exception"},{keyword:"warning"}]` | Keywords to watch for with alert type (flash, badge, none) |

## Known Limitations

- The sidebar viewer caps at 50,000 lines for performance (the file on disk keeps all lines up to `maxLines`).
- Screenshots must be added manually before publishing.

## License

UNLICENSED (proprietary)
