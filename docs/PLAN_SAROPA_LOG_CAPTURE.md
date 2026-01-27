# Saropa Log Capture — VS Code Extension

## The Problem

VS Code's Debug Console is ephemeral. When a debug session ends, the output is gone. There is no built-in way to save it to a file. This has been [requested](https://github.com/microsoft/vscode/issues/77849) and [closed as out-of-scope](https://github.com/microsoft/vscode/issues/140859). No existing extension fills this gap.

## The Solution

A VS Code extension that automatically captures Debug Console output to persistent log files on the developer machine, with a rich real-time log viewer built into the sidebar. Works with **any** debug adapter (Dart, Node, Python, C++, Go, etc.).

## Name Candidates

**Confirmed name: Saropa Log Capture**. Other candidates considered:

| Name | Search Keywords Hit | Pros | Cons |
|---|---|---|---|
| **Saropa Log Capture** | log, capture | Clear verb, describes the action | "Log" could mean logging framework |
| **Saropa Debug Capture** | debug, capture | Directly says "debug output" | Slightly less searchable than "log" |
| **Saropa Console Capture** | console, capture | "Console" matches VS Code terminology | People search "debug" more than "console" |
| **Saropa Debug Recorder** | debug, recorder | Implies persistence/recording | "Recorder" is unusual for dev tools |
| **Saropa Debug Logger** | debug, logger | "Logger" is a highly searched term | Could be confused with logging libraries |
| **Saropa Session Logger** | session, logger | Emphasizes session-based capture | Less obvious what "session" means |
| **Saropa Debug Tape** | debug, tape | Memorable metaphor (tape recorder) | Abstract, not immediately clear |
| **Saropa Debug Archive** | debug, archive | Implies persistence and history | "Archive" sounds heavy/enterprise |
| **Saropa Output Capture** | output, capture | Generic, covers all output types | Less specific than "debug" |
| **Saropa Debug Vault** | debug, vault | Implies safe storage, memorable | "Vault" sounds like security tool |
| **Saropa Debug Scribe** | debug, scribe | Literary, implies faithful recording | Too clever, not discoverable |
| **Saropa Console Persist** | console, persist | Exactly describes the problem solved | "Persist" is technical jargon |

**Discoverability analysis**: Users searching the VS Code marketplace would type things like:
- "save debug console output"
- "debug log file"
- "persist debug output"
- "capture debug console"
- "debug session log"

The name should contain at least one of: `debug`, `log`, `console`, `capture`, `save`, `persist`.

**Shortlist (top 4):**

1. **Saropa Debug Capture** — "Debug" is what users search for. "Capture" accurately describes recording existing output (vs "Logger" which implies generating output). Strongest marketplace SEO.
2. **Saropa Log Capture** — Current working title. "Log" is the most common term for this kind of output. Simple, clear.
3. **Saropa Console Capture** — Matches VS Code's "Debug Console" terminology exactly. The most technically precise name.
4. **Saropa Debug Logger** — "Logger" is the most searched term in this category. Risk: could be confused with logging frameworks (Winston, Pino, etc.) that generate logs.

**Note**: VS Code marketplace allows a display name + subtitle. The subtitle can carry keywords the name doesn't. Example:
- **Name**: Saropa Debug Capture
- **Subtitle**: Save VS Code Debug Console output to persistent log files

## Competitive Landscape

| Extension | Installs | What It Does | Gap |
|---|---|---|---|
| Console Ninja | 1.3M | Inline console.log for JS only | No file persistence, JS-only, 3-star reviews |
| Turbo Console Log | 2M | Inserts console.log statements | Doesn't capture output at all |
| Log File Highlighter | 518K | Syntax highlighting for .log files | Requires existing files, no capture |
| Log Viewer | 201K | Watches existing log files | No capture from Debug Console |
| Output Colorizer | - | Colors output panel text | View-only, no persistence |
| **This extension** | - | **Captures + persists + views debug output** | **Nothing like it exists** |

## Project Setup

- **Repo**: New standalone repo `saropa-log-capture`
- **Language**: TypeScript
- **Scaffold**: `yo code` (Yeoman VS Code extension generator)
- **UI Toolkit**: `@vscode/webview-ui-toolkit` (native-looking VS Code components)
- **Dependencies**: `ansi-to-html` (ANSI escape codes to HTML spans)

---

## Design Principles

Derived from studying what makes legendary dev tools (Wireshark, Chrome DevTools, Charles Proxy, Postman, Sentry, Datadog, GitLens, Prettier) successful:

1. **Zero Friction** — Works immediately on install. No config file to create, no project setup, no onboarding wizard. Install → start debugging → logs appear. The extension activates lazily via `onDebugAdapterProtocolTracker` and auto-captures with sane defaults. Log files are stored in a root-level `/reports/` directory (not hidden in `.vscode/`) — easily accessible via the OS file explorer. On first run, the extension checks for `.gitignore` presence and offers to add `/reports/` to prevent accidental version control commits.

2. **One Problem, Perfectly** — This is NOT a logging framework, NOT a log analysis platform, NOT a monitoring tool. It does ONE thing: captures VS Code Debug Console output to persistent files with a good viewer. Resist scope creep into territory that belongs to Sentry, Datadog, or ELK.

3. **Progressive Disclosure** — Simple surface, power underneath. A new user sees: sidebar with scrolling log, status bar with line count, log file on disk. A power user discovers: regex search, keyword watch, custom highlight rules, session comparison, file split rules. Never overwhelm on first use.

4. **Multiple Surfaces, One Data Stream** — The same captured log data appears in: the sidebar viewer (real-time), the status bar (summary), the file on disk (persistence), the session history (archive), notifications (alerts). Each surface serves a different moment in the developer's workflow.

5. **Never Lose Data** — The trust moat. Every line captured is written to disk immediately (append, not batch-write-on-close). If VS Code crashes, the extension crashes, or the debug session dies unexpectedly, the log file is intact up to the last line. This reliability is what makes developers depend on the tool.

6. **Respect the Host** — This is a VS Code extension, not a standalone app. Use native VS Code patterns: TreeView for history, WebviewView for the viewer, status bar for counters, `--vscode-*` CSS variables for theming, `@vscode/webview-ui-toolkit` for controls. It should feel like a built-in feature, not a bolted-on tool.

7. **Power User Escape Hatch** — Every automated behavior has a manual override. Auto-scroll? Scroll up to pause. Auto-capture? Pause command. Auto-naming? Rename command. Default keywords? Add custom ones. Default file format? Switch to HTML. Default split rules? Configure every parameter.

8. **Performance is a Feature** — Virtual scrolling for 100K+ lines. Batched UI updates (200ms). Streaming file writes (no buffering entire session in memory). The extension must NEVER slow down the debug session or make VS Code laggy.

---

## Architecture

### Data Flow

```
Debug Adapter
  --> DAP OutputEvent (type: 'event', event: 'output')
  --> DebugAdapterTracker.onDidSendMessage()
  --> Deduplication (debounce & group identical rapid lines)
  --> LogSession (in-memory buffer + file writer)
  --> File on disk (.log or .html) in /reports/ directory
  --> WebviewView (real-time sidebar viewer via postMessage)
  --> Status Bar (live counter)
```

**Deduplication ("Debounce & Group"):** If identical log lines arrive in rapid succession (e.g., inside a tight loop), the extension does NOT write every line. Instead, it groups them and updates the last line with a counter: `Error: Connection Refused (x54)`. This prevents file bloat and UI freezing during infinite loops or error storms.

