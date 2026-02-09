# Cross-Session Analysis — Status, Roadmap & Ideas

## Current State (February 2026)

The cross-session analysis system is **operational** across 28 files (14 modules, 14 UI files, ~3,000 lines). What started as a "search other sessions" button has grown into a multi-dimensional investigation surface that bridges log output, project source code, git history, and dependency graphs.

### What's Built and Working

| Feature | Module(s) | Status |
|---------|-----------|--------|
| **"Analyze Line" context action** | `analysis-panel.ts`, `line-analyzer.ts` | Shipped. Right-click any log line → progressive analysis panel |
| **Token extraction** | `line-analyzer.ts` (46 lines) | Extracts source files, error classes, HTTP status, URL paths, quoted strings, class.method patterns |
| **Parallel session search** | `log-search.ts` | Concurrent scan of all session files for token matches, capped at 50 results |
| **Source file lookup** | `source-linker.ts` + `workspace-analyzer.ts` | Finds referenced source files in workspace, reads code around crash line |
| **Git blame** | `git-blame.ts` | Shows who last changed the crash line, and when |
| **Git history (file-level)** | `workspace-analyzer.ts` | Last 10 commits touching the source file |
| **Git history (line-range)** | `workspace-analyzer.ts` | Commits that changed the ±2 line region around the crash |
| **Source annotations** | `workspace-analyzer.ts` | Finds TODO/FIXME/BUG/HACK/NOTE/XXX near the crash site |
| **Documentation scan** | `docs-scanner.ts` (79 lines) | Searches project markdown files for references to analysis tokens |
| **Import extraction** | `import-extractor.ts` (75 lines) | Parses imports from the crashing source file (Dart, TS, JS, Python, Go, Rust, Java, Kotlin, Swift, C/C++, C#, Ruby, PHP) |
| **Symbol resolution** | `symbol-resolver.ts` (74 lines) | Resolves class/method names via VS Code's workspace symbol provider |
| **Error fingerprinting** | `error-fingerprint.ts` (79 lines) | FNV-1a hash after normalizing timestamps, IDs, UUIDs, hex addresses, paths |
| **Cross-session aggregation** | `cross-session-aggregator.ts` (116 lines) | Reads all `.meta.json` sidecars to build hot-file rankings + recurring error groups |
| **Correlation tags** | `correlation-scanner.ts` (43 lines) | Extracts `file:` and `error:` tags from log content for session metadata |
| **Bug report generation** | `bug-report-collector.ts` + `bug-report-formatter.ts` | One-click markdown report with error, stack trace, context, environment, dev environment, source code, git history, imports, docs, symbols, cross-session match |
| **Insights panel** | `insights-panel.ts` (176 lines) | Hot files + recurring errors aggregated across all sessions |
| **Insights drill-down** | `insights-drill-down.ts` (71 lines) | Click a recurring error → fuzzy regex search across sessions, results grouped by session |
| **Session timeline** | `timeline-panel.ts` (214 lines) | SVG visualization of errors/warnings over time within a session |
| **Session comparison** | `session-comparison.ts` (234 lines) | Side-by-side diff with color highlighting and optional synchronized scrolling |
| **Progressive rendering** | `analysis-panel-render.ts` + styles | Sections appear independently as their data arrives — spinners → content |
| **Cancellation** | `analysis-panel.ts` | AbortController-based; user can stop analysis mid-flight |
| **Executive summary** | `analysis-relevance.ts` + `analysis-panel-summary.ts` | Relevance scoring → 2-4 key findings banner, smart section collapse |
| **Root cause correlation** | `analysis-relevance.ts` + `git-diff.ts` | Blame date vs error first-seen date → "Error likely introduced by commit" |
| **Commit diff summary** | `git-diff.ts` (52 lines) | Parses `git show --stat` for files changed / insertions / deletions |
| **Stack trace deep-dive** | `analysis-frame-render.ts` (65 lines) | Clickable frame list with APP/FW badges; click app frame → inline source + blame |
| **Cross-session lookup** | `analysis-panel.ts` | Parallel stream: fingerprint → aggregator match → firstSeenDate for correlation |
| **Related lines** | `related-lines-scanner.ts` + `analysis-related-render.ts` | Scans log file for all lines sharing source tag, diagnostic timeline UI |
| **Referenced files** | `analysis-panel.ts` + `analysis-related-render.ts` | Git blame + annotations for each source file across related lines |
| **GitHub context** | `github-context.ts` + `analysis-related-render.ts` | `gh` CLI: blame-to-PR mapping, file PRs, issue search with auto-detection |
| **Progress reporting** | `analysis-panel-render.ts` + styles | Progress bar, per-section spinner text, smooth CSS transitions |
| **Bug report scoring** | `bug-report-formatter.ts` | Executive summary with key findings in markdown bug reports |

### Recently Completed

**Related Lines, Referenced Files, GitHub Context** — Two-wave execution: Wave 1 scans the log file for all lines sharing the analyzed line's source tag (fast, ~50ms), extracting enriched tokens from the group. Wave 2 runs seven parallel streams with the enriched tokens: source chain, docs, symbols, tokens, cross-session, referenced files, and GitHub context. Referenced files analyzes up to 5 source files with git blame and annotations. GitHub integration queries `gh` CLI for blame-to-PR mapping, file PRs, and issue search, with auto-detection of `gh` availability and actionable setup hints.

**Progress Reporting** — Header progress bar with "X/N complete" counter, per-section spinner text updates, smooth CSS transitions. Bar turns green and fades on completion.

**Stack Trace Deep-Dive** — `extractFrames()` reads the log file below the error line, classifies frames as app vs framework. `analysis-frame-render.ts` renders a clickable frame list with APP/FW badges. Clicking an app frame sends `analyzeFrame` → extension runs `analyzeSourceFile()` + `getGitBlame()` → posts `frameReady` with inline source preview + blame. FW frames are grayed out, not clickable.

**Bug Report Scoring** — `bug-report-formatter.ts` calls `scoreRelevance()` and renders high/medium findings as a "Key Findings" section in the markdown output.

---

## Architecture

### Data Flow

```
User right-clicks log line → analyzeLine message includes lineIndex + fileUri
    ↓
extractAnalysisTokens(lineText) → AnalysisToken[]
extractFrames(fileUri, lineIndex) → StackFrameInfo[] (reads log file for stack frames)
    ↓
buildProgressiveShell() → HTML with spinner placeholders + frame section
    ↓
Wave 1 — quick related-lines scan (~50ms):
    scanRelatedLines(fileUri, sourceTag) → related lines, source refs, enhanced tokens
    ↓
Wave 2 — seven parallel streams with enriched tokens:
    ├─ runSourceChain() → source preview, blame, diff summary, line history, imports
    ├─ runDocsScan(allTokens) → documentation matches
    ├─ runSymbolResolution(allTokens) → symbol definitions
    ├─ runTokenSearch(allTokens) → cross-session token matches
    ├─ runCrossSessionLookup() → fingerprint match → sessionCount, firstSeenDate
    ├─ runReferencedFiles(related) → git blame + annotations per source file
    └─ runGitHubLookup(related, allTokens) → blame-to-PR, file PRs, issue search
    ↓
Promise.allSettled() collects metrics from all streams
    ↓
scoreRelevance(mergedData) → findings[] + sectionLevels (includes correlation scoring)
    ↓
Post 'summaryReady' → webview inserts banner, collapses low sections
    ↓
User clicks app frame → 'analyzeFrame' → inline source preview + blame
```

### Module Dependency Map

```
analysis-panel.ts (orchestrator, 300 lines)
├── line-analyzer.ts (token extraction)
├── source-linker.ts (file:line parsing)
├── source-tag-parser.ts (source tag extraction)
├── related-lines-scanner.ts (tag-based line grouping)
├── workspace-analyzer.ts (source + git + annotations)
│   └── git-blame.ts
├── git-diff.ts (commit diff summary)
├── github-context.ts (gh CLI: PRs, issues, blame-to-PR)
├── docs-scanner.ts (markdown search)
├── import-extractor.ts (dependency parsing)
├── symbol-resolver.ts (VS Code symbol API)
├── log-search.ts (cross-session file search)
├── error-fingerprint.ts (line normalization + hashing)
├── cross-session-aggregator.ts (recurring error lookup)
├── stack-parser.ts (frame detection + date extraction)
├── analysis-relevance.ts (scoring + correlation)
├── analysis-panel-render.ts (HTML generation)
│   └── analysis-frame-render.ts (frame list + mini-analysis)
├── analysis-related-render.ts (related lines, files, GitHub HTML)
├── analysis-frame-handler.ts (frame extraction + analysis)
├── analysis-panel-summary.ts (summary HTML)
└── analysis-panel-styles.ts (CSS + webview script)

bug-report-collector.ts (orchestrator, 153 lines)
├── source-linker.ts
├── error-fingerprint.ts
├── stack-parser.ts
├── workspace-analyzer.ts
├── git-blame.ts
├── cross-session-aggregator.ts
├── environment-collector.ts
├── line-analyzer.ts
├── docs-scanner.ts
├── import-extractor.ts
└── symbol-resolver.ts

bug-report-formatter.ts (153 lines)
├── bug-report-collector.ts (data types)
└── analysis-relevance.ts (scoring for Key Findings)

insights-panel.ts
└── cross-session-aggregator.ts
    └── session-metadata.ts (sidecar .meta.json files)

session-comparison.ts
└── diff-engine.ts (normalization + comparison)
```

---

## Open Questions (Resolved & Remaining)

### Resolved

| Question | Resolution |
|----------|-----------|
| QuickPick vs webview for Analyze Line? | **Webview panel** — richer, persistent, supports progressive loading |
| Auto-tags: eager or lazy? | **Eager** — computed on session end via `correlation-scanner.ts` |
| Workspace scanning respect .gitignore? | **Yes** — `workspace.findFiles()` respects VS Code exclude patterns |
| Git history cached or fresh? | **Fresh** — git is fast enough; no caching layer needed |
| Non-git projects? | **Graceful skip** — git functions return empty arrays, sections show "no data" |

### Still Open

- Should investigation groups persist in workspace state or in a `.json` file in `reports/` (shareable via git)?
- Should the "related sessions" panel in session info auto-populate from shared source files, or is the insights panel enough?
- Should the source file heatmap be a dedicated panel or integrated into the insights panel?
- How should the timeline panel interact with cross-session data? (Currently per-session only)

---

## What's Left to Build

### Short-Term Enhancements

| Enhancement | Effort | Impact | Status |
|-------------|--------|--------|--------|
| ~~Stack trace deep-dive~~ | ~~Medium~~ | ~~High~~ | **Done** |
| ~~Root cause correlation~~ | ~~Low~~ | ~~High~~ | **Done** |
| Error timeline/trend chart across sessions | Medium | Visual pattern: is this error increasing, stable, or resolved? | Next |
| Related errors clustering — group errors by shared stack frames | Medium | "These 4 errors all pass through `api_client.dart:87`" | Backlog |
| Dependency change detector — flag recently-updated packages | Medium | "Package `http` updated 2 days ago" | Backlog |

---

## Feature Ideas — Practical

### ~~1. Stack Trace Deep-Dive~~ — DONE

Implemented in `analysis-frame-render.ts` (65 lines) + `analysis-panel.ts`. Clickable frame list with APP/FW badges. Click an app frame → inline source preview + blame via `analyzeFrame()`. Frames extracted from log file below the error line. FW frames grayed out.

### 2. Error Trend Chart

Show a simple spark-line or bar chart in the executive summary: how many times has this error appeared across the last N sessions?

```
Sessions:  █ · █ ██ · · █ · ··
           ↑               ↑
        first seen      still here
```

**Data source:** `cross-session-aggregator.ts` already has `firstSeen`/`lastSeen` per error hash. Extend to include a per-session occurrence timeline.

**Implementation:** Store session dates alongside counts in `RecurringError`. Render as a small inline SVG in the executive summary (similar pattern to `timeline-panel.ts`).

### ~~3. Root Cause Correlation~~ — DONE

Implemented in `git-diff.ts` (52 lines) + `analysis-relevance.ts:scoreCorrelation()`. Shows commit diff summary (files changed, +insertions, -deletions) below blame. Correlates blame date with error fingerprint's cross-session first appearance via `runCrossSessionLookup()`. 3-day window = "Error likely introduced by commit".

### 4. Caller Graph

When the crashing file's imports are extracted, trace in the reverse direction: which files in the workspace import the crashing file?

```
Who calls payment_handler.dart?
├── checkout_controller.dart (L14: import 'payment_handler.dart')
├── order_service.dart (L8: import '../payment/payment_handler.dart')
└── test/payment_test.dart (L3: import 'payment_handler.dart')
```

**Implementation:** `vscode.workspace.findFiles('**/*.{dart,ts,js,...}')` then grep each file for import/require of the crashing filename. Already have the pattern from `import-extractor.ts`.

### 5. Smart Context Boundaries

Instead of always showing the 15 lines before an error, use blank lines and log-level changes to find the logical boundary of the current operation.

**Example:** If the log has a blank line 3 lines before the error, the context probably starts there — not 15 lines back in a different operation.

**Implementation:** Walk backward from the error line, tracking blank lines, timestamp gaps (>1s), and log level transitions. Stop at the first "boundary" indicator.

### 6. "Show Log History" for Source Files

Right-click any source file in VS Code's Explorer → "Show Log References" → see every session that mentioned this file, with the specific lines.

**Implementation:** New command registered in `package.json`. Uses `searchLogFilesConcurrent()` with the filename. Groups results by session, shows matching lines.

### 7. Session Annotations

Let users add notes to sessions directly in the sidebar viewer: "Fixed by updating the API key" or "Regression from PR #142". Stored in the sidecar `.meta.json`.

**Implementation:** Context menu "Add Note" → `showInputBox()` → save to metadata. Display notes in session history tree and in the timeline panel.

### 8. Investigation Groups

Bundle related sessions into named investigations. Shared analysis auto-highlights patterns unique to the group.

```
"Bug #42: Payment timeout"
├── session_2025-01-15_1430.log  (first occurrence)
├── session_2025-01-15_1630.log  (after fix attempt 1)
├── session_2025-01-16_0900.log  (after fix attempt 2 — clean!)
└── notes: "Root cause was connection pool exhaustion"
```

**Implementation:** Workspace state or `reports/.investigations.json`. Context menu "Add to Investigation" on session tree items. Investigation nodes as tree parents.

---

## Feature Ideas — Magical

### 9. Predictive Error Surfacing

Before the user even clicks "Analyze Line," the extension has already computed which errors are interesting. On session end (or file save), automatically compute relevance scores for all errors in the log. Surface the top 3 in the status bar or as a notification.

"Your latest session has 2 recurring errors and 1 new error in recently-changed code."

**The magic:** The user doesn't have to hunt for errors. The extension tells them what's important before they ask.

**Implementation:** After session end, run `scanForFingerprints()` → cross-reference against `aggregateInsights()` → score relevance → post a VS Code notification with quick-actions to analyze each one.

### 10. "What Changed?" Regression Detector

After a debug session, automatically compare it against the previous session (or the last "clean" session). Highlight:
- New errors that didn't exist before
- Old errors that disappeared (fixes!)
- Output volume changes (debug print explosion?)
- New source files appearing in the output

**The magic:** The developer runs the app, and without asking, the extension says: "Compared to your last run: 1 new error (`TimeoutException` in `api_client.dart`), 2 errors fixed, output volume +40%."

**Implementation:** Extend `diff-engine.ts` to compute a session delta summary. Store the URI of the "comparison baseline" session. Run diff automatically on session end.

### 11. Ghost Errors — Intermittent Bug Tracker

Some errors appear in 30% of sessions. Others in 100%. The extension tracks this automatically.

```
Reliability Report:
  SocketException        ▓▓▓░░▓▓▓░░  60% of sessions — intermittent
  NullPointerException   ▓▓▓▓▓▓▓▓▓▓  100% of sessions — consistent
  FormatException        ░░░░░░░░░▓   10% of sessions — rare
```

Intermittent errors are often the hardest bugs. Making their pattern visible is the first step to understanding them.

**Implementation:** Extend `RecurringError` with a `sessionPercentage` field. `aggregateInsights()` already knows total sessions and per-error session count. Render as a spark-line in the insights panel.

### 12. Code Freshness Heatmap

Overlay git commit recency onto the source file mentions. Files that are both frequently-logged AND recently-changed are prime suspects.

```
payment_handler.dart    ████████████  47 mentions  🔴 changed 2 days ago
user_service.dart       ████████      31 mentions  🟢 stable 30 days
api_client.dart         ████          15 mentions  🟡 changed 8 days ago
```

**The magic:** One glance shows where log noise meets code churn. That intersection is almost always where the bug lives.

**Implementation:** Combine hot-file data from `cross-session-aggregator.ts` with `git log --format=%ai -1 -- <file>` for each hot file. Sort by combined score.

### 13. Semantic Error Grouping

Go beyond fingerprint hashing. Group errors by meaning, not just text similarity.

```
Group: "Network connectivity issues"
├── SocketException: Connection refused (port 8080)
├── TimeoutException: Future not completed [5000ms]
├── HttpException: Connection reset by peer
└── ClientException: Failed host lookup: 'api.example.com'
```

**Implementation:** Pattern library mapping error class names to semantic categories. `SocketException`, `TimeoutException`, `HttpException`, `ClientException` → "network". `FileNotFoundException`, `PathNotFoundException` → "filesystem". `FormatException`, `RangeError`, `TypeError` → "data validation".

### 14. Debugging Velocity Score

Track how many sessions it takes to resolve an error. Show the developer their "fix rate."

```
This Week:
  3 errors resolved (avg 2.3 sessions each)
  1 error persisting (5 sessions and counting)
  Fix velocity: ████████░░  80%
```

**The magic:** Turns debugging into a game. Developers can see their progress. Managers can see blockers. The metric is computed purely from existing data — no manual tracking.

**Implementation:** An error is "resolved" when its fingerprint stops appearing in new sessions. Track the session window. Compute fix velocity as `resolved / (resolved + persisting)`.

### 15. Time-Travel Debugging Context

When analyzing an error, show what the output looked like at the moment the error occurred — not the full log, but a reconstruction of what was on screen.

"At 14:32:07 when `TimeoutException` fired, the last 5 log messages were:"

```
14:32:02  Fetching user profile for user_abc123...
14:32:04  API request: GET /api/v2/users/abc123
14:32:05  Waiting for response...
14:32:07  TimeoutException: Future not completed [5000ms]  ← YOU ARE HERE
14:32:07  Stack trace...
```

**Implementation:** Already have log context extraction in `bug-report-collector.ts` (15 lines before error). Extend to use timestamp parsing for smarter boundaries (group by second, highlight time gaps).

### 16. Environment Diff

When an error appears in session A but not session B, automatically diff the session environments.

"This error appeared when using Dart SDK 3.2.1 but not when using 3.1.0. The SDK version may be relevant."

**Implementation:** Session headers already contain environment data. `session-comparison.ts` already has diff logic. Cross-reference error presence with environment differences.

### 17. Error Attention Score

Not all errors deserve attention. Rank them by a composite score:

| Factor | Weight |
|--------|--------|
| Appears in app code (not framework) | +3 |
| Referenced source file recently changed | +3 |
| Recurring across sessions | +2 |
| Has a FIXME/BUG annotation nearby | +2 |
| First time ever seen | +1 |
| Appears in project documentation | +1 |
| Framework-only stack trace | -2 |
| Common SDK error (well-documented) | -1 |

**The magic:** The analysis panel re-orders errors by attention score. The most actionable error is always at the top.

**Implementation:** Extend `analysis-relevance.ts` scoring to work on individual errors, not just sections. Run scoring against each error fingerprint in the session.

### 18. "Why Did This Break?" Story Mode

Combine all available signals into a narrative:

> **payment_handler.dart:142 — TimeoutException**
>
> This error first appeared yesterday. The crash line was modified 2 days ago
> by craig (commit `abc1234`: "increase API timeout to 5s"). The same file
> was also changed in commit `def5678` ("add retry logic") which introduced
> a new import of `http_retry.dart`. This error has been seen in 3 out of
> 4 sessions since the change.
>
> **Suggested investigation:** Review commits `abc1234` and `def5678`. The
> timeout increase may be insufficient, or the retry logic may have a bug.

**Implementation:** Template-based narrative generator. Inputs: blame data, commit messages, cross-session frequency, import changes. Each template handles a pattern (recent change + new error, recurring error + no recent change, etc.).

### 19. Session Health Score

Rate each debug session with a simple health score:

```
Session 2025-01-16 14:30 — Health: 72/100
  -15: 3 errors (2 recurring)
  -8:  framework warnings
  -5:  output volume spike
  +0:  no new errors
```

**The magic:** Developers can glance at the session history and see trend arrows. A score dropping from 85 to 60 over three sessions means something is getting worse.

**Implementation:** Weighted scoring based on error count, error severity, new vs recurring, output volume delta, framework noise ratio. Stored in `.meta.json`.

### 20. Workspace Pulse Dashboard

A single panel showing the health of the entire project, computed from all sessions:

```
Workspace Pulse — 23 sessions analyzed

🟢 Improving: SocketException (gone since Jan 15)
🔴 Worsening: NullPointerException (frequency increasing)
🟡 Stable: FormatException (2 sessions out of 23)

Hot Code:
  payment_handler.dart  47 log mentions, changed 2 days ago  ⚠️
  user_service.dart     31 log mentions, stable 30 days      ✓

Fix Velocity: 3 errors resolved this week, 1 persisting
```

**Implementation:** Combine: error trend analysis, hot file data with git freshness, session health scores over time. Render as a webview dashboard.

---

## Design Principles

1. **Speed over completeness** — Analysis should feel instant. Use concurrent operations, cap results, show partial results progressively.
2. **Index lazily** — Don't scan all files on activation. Compute when asked, cache for next time.
3. **Reuse existing infrastructure** — Every new feature should build on existing modules, not duplicate them.
4. **Progressive disclosure** — Start with the summary, expand into details. Never overwhelm.
5. **Non-destructive** — Analysis is read-only. Never modify log files. Metadata goes in sidecars.
6. **Two-directional** — Every feature should bridge logs ↔ source. Logs explain what happened; source explains why.
7. **Git is cheap** — Use git freely for context. It's fast and the project is almost always a git repo.
8. **Silence is golden** — Don't show a section with no data. Don't show a summary with nothing interesting. Empty state should be a quiet dash, not a noisy message.
9. **Attention is finite** — Score, rank, collapse, summarize. The developer's time is the scarcest resource.

---

## Implementation Priority Matrix

| Feature | Effort | User Impact | "Magic" Level | Priority |
|---------|--------|-------------|---------------|----------|
| ~~Executive summary + smart collapse~~ | ~~Low~~ | ~~High~~ | ~~Medium~~ | **Done** |
| ~~Stack trace deep-dive~~ | ~~Medium~~ | ~~High~~ | ~~Medium~~ | **Done** |
| ~~Root cause correlation~~ | ~~Low~~ | ~~High~~ | ~~High~~ | **Done** |
| Error trend chart | Medium | High | High | **Next** |
| Predictive error surfacing | Medium | Very High | Very High | Soon |
| "What Changed?" regression detector | Medium | Very High | Very High | Soon |
| Smart context boundaries | Low | Medium | Low | Backlog |
| Caller graph | Medium | Medium | Medium | Backlog |
| Ghost errors tracker | Low | Medium | High | Backlog |
| Code freshness heatmap | Low | High | High | Backlog |
| Semantic error grouping | Medium | Medium | High | Backlog |
| Session annotations | Low | Medium | Low | Backlog |
| Investigation groups | Medium | Medium | Medium | Backlog |
| "Why Did This Break?" story mode | High | Very High | Very High | Future |
| Debugging velocity score | Medium | Medium | High | Future |
| Session health score | Medium | High | High | Future |
| Workspace pulse dashboard | High | Very High | Very High | Future |
| Environment diff | Medium | Medium | High | Future |
| Time-travel debugging context | Low | Medium | Medium | Future |
| Error attention score | Medium | High | Very High | Future |
| N-way cross-session diff | High | Medium | Medium | Future |
| "Show Log History" for source files | Low | Medium | Low | Future |

---

## File Inventory

### Core Analysis Modules (`src/modules/`)

| File | Lines | Role |
|------|-------|------|
| `line-analyzer.ts` | 46 | Token extraction from log lines |
| `source-linker.ts` | ~80 | Parse `file.dart:42` references from text |
| `workspace-analyzer.ts` | 133 | Source lookup, git history, annotations |
| `git-blame.ts` | ~50 | `git blame` for a specific line |
| `git-diff.ts` | 52 | Commit diff summary (`git show --stat`) |
| `error-fingerprint.ts` | 79 | Normalize + FNV-1a hash for error grouping |
| `cross-session-aggregator.ts` | 116 | Hot files + recurring errors from metadata |
| `correlation-scanner.ts` | 43 | Extract `file:` and `error:` tags |
| `stack-parser.ts` | 136 | Frame classification, stack detection, date extraction |
| `docs-scanner.ts` | 79 | Search markdown docs for tokens |
| `import-extractor.ts` | 75 | Parse import statements (12 languages) |
| `symbol-resolver.ts` | 74 | VS Code workspace symbol lookup |
| `analysis-relevance.ts` | 153 | Relevance scoring + root cause correlation |
| `bug-report-collector.ts` | 153 | Evidence collection orchestrator |
| `bug-report-formatter.ts` | 168 | Markdown report formatter + executive summary |
| `environment-collector.ts` | 87 | Git state, runtime, system info |

### UI Panels (`src/ui/`)

| File | Lines | Role |
|------|-------|------|
| `analysis-panel.ts` | 244 | Analysis panel orchestrator (5 parallel streams + frame analysis) |
| `analysis-panel-render.ts` | 198 | Progressive HTML rendering + diff + frames |
| `analysis-panel-styles.ts` | 141 | CSS + webview script (frame clicks, frameReady handler) |
| `analysis-panel-summary.ts` | 16 | Executive summary HTML |
| `analysis-frame-render.ts` | 65 | Stack frame list + inline mini-analysis |
| `bug-report-panel.ts` | 125 | Bug report preview panel |
| `bug-report-panel-styles.ts` | 49 | Bug report CSS |
| `insights-panel.ts` | 176 | Cross-session insights dashboard |
| `insights-panel-styles.ts` | 77 | Insights CSS |
| `insights-drill-down.ts` | 71 | Recurring error detail view |
| `insights-drill-down-styles.ts` | 18 | Drill-down CSS |
| `session-comparison.ts` | 234 | Side-by-side session diff |
| `session-comparison-styles.ts` | 107 | Comparison CSS |
| `timeline-panel.ts` | 214 | SVG error/warning timeline |
| `timeline-panel-styles.ts` | 29 | Timeline CSS |
