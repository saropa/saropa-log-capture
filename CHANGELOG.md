# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed
- **Panel Location:** Moved the Log Viewer and Session History from the sidebar (Activity Bar) to the bottom panel, next to Output and Terminal tabs. Provides more horizontal space for log lines.

### Added
- **Full Debug Console Capture:** Added `saropaLogCapture.captureAll` setting and UI toggle ("App Only: OFF") to capture all Debug Console output, bypassing category and exclusion filters. When enabled, all system, framework, and app logs are captured. Toggle via the viewer or settings.
- **Line Decorations:** Added `saropaLogCapture.showDecorations` setting and footer "Deco" toggle to prefix each viewer line with a colored severity dot (🟢/🟠/🔴), sequential counter (#N), and wall-clock timestamp. A gear button (⚙) opens a settings popover to toggle individual parts and enable "Whole line" coloring mode (subtle background tint by severity). Viewer-only — log files are not modified.
- **Level Filter:** Added All/Errors/Warn+ segmented buttons in the footer to filter log lines by severity. Configurable context lines (`saropaLogCapture.filterContextLines`) shown dimmed around matches.
- **Inline Peek:** Double-click any log line to expand an inline peek showing surrounding context lines. Press Escape to dismiss. Configurable range via `saropaLogCapture.contextViewLines`.
- **Expanded Highlight Rules:** Default highlight patterns now include Fatal, TODO/FIXME, Hack/Workaround, Deprecated, Info, and Debug in addition to Error, Warning, and Success.
- **Historical Log Viewing:** Opening a session from Session History now loads it into the panel viewer instead of as a raw text file.
- **Build & Install script** (`scripts/build_and_install.py`): Compiles the extension, packages a `.vsix` file, automatically saves a build report to `reports/`, and offers interactive CLI installation. Prompts for optional steps; CLI flags (`--skip-compile`, `--auto-install`, `--no-logo`) available for automation.
- **Environment setup improvements** (`scripts/init_environment.py`): Added colored terminal output, Saropa ASCII art logo, per-step timing with bar chart summary, and automatic setup report to `reports/`. Optional steps prompt interactively; CLI flags (`--skip-compile`, `--skip-extensions`, `--skip-global-npm`, `--no-logo`) available for automation.

## [0.1.0] - 2026-01-28

First public release on the VS Code Marketplace.

### Core Features

- **Auto-capture**: Debug Console output saved to `.log` files automatically when debugging starts
- **Live sidebar viewer**: Real-time log streaming with virtual scrolling (100K+ lines)
- **ANSI color support**: Full color rendering in viewer, raw codes preserved in files
- **Click-to-source**: Click `file.ts:42` patterns to jump to source; Ctrl+Click for split editor
- **Collapsible stack traces**: Auto-detected and grouped; press `A` for app-only mode
- **Search**: Ctrl+F with regex support, F3/Shift+F3 navigation, match highlighting
- **Session history**: Browse past sessions with metadata (adapter type, size, date)

### Session Management

- **Rename sessions**: Right-click to set display names (also renames file on disk)
- **Tag sessions**: Add `#tags` for organization; auto-tags with `~prefix` from content patterns
- **Annotations**: Press `N` to annotate lines; persisted and exported
- **Pin lines**: Press `P` to pin important lines to sticky header
- **Deep links**: Share `vscode://` URLs that open specific sessions and lines

### Export Options

- **HTML export**: Static or Interactive with search, filters, and theme toggle
- **CSV export**: Structured columns (timestamp, category, level, line_number, message)
- **JSON export**: Array of log entry objects with full metadata
- **JSONL export**: Line-delimited JSON for streaming tools

### Filtering & Search

- **Category filter**: Filter by DAP category (stdout, stderr, console)
- **Exclusion patterns**: Hide lines matching string or `/regex/` patterns
- **Keyword watch**: Track patterns with live counters, flash alerts, and badges
- **Filter presets**: Save and apply filter combinations; built-in presets included
- **Cross-session search**: Search all log files via Quick Pick

### Visual Features

- **Highlight rules**: Color lines matching patterns (configurable colors, labels)
- **Elapsed time**: Show `+Nms` between lines; slow gaps highlighted
- **JSON rendering**: Embedded JSON shown as collapsible pretty-printed elements
- **Inline decorations**: Show log indicators next to source lines in editor

### Advanced Features

- **Session comparison**: Side-by-side diff view with color highlighting
- **Session templates**: Save/load project-specific configurations (Flutter, Node.js, Python built-in)
- **Auto file split**: Split by line count, size, keywords, duration, or silence
- **Flood protection**: Suppress rapid repeated messages (>100/sec)
- **Deduplication**: Identical rapid lines grouped as `Message (x54)`

### Infrastructure

- Context header with launch.json config, VS Code version, OS, adapter type
- Status bar with live line counter and watch hit counts
- File retention with configurable `maxLogFiles`
- Gitignore safety check on first run
- First-run walkthrough for new users

## [0.0.1]

- Initial scaffold via `yo code`