**ANSI Retention:** Raw ANSI escape codes are preserved in the `.log` file on disk. Developers often open log files in external terminal tools (`less`, `cat`, or external log viewers) where ANSI codes render correctly. The internal VS Code viewer parses ANSI codes for display, but the disk file remains "raw."

### Key Files

```
saropa-log-capture/
  src/
    extension.ts            # Activation, wiring, command registration
    tracker.ts              # DebugAdapterTracker + Factory
    log-session.ts          # Session state, in-memory buffer, file writer
    deduplication.ts        # Debounce & group identical rapid log lines
    ansi-formatter.ts       # ANSI-to-HTML conversion for viewer (raw ANSI preserved in .log files)
    config.ts               # Settings reader with defaults
    keyword-watcher.ts      # Watch list matching, counters, alert triggers
    file-splitter.ts        # Auto file split rule engine + seamless rotation
    file-retention.ts       # Max log file rotation (delete oldest when limit exceeded)
    gitignore-checker.ts    # Check/offer to add /reports/ to .gitignore
    ui/
      status-bar.ts         # Status bar item (live counter, watch hits, flash)
      log-viewer-provider.ts  # WebviewViewProvider for sidebar panel
      session-history.ts    # TreeDataProvider for past session list
  media/
    log-viewer.html         # Webview HTML template
    log-viewer.css          # Webview styles (uses --vscode-* CSS variables)
    log-viewer.js           # Webview client-side logic (scroll, search, filter)
  package.json
  tsconfig.json
```

---

## UI Design

### 1. Sidebar: Live Log Viewer (WebviewView)

A rich, real-time log viewer inside the VS Code sidebar using the Webview API. Automatically matches the user's theme via `--vscode-*` CSS variables (light, dark, high-contrast — all free).

**Layout:**
```
+------------------------------------------+
| [Search... ] [Level v] [Wrap] [Pause]    |  <-- toolbar
|------------------------------------------|
| 🟢 #1  T14:32:05 » App started          |  <-- log entries
| 🟢 #2  T14:32:05 » Loading contacts...  |     color-coded by level
| 🟠 #3  T14:32:06 » Slow query: 1.2s     |     emojis preserved
| 🔴 #4  T14:32:07 » NullPointerException |
|   > at ContactIO.load (contact_io:42)    |  <-- collapsible stack trace
|   > at HomeTab.build (home_tab:118)      |
| 🟢 #5  T14:32:08 » Retry succeeded      |
|                                          |
|             [auto-scrolling]             |  <-- sticky bottom indicator
+------------------------------------------+
| Recording: 5 lines | debug-2026-01-27.log |  <-- footer status
+------------------------------------------+
```

**Core Features:**
- **Auto-scroll with pause-on-scroll**: Scrolling up pauses auto-scroll. Reaching the bottom resumes it. A "Jump to bottom" button appears when paused.
- **Collapsible stack traces**: Multi-line errors collapse to first line with a expand chevron. Click to expand.
- **Color-coded severity**: ANSI colors converted to themed CSS. Emoji indicators preserved.
- **Virtual scrolling**: Only renders visible rows. Handles 100K+ lines without lag.
- **Search**: Regex-capable search bar. Highlights all matches. Next/Previous navigation with F3/Shift+F3.
- **Level filter dropdown**: Show/hide by level (Info, Warning, Error, etc.) or by DAP category (console, stdout, stderr).
- **Word wrap toggle**: Toggle between wrapped and horizontal-scroll modes.
- **Pause/Resume**: Pause live capture without stopping the session. Visual "PAUSED" indicator.

**Theme Integration (zero custom theme code):**
```css
body {
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
}
.log-line:hover {
  background: var(--vscode-list-hoverBackground);
}
.log-line.selected {
  background: var(--vscode-editor-lineHighlightBackground);
}
.toolbar {
  background: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-panel-border);
}
```

**Controls use `@vscode/webview-ui-toolkit`** for native VS Code look:
- `<vscode-text-field>` for search
- `<vscode-dropdown>` for level filter
- `<vscode-button>` for pause/clear/export

**Real-time streaming architecture:**
- Extension batches log entries every 200ms and sends via `postMessage`
- Webview appends to virtual scroll container
- `setState()` preserves scroll position, filters, search term across tab switches
- No `retainContextWhenHidden` needed (state restored from `getState()`)

**Security (CSP):**
- Content Security Policy meta tag with `${webview.cspSource}`
- All JS/CSS in external files (no inline scripts)
- `localResourceRoots` restricted to `media/` directory

### 2. Sidebar: Session History (TreeView)

A native VS Code tree view below the log viewer showing past sessions.

```
DEBUG LOG HISTORY
  > 2026-01-27 14:32 - contacts (42 lines, 3 errors)
  > 2026-01-27 11:05 - contacts (1,204 lines, 0 errors)
  > 2026-01-26 16:20 - node-api (89 lines, 12 errors)
```

- Each item shows: date, project name, line count, error count
- Inline icons: Open in Editor, Open in Browser (HTML), Delete
- Click opens the file in VS Code editor
- Sorted newest-first

### 3. Keyword Watch

Monitor the log stream for configurable keywords and alert the developer when they appear.

**Watch List (configurable in settings):**
- Built-in defaults: `error`, `exception`, `fatal`, `warning`
- User adds custom keywords: e.g. `timeout`, `null`, `OOM`, a specific class name
- Each keyword can be a string or regex

**Live Counters (in viewer footer + status bar):**
```
+------------------------------------------+
| Recording: 247 lines | 3 errors | 1 warn | debug-2026-01-27.log |
+------------------------------------------+
```

Status bar also shows watch hits:
```
$(debug) 247 lines | $(error) 3 | $(warning) 1
```

Counters update in real time. Clicking a counter in the footer filters the viewer to just those matches.

**Getting the User's Attention:**

When a watched keyword is hit:
1. **Status bar flash** — background briefly pulses `--vscode-statusBarItem-errorBackground` (red) for errors, `--vscode-statusBarItem-warningBackground` (yellow) for warnings
2. **Badge on sidebar icon** — VS Code view badge API shows unread count (like unread notifications)
3. **VS Code notification** (optional, off by default) — `vscode.window.showWarningMessage('3 new errors detected in debug session')` with "Show" action button that jumps to the first unread match
4. **Sound** (optional, off by default) — VS Code's `audioCues` API if available, or a system beep
5. **Viewer highlight** — new watch hits get a colored left-border gutter indicator (red/yellow/custom) so they stand out when scrolling

**Watch Panel in Viewer Toolbar:**
```
+------------------------------------------+
| [Search...] [Level v] [Wrap] [Pause]     |
| Watch: [error: 3] [warning: 1] [OOM: 0] |  <-- clickable keyword chips
+------------------------------------------+
```

- Each chip shows keyword + count
- Click a chip to filter the viewer to just that keyword's matches
- Click again to clear the filter
- Right-click a chip to remove the keyword from the watch list
- "+" button to add a new keyword on the fly

### 4. Click-to-Source

Click any log line to jump directly to the source file and line that generated it.

**How it works (dual strategy — regex-first, DAP-augmented):**
- **Primary: Aggressive regex parsing.** The extension scans ALL log lines for file path patterns (e.g., `/src/app/main.ts:40:5`, `contact_io.dart:42`, `file.py:120`) to generate clickable links. This works regardless of debug adapter support and catches stack traces, error messages, and framework output.
- **Secondary: DAP metadata.** DAP `output` events include optional `source` (file path) and `line` fields. When available, these augment the regex-parsed results with structured source metadata.
- **Rationale:** Many debug adapters do NOT provide structured source metadata in their output events. Relying solely on DAP `source` fields would leave most log lines un-navigable. Regex parsing ensures broad coverage across all adapters and log formats.
- Log lines with source info show a subtle link icon on hover
- Click opens the file at that line in the editor via `vscode.window.showTextDocument()` + `TextEditor.revealRange()`
- Ctrl+Click opens in a split editor (side by side with the log viewer)

