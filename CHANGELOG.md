# Change Log

All notable changes to the "saropa-log-capture" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## Unreleased

### Added (Iteration B — Pinning, Exclusions, Copy)

- Pin/unpin log entries: press `P` to pin the center line, pinned lines appear in a sticky section above the scroll area
- Exclusion filter engine: hide lines matching string or `/regex/` patterns without removing from data
- `exclusions` setting for persistent exclusion patterns (string or regex)
- Exclusion toggle button and hidden line counter in viewer footer
- Multi-format copy: Shift+click to select lines, Ctrl+C for plain text, Ctrl+Shift+C for markdown
- Selection highlighting with VS Code theme colors
- Exclusion matcher module with unit tests

### Added (Iteration A — Keyword Watch)

- Keyword watcher: configurable patterns (string or `/regex/`) matched against every log line
- Watch hit counters in viewer footer as colored chips (red for error/exception, yellow for warning)
- Watch hit counts in status bar alongside line counter
- Flash animation on watch chips when new hits detected
- View badge on sidebar icon showing unread watch hit count (resets on view focus)
- `watchPatterns` setting with per-pattern alert type (flash, badge, none)
- Marketplace icon (PNG) registered in package.json

### Added (Stage 3 — The Navigator)

- Click-to-source navigation: click `file.ts:42` patterns in log output to open source at that line
- Ctrl+Click opens source in split editor (`ViewColumn.Beside`)
- Source link regex module with whitelist of ~25 file extensions (ts, js, dart, py, go, etc.)
- Search bar (Ctrl+F): regex matching with `<mark>` highlighting, F3/Shift+F3 navigation
- Category filter dropdown in viewer footer (multi-select, filters by DAP output category)
- Keyboard shortcuts: Space (pause), W (wrap), Home/End (scroll), Escape (close search)
- Session history tree view in sidebar with metadata (adapter type, file size, date)
- File system watcher auto-refreshes session history on file changes
- HTML export: converts .log files to styled HTML with ANSI colors and collapsible context header
- Export as HTML command in session history context menu
- Delete session command with confirmation dialog
- Marketplace metadata: gallery banner, expanded categories and keywords

### Added (Stage 2 — The Window)

- ANSI-to-HTML color rendering in sidebar viewer (bold, dim, italic, underline, 16 fg/bg colors)
- Virtual scrolling for 100K+ lines without lag (data-model-driven, renders only visible rows)
- `M` keyboard shortcut in viewer to insert timestamp-only marker
- Active log filename displayed in viewer footer
- `localResourceRoots: []` CSP hardening on webview
- Webview-to-extension messaging for viewer keyboard commands

### Changed

- Log filenames now use date-first format (`YYYYMMDD_HH-MM_name.log`) for chronological sorting
- Disable noisy extensions in F5 launch config to reduce Debug Console clutter
- Viewer DOM cap increased from 5,000 to 50,000 lines (backed by JS array, not DOM nodes)
- Split viewer-content.ts into viewer-styles.ts + viewer-script.ts for maintainability
- README rewritten with full feature list, keyboard shortcuts table, and updated limitations

## 0.1.0

### Added

- Set license to UNLICENSED (proprietary)
- Core capture pipeline: DAP output interception via `tracker.ts`
- Session lifecycle and immediate-append file writer (`log-session.ts`)
- Deduplication engine for rapid identical lines (`deduplication.ts`)
- Configuration reader with defaults (`config.ts`)
- File retention with `maxLogFiles` enforcement (`file-retention.ts`)
- Gitignore checker — prompts to add `/reports/` on first run (`gitignore-checker.ts`)
- ANSI escape code preservation in `.log` files
- Context header with launch.json config, VS Code version, OS, adapter type
- Status bar with live line counter, recording indicator, pause/resume toggle
- 8 commands: start, stop, pause, open, openFolder, clear, delete, insertMarker
- Environment variable redaction support in context headers
- Sidebar log viewer with real-time streaming, auto-scroll, and pause-on-scroll
- Insert Marker command for visual separators in the log stream
- ANSI stripping for clean viewer display (raw codes preserved in .log files)
- Pause/resume indicator in sidebar viewer footer with visual styling
- Collapsible stack traces in sidebar viewer (auto-detects `at` frames)

## 0.0.1

- Initial scaffold via yo code
