# bugs to fix — RESOLVED

**Resolved (implemented):** (1) Notice/framework blue unified to `--vscode-charts-blue` (#2196f3) in bar, tint, line text, footer dot. (2) File load capped at `maxLines` to avoid CPU spike; footer shows "Showing first X of Y lines" when truncated. (3) Emoji dot only in Copy with decorations (respects "Severity dot (copy only)"); viewer shows gutter bar only; JSDoc updated.

---

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

**What the screenshot shows:** The image clearly shows **both** (1) the **severity bar** — the vertical gutter to the left of the line numbers with colored dots (blue, orange, etc.) — and (2) **emoji-like severity symbols in the line content** — e.g. green checkmark, blue “i”, orange “!” immediately after the `»` prefix and before the log level (D/, I/, W/). So the same severity is shown twice: once in the gutter (CSS bar + dot) and once as an emoji/icon in the text. That redundancy, and any visual overlap or disconnect between the two, is the bug.

**Intended behavior:** In the **viewer**, show **only** the severity bar (gutter). The **emoji dot** (🟢🟠🔴 etc.) should appear **only** in “Copy with decorations” (clipboard), not in the on-screen line.

**Current code:** `getDecorationPrefix()` in `viewer-decorations.ts` does *not* add the emoji to the visible prefix (comment there says “Emoji dots are NOT shown in the visual prefix”). `getLevelDot()` is only used in `viewer-copy.ts` for decorated copy. So in the current codebase the visible line should not include the emoji. If the screenshot is from this build, then either (a) another code path still injects the emoji into the line HTML, or (b) the “emoji-like” symbols are coming from the log content/ANSI rather than our `getLevelDot()`.

**Recommendation:** (1) Ensure **no** path adds the emoji to the visible line: keep `getDecorationPrefix()` as-is (no `decoShowDot` branch that pushes `getLevelDot()` into `parts`), and grep for any other use of `getLevelDot` that feeds into the line DOM. (2) If the symbols in the screenshot are ours, remove that path so only the gutter severity bar is shown in the viewer. (3) Align UI/docs with “copy only”: the deco settings label already says “Severity dot (copy only)”; the JSDoc example in `getDecorationPrefix` still shows `🟢` in the example output — update that example to show counter + timestamp + » only, so it doesn’t imply the emoji appears in the viewer.