**Fallback for logs without source info:**
- Lines with no source data are still clickable — they copy the line text to clipboard
- Stack trace lines always have parseable `file:line` — those are always navigable

### 5. Pinned / Favorite Entries

Pin important log lines to a sticky section at the top of the viewer.

```
+------------------------------------------+
| PINNED (2)                          [x]  |
| 📌 🔴 #4  T14:32:07 » NullPointer...    |
| 📌 🟠 #87 T14:33:12 » Timeout on...     |
|------------------------------------------|
| [Search... ] [Level v] [Wrap] [Pause]    |
|------------------------------------------|
| 🟢 #88 T14:33:13 » Retry succeeded      |
| ...                                      |
```

- Right-click a log line → "Pin this entry"
- Pinned entries stick to the top in a collapsible section
- Pins persist for the session (saved in webview state)
- Click a pin to scroll to its original position in the log
- Click the `x` on a pin to unpin it
- Pinned entries also exported at the top of the file output (plain text and HTML) as a summary

### 6. Session Tagging / Naming

Name or tag debug sessions for easy identification in history.

- When a debug session starts, the extension auto-names it: `contacts - 2026-01-27 14:32`
- User can rename it at any time via:
  - Command: `saropaLogCapture.renameSession`
  - Inline rename in the session history tree (F2)
  - Click the session name in the viewer footer
- Tags: User can add tags like `before-refactor`, `bug-123`, `after-fix`
- Tags appear in session history and in the log file header
- Search/filter session history by tags
- Log file is renamed to match: `before-refactor_2026-01-27_14-32.log`

### 7. File Retention / Rotation (MVP)

Automatic cleanup to prevent disk clutter from accumulated log files.

- **Setting:** `maxLogFiles` (default: 10). Configures the maximum number of log files kept in `/reports/`.
- When a new log file is created, the extension checks the file count in `/reports/`.
- If the count exceeds `maxLogFiles`, the oldest file(s) are automatically deleted.
- Deletion is by file modification time — oldest first.
- Split session parts count as individual files toward the limit.
- Users can set `maxLogFiles` to `0` to disable retention (keep all files).
- A notification is shown the first time files are auto-deleted: "Saropa Log Capture: Removed 2 old log file(s) (maxLogFiles: 10)."

### 8. Context Header (MVP)

Every log file starts with a session context dump — a log file is useless without knowing the conditions it ran under.

**First lines of every log file:**
```
=== SAROPA LOG CAPTURE — SESSION START ===
Date:           2026-01-27 14:32:05
Project:        contacts
Debug Adapter:  dart
launch.json:    Flutter (debug mode)
  program:      lib/main.dart
  args:         []
  env:          { "FLUTTER_TEST": "true" }
VS Code:        1.96.0
Extension:      saropa-log-capture v1.2.0
OS:             Windows 11 (10.0.26100)
==========================================
```

- Dumps the `launch.json` configuration (program, arguments, environment variables) used to start the debug session.
- Includes VS Code version, extension version, OS, debug adapter type.
- Context header is always the first block — before any captured output.
- In HTML format, the header is rendered as a styled metadata block.
- Sensitive env vars can be redacted via a configurable exclusion list: `saropaLogCapture.redactEnvVars: ["API_KEY", "SECRET_*"]`.

### 9. User Markers (MVP)

Insert visual separators into the log stream to mark different test attempts or phases within a single debug session.

- **Command:** `saropaLogCapture.insertMarker` — injects a separator line into the log stream.
- **Output format:** `--- MARKER: 10:45 AM ---` (or custom text if provided).
- Markers are written to the log file AND displayed in the viewer with a distinctive visual style (full-width horizontal rule with timestamp).
- Accessible via:
  - Command palette: "Saropa Log Capture: Insert Marker"
  - Keyboard shortcut: `M` in the webview viewer
  - Toolbar button in the viewer
- Optional custom text: command prompts for text, or uses timestamp-only as default.
- Markers appear in the viewer with a colored background (using `--vscode-editorGutter-addedBackground`) to stand out from regular log lines.
- Use case: Run a test, insert marker, change code, hot-restart, run test again — the marker visually separates the two attempts in the log.

### 10. Multi-Session Side-by-Side

Compare two debug sessions in a split view.

- Right-click a session in history → "Compare with current session" or "Compare with..."
- Opens a `WebviewPanel` (editor tab, not sidebar) with two scrollable log panels side by side
- Synchronized scrolling (optional toggle) — scroll one, the other follows by timestamp proximity
- Color diff: lines unique to session A highlighted left, unique to session B highlighted right
- Shared lines (identical output) shown in neutral color
- Useful for: before/after a code change, reproducing vs non-reproducing runs, regression hunting

### 11. Status Bar

```
$(debug) 247 lines | $(error) 3 | $(warning) 1
```

- Right-aligned, only visible during active debug session
- Shows live line count + watch keyword hit counts
- Click toggles pause/resume
- Flashes on new watch hits (error = red flash, warning = yellow flash)
- Changes to `$(debug-pause) Paused (247 lines)` when paused

### 12. Auto File Split Rules

Automatically split log output into multiple files based on configurable rules. Prevents massive monolithic log files, enables logical separation, and keeps file sizes manageable.

**Split Triggers (any combination, first one hit triggers the split):**
- **Max file size** — split when file exceeds a threshold (e.g., 10MB)
- **Max lines** — split after N lines (e.g., 50,000)
- **Keyword trigger** — split when a specific pattern appears in the output (string or regex). Examples: `"Session started"`, `"=== HOT RESTART ==="`, `"BUILD SUCCEEDED"`, any custom pattern
- **Time interval** — split every N minutes of debug session time
- **Silence gap** — split after N seconds of no output (natural break point)
- **Combined rules** — multiple triggers active simultaneously, independently evaluated

**Split Behavior:**
- Files named with incrementing suffix: `contacts_2026-01-27_14-32_001.log`, `_002.log`, `_003.log`
- Each split file includes a header: part number, split reason, continuation reference, session metadata
- Seamless — zero gap in capture during split (new file opened before old one closed)
- If keyword split is configured, the triggering line becomes the FIRST line of the new file (not the last line of the old file)

**Session History Integration:**
```
DEBUG LOG HISTORY
  v 2026-01-27 14:32 - contacts (3 parts, 2,847 lines, 5 errors)
    > Part 1: lines 1-1000 (startup)
    > Part 2: lines 1001-2000 (split: "HOT RESTART")
    > Part 3: lines 2001-2847 (split: max lines)
```

- Session history shows the parent session with expandable child files
- Click parent to open combined view (all parts concatenated in viewer)
- Click a child to open just that part
- Delete parent deletes all parts

**Viewer Integration:**
- When viewing a split session, a breadcrumb bar shows: `Part 1 of 3 | [<] [>] | Split at: "HOT RESTART"`
- Navigate between parts with Previous/Next buttons or keyboard arrows
- Search operates across ALL parts of a session (not just the current file)
- Virtual scrolling treats all parts as one continuous log

**Settings:**
```jsonc
"saropaLogCapture.fileSplit": {
  "enabled": false,                    // off by default (single file is simplest)
  "maxFileSize": "10MB",              // null = no size limit
  "maxLines": 50000,                  // null = no line limit
  "keywords": [],                     // strings or /regex/ patterns
  "timeInterval": null,               // minutes, null = disabled
  "silenceGap": null                  // seconds of no output, null = disabled
}
```

