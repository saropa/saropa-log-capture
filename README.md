# Saropa Log Capture

Automatically capture VS Code Debug Console output to persistent log files on disk, with a real-time sidebar viewer. Works with **any** debug adapter (Dart, Node.js, Python, C++, Go, etc.).

## Features

- **Auto-capture** -- Debug Console output is saved to `.log` files automatically when you start debugging. No configuration needed.
- **Live sidebar viewer** -- Watch captured output in real time in a sidebar panel with auto-scroll and pause-on-scroll.
- **Insert markers** -- Add visual separators to the log stream to mark test phases or debug attempts.
- **Context header** -- Every log file starts with session metadata: launch config, VS Code version, OS, debug adapter type.
- **Deduplication** -- Identical rapid lines are grouped as `Message (x54)` instead of bloating the file.
- **File retention** -- Oldest log files auto-deleted when the configurable limit is exceeded.
- **Gitignore safety** -- On first run, offers to add the log directory to `.gitignore`.
- **ANSI preservation** -- Raw ANSI escape codes are kept in `.log` files for external tools like `less -R`.
- **Status bar** -- Live line counter with pause/resume toggle.

## Getting Started

1. Install the extension
2. Start a debug session (F5)
3. Output is automatically captured to the `reports/` directory
4. Open the **Saropa Log Capture** sidebar to view output in real time

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

## Known Limitations

- The sidebar viewer caps at 5,000 lines for performance (the file on disk keeps all lines up to `maxLines`)
- ANSI color codes are stripped in the sidebar viewer (preserved in the `.log` file)
- HTML output format is not yet implemented

## License

UNLICENSED (proprietary)
