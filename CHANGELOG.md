# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