### 13. Log Line Annotations

Add freeform text notes to any log line — like code review comments but on log output.

- Right-click a log line → "Add Note"
- Note appears below the log line in a muted/indented style
- Notes persist with the session (saved in session metadata JSON alongside the .log file)
- Notes exported with the log file (plain text: `  // NOTE: this is the crash we're investigating` / HTML: styled callout)
- Useful for: collaborative debugging ("I think this is the root cause"), bug investigation notes, explaining context for a shared log

```
🔴 #4  T14:32:07 » NullPointerException
  > at ContactIO.load (contact_io.dart:42)
  📝 "This started after the migration to Isar v4 — check schema change" — craig, 14:35
```

### 14. Structured JSON Log Parsing

Detect and parse JSON log lines (common in Node.js, Go, structured logging frameworks).

- Auto-detect lines that are valid JSON objects
- Show collapsed: `{ "level": "error", "msg": "Connection failed", ... }` with expand arrow
- Expanded view: syntax-highlighted, indented JSON with collapsible nested objects
- Filter by JSON field values: e.g., "Show only lines where `level` = `error`"
- JSON field extraction: configurable fields shown as columns (timestamp, level, message, source)
- Works alongside non-JSON lines — mixed output is common

### 15. Cross-Session Search

Search across ALL past sessions, not just the current one.

- Command: `saropaLogCapture.searchAll`
- Opens a VS Code Quick Pick with search input
- Results grouped by session, showing: session name, date, matching line with context
- Click a result → opens that session in the viewer at the matching line
- Use case: "When did this error first appear?" / "Has this warning happened before?"
- Indexes session files on disk (lazy — indexed on first search, cached after)

### 16. Exclusion Filters

Permanently hide noisy log lines that clutter the output.

- Right-click a log line → "Always Hide Lines Like This"
- Exclusion rules: string match, regex, or by DAP category
- Managed in settings: `saropaLogCapture.exclusions: ["/^flutter: .*repainting/", "Observatory listening"]`
- Excluded lines still captured to file (never lose data) — just hidden from the viewer
- Toggle exclusions on/off globally with a toolbar button
- Counter shows: "247 lines (18 hidden)"
- Useful for: framework noise, repetitive status messages, platform spam

### 17. Copy as Formatted

Copy log selections in multiple formats for different destinations.

- Select one or more log lines → right-click → "Copy As..."
  - **Plain text** — raw text, no formatting
  - **Markdown** — fenced code block with language hint, ready for GitHub issues/PRs
  - **HTML** — colored, styled, paste in email or rich text editor
  - **Bug report template** — pre-filled template with session info, error details, stack trace, environment
- Single-key shortcut: `Ctrl+C` copies plain, `Ctrl+Shift+C` copies as markdown
- The bug report template includes: extension version, VS Code version, debug adapter type, OS, session duration, error count

### 18. Error Rate Alerts

Go beyond keyword occurrence — detect error RATE patterns and alert on anomalies.

- Alert when error count exceeds N in a sliding window (e.g., >10 errors per minute)
- Alert when error rate increases suddenly (spike detection — 3x baseline rate)
- Visual indicator in the timeline sparkline (Phase 10) — red zones for error bursts
- Status bar shows rate: `$(error) 3/min` alongside total count
- Configurable thresholds in settings
- Useful for: detecting infinite error loops, API failure cascades, performance degradation storms

### 19. Quick Actions from Log Lines

Right-click context menu with powerful actions beyond copy and pin.

- **Search codebase** — search workspace for the text of this log line or the class/function name
- **Open source** — if source info available, open the file (same as click-to-source)
- **Create GitHub issue** — pre-fill a new issue with the error text, stack trace, and session metadata (uses `gh` CLI or GitHub API)
- **Search previous sessions** — find this exact text in past sessions (uses cross-session search)
- **Add to watch list** — add a keyword from this line to the watch list
- **Exclude** — add this line's pattern to exclusion filters

### 20. Stack Trace Intelligence

Not just collapsible stack traces — smart stack traces.

