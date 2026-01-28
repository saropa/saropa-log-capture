# Change Log

All notable changes to the "saropa-log-capture" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## Unreleased

### Added (Iteration F — Interactive HTML Export)

- Interactive HTML export: self-contained HTML file with embedded JavaScript
- Search in exported HTML: Ctrl+F to open search, F3/Shift+F3 for next/previous match
- Category filter dropdown: filter log lines by DAP category (stdout, stderr, console)
- Collapsible stack traces: click header to expand/collapse stack frames
- Collapsible JSON: inline JSON objects/arrays expand to pretty-printed view
- Theme toggle: switch between dark and light themes in exported HTML
- Context menu option: "Export as HTML (Interactive)" in session history
- Standalone file: works offline, no external dependencies

### Added (Iteration G — Search + Analytics)

- Cross-session search: `Saropa Log Capture: Search Log Files` command (Ctrl+Shift+P) with Quick Pick UI
- Search across all log files with regex support, case sensitivity option, and debounced input
- JSON log detection: embedded JSON objects/arrays are detected and rendered as collapsible elements
- Click expand arrow (▶) to view pretty-printed JSON, click again to collapse
- End-of-session summary: notification shows stats when debug session ends (duration, lines, size, watch hits)
- Error rate alert engine: monitors error frequency and can alert when rate exceeds threshold (utility module)
- Search index manager: tracks file metadata for optimized search (utility module)

### Added (Iteration E — Auto File Split)

- Automatic file splitting based on configurable rules (lines, size, keywords, duration, silence)
- `splitRules` setting with `maxLines`, `maxSizeKB`, `keywords`, `maxDurationMinutes`, `silenceMinutes`
- Manual split command: `Saropa Log Capture: Split Log File Now`
- Split file navigation breadcrumb in viewer (Part 1 of N)
- Split groups in session history tree (collapsible parent with child parts)
- Continuation headers in split files with split reason

### Added (Deferred Tasks)

- File rename on session rename: renaming a session also renames the .log file on disk
- Stack frame hover preview: hover over source links to see code context (3 lines before/after)
- Source preview tooltip with VS Code theme integration

### Added

- Automatic flood protection: detects and suppresses rapid repeated messages (>100/sec) to prevent lockups
- Early exclusion filtering: exclusion patterns now applied at capture time, not just viewer display
- Pre-compiled exclusion rules for better performance on high-volume output

### Changed

- License changed from UNLICENSED to MIT for public distribution

### Added (Iteration D — Timing & Stack Intelligence)

- LineData interface refactor: replaced 7 positional parameters with a single typed object
- Elapsed time column: `+Nms` prefix on each log line when enabled via `showElapsedTime` setting
- Slow gap highlighting: dashed separator when gap between lines exceeds `slowGapThreshold` (default 1000ms)
- Duration extraction module: parses timing values from log text (e.g., `500ms`, `2.5s`, `duration=3000`)
- Stack frame classifier: detects framework vs app code across Dart, Node, Python, Go, Java, .NET
- App-only stack trace mode: press `A` to hide framework frames in expanded stack groups
- Stack trace deduplication: identical traces collapsed with `(xN)` count badge on the header
- `showElapsedTime` and `slowGapThreshold` settings

### Added (Iteration C — Session Management)

- Session metadata stored as sidecar `.meta.json` files alongside `.log` files
- Rename session: right-click → Rename Session to set a display name
- Tag session: right-click → Tag Session to add comma-separated tags (shown as `#tag` in tree)
- Log line annotations: press `N` to annotate the center line, muted italic text shown below
- Annotations persist in `.meta.json` and are included in HTML export
- `renameSession` and `tagSession` commands with context menu entries

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
