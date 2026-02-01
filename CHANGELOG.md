# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

---
## [0.1.11]  - Current

### Fixed
- **Source preview popup not dismissible:** The hover preview over stack trace source links had no close affordance — it only auto-hid when the mouse moved away. Added a close button (×), Escape key, and click-outside dismissal.
- **Decoration counter showing `#&nb` instead of numbers:** `padStart(5, '&nbsp;')` used the 6-character literal HTML entity as a JavaScript padding string, causing truncated gibberish. Now pads with Unicode non-breaking space (`\u00a0`).
- **Inconsistent datetime in log filenames:** Filename format now includes seconds (`YYYYMMDD_HH-MM-SS_name.log`) for uniqueness and consistency. Rename and metadata parsing handle both old (`HH-MM`) and new (`HH-MM-SS`) formats.
- **Session info expander always blank:** The collapsible session header never displayed data because (1) header lines were stripped before reaching the webview and (2) the JavaScript hook referenced a non-existent `handleSetContent` function. Redesigned as a compact prefix line at the top of the log content (showing adapter, project, config, date) with an ℹ️ icon button in the header bar that opens a modal with full session metadata. Now works for both live sessions and historical file loads.
- **Viewer flickering and inability to scroll:** The scrollbar minimap wrapped `renderViewport` with `setTimeout(updateMinimap, 50)` on every call, including scroll-only renders. This created a feedback loop (scroll → render → 50ms minimap DOM rebuild → layout recalc → scroll) that caused constant flickering and unwanted auto-scrolling to bottom via the ResizeObserver. Fixed by only scheduling minimap rebuilds on data changes (`force=true`), debouncing rapid updates, and using cached heights for the scroll handler.
- **Scrollbar minimap O(n²) performance:** Minimap marker placement re-iterated all preceding lines for each marker to compute cumulative height. Replaced with a single O(n) pre-computed array. The scroll-time viewport indicator now uses cached total height (O(1)) instead of recalculating on every frame.

### Added
- **Copy File Path:** Right-click a session in Session History and select "Copy File Path" to copy the full filesystem path to clipboard.

### Refactored
- **Split oversized commands module:** Extracted session comparison commands from `commands.ts` (305 lines) into `commands-comparison.ts` to comply with the 300-line file limit.

### Changed
- **Decorations enabled by default:** The `saropaLogCapture.showDecorations` setting now defaults to `true` so new users see line prefixes (severity dot, counter, timestamp) out of the box.
- **Emoji toggle buttons:** Replaced text-based footer toggles (`Deco: OFF`, `Audio: OFF`, `Minimap: ON`) with emoji buttons (🎨, 🔔/🔕, 🗺️). Active state shown at full opacity; inactive at 35% opacity. Tooltips explain current state and action.
- **Clearer options panel label:** Renamed "Show decorations" to "Line prefix (🟢 #N T00:00:00)" so users can see exactly what the toggle controls.
- **Search is now a slide-out panel:** Converted the inline search bar to a toggleable slide-out panel from the right edge, matching the options panel pattern. Added a 🔍 toolbar button in the footer. Keyboard shortcuts (Ctrl+F, F3, Escape) still work. Search and options panels are mutually exclusive — opening one closes the other.
- **Version inline with filename:** Version string now sits immediately after the filename in the header bar instead of floating as a separate right-aligned element.

---
## [0.1.10]  - 2026-02-01

