# bugs to fix

1. Why do we have 3 different blue colors? D:\src\saropa-log-capture\bugs\blue.png

2. Investigate this massive 100% CPU spike: `saropa-log-capture` project contains massive text or log files, **this is almost certainly the root cause of your CPU and Disk I/O spikes.**

3. The severity bar layout became disconnected with emoji dots. Keep the emoji DOT ONLY for the decorative copy

D:\src\saropa-log-capture\bugs\Screenshot_log_capture_emoji_dot_overlap

---

## Review (findings)

### 1. Three blue colors — root cause

Three distinct blue/cyan values are used in the viewer:

| Use | Token / class | Value | File(s) |
|-----|----------------|-------|--------|
| Notice bar + line tint | `level-bar-notice`, `line-tint-notice` | `--vscode-terminal-ansiCyan, #4fc1ff` | viewer-styles-decoration.ts |
| Notice line text | `.line.level-notice` | `#4fc1ff` (ansiCyan) | viewer-styles.ts |
| **Info** line text | `.line.level-info` | `--vscode-terminal-ansiBlue, #3794ff` | viewer-styles.ts |
| Framework bar + sev dot | `level-bar-framework`, `.sev-fw` | `--vscode-charts-blue, #2196f3` | viewer-styles-decoration.ts, viewer-styles-session.ts |
| Footer “Notice” dot | `.level-dot-notice` | `#2196f3` (hardcoded) | viewer-styles-level.ts |
| Links / UI accent | textLink, editorInfo | `#3794ff` | viewer-styles*.ts, analysis-panel-styles.ts |

So: **notice** uses cyan `#4fc1ff` in the bar/tint but **#2196f3** in the footer dot; **framework** uses **#2196f3**; **info** uses **#3794ff** for line color. That’s three blues (4fc1ff, 2196f3, 3794ff) in one UI.

**Recommendation:** Pick one semantic blue for “notice” (e.g. `--vscode-charts-blue` #2196f3) and use it for notice bar, tint, footer dot, and any notice line styling so notice and framework can share a family; keep #3794ff for links/info accent only. Optionally use the same charts-blue for framework so there’s a single “blue” in the gutter/footer.

### 2. CPU spike with massive log files

The warning points at “massive text or log files” as the cause. Likely hot spots:

- **Extension host:** `viewer-file-loader.ts` + `viewer-data.ts` — full file read and line-by-line parse (ANSI, classify, stack detection) when opening a session. No streaming or cap on initial parse.
- **Metadata / scanning:** `metadata-loader.ts`, `session-severity-counts.ts`, `session-metadata.ts` — scanning or re-scanning large files for severity counts and metadata can be heavy.
- **Webview:** Virtual scrolling and `renderViewport` are already in place; `prefixSums` and height recalc over 100K+ lines could spike during scroll or when `allLines` is huge.
- **File watchers / session list:** Many sessions or frequent refresh over a folder full of large logs may amplify work.

**Recommendation:** (1) Add a max line cap or streaming/chunked load for “open file” so the first paint doesn’t parse the entire file. (2) Lazy or incremental severity/metadata scan (e.g. first N lines + on-demand for rest). (3) Profile in Extension Host with a 50k+ line log to confirm where time is spent (file read vs parse vs webview message size).

### 3. Severity bar vs emoji dot (layout / “decorative copy only”)

Code already restricts emoji to **copy only**: `viewer-decorations.ts` (getDecorationPrefix) does **not** add emoji to the line DOM; `getLevelDot()` is only used in `viewer-copy.ts` for “Copy with decorations”. The gutter uses only CSS: `level-bar-*` with `::before` (7px circle) and `bar-down`/`bar-up`/`bar-bridge` for connectors.

So the bug is likely one or both of:

- **Layout:** The CSS dot (::before at `left: 9px`) and the connector (`left: 11px`, width 3px) can misalign or overlap with line content when padding/indent changes (e.g. `.line:has(.line-decoration)` with `padding-left: 170px`), or when zoom/font size changes.
- **Duplicate or stray emoji:** If any code path still injects an emoji into the line HTML (e.g. in `viewer-data-helpers.ts` or where `deco` is built), it would show in the content area and look like a “dot” overlapping the bar.

**Recommendation:** (1) Search the built line HTML for any use of `getLevelDot` or emoji outside of the copy path; ensure only `getDecorationPrefix` (counter + timestamp + separator, no emoji) feeds the visible line. (2) In DevTools, inspect the gutter: ensure only `[class*="level-bar-"]` and `::before`/`::after` are present; adjust `left`/width so the dot and connector align and don’t overlap the first character of the line. (3) Optionally add a single comment in `viewer-decorations.ts`: “Emoji dots are used only in viewer-copy.ts for decorated copy; the gutter uses CSS level-bar-* only.”
