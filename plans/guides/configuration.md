# Configuration

All settings are prefixed with `saropaLogCapture.`

## Capture Settings

| Setting              | Default                         | Description                                                                                                                                      |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`            | `true`                          | Enable/disable automatic log capture. Also toggled in Options → Capture.                                                                         |
| `categories`         | `["console","stdout","stderr"]` | DAP output categories to capture                                                                                                                 |
| `maxLines`           | `100000`                        | Maximum lines per log file                                                                                                                       |
| `includeTimestamp`   | `true`                          | Prefix each line with a timestamp                                                                                                                |
| `includeSourceLocation` | `false`                      | Include source file and line number in log lines                                                                                                 |
| `includeElapsedTime` | `false`                         | Show elapsed time since previous line in log files                                                                                               |
| `format`             | `"plaintext"`                   | Output format (plaintext only for now)                                                                                                           |
| `captureAll`         | `false`                         | Capture all Debug Console output, bypassing filters                                                                                              |

## Viewer & Display Settings

| Setting              | Default          | Description                                                                                                          |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `viewerMaxLines`     | `0`              | Max lines shown in viewer (0 = 50,000). Cannot exceed `maxLines`. Reduce for large files.                            |
| `showElapsedTime`    | `false`          | Show elapsed time between consecutive log lines                                                                      |
| `slowGapThreshold`   | `1000`           | Elapsed time threshold (ms) for highlighting slow gaps                                                               |
| `contextViewLines`   | `10`             | Context lines shown in inline peek on double-click                                                                   |
| `highlightRules`     | *(3 built-in)*   | Pattern-based line coloring rules                                                                                    |

## Filter & Search Settings

| Setting              | Default                                                              | Description                                                                                                          |
| -------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `exclusions`         | `[]`                                                                 | Patterns to exclude from viewer (string or `/regex/`)                                                                |
| `viewerAlwaysShowSearchMatchOptions` | `false`                                            | Always show case / whole word / regex toggles in the session-bar search; when off, they appear only while the field is focused or has text |
| `filterContextLines` | `3`                                                                  | Context lines shown around level-filter matches                                                                      |
| `watchPatterns`      | `[{keyword:"error",...},{keyword:"exception",...},{keyword:"warning",...}]` | Keywords to watch with alert type                                                                              |
| `filterPresets`      | `[]`                                                                 | Saved filter presets for quick application                                                                           |

## Alert & Diagnostics Settings

| Setting                | Default        | Description                                                                                                                                                                        |
| ---------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suppressTransientErrors` | `false`     | Hide expected transient errors (timeout, socket, etc.)                                                                                                                             |
| `breakOnCritical`      | `false`        | Show notification when critical errors appear                                                                                                                                      |
| `levelDetection`       | `"strict"`     | Error detection mode: `strict` (label positions) or `loose` (keywords anywhere)                                                                                                    |
| `stderrTreatAsError`   | `false`        | When true, force all DAP `stderr` lines to error/red; when false, classify stderr by content like other categories                                                                 |
| `severityKeywords`     | *(see below)*  | User-editable keyword lists per severity level (error, warning, performance, todo, debug, notice). Each keyword is matched as a case-insensitive whole word. Structural patterns (logcat prefixes, `Error:`, `[error]`, Dart `_TypeError`) are built-in |

## File Splitting Rules

| Setting                         | Default      | Description                                |
| ------------------------------- | ------------ | ------------------------------------------ |
| `splitRules.maxLines`           | `0`          | Split file after N lines (0 = disabled)    |
| `splitRules.maxSizeKB`          | `0`          | Split file after N KB (0 = disabled)       |
| `splitRules.keywords`           | `[]`         | Split when keyword or `/regex/` matched    |
| `splitRules.maxDurationMinutes` | `0`          | Split after N minutes (0 = disabled)       |
| `splitRules.silenceMinutes`     | `0`          | Split after N minutes of silence (0 = disabled) |

## Advanced Settings

| Setting              | Default          | Description                                                                                                                                      |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `logDirectory`       | `"reports"`      | Where to save log files (relative to workspace root)                                                                                             |
| `autoOpen`           | `false`          | Open log file when debug session ends                                                                                                            |
| `maxLogFiles`        | `10`             | Max log files to retain (0 = unlimited)                                                                                                          |
| `organizeFolders`    | `true`           | Move flat log files into `yyyymmdd/` date subfolders on session start                                                                            |
| `includeSubfolders`  | `true`           | Include log files from date subfolders in session history, search, and analysis                                                                   |
| `gitignoreCheck`     | `true`           | Offer to add log directory to .gitignore on first run                                                                                            |
| `redactEnvVars`      | `[]`             | Env var patterns to redact from headers. **Tip:** Add `API_KEY`, `SECRET_*`, `*_TOKEN` to keep secrets out of session context headers.            |
| `autoTagRules`       | `[]`             | Rules for auto-tagging sessions by content patterns                                                                                              |
| `tailPatterns`       | `["**/*.log"]`   | Glob patterns for **Open Tailed File** (workspace-relative)                                                                                      |
| `projectIndex.enabled` | `true`         | Enable project-wide indexing of docs and session metadata (`.saropa/index/`) for faster analysis and doc matching                                 |
| `verboseDap`         | `false`          | Log all raw DAP protocol messages to the log file                                                                                                |
| `diagnosticCapture`  | `false`          | Log capture pipeline events (session/buffer/write) to the Saropa Log Capture output channel; use when log files are empty to debug                |
