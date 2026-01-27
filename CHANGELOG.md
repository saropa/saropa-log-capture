# Change Log

All notable changes to the "saropa-log-capture" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

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
- Extension wiring: 7 commands (start, stop, pause, open, openFolder, clear, delete)
- Environment variable redaction support in context headers

### Changed

- Updated plan document with Stage 1 implementation status

## 0.0.1

- Initial release