- **App-only mode**: Filter out framework frames (Flutter internals, Dart SDK, package code). Show only YOUR code. Toggle: "Show all frames" / "Show app code only"
- **Frame linking**: Every frame in the stack trace is a clickable link → opens the file at that line
- **Inline preview**: Hover over a frame → shows 3-5 lines of source code around that line in a tooltip (like VS Code's peek)
- **Copy stack trace** — right-click → "Copy Stack Trace" extracts just the trace (not surrounding log text)
- **Deduplication**: If the same stack trace appears 50 times, show it once with a count badge: `NullPointerException (×50)` — expand to see all timestamps

### 21. Timing Markers

Auto-detect timing information and visualize gaps between log entries.

- **Elapsed time column**: Optional column showing time since previous log line: `+0ms`, `+12ms`, `+1.2s`, `+5.0s`
- **Slow gap highlighting**: If elapsed time exceeds a threshold (configurable, default 1s), the gap is visually highlighted with a colored separator bar:
```
🟢 #42 T14:32:05 » Query started
── 3.2s gap ──────────────────────────── (highlighted yellow)
🟠 #43 T14:32:08 » Query completed (slow)
```
- **Duration extraction**: Auto-detect log lines that mention durations (e.g., "took 1.2s", "elapsed: 500ms", "duration=3000") and tag them as performance-related
- **Session duration in footer**: `Duration: 4m 32s | Avg gap: 45ms | Longest gap: 3.2s`
- **Threshold configurable**: `saropaLogCapture.slowGapThreshold: 1000` (milliseconds)

### 22. Session Import/Export

Full session portability — not just .log or .html files, but complete sessions with metadata.

- **Export as .slc file** (Saropa Log Capture session bundle) — a ZIP containing:
  - The log file(s) (including split parts)
  - Session metadata JSON (name, tags, timestamps, line count, error count, watch hits, pinned entries, annotations)
  - Split metadata (part info, split reasons)
- **Import .slc file** — drag-and-drop into VS Code or command. Appears in session history as an imported session
- **Share session** — the .slc file is the unit of sharing. Email it, attach to a Jira ticket, drop in Slack
- Use case: "Here's my debug session — import it and you'll see the same thing I see, with my annotations and pins"

### 23. Additional Export Formats

Beyond .log, .html, and .slc:

- **CSV** — `timestamp, category, level, line_number, message` columns. Opens in Excel/Google Sheets for data analysis
- **JSON** — structured array of log entry objects. For programmatic processing, feeding into other tools
- **JSONL** — line-delimited JSON. For streaming processing tools, log aggregation pipelines

### 24. Auto-Tag Rules

Automatically tag sessions based on content patterns — no manual tagging needed.

- Define rules in settings:
```jsonc
"saropaLogCapture.autoTagRules": [
  { "pattern": "MIGRATION", "tag": "migration" },
  { "pattern": "/hot.?restart/i", "tag": "hot-restart" },
  { "pattern": "Exception", "tag": "has-errors" },
  { "pattern": "BUILD SUCCEEDED", "tag": "build-ok" }
]
```
- Rules evaluated against all log lines during capture
- Tags added automatically to session metadata
- Auto-tags shown with a different style (e.g., italic or lighter color) to distinguish from manual tags
- Session history filterable by auto-tags

### 25. Session Templates

Save project-specific configurations as reusable templates.

- A template saves: watch keywords, exclusion filters, filter presets, auto-tag rules, file split rules, highlight rules
- Templates scoped to workspace (saved in `.vscode/saropaLogCapture/templates/`)
- Quick-switch between templates: command palette or dropdown in viewer toolbar
- Built-in starter templates:
  - **Flutter** — watches: `Exception`, `Error`, `FlutterError`; excludes: `flutter: Repainting`, `Observatory listening`
  - **Node.js** — JSON parsing enabled; watches: `ERR!`, `FATAL`, `unhandled`
  - **Python** — watches: `Traceback`, `ERROR`, `WARNING`; stack trace pattern: Python-style
- Users can create custom templates and share them (export as JSON file)

### 26. First-Run Walkthrough

Use VS Code's Walkthrough API to guide new users through the extension.

- Appears in VS Code's "Get Started" welcome tab after install
- Steps:
  1. "Start a debug session" — explains auto-capture
  2. "Find your log file" — shows where files are saved
  3. "Use the sidebar viewer" — introduces the viewer panel
  4. "Search and filter" — shows search, level filter, word wrap
  5. "Watch for keywords" — explains keyword watching
  6. "Customize your setup" — links to settings
- Each step has a "Try it" button that triggers the relevant action
- Non-intrusive — only shows once, accessible later via command palette
- Follows VS Code's standard walkthrough pattern (used by Python, Docker, GitHub extensions)

---

## File Output

### Plain Text (.log) — Default

```
=== SAROPA LOG CAPTURE — SESSION START ===
Date:           2026-01-27 14:32:05
Project:        contacts
Debug Adapter:  dart
launch.json:    Flutter (debug mode)
  program:      lib/main.dart
==========================================
[14:32:05.123] [console] 🟢 #1 » App started
[14:32:05.456] [console] 🟢 #2 » Loading contacts...
[14:32:06.789] [console] 🟠 #3 » Slow query: 1.2s
[14:32:07.012] [stderr]  🔴 #4 » NullPointerException
  at ContactIO.load (contact_io.dart:42)
  at HomeTab.build (home_tab.dart:118)
```

- **ANSI escape codes preserved** — raw codes remain in the `.log` file so external terminal tools (`less`, `cat`, log viewers) render colors correctly. The VS Code viewer parses ANSI codes for display internally.
- Context header with `launch.json` config is the first block in every file
- Timestamp + DAP category prefix added to each line
- Emoji indicators preserved (they're plain Unicode)
- Deduplicated rapid lines shown as: `Error: Connection Refused (x54)`
- Opens in any terminal or text editor

### HTML (.html) — Option

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { background: #1e1e1e; color: #ccc; margin: 0; padding: 16px; }
  pre { font-family: 'Cascadia Code', monospace; font-size: 13px; line-height: 1.5; }
  .ts { color: #888; }
  .cat { color: #666; }
</style>
</head><body><pre>
<span class="ts">[14:32:05.123]</span> <span class="cat">[console]</span> <span style="color:#00ff00">🟢 #1 » App started</span>
<span class="ts">[14:32:05.456]</span> <span class="cat">[console]</span> <span style="color:#00ff00">🟢 #2 » Loading contacts...</span>
<span class="ts">[14:32:06.789]</span> <span class="cat">[console]</span> <span style="color:#ffff00">🟠 #3 » Slow query: 1.2s</span>
<span class="ts">[14:32:07.012]</span> <span class="cat">[stderr]</span>  <span style="color:#ff0000">🔴 #4 » NullPointerException
  at ContactIO.load (contact_io.dart:42)
  at HomeTab.build (home_tab.dart:118)</span>
</pre></body></html>
```

- ANSI codes converted to `<span style="color:...">` via `ansi-to-html`
- Dark background, monospace font
- Opens in any browser with full color
- Shareable — email it, paste in a bug report

---

## Extension Settings

Settings grouped by category. All prefixed with `saropaLogCapture.`

### Capture Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Enable/disable log capture globally |
| `categories` | string[] | `["console","stdout","stderr"]` | Which DAP output categories to capture |
| `maxLines` | number | `100000` | Max lines per session (oldest lines dropped when exceeded) |
| `includeTimestamp` | boolean | `true` | Prefix each line with a timestamp |

### Output Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `format` | enum | `"plaintext"` | Output format: `"plaintext"` or `"html"` |
| `logDirectory` | string | `reports` | Where to save log files (relative to workspace root). Uses `/reports/` — visible in file explorer, not hidden in `.vscode/` |
| `autoOpen` | boolean | `false` | Automatically open the log file when debug session ends |
| `maxLogFiles` | number | `10` | Maximum number of log files to retain. Oldest deleted when exceeded. `0` = unlimited |
| `gitignoreCheck` | boolean | `true` | On first run, check if `/reports/` is in `.gitignore` and offer to add it |
| `redactEnvVars` | string[] | `[]` | Env var name patterns to redact from context header (e.g., `"API_KEY"`, `"SECRET_*"`) |

### Viewer Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `batchInterval` | number | `200` | Milliseconds between webview UI updates (lower = smoother, higher = less CPU) |
| `clickToSource` | boolean | `true` | Enable click-to-source navigation from log lines |
| `showElapsedTime` | boolean | `false` | Show elapsed time column between log entries |
| `slowGapThreshold` | number | `1000` | Highlight time gaps exceeding N milliseconds |
| `stackTrace.appOnly` | boolean | `false` | Filter out framework frames from stack traces by default |
| `jsonParsing` | boolean | `false` | Auto-detect and render JSON log lines as collapsible objects |
| `exclusions` | string[] | `[]` | Patterns to permanently hide from viewer (strings or `/regex/`) |

### Keyword Watch Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `watchKeywords` | object[] | `[{"keyword":"error","alert":"flash"}, {"keyword":"warning","alert":"flash"}]` | Keywords to watch for, each with alert behavior |
| `watchNotify` | boolean | `false` | Show VS Code notification popup on watch hits |
| `watchSound` | boolean | `false` | Play a sound on watch hits |

### Error Rate Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `errorRate.threshold` | number\|null | `null` | Alert when errors exceed N per minute (null = disabled) |
| `errorRate.spikeMultiplier` | number | `3` | Alert when error rate exceeds Nx above baseline |

### File Split Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `fileSplit.enabled` | boolean | `false` | Enable automatic file splitting |
| `fileSplit.maxFileSize` | string\|null | `null` | Split when file exceeds size (e.g., `"10MB"`, `"500KB"`) |
| `fileSplit.maxLines` | number\|null | `null` | Split after N lines |
| `fileSplit.keywords` | string[] | `[]` | Split when pattern appears (strings or `/regex/` patterns) |
| `fileSplit.timeInterval` | number\|null | `null` | Split every N minutes |
| `fileSplit.silenceGap` | number\|null | `null` | Split after N seconds of no output |

### Session Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `autoTagRules` | object[] | `[]` | Auto-tag rules: `[{"pattern":"...", "tag":"..."}]` |
| `sessionTemplate` | string\|null | `null` | Active session template name (null = no template) |

## Commands

| Command | Icon | Description |
|---|---|---|
| `saropaLogCapture.start` | `$(play)` | Start capturing to a new log file |
| `saropaLogCapture.stop` | `$(debug-stop)` | Stop capturing and finalize the file |
| `saropaLogCapture.pause` | `$(debug-pause)` | Pause capture (resume with start) |
| `saropaLogCapture.open` | `$(go-to-file)` | Open the active log file in editor |
| `saropaLogCapture.openInBrowser` | `$(globe)` | Open HTML log in default browser |
| `saropaLogCapture.openFolder` | `$(folder-opened)` | Reveal log directory in file explorer |
| `saropaLogCapture.insertMarker` | `$(horizontal-rule)` | Insert a visual marker/separator into the log stream |
| `saropaLogCapture.clear` | `$(clear-all)` | Clear the current session's viewer |
| `saropaLogCapture.delete` | `$(trash)` | Delete a selected log file from history |
| `saropaLogCapture.addWatch` | `$(add)` | Add a keyword to the watch list |
| `saropaLogCapture.clearWatchCounts` | `$(clear-all)` | Reset all watch counters to zero |
| `saropaLogCapture.renameSession` | `$(edit)` | Rename the current or selected session |
| `saropaLogCapture.tagSession` | `$(tag)` | Add tags to a session |
| `saropaLogCapture.compareSession` | `$(diff)` | Compare two sessions side by side |
| `saropaLogCapture.splitNow` | `$(split-horizontal)` | Manually trigger a file split at current position |
| `saropaLogCapture.configureSplit` | `$(gear)` | Open file split rule configuration |
| `saropaLogCapture.addExclusion` | `$(eye-closed)` | Add exclusion rule to hide matching lines |
| `saropaLogCapture.toggleExclusions` | `$(eye)` | Toggle exclusion filters on/off |
| `saropaLogCapture.annotate` | `$(comment)` | Add a note to the selected log line |
| `saropaLogCapture.searchAll` | `$(search)` | Search across all past sessions |
| `saropaLogCapture.copyAsMarkdown` | `$(markdown)` | Copy selected lines as markdown code block |
| `saropaLogCapture.copyAsBugReport` | `$(bug)` | Copy selection as pre-filled bug report |

## Keyboard Shortcuts (in webview)

| Key | Action |
|---|---|
| `Ctrl+F` / `Cmd+F` | Focus search field |
| `F3` | Next search match |
| `Shift+F3` | Previous search match |
| `Escape` | Clear search / close filter |
| `Space` | Toggle pause/resume |
| `W` | Toggle word wrap |
| `End` | Jump to bottom (resume auto-scroll) |
| `Home` | Jump to top |
| `Ctrl+Shift+C` / `Cmd+Shift+C` | Copy selection as markdown |
| `M` | Insert marker at current position |
| `P` | Pin/unpin selected log line |
| `N` | Add annotation to selected log line |
| `E` | Toggle exclusion filters |
| `Ctrl+Shift+F` / `Cmd+Shift+F` | Search all past sessions |

---

## Feature Priority

Features ranked by usefulness — what makes a developer install it, keep it, and recommend it.

### Tier 1: Core Value (Without these, no reason to install)

These are the "install-or-don't" features. The extension lives or dies on these.

| # | Feature | Why It's Tier 1 |
|---|---|---|
| 1 | DAP output capture to file | The entire reason the extension exists |
| 2 | Auto-start on debug session | Zero friction — must work without any user action |
| 3 | Plain text .log output (ANSI preserved) | Universal, opens anywhere. Raw ANSI codes retained for external terminal tools |
| 4 | Spam protection (debounce & group) | Prevents file bloat and UI freezing during infinite loops — `Error (x54)` |
| 5 | `.gitignore` check for `/reports/` | Prevents accidental version control commits of log files |
| 6 | File retention / rotation (`maxLogFiles`) | Auto-cleanup prevents disk clutter — essential from day one |
| 7 | Context header (launch.json dump) | A log file is useless without knowing the session context it ran under |
| 8 | Basic sidebar viewer | Users need to SEE the log, not just know it's being saved |
| 9 | Auto-scroll with pause-on-scroll | Without this, the viewer is unusable for live output |
| 10 | Status bar line counter | Minimal confirmation that capture is working |
| 11 | User markers (insert separator) | Visually separate test attempts within a single debug session |

### Tier 2: Daily Driver (Makes it genuinely useful every single day)

These turn "nice to have" into "can't work without it."

| # | Feature | Why It's Tier 2 |
|---|---|---|
| 12 | Search in viewer (regex) | The #1 thing you do with any log is search it |
| 13 | Level/category filtering | Noise reduction — hide info, show only errors |
| 14 | Click-to-source navigation (regex + DAP) | Bridges log output to source code — regex parsing ensures broad adapter coverage |
| 15 | Collapsible stack traces | Stack traces dominate log output — must be collapsible |
| 16 | Session history (past sessions) | Without this, users can't find yesterday's logs |
| 17 | Keyword watch with counters | Real-time "how many errors so far?" at a glance |
| 18 | HTML output option | Shareable, colorful, paste in bug reports |

### Tier 3: Power Tool (Makes power users love it)

These are the features that earn 5-star reviews and word-of-mouth.

| # | Feature | Why It's Tier 3 |
|---|---|---|
| 19 | Virtual scrolling (100K+ lines) | Performance at scale — long debug sessions need this |
| 20 | Watch keyword alerts (flash, badge) | Proactive notification — don't stare at the log |
| 21 | Exclusion filters (hide noisy lines) | Noise reduction — filter out framework spam permanently |
| 22 | Pinned/favorite entries | Bookmark the important lines during investigation |
| 23 | Session tagging/naming | "before-refactor" vs "after-fix" — essential for comparison |
| 24 | Copy as formatted (markdown, HTML, bug report) | Copy-paste into GitHub issues, Slack, PRs without reformatting |
| 25 | Word wrap toggle | Preference — some logs have long lines |
| 26 | Auto file split rules | Prevent 500MB log files, logical separation |
| 27 | Saved filter presets | "Show me just SQL queries" as a one-click preset |
| 28 | Keyboard shortcuts | Power user speed — F3, Space to pause, W to wrap, M for markers |
| 29 | Log line annotations | Note-taking on log lines during investigation |
| 30 | Stack trace intelligence (app-only, dedup) | Smart stack traces — filter framework noise, count duplicates |
| 31 | Timing markers + slow gap highlighting | See where time is spent — instant performance visibility |

### Tier 4: Differentiators (Makes it famous)

These are the "wow" features that no competing tool has.

| # | Feature | Why It's Tier 4 |
|---|---|---|
| 32 | Session comparison (side-by-side) | Before/after debugging — nothing else does this |
| 33 | Interactive HTML export | Self-contained, shareable, searchable HTML file |
| 34 | Cross-session search | "When did this error first appear?" across all history |
| 35 | Session summary & analytics | End-of-session report: errors, throughput, top messages |
| 36 | Structured JSON log parsing | Node.js / Go structured logs with expandable JSON |
| 37 | Timeline sparkline | Visual log density over time — spot error bursts |
| 38 | Error rate alerts (spike detection) | Detect error storms — "10 errors/min, 3x baseline" |
| 39 | Custom regex highlight rules | Color-code patterns for visual scanning |
| 40 | Quick actions from log lines | Right-click → search codebase, create issue, add watch |
| 41 | Deep links (vscode:// URIs) | Paste a link in Slack → teammate opens exact log line |
| 42 | Session import/export (.slc bundles) | Share complete debug sessions with teammates |
| 43 | Auto-tag rules | Sessions auto-tagged based on content — zero manual effort |

### Tier 5: Ecosystem (Long-term growth)

Features for mature adoption and enterprise use.

| # | Feature | Why It's Tier 5 |
|---|---|---|
| 44 | Tail mode for workspace .log files | Extend beyond debug console to any log file |
| 45 | Quick filter bar (type-ahead) | VS Code-style quick open for log lines |
| 46 | Remote workspace / SSH support | Enterprise environments |
| 47 | Inline code decorations | Console Ninja approach — output next to source |
| 48 | External log service integration | Logz.io, Loki, Datadog export |
| 49 | Additional export formats (CSV, JSON, JSONL) | Data analysis in Excel, programmatic processing |
| 50 | Session templates (project-specific configs) | Flutter/Node/Python starter configs, save custom setups |
| 51 | First-run walkthrough (VS Code Walkthrough API) | Guided onboarding for new users |

---

## Implementation Roadmap

Three stability-focused stages, each delivering a complete, testable milestone. Each stage must be **fully stable** before advancing to the next. This replaces the previous all-at-once phased approach.

---

### Stage 1: "The Black Box" (Headless Capture)

**Focus:** Stability & Data Integrity. No UI other than a status bar indicator.

The extension silently captures all debug output to disk with maximum reliability. If this stage has bugs, nothing else matters.

| # | Task | Delivers |
|---|---|---|
| 1 | Scaffold project (`yo code`), `tsconfig.json`, npm setup | Project skeleton |
| 2 | `package.json` — activation events (`onDebugAdapterProtocolTracker`), settings, commands | Extension manifest |
| 3 | `config.ts` — settings reader with defaults (`logDirectory: "reports"`, `maxLogFiles: 10`) | Configuration |
| 4 | `tracker.ts` — `DebugAdapterTrackerFactory`, intercept DAP `output` events | Core capture |
| 5 | `deduplication.ts` — debounce & group identical rapid log lines (`Error (x54)`) | Spam protection |
| 6 | `log-session.ts` — session lifecycle, immediate-append file writer, context header generation | File persistence |
| 7 | Context header — dump `launch.json` config (program, args, env vars) as first lines of every log file | Session context |
| 8 | `file-retention.ts` — enforce `maxLogFiles` setting, delete oldest when limit exceeded | Disk cleanup |
| 9 | `gitignore-checker.ts` — check for `.gitignore` presence, offer to add `/reports/` on first run | Safety |
| 10 | ANSI preservation — write raw ANSI codes to `.log` files (no stripping) | External tool compat |
| 11 | `status-bar.ts` — live line counter, recording indicator, pause/resume toggle | Status bar |
| 12 | `extension.ts` — wire tracker + session + dedup + retention + status bar + commands | Activation |
| 13 | Test with Dart + Node.js + Python debug sessions | Cross-adapter validation |
| 14 | Package with `vsce package` | Distributable |

**Exit criteria for Stage 1:**
- Extension silently captures to `/reports/` for any debug adapter
- Context header present in every log file
- Deduplication handles tight-loop spam without file bloat
- File retention auto-cleans oldest files
- `.gitignore` check works on first run
- ANSI codes preserved in `.log` — verified with `less -R` and `cat`
- Status bar shows line count and recording indicator
- *No UI beyond status bar*

**After Stage 1**: Rock-solid data capture. Log files appear in `/reports/` with context headers, spam protection, and automatic cleanup. Zero user interaction required.

---

### Stage 2: "The Window" (Live View)

**Focus:** Visibility. Make the captured data viewable in real time.

| # | Task | Delivers |
|---|---|---|
| 15 | `ansi-formatter.ts` — ANSI-to-HTML conversion for viewer rendering | Viewer formatting |
| 16 | `log-viewer-provider.ts` — WebviewView with `<pre>` block, ANSI-to-HTML rendering | Sidebar viewer |
| 17 | Auto-scroll with pause-on-scroll, "Jump to bottom" button | Scroll behavior |
| 18 | `@vscode/webview-ui-toolkit` for native VS Code controls | Native UX |
| 19 | Content Security Policy headers + `localResourceRoots` | Security |
| 20 | Virtual scrolling (render only visible rows, handle 100K+ lines) | Performance |
| 21 | Collapsible stack traces (detect multi-line errors, expand/collapse) | Readability |
| 22 | `insertMarker` command — inject `--- MARKER: HH:MM AM ---` separator into stream | User markers |
| 23 | Marker visual styling (full-width rule, colored background, keyboard shortcut `M`) | Marker UX |
| 24 | Pause/resume capture command with "PAUSED" visual indicator | Capture control |
| 25 | Viewer footer: recording status, line count, active log filename | Viewer status |
| 26 | Test viewer with 100K+ line sessions, rapid output, and theme switching | Performance validation |

**Exit criteria for Stage 2:**
- Sidebar shows real-time log output with ANSI colors rendered
- Auto-scroll pauses when user scrolls up, resumes at bottom
- Virtual scrolling handles 100K+ lines without lag
- Stack traces collapse/expand correctly
- Markers inject and display with distinctive visual style
- Viewer adapts to light/dark/high-contrast themes
- *No search, no filtering, no history — just viewing*

**After Stage 2**: Developers can watch their debug output in real time with a performant, theme-aware viewer. Markers let them separate test attempts visually.

---

### Stage 3: "The Navigator" (Interaction)

**Focus:** Usability. Make the viewer interactive and navigable.

| # | Task | Delivers |
|---|---|---|
| 27 | Regex-first click-to-source — scan log lines for `file:line` patterns, generate clickable links | Source navigation |
| 28 | DAP `source` + `line` field augmentation for click-to-source | DAP metadata |
| 29 | Click log line → open source file at line in editor, Ctrl+Click → split editor | Navigation |
| 30 | Search with regex + match highlighting + F3/Shift+F3 navigation | Search |
| 31 | Level/category filter dropdown (Info, Warning, Error, stdout, stderr) | Filtering |
| 32 | Word wrap toggle | Preference |
| 33 | `session-history.ts` — TreeDataProvider for past sessions in `/reports/` | Session list |
| 34 | Session metadata (line count, error count, duration, project name) | Context |
| 35 | Open in Editor / Open in Browser (HTML) / Delete inline actions | Session actions |
| 36 | HTML output option (ANSI-to-HTML conversion, styled export, context header) | Shareable output |
| 37 | All core keyboard shortcuts in webview (F3, Space, W, M, Home, End) | Shortcuts |
| 38 | Marketplace publishing (icon, README, screenshots, changelog) | Distribution |

**Exit criteria for Stage 3:**
- Click-to-source works via regex parsing across all tested adapters (Dart, Node, Python)
- Search finds matches, highlights them, navigates with F3
- Level filter hides/shows by category
- Session history lists past sessions with metadata
- HTML export renders with colors and context header
- Keyboard shortcuts work in webview
- *Extension is marketplace-ready*

**After Stage 3**: Full MVP. Capture + View + Navigate. Ready for marketplace release.

---

### Post-MVP: Tier 3-5 Features

After the 3-stage MVP is stable and published, additional features are implemented in focused iterations. Each iteration should be independently releasable.

#### Iteration A: Keyword Watch (Tier 2-3)

| # | Task | Delivers |
|---|---|---|
| 39 | `keyword-watcher.ts` — match log lines against watch list (string + regex) | Watch engine |
| 40 | Watch counters in viewer footer (clickable to filter) | Live counters |
| 41 | Watch keyword chips in toolbar (add/remove on the fly, click to filter) | Chip UI |
| 42 | Status bar watch hit counts (`$(error) 3 \| $(warning) 1`) | Status bar |
| 43 | Status bar flash on new watch hits (red/yellow pulse via theme colors) | Attention |
| 44 | View badge API — unread watch hit count on sidebar icon | Badge |

#### Iteration B: Pinning + Exclusions + Copy (Tier 3)

| # | Task | Delivers |
|---|---|---|
| 45 | Pin/unpin log entries to sticky top section | Bookmarking |
| 46 | Pinned entries persist in webview state, export at top of file | Persistence |
| 47 | Exclusion filter engine — string, regex, category-based rules | Noise reduction |
| 48 | "Always Hide Lines Like This" right-click action | Quick exclude |
| 49 | Exclusion toggle button in toolbar + "N hidden" counter | Visibility |
| 50 | Copy as formatted — plain text, markdown, HTML, bug report template | Copy formats |
| 51 | Ctrl+Shift+C for markdown copy shortcut | Quick copy |

#### Iteration C: Session Management (Tier 3)

| # | Task | Delivers |
|---|---|---|
| 52 | Session renaming (command, inline F2, footer click) | Naming |
| 53 | Session tagging (add/remove tags, filter history by tag) | Tagging |
| 54 | Renamed sessions update the log filename on disk | File naming |
| 55 | Log line annotations — right-click "Add Note", persistent in session metadata | Notes |
| 56 | Annotation export (plain text + HTML output includes notes) | Note export |

#### Iteration D: Timing + Stack Intelligence (Tier 3)

| # | Task | Delivers |
|---|---|---|
| 57 | Elapsed time column — `+0ms`, `+12ms`, `+1.2s` between entries | Timing |
| 58 | Slow gap highlighting — visual separator bar when gap > threshold | Gap visibility |
| 59 | Duration extraction — auto-detect timing mentions in log text | Duration tags |
| 60 | Stack trace parser — framework vs app code per adapter (Dart, Node, Python, Go) | Smart traces |
| 61 | App-only mode toggle — filter framework frames | Noise reduction |
| 62 | Stack frame hover preview — 3-5 lines of source in tooltip | Peek |
| 63 | Stack trace deduplication — count badge: `NullPointerException (x50)` | Dedup |

#### Iteration E: Auto File Split (Tier 3)

| # | Task | Delivers |
|---|---|---|
| 64 | `file-splitter.ts` — rule engine (size, lines, keyword, time, silence) | Split engine |
| 65 | Seamless file rotation (new file before old closes, zero gap) | Reliability |
| 66 | Split file naming + headers (part number, reason, continuation ref) | Organization |
| 67 | Session history expandable parent/child for split sessions | Split history |
| 68 | Viewer breadcrumb bar for split parts + cross-part search | Split navigation |
| 69 | Manual split command (`splitNow`) | Manual control |

#### Iteration F: Session Comparison + Portability (Tier 4)

| # | Task | Delivers |
|---|---|---|
| 70 | Multi-session side-by-side WebviewPanel (editor area) | Compare UI |
| 71 | Synchronized scrolling by timestamp proximity | Sync scroll |
| 72 | Color diff (unique lines per session highlighted) | Visual diff |
| 73 | Interactive HTML export (embedded JS: search, filter, expand, theme toggle) | Rich HTML |
| 74 | .slc session bundle (ZIP: logs + metadata + split info + annotations + pins) | Session package |
| 75 | .slc import — drag-and-drop or command, appears in history | Import |
| 76 | Additional export formats: CSV, JSON, JSONL | Data export |

#### Iteration G: Search + Analytics (Tier 4)

| # | Task | Delivers |
|---|---|---|
| 77 | Cross-session search via Quick Pick (results grouped by session) | Global search |
| 78 | Lazy on-disk indexing (indexed on first search, cached) | Performance |
| 79 | Structured JSON log detection and collapsible inline rendering | JSON parsing |
| 80 | End-of-session summary (lines, errors, warnings, duration, throughput, top messages) | Summary |
| 81 | Error rate alert engine (sliding window, spike detection, rate in status bar) | Rate alerts |

#### Iteration H: Polish + Ecosystem (Tier 4-5)

| # | Task | Delivers |
|---|---|---|
| 82 | Custom regex highlight rules (pattern → color, stackable, persisted) | Highlight |
| 83 | Saved filter presets (level + keyword + category as named preset) | Presets |
| 84 | Auto-tag rule engine (content pattern → automatic tag) | Auto-tagging |
| 85 | Session templates (save project-specific config bundles) + starter templates | Templates |
| 86 | First-run walkthrough (VS Code Walkthrough API, 6 steps) | Onboarding |
| 87 | Quick actions context menu (search codebase, create GitHub issue, add to watch) | Context menu |
| 88 | Log entry deep links (`vscode://saropa.log-capture/session/<id>/line/<n>`) | Deep links |
| 89 | Tail mode for workspace .log files (file watcher, configurable globs) | File tailing |
| 90 | Remote workspace / SSH support | Remote |
| 91 | Inline code decorations (show log output next to source line) | Inline logs |
| 92 | External log service integration (Logz.io, Loki, Datadog) | Export |

---

## Verification

Organized by stage. Each stage's tests must pass before advancing.

### Stage 1 Verification: "The Black Box"

1. Run extension in Extension Development Host (`F5`)
2. Open a Flutter project, start debug session
3. Confirm log file created in `/reports/` directory (not `.vscode/logs/`)
4. Confirm first lines of log file contain context header (launch.json config, VS Code version, OS, adapter type)
5. Confirm ANSI escape codes are preserved in `.log` file (verify with `less -R` or `cat` in terminal)
6. Trigger a tight loop / rapid duplicate output — confirm deduplication groups identical lines as `Message (x N)` instead of writing every line
7. Confirm `maxLogFiles` enforcement: create 12 sessions, verify only 10 log files remain in `/reports/`
8. On first run in a new workspace, confirm `.gitignore` check prompts to add `/reports/` if not present
9. Test pause/resume mid-session via status bar
10. Stop debug session, confirm file is finalized
11. Test with Node.js debug session (adapter-agnostic)
12. Test with Python debug session (adapter-agnostic)
13. Confirm status bar shows live line count and recording indicator

### Stage 2 Verification: "The Window"

14. Confirm sidebar viewer shows output in real time with ANSI colors rendered as HTML
15. Confirm auto-scroll pauses when scrolling up, resumes at bottom
16. Generate 100K+ lines of output — confirm virtual scrolling handles it without lag
17. Trigger a multi-line stack trace — confirm it collapses and expands
18. Insert a marker via command/keyboard (`M`) — confirm visual separator appears in viewer and is written to log file
19. Insert multiple markers to separate test attempts — confirm they display with timestamp and distinctive styling
20. Switch between light/dark/high-contrast themes, confirm viewer adapts via `--vscode-*` CSS variables
21. Confirm viewer footer shows recording status, line count, and filename

### Stage 3 Verification: "The Navigator"

22. Click-to-source from a log line containing a file path — confirm editor opens at correct file and line
23. Verify regex parsing finds `file:line` patterns across Dart, Node.js, and Python stack traces
24. Ctrl+Click a log line with source info — confirm it opens in split editor
25. Use search bar with a regex pattern — confirm matches highlighted and F3/Shift+F3 navigates between them
26. Use level filter dropdown — confirm hiding/showing by category (Info, Warning, Error, stdout, stderr)
27. Toggle word wrap — confirm behavior
28. Confirm session appears in history tree with metadata (line count, error count, duration)
29. Open a past session from history — confirm it loads in viewer
30. Switch to HTML format, confirm colors and context header render in browser
31. Test all keyboard shortcuts (F3, Space, W, M, Home, End)

### Post-MVP Verification

32. Add a custom watch keyword, trigger it in app code, confirm counter increments
33. Confirm status bar flashes on error watch hit
34. Click a watch chip in toolbar, confirm viewer filters to those matches
35. Confirm view badge shows unread watch count on sidebar icon
36. Configure file split with max 100 lines, confirm split occurs and creates `_001`, `_002` files
37. Configure keyword split on "HOT RESTART", trigger hot restart, confirm new file starts
38. Confirm split session appears as expandable parent in session history
39. Confirm cross-part search finds matches across all split files
