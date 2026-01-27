# Change Log

All notable changes to the "saropa-log-capture" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## Unreleased

### Changed

- Log filenames now use date-first format (`YYYYMMDD_HH-MM_name.log`) for chronological sorting
- Disable noisy extensions in F5 launch config to reduce Debug Console clutter

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