### Fixed
- **Viewer blank due to regex SyntaxError:** An invalid character class range in `isSeparatorLine` (`[=\\-+...]` produced range `\` to `+` with start > end) caused a SyntaxError that killed the entire webview script block. Fixed by moving `-` to end of character class.
- **Double-escaped regexes in viewer scripts:** `extractContext` in data helpers and decoration-stripping regexes in the export script used `\\\\s`/`\\\\d` which produced literal `\s`/`\d` instead of whitespace/digit classes. Fixed to single-escaped.
- **Export join produced literal `\n`:** `lines.join('\\\\n')` in export script produced literal backslash-n instead of newline. Fixed to `\\n`.
- **Session file loading race condition:** Loading a historical log file while webview was re-resolving (tab switch) could silently fail. Added generation counter and pending-load retry.

### Added
- **Script fault isolation:** Split the single `<script>` block (33 concatenated scripts) into separate `<script>` blocks per feature. A SyntaxError in one feature no longer kills the entire viewer.
- **Global error handler:** New first-loaded script catches uncaught errors, shows a visible red banner in the webview, and reports errors to the extension host via `console.warn`.
- **Build-time syntax validation test:** New test extracts all `<script>` blocks from the generated HTML and validates each with `new Function()`, catching SyntaxErrors before release.

---
## [0.1.9]  - 2026-02-01

- Development build

---
## [0.1.8] - 2026-02-01

### Fixed
- **Options panel button unresponsive:** The slide-out options panel used `right: -25%` to hide off-screen, but with `min-width: 280px` it remained partially visible in narrow sidebar viewports (z-index 250), silently intercepting clicks on footer buttons including the options toggle. Changed to `right: -100%` with `pointer-events: none` when closed.
- **Duplicate error breakpoint elements:** `getErrorBreakpointHtml()` was called twice in the viewer HTML template, creating duplicate `error-badge` and `error-modal` elements with the same IDs. Removed the stray call outside the footer.
- **Missing `escapeHtml()` in webview:** The function was called by repeat notifications, edit modal, and session header scripts but was only defined in the TypeScript extension host (not injected into the webview). Added the function to the webview data helpers script.
- **Dead audio mute code:** Removed `audioMuted` variable, `toggleAudioMute()`, and `updateAudioMuteButton()` which referenced a nonexistent `audio-mute-toggle` element with no corresponding HTML or event wiring.
- **Split breadcrumb shows wrong part number:** `setSplitInfo(totalParts, totalParts)` passed `totalParts` for both arguments, so the breadcrumb always showed "Part N of N" after a split instead of the actual current part number. Now passes the correct `partNumber`.
- **Audio files never loaded (doubled path):** `initAudio()` appended `/audio/` to a URI that already pointed to the `audio/` directory, creating an invalid path like `audio/audio/swipe_low.mp3`. Removed the redundant segment.
- **Version string type assertion:** `as string ?? ''` made TypeScript treat the version as always a string, so the nullish fallback was unreachable. Replaced with `String(... ?? '')` for safe runtime conversion.

### Added
- **Version display in viewer header:** The extension version number (e.g., "v0.1.7") now appears in the log viewer header bar.

## [0.1.6] - 2026-01-31

<!-- cspell:ignore ECONNREFUSED -->
### Added
- **Smart Error Classification:** Automatically classifies error log lines into three categories: 🔥 CRITICAL (NullPointerException, AssertionError, FATAL, etc.), ⚡ TRANSIENT (TimeoutException, SocketException, ECONNREFUSED, etc.), and 🐛 BUG (TypeError, ReferenceError, SyntaxError, etc.). Visual badges appear inline before the log message. Two new settings: `saropaLogCapture.suppressTransientErrors` (default: false) hides expected transient errors via filtering, and `saropaLogCapture.breakOnCritical` (default: false) triggers VS Code notifications when critical errors appear. Helps quickly identify severe issues vs. expected network hiccups.

## [0.1.5] - 2026-01-31

### Added
- **Stack Trace Preview Mode:** Stack traces now show first 3 non-framework frames by default (collapsible preview mode) instead of completely collapsed. Click the header to cycle through: preview → fully expanded → fully collapsed → preview. Framework frames are filtered out in preview mode. Toggle indicator shows ▷ (preview), ▼ (expanded), or ▶ (collapsed).
- **Milliseconds Display:** Added "Show milliseconds" checkbox to decoration settings panel (⚙ gear button). When enabled, timestamps show `.000` milliseconds after the seconds (e.g., `T14:32:15.234`). Works with existing timestamp decoration toggle.
- **Audio Volume Control:** Expanded audio options panel with volume slider (0-100%, default 30%), rate limiting selector (none/0.5s/1s/2s/5s/10s), and preview sound buttons (🔴 Error / 🟠 Warning) to test settings. Volume and rate limiting apply immediately. Rate limiting prevents audio spam by enforcing minimum time between sounds of the same level.
- **Inline Tag Parsing:** Extended source tag filter to extract `[TagName]` patterns anywhere in log lines (not just at the start). Tags like `[API]`, `[Database]`, `[Auth]` are now automatically detected and added to the collapsible Sources panel for filtering. Works alongside existing Android logcat and bracket prefix patterns.
- **Session Info Header:** Collapsible session metadata block appears at the top of the viewer (below split breadcrumb) when loading log files. Shows project name, debug adapter type, configuration name, platform, VS Code version, and extension version. Parsed from the context header block in log files. Click to expand/collapse. Hidden for live sessions (only shows when loading files).
- **Real-Time Repeat Notifications:** Duplicate log lines now show immediate repeat notifications instead of being batched. Shows `"🔴 Repeated log #5 (Connection Refused...)"` with first 85 characters of message preview. Uses smart hash-based detection (`level::message`) instead of exact string matching. Repeat counter resets when a new unique message arrives. 3-second detection window (configurable).
- **Multi-Level Classification:** Added three new log levels with automatic detection and filtering:
  - **TODO Level** (⚪ White): Detects TODO, FIXME, HACK, XXX in logs for task tracking
  - **Debug/Trace Level** (🟤 Brown): Detects breadcrumb, trace, debug keywords for diagnostic logging
  - **Notice Level** (🟦 Blue Square): Detects notice, note, important for informational highlights
  - Each level has dedicated toggle button in footer, checkbox in options panel, color styling, and emoji indicator. All levels work with existing filter presets and context line display.
- **Inline Context Metadata:** Extracts and displays file path, function name, and line number from stack traces as inline breadcrumbs. Shows shortened file paths (last 2 segments) and function names in format `utils/auth.ts:42 » login()`. Toggle on/off via "Show inline context" checkbox in options panel. Automatically parses common stack trace formats (V8, Mozilla, etc.) and displays context for both stack headers and frames.
- **Per-Level Export/Save:** Export filtered logs to file with preset templates or custom level selection. Templates include "Errors Only", "Warnings + Errors", "Production Ready", "Full Debug", and "Performance Analysis". Export options allow including/excluding timestamps, decorations, and ANSI codes. Preview shows line count before export. Accessible via 💾 button in footer.
- **Layout Improvements:** Four new customization features for better readability:
  - **Font Size Adjustment:** Slider control (10-20px) in options panel to adjust log font size independently of VS Code editor settings
  - **Line Height Adjustment:** Slider control (1.0-2.5) in options panel to adjust vertical spacing between log lines
  - **Severity Bar Mode:** Colored left borders (3px) for each log level instead of/alongside emoji dots. Creates continuous vertical bars for consecutive same-level lines. Toggle via decoration settings panel
  - **Visual Spacing (Breathing Room):** Heuristic spacing adds 8px margins before/after key transitions: level changes to errors/warnings, before/after markers. Helps separate logical sections without adding actual newlines. Toggle in options panel

### Refactored
- **File Size Compliance:** Split 6 oversized UI modules (630-391 lines each) into 17 smaller modules (all under 300 lines). Improved code organization by extracting logical sections: modal styles, decoration styles, search/UI components, helper functions, and HTML/script templates. No functional changes — behavior, API surface, and build output are identical.

## [0.1.4] - 2026-01-31

### Added
- **Error Breakpoints:** Configurable visual and audio alerts when errors appear in logs. Features: flash red border around viewer, play alert sound, increment error counter badge (clickable to clear), and optional modal popup. Toggle on/off via footer button. Detects errors via `stderr` category or error keywords (`error`, `exception`, `failed`, `fatal`, `panic`, `critical`). Only triggers once per batch to avoid spam.
- **Search Enhancements:** Added case sensitivity toggle (Aa/AA) and whole word match toggle (\b) to search bar. Both buttons show bold text when active and work in combination with existing regex mode toggle.
- **Live Statistics Counters:** Real-time running totals displayed in footer showing counts for errors (🔴), warnings (🟠), performance issues (🟣), and framework/info logs (🟢). Updates incrementally as lines arrive and resets on session reset.
- **Enhanced Performance Detection:** Extended performance pattern matching to detect Choreographer frame skips (`skipped N frames`), `choreographer`, `doing too much work`, `gc pause`, `anr`, and `application not responding` patterns for better Android/Flutter debugging.
- **Edit Line Modal:** Right-click any log line and select "Edit Line" to open a modal with editable textarea. Changes are saved back to the log file with proper validation. Shows warning badge when debug session is active to prevent concurrent write conflicts. Reloads viewer after successful edit.
- **Scrollbar Minimap:** Visual overview overlay on the scrollbar (8px wide, right edge) showing search match locations (yellow marks), current match (bright orange), error locations (red marks), warning locations (orange marks), and viewport position indicator. Updates automatically when searching or scrolling. Toggle on/off via footer button.
- **Copy All to Clipboard:** Added Ctrl+Shift+A keyboard shortcut and `copyAllToClipboard()` function to copy all visible log lines to clipboard in plain text format.
- **Copy to Search:** Added "Copy to Search" action to right-click context menu. Opens search bar and populates it with the clicked line's text, automatically running the search.
- **ASCII Art Detection:** Enhanced separator line detection to recognize box-drawing characters (─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬) in addition to standard ASCII patterns (===, ---, +---). Lowered threshold to 60% for better detection. Detected separators are styled in yellow with reduced opacity.
- **Minimap Toggle Button:** Added "Minimap: ON/OFF" button to footer for controlling scrollbar minimap visibility.

### Fixed
- **Session History Empty Viewer:** Fixed issue where selecting log files from session history panel resulted in empty viewer. Added retry loop to wait for webview initialization before loading file content (up to 1 second wait).
- **Level Filter Visual Feedback:** Enhanced inactive level filter buttons with three visual indicators: reduced opacity (0.25), grayscale filter (0.8), and strike-through text. Makes toggle state immediately obvious.
- **Session History Sorting:** Fixed incorrect sorting of mixed-format filenames by sorting on file modification time instead of date strings. Ensures newest sessions always appear first regardless of filename format.
- **Double-Click Viewport Jumping:** Fixed random viewport jumping when double-clicking lines to open context peek. Replaced problematic `scrollIntoView` with proper scroll calculation that positions the peeked line consistently at the top of the view.

### Changed
- **Search Bar Width:** Increased minimum width of search input to 200px to prevent it from becoming too narrow when multiple toggle buttons are present.
- **Session State Tracking:** Extension now tracks debug session active/inactive state and currently displayed file URI. Viewer receives `sessionState` messages to enable intelligent warnings and safe file editing.

## [0.1.3] - 2026-01-31

### Refactored
- **File Size Compliance:** Split 12 TypeScript files that exceeded the 300-line limit into 29 files (12 original + 17 new extraction files). All source files now comply with the project's hard limit. No functional changes — behavior, API surface, and build output are identical.

### Changed
- **Enhanced Color Palette:** Updated ANSI color rendering to use VS Code's vibrant terminal color palette, matching the Debug Console appearance. Standard and bright colors (red, green, yellow, blue, cyan, magenta) are now significantly more vibrant and easier to distinguish.
- **Automatic Log Level Coloring:** Log lines are now automatically color-coded by severity — errors appear in red, warnings in yellow, and info lines use the default foreground color for better visual scanning.
- **Panel Location:** Moved the Log Viewer and Session History from the sidebar (Activity Bar) to the bottom panel, next to Output and Terminal tabs. Provides more horizontal space for log lines.

### Added
- **Source Tag Filter:** Collapsible "Sources" panel above the log lines that auto-discovers source tags from Android logcat prefixes (e.g. `D/FlutterJNI`, `I/flutter`) and bracket prefixes (e.g. `[log]`). Each tag appears as a chip with a line count; click to toggle visibility. Includes All/None bulk actions. Tags are grouped by name only (ignoring level prefix), sorted by frequency. Panel stays hidden until tags are detected. Composes with all existing filters (category, exclusion, level).
- **Full Debug Console Capture:** Added `saropaLogCapture.captureAll` setting and UI toggle ("App Only: OFF") to capture all Debug Console output, bypassing category and exclusion filters. When enabled, all system, framework, and app logs are captured. Toggle via the viewer or settings.
- **Line Decorations:** Added `saropaLogCapture.showDecorations` setting and footer "Deco" toggle to prefix each viewer line with a colored severity dot (🟢/🟠/🔴), sequential counter (#N), and wall-clock timestamp. A gear button (⚙) opens a settings popover to toggle individual parts and enable "Whole line" coloring mode (subtle background tint by severity). Viewer-only — log files are not modified.
- **Level Filter:** Added All/Errors/Warn+ segmented buttons in the footer to filter log lines by severity. Configurable context lines (`saropaLogCapture.filterContextLines`) shown dimmed around matches.
- **Inline Peek:** Double-click any log line to expand an inline peek showing surrounding context lines. Press Escape to dismiss. Configurable range via `saropaLogCapture.contextViewLines`.
- **Expanded Highlight Rules:** Default highlight patterns now include Fatal, TODO/FIXME, Hack/Workaround, Deprecated, Info, and Debug in addition to Error, Warning, and Success.
- **Historical Log Viewing:** Opening a session from Session History now loads it into the panel viewer instead of as a raw text file.
- **Developer Toolkit** (`scripts/dev.py`): One-click script replacing `init_environment.py` and `build_and_install.py`. Runs the full pipeline automatically: prerequisites, deps, compile, quality checks, package .vsix. Interactive prompts only at the end (install via CLI, open report). Features Saropa ASCII logo, colored output, per-step timing bar chart, and automatic reports to `reports/`.

### Fixed
- **ANSI Color Rendering:** Updated Content Security Policy to allow inline styles (`'unsafe-inline'`), fixing blocked ANSI color rendering in the log viewer and session comparison views. Colors from debug output now display correctly.
- **Viewer Controls:** Fixed all non-working buttons and controls (Excl ON, App Only, All/Errors/Warn+, Preset dropdown, category filter, Deco toggle, settings panel) by removing inline event handlers that were blocked by Content Security Policy. Converted all `onclick`/`onchange` handlers to proper `addEventListener` calls.
- **Historical Log Viewing:** Skips context header block, parses `[category]` prefixes for proper stderr coloring, detects markers, and sends lines in async batches to avoid UI freezing. Footer shows "Viewing:" instead of "Recording:" for historical files.
- **Filter Coordination:** Category, exclusion, and level filters now respect each other's state via shared `recalcHeights()`. Previously, applying one filter could override another's visibility decisions.
- **Inline Peek on Double-Click:** Fixed DOM index mapping when lines have gap markers or annotations — `querySelectorAll` now counts only line-level elements.
- **Inline Peek on Clear:** Peek is now closed when the viewer is cleared, preventing stale content.
- **Context Line Settings:** Setting `filterContextLines` or `contextViewLines` to 0 is now honored (previously treated as default due to falsy-zero).
- **Success Highlight:** Pattern now matches "successfully" and "successful" in addition to "success", "passed", and "succeeded".
- **Config Timing:** Highlight rules and presets are cached and sent when the webview initializes, so historical file views get proper coloring even without a prior debug session.

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
