# Cross-Session Analysis — Status, Roadmap & Ideas

## Current State (June 2026)

The cross-session analysis system is **operational**. What started as a "search other sessions" button has grown into a multi-dimensional investigation surface that bridges log output, project source code, git history, and dependency graphs. Since the original write-up the modules were reorganized into topic subdirectories (`src/modules/analysis/`, `bug-report/`, `source/`, `git/`, `compare/`, `regression/`, `root-cause-hints/`, `signals/`; UI under `src/ui/analysis/`, `src/ui/session/`, `src/ui/panels/`, `src/ui/signals/`), so the file paths below differ from the early-2026 layout.

> Note on scope: the standalone "Insights" panel has been folded into the unified **Signals** diagnostic system (`src/ui/signals/`, ~14 files). Cross-session aggregation still feeds it; the single-session project view lives in [analysis-project-insights.ts](src/ui/analysis/analysis-project-insights.ts).

### What's Built and Working

| Feature | Module(s) | Status |
|---------|-----------|--------|
| **"Analyze Line" context action** | [analysis-panel.ts](src/ui/analysis/analysis-panel.ts), [line-analyzer.ts](src/modules/analysis/line-analyzer.ts) | Shipped. Right-click any log line → progressive analysis panel |
| **Token extraction** | [line-analyzer.ts](src/modules/analysis/line-analyzer.ts) | Extracts source files, error classes, HTTP status, URL paths, quoted strings, class.method patterns |
| **Parallel session search** | [log-search.ts](src/modules/search/log-search.ts) | Concurrent scan of all session files for token matches |
| **Source file lookup** | [source-linker.ts](src/modules/source/source-linker.ts) + [workspace-analyzer.ts](src/modules/misc/workspace-analyzer.ts) | Finds referenced source files in workspace, reads code around crash line |
| **Git blame** | [git-blame.ts](src/modules/git/git-blame.ts) | Shows who last changed the crash line, and when |
| **Git history (file-level)** | [workspace-analyzer.ts](src/modules/misc/workspace-analyzer.ts) | Last 10 commits touching the source file |
| **Git history (line-range)** | [workspace-analyzer.ts](src/modules/misc/workspace-analyzer.ts) | Commits that changed the ±2 line region around the crash |
| **Source annotations** | [workspace-analyzer.ts](src/modules/misc/workspace-analyzer.ts) | Finds TODO/FIXME/BUG/HACK/NOTE/XXX near the crash site |
| **Documentation scan** | [docs-scanner.ts](src/modules/misc/docs-scanner.ts) | Searches project markdown files for references to analysis tokens |
| **Import extraction** | [import-extractor.ts](src/modules/source/import-extractor.ts) | Parses imports from the crashing source file (Dart, TS, JS, Python, Go, Rust, Java, Kotlin, Swift, C/C++, C#, Ruby, PHP) |
| **Symbol resolution** | [symbol-resolver.ts](src/modules/source/symbol-resolver.ts) | Resolves class/method names via VS Code's workspace symbol provider |
| **Error fingerprinting** | [error-fingerprint.ts](src/modules/analysis/error-fingerprint.ts) | FNV-1a hash after normalizing timestamps, IDs, UUIDs, hex addresses, paths |
| **Cross-session aggregation** | [cross-session-aggregator.ts](src/modules/misc/cross-session-aggregator.ts) | Reads all `.meta.json` sidecars to build hot-file rankings + recurring error groups |
| **Correlation tags** | [correlation-scanner.ts](src/modules/analysis/correlation-scanner.ts) | Extracts `file:` and `error:` tags from log content for session metadata |
| **Bug report generation** | [bug-report-collector.ts](src/modules/bug-report/bug-report-collector.ts) + [bug-report-formatter.ts](src/modules/bug-report/bug-report-formatter.ts) | One-click markdown report with error, stack trace, context, environment, dev environment, source code, git history, imports, docs, symbols, cross-session match |
| **Insights / Signals dashboard** | [signal-report-panel.ts](src/ui/signals/signal-report-panel.ts) + [cross-session-aggregator.ts](src/modules/misc/cross-session-aggregator.ts) | Hot files + recurring signals aggregated across all sessions (the old insights panel, now part of the Signals system) |
| **Session timeline** | [timeline-panel.ts](src/ui/panels/timeline-panel.ts) | SVG visualization of errors/warnings over time within a session |
| **Session comparison** | [session-comparison.ts](src/ui/session/session-comparison.ts) | Side-by-side diff with color highlighting and optional synchronized scrolling |
| **Progressive rendering** | [analysis-panel-render.ts](src/ui/analysis/analysis-panel-render.ts) + styles | Sections appear independently as their data arrives — spinners → content |
| **Cancellation** | [analysis-panel.ts](src/ui/analysis/analysis-panel.ts) | AbortController-based; user can stop analysis mid-flight |
| **Executive summary** | [analysis-relevance.ts](src/modules/analysis/analysis-relevance.ts) + [analysis-panel-summary.ts](src/ui/analysis/analysis-panel-summary.ts) | Relevance scoring → key findings banner, smart section collapse |
| **Root cause correlation** | [analysis-relevance.ts](src/modules/analysis/analysis-relevance.ts) + [regression-hint-service.ts](src/modules/regression/regression-hint-service.ts) + [git-diff.ts](src/modules/git/git-diff.ts) | Blame date vs error first-seen date → "Error likely introduced by commit" |
| **Commit diff summary** | [git-diff.ts](src/modules/git/git-diff.ts) | Parses `git show --stat` for files changed / insertions / deletions |
| **Stack trace deep-dive** | [analysis-frame-render.ts](src/ui/analysis/analysis-frame-render.ts) | Clickable frame list with APP/FW badges; click app frame → inline source + blame |
| **Error trend chart** | [analysis-trend-render.ts](src/ui/analysis/analysis-trend-render.ts) | Compact per-session SVG bar chart of how often an error recurred, with date labels + tooltips |
| **Cross-session lookup** | [analysis-panel.ts](src/ui/analysis/analysis-panel.ts) | Parallel stream: fingerprint → aggregator match → firstSeenDate for correlation |
| **Related lines** | [related-lines-scanner.ts](src/modules/analysis/related-lines-scanner.ts) + [analysis-related-render.ts](src/ui/analysis/analysis-related-render.ts) | Scans log file for all lines sharing source tag, diagnostic timeline UI |
| **Referenced files** | [analysis-panel.ts](src/ui/analysis/analysis-panel.ts) + [analysis-related-render.ts](src/ui/analysis/analysis-related-render.ts) | Git blame + annotations for each source file across related lines |
| **GitHub context** | [github-context.ts](src/modules/git/github-context.ts) + [analysis-related-render.ts](src/ui/analysis/analysis-related-render.ts) | `gh` CLI: blame-to-PR mapping, file PRs, issue search with auto-detection |
| **Regression signals** | [regression-detector.ts](src/modules/signals/regression-detector.ts) | New-error / disappeared-error detection vs the past N sessions, surfaced in the Signals panel |
| **Session groups** | [session-groups.ts](src/modules/session/session-groups.ts) + [session-group-tracker.ts](src/modules/session/session-group-tracker.ts) | Bundles related sessions by time window / DAP boundary; manual group/ungroup commands |
| **Root cause hypotheses** | [build-hypotheses.ts](src/modules/root-cause-hints/build-hypotheses.ts) | Template-based hypotheses for SQL bursts, ANR, network, and text patterns |
| **Progress reporting** | [analysis-panel-render.ts](src/ui/analysis/analysis-panel-render.ts) + styles | Progress bar, per-section spinner text, smooth CSS transitions |
| **Bug report scoring** | [bug-report-formatter.ts](src/modules/bug-report/bug-report-formatter.ts) | Executive summary with key findings in markdown bug reports |

### Recently Completed

**Error Trend Chart** — [analysis-trend-render.ts](src/ui/analysis/analysis-trend-render.ts) renders a compact per-session SVG bar chart in the analysis surface: how often the analyzed error recurred across sessions, with date-range headers and hover tooltips. Data comes from the cross-session aggregator's per-error timeline.

**Session Groups** — [session-groups.ts](src/modules/session/session-groups.ts) (pure grouping rules) + [session-group-tracker.ts](src/modules/session/session-group-tracker.ts) (DAP-anchored state machine) bundle related sessions by time window or debug-session boundary. This is the foundation under the "Investigation Groups" idea below — automatic grouping is shipped; named/curated investigations are not.

**Regression Signals** — [regression-detector.ts](src/modules/signals/regression-detector.ts) detects errors new to the current session and errors that disappeared versus the past N sessions, surfaced inside the Signals panel.

**Related Lines, Referenced Files, GitHub Context** — Two-wave execution: Wave 1 scans the log file for all lines sharing the analyzed line's source tag (fast, ~50ms), extracting enriched tokens from the group. Wave 2 runs parallel streams with the enriched tokens: source chain, docs, symbols, tokens, cross-session, referenced files, and GitHub context. Referenced files analyzes up to 5 source files with git blame and annotations. GitHub integration queries `gh` CLI for blame-to-PR mapping, file PRs, and issue search.

**Progress Reporting** — Header progress bar with "X/N complete" counter, per-section spinner text updates, smooth CSS transitions. Bar turns green and fades on completion.

**Stack Trace Deep-Dive** — `extractFrames()` reads the log file below the error line, classifies frames as app vs framework. [analysis-frame-render.ts](src/ui/analysis/analysis-frame-render.ts) renders a clickable frame list with APP/FW badges. Clicking an app frame sends `analyzeFrame` → extension runs source lookup + `getGitBlame()` → posts `frameReady` with inline source preview + blame. FW frames are grayed out, not clickable.

**Bug Report Scoring** — [bug-report-formatter.ts](src/modules/bug-report/bug-report-formatter.ts) calls `scoreRelevance()` and renders high/medium findings as a "Key Findings" section in the markdown output.

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
Wave 2 — parallel streams with enriched tokens:
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
analysis-panel.ts (orchestrator — src/ui/analysis/)
├── line-analyzer.ts (token extraction — src/modules/analysis/)
├── source-linker.ts (file:line parsing — src/modules/source/)
├── source-tag-parser.ts (source tag extraction — src/modules/source/)
├── related-lines-scanner.ts (tag-based line grouping — src/modules/analysis/)
├── workspace-analyzer.ts (source + git + annotations — src/modules/misc/)
│   └── git-blame.ts (src/modules/git/)
├── git-diff.ts (commit diff summary — src/modules/git/)
├── github-context.ts (gh CLI: PRs, issues, blame-to-PR — src/modules/git/)
├── docs-scanner.ts (markdown search — src/modules/misc/)
├── import-extractor.ts (dependency parsing — src/modules/source/)
├── symbol-resolver.ts (VS Code symbol API — src/modules/source/)
├── log-search.ts (cross-session file search — src/modules/search/)
├── error-fingerprint.ts (line normalization + hashing — src/modules/analysis/)
├── cross-session-aggregator.ts (recurring error lookup — src/modules/misc/)
├── stack-parser.ts (frame detection + date extraction — src/modules/analysis/)
├── analysis-relevance.ts (scoring + correlation — src/modules/analysis/)
├── regression-hint-service.ts (root-cause correlation — src/modules/regression/)
├── analysis-panel-render.ts (HTML generation — src/ui/analysis/)
│   └── analysis-frame-render.ts (frame list + mini-analysis — src/ui/analysis/)
├── analysis-related-render.ts (related lines, files, GitHub HTML — src/ui/analysis/)
├── analysis-trend-render.ts (per-session error trend chart — src/ui/analysis/)
├── analysis-frame-handler.ts (frame extraction + analysis — src/ui/analysis/)
├── analysis-panel-summary.ts (summary HTML — src/ui/analysis/)
└── analysis-panel-styles.ts (CSS + webview script — src/ui/analysis/)

bug-report-collector.ts (orchestrator — src/modules/bug-report/)
├── source-linker.ts (src/modules/source/)
├── error-fingerprint.ts (src/modules/analysis/)
├── stack-parser.ts (src/modules/analysis/)
├── workspace-analyzer.ts (src/modules/misc/)
├── git-blame.ts (src/modules/git/)
├── cross-session-aggregator.ts (src/modules/misc/)
├── environment-collector.ts (src/modules/misc/)
├── line-analyzer.ts (src/modules/analysis/)
├── docs-scanner.ts (src/modules/misc/)
├── import-extractor.ts (src/modules/source/)
└── symbol-resolver.ts (src/modules/source/)

bug-report-formatter.ts (src/modules/bug-report/)
├── bug-report-collector.ts (data types)
└── analysis-relevance.ts (scoring for Key Findings)

signal-report-panel.ts (src/ui/signals/ — the former insights panel)
└── cross-session-aggregator.ts (src/modules/misc/)
    └── session-metadata.ts (sidecar .meta.json files — src/modules/session/)

session-comparison.ts (src/ui/session/)
└── diff-engine.ts (normalization + comparison — src/modules/misc/)
    └── session-compare.ts (3-way diff — src/modules/compare/)
```

---

## Open Questions (Resolved & Remaining)

### Resolved

| Question | Resolution |
|----------|-----------|
| QuickPick vs webview for Analyze Line? | **Webview panel** — richer, persistent, supports progressive loading |
| Auto-tags: eager or lazy? | **Eager** — computed on session end via [correlation-scanner.ts](src/modules/analysis/correlation-scanner.ts) |
| Workspace scanning respect .gitignore? | **Yes** — `workspace.findFiles()` respects VS Code exclude patterns |
| Git history cached or fresh? | **Fresh** — git is fast enough; no caching layer needed |
| Non-git projects? | **Graceful skip** — git functions return empty arrays, sections show "no data" |
| Standalone insights panel or unified? | **Unified** — insights folded into the Signals diagnostic system ([src/ui/signals/](src/ui/signals/)) |

### Still Open

- Should investigation groups persist a curated/named layer on top of the automatic [session-groups.ts](src/modules/session/session-groups.ts) grouping (workspace state vs a shareable `reports/.investigations.json`)?
- Should the "related sessions" panel in session info auto-populate from shared source files, or is the Signals panel enough?
- Should the source file heatmap be a dedicated panel or integrated into the Signals panel?
- How should the timeline panel interact with cross-session data? (Currently per-session only)

---

## What's Left to Build

### Short-Term Enhancements

| Enhancement | Effort | Impact | Status |
|-------------|--------|--------|--------|
| ~~Stack trace deep-dive~~ | ~~Medium~~ | ~~High~~ | **Done** |
| ~~Root cause correlation~~ | ~~Low~~ | ~~High~~ | **Done** |
| ~~Error trend/trend chart across sessions~~ | ~~Medium~~ | ~~High~~ | **Done** ([analysis-trend-render.ts](src/ui/analysis/analysis-trend-render.ts)) |
| Related errors clustering — group errors by shared stack frames | Medium | "These 4 errors all pass through `api_client.dart:87`" | Backlog |
| Dependency change detector — flag recently-updated packages | Medium | "Package `http` updated 2 days ago" | Backlog |
| Curated/named investigations on top of auto session-groups | Medium | Persist a human-named bug investigation across sessions | Next |

---

## Feature Ideas — Practical

### ~~1. Stack Trace Deep-Dive~~ — DONE

Implemented in [analysis-frame-render.ts](src/ui/analysis/analysis-frame-render.ts) + [analysis-panel.ts](src/ui/analysis/analysis-panel.ts). Clickable frame list with APP/FW badges. Click an app frame → inline source preview + blame via `analyzeFrame()`. Frames extracted from log file below the error line. FW frames grayed out.

### ~~2. Error Trend Chart~~ — DONE

Implemented in [analysis-trend-render.ts](src/ui/analysis/analysis-trend-render.ts). Compact per-session SVG bar chart in the analysis surface showing how often the analyzed error recurred across sessions, with date-range headers and hover tooltips. Data source is the cross-session aggregator's per-error `firstSeen`/`lastSeen` + occurrence timeline.

```
Sessions:  █ · █ ██ · · █ · ··
           ↑               ↑
        first seen      still here
```

### ~~3. Root Cause Correlation~~ — DONE

Implemented in [git-diff.ts](src/modules/git/git-diff.ts) + [regression-hint-service.ts](src/modules/regression/regression-hint-service.ts) + [analysis-relevance.ts](src/modules/analysis/analysis-relevance.ts). Shows commit diff summary (files changed, +insertions, -deletions) below blame. Correlates blame date with the error fingerprint's cross-session first appearance. A short window after the blame date = "Error likely introduced by commit".

### 4. Caller Graph — NOT BUILT

When the crashing file's imports are extracted, trace in the reverse direction: which files in the workspace import the crashing file?

```
Who calls payment_handler.dart?
├── checkout_controller.dart (L14: import 'payment_handler.dart')
├── order_service.dart (L8: import '../payment/payment_handler.dart')
└── test/payment_test.dart (L3: import 'payment_handler.dart')
```

**Implementation:** `vscode.workspace.findFiles('**/*.{dart,ts,js,...}')` then grep each file for import/require of the crashing filename. Reuse the patterns from [import-extractor.ts](src/modules/source/import-extractor.ts) (which currently does forward imports only).

### 5. Smart Context Boundaries — NOT BUILT

Instead of always showing the 15 lines before an error, use blank lines and log-level changes to find the logical boundary of the current operation.

**Example:** If the log has a blank line 3 lines before the error, the context probably starts there — not 15 lines back in a different operation.

**Implementation:** Walk backward from the error line, tracking blank lines, timestamp gaps (>1s), and log level transitions. Stop at the first "boundary" indicator. [blank-line-text.ts](src/modules/misc/blank-line-text.ts) exists but is not yet used for error context.

### 6. "Show Log History" for Source Files — NOT BUILT

Right-click any source file in VS Code's Explorer → "Show Log References" → see every session that mentioned this file, with the specific lines.

**Implementation:** New command registered in [package.json](package.json). Uses the cross-session search in [log-search.ts](src/modules/search/log-search.ts) with the filename. Groups results by session, shows matching lines. [log-search-ui.ts](src/modules/search/log-search-ui.ts) exists but does not yet expose an Explorer context-menu entry.

### 7. Session Annotations — PARTIAL

Let users add notes to sessions directly in the sidebar viewer: "Fixed by updating the API key" or "Regression from PR #142". Stored in the sidecar `.meta.json`.

**Status:** The storage layer exists — [session-metadata.ts](src/modules/session/session-metadata.ts) defines an `Annotation` interface (lineIndex, text, timestamp) with an `addAnnotation()` method. **Remaining:** no UI to add/edit notes, and notes are not yet displayed in the session history tree or timeline panel.

### 8. Investigation Groups — PARTIAL (automatic grouping shipped)

Bundle related sessions into named investigations. Shared analysis auto-highlights patterns unique to the group.

```
"Bug #42: Payment timeout"
├── session_2025-01-15_1430.log  (first occurrence)
├── session_2025-01-15_1630.log  (after fix attempt 1)
├── session_2025-01-16_0900.log  (after fix attempt 2 — clean!)
└── notes: "Root cause was connection pool exhaustion"
```

**Status:** Automatic session grouping is shipped — [session-groups.ts](src/modules/session/session-groups.ts) + [session-group-tracker.ts](src/modules/session/session-group-tracker.ts) bundle sessions by time window / DAP boundary, with manual group/ungroup commands. **Remaining:** the curated, human-named investigation layer (custom title + notes + "Add to Investigation") persisted to workspace state or `reports/.investigations.json`.

---

## Feature Ideas — Magical

### ~~9. Predictive Error Surfacing~~ — DONE

Implemented in [session-signal-surfacing.ts](src/modules/session/session-signal-surfacing.ts) (+ pure [session-signal-surfacing-format.ts](src/modules/session/session-signal-surfacing-format.ts) for the testable variant/truncation logic), wired into session finalization ([session-lifecycle-finalize.ts](src/modules/session/session-lifecycle-finalize.ts)). After the fingerprint scans settle on session end, it composes two already-persisted sources — new error patterns (the regression detector's F7 against the previous sessions) and this session's error fingerprints that recur across 5+ sessions (the cross-session aggregator) — into one toast: "Session signals — new error patterns: 1, recurring: 2 · top: …", with an "Open Signals" action. Stays silent when nothing is actionable.

This supersedes the older recurring-only notification (one toast per session end, strictly more information). Per-error quick-actions beyond "Open Signals" are not built; the panel already lists each item.

### ~~10. "What Changed?" Regression Detector~~ — DONE (output-volume delta omitted)

After a debug session, automatically compare it against the previous session (or the last "clean" session). Highlight:
- New errors that didn't exist before
- Old errors that disappeared (fixes!)
- Output volume changes (debug print explosion?)
- New source files appearing in the output

**The magic:** The developer runs the app, and without asking, the extension says: "Compared to your last run: 1 new error (`TimeoutException` in `api_client.dart`), 2 errors fixed, output volume +40%."

**Status:** Shipped. [session-delta.ts](src/modules/compare/session-delta.ts) computes the delta vs the chronologically previous session — error/warning count deltas, error fingerprints new vs gone, and source files (`file:` correlation tags) referenced only this session — and session finalization ([session-lifecycle-finalize.ts](src/modules/session/session-lifecycle-finalize.ts)) auto-logs a "Since last session:" summary to the output channel on every session end (silent, so it never competes with the predictive-surfacing toast from idea #9). New/disappeared error detection also remains available in the Signals panel via [regression-detector.ts](src/modules/signals/regression-detector.ts). **Omitted:** raw output-volume (total-line) delta — SessionMeta does not persist a per-session line count, so it is not derivable without re-reading both log files, which this lightweight summary avoids.

### ~~11. Ghost Errors — Intermittent Bug Tracker~~ — DONE

Some errors appear in 30% of sessions. Others in 100%. The extension tracks this automatically.

```
Reliability Report:
  SocketException        ▓▓▓░░▓▓▓░░  60% of sessions — intermittent
  NullPointerException   ▓▓▓▓▓▓▓▓▓▓  100% of sessions — consistent
  FormatException        ░░░░░░░░░▓   10% of sessions — rare
```

Intermittent errors are often the hardest bugs. Making their pattern visible is the first step to understanding them.

**Status:** Shipped. [signal-reliability.ts](src/modules/misc/signal-reliability.ts) classifies each signal's cross-session frequency into a percentage + tier (consistent ≥80%, intermittent 25–79%, rare <25%), and [recurring-signal-builder.ts](src/modules/misc/recurring-signal-builder.ts) now stamps `sessionPercentage` + `reliability` onto every `RecurringSignalEntry` (denominator = total sessions considered). The Signals panel's cross-session list renders the tier inline next to each signal's session count (e.g. "60% of sessions — intermittent"). A dedicated spark-line glyph was not added — the existing recurring badge + trend arrow already mark frequency, and the percentage/tier text carries the ghost-error signal without new CSS.

### 12. Code Freshness Heatmap — NOT BUILT

Overlay git commit recency onto the source file mentions. Files that are both frequently-logged AND recently-changed are prime suspects.

```
payment_handler.dart    ████████████  47 mentions  🔴 changed 2 days ago
user_service.dart       ████████      31 mentions  🟢 stable 30 days
api_client.dart         ████          15 mentions  🟡 changed 8 days ago
```

**The magic:** One glance shows where log noise meets code churn. That intersection is almost always where the bug lives.

**Implementation:** Combine hot-file data from [cross-session-aggregator.ts](src/modules/misc/cross-session-aggregator.ts) with `git log --format=%ai -1 -- <file>` for each hot file. Sort by combined score.

### ~~13. Semantic Error Grouping~~ — DONE (classifier + label; list grouping pending)

Go beyond fingerprint hashing. Group errors by meaning, not just text similarity.

```
Group: "Network connectivity issues"
├── SocketException: Connection refused (port 8080)
├── TimeoutException: Future not completed [5000ms]
├── HttpException: Connection reset by peer
└── ClientException: Failed host lookup: 'api.example.com'
```

**Status:** Shipped. [error-semantics.ts](src/modules/analysis/error-semantics.ts) is an ordered pattern library mapping error text to a meaning-based category — network, filesystem, permission, validation, concurrency, memory — with `'other'` as the no-match fallback (permission precedes filesystem so a permission-denied-on-a-file lands in the more informative bucket). The markdown bug report tags the error with its category ([bug-report-formatter.ts](src/modules/bug-report/bug-report-formatter.ts)), omitting it when nothing matches. **Pending:** using the category to visually group the "all errors" / cross-session signal lists under semantic headings (the classifier is ready; only the grouped list render remains).

**Implementation:** Pattern library mapping error class names to semantic categories. `SocketException`, `TimeoutException`, `HttpException`, `ClientException` → "network". `FileNotFoundException`, `PathNotFoundException` → "filesystem". `FormatException`, `RangeError`, `TypeError` → "data validation".

### 14. Debugging Velocity Score — NOT BUILT

Track how many sessions it takes to resolve an error. Show the developer their "fix rate."

```
This Week:
  3 errors resolved (avg 2.3 sessions each)
  1 error persisting (5 sessions and counting)
  Fix velocity: ████████░░  80%
```

**The magic:** Turns debugging into a game. Developers can see their progress. Managers can see blockers. The metric is computed purely from existing data — no manual tracking.

**Implementation:** An error is "resolved" when its fingerprint stops appearing in new sessions. Track the session window. Compute fix velocity as `resolved / (resolved + persisting)`. The disappeared-error detection in [regression-detector.ts](src/modules/signals/regression-detector.ts) supplies the "resolved" signal.

### ~~15. Time-Travel Debugging Context~~ — DONE (gap highlight; full timeline pending)

When analyzing an error, show what the output looked like at the moment the error occurred — not the full log, but a reconstruction of what was on screen.

"At 14:32:07 when `TimeoutException` fired, the last 5 log messages were:"

```
14:32:02  Fetching user profile for user_abc123...
14:32:04  API request: GET /api/v2/users/abc123
14:32:05  Waiting for response...
14:32:07  TimeoutException: Future not completed [5000ms]  ← YOU ARE HERE
14:32:07  Stack trace...
```

**Status:** Shipped (the time-gap signal). [time-travel-context.ts](src/modules/bug-report/time-travel-context.ts) scans the pre-error context lines, extracts each line's leading timestamp (via the dependency-free `extractTimestamp`), and finds the largest pause (≥1s) between consecutive lines. The bug report's Log Context section appends a "⏱ Largest pause in this context: 5.2s before `<line>`" note, telling the developer the error followed a wait (operation boundary) rather than a tight burst. Omitted when no two lines carry timestamps or no gap reaches the threshold. **Pending:** the full reconstructed "last N messages with a YOU ARE HERE marker" timeline view — the gap highlight is the highest-signal slice; the annotated mini-timeline render is not built.

### ~~16. Environment Diff~~ — DONE (in the session delta)

When an error appears in session A but not session B, automatically diff the session environments.

"This error appeared when using Dart SDK 3.2.1 but not when using 3.1.0. The SDK version may be relevant."

**Status:** Shipped as part of the session delta ([session-delta.ts](src/modules/compare/session-delta.ts)). The "Since last session:" summary now also reports environment fields that changed versus the previous session — app version, debug adapter, and target device — as "app version: 1.1.0 → 1.2.0" lines, so an environment change that coincides with new/resolved errors is visible right next to them. A field newly populated (absent in the previous session) is not treated as a change, to avoid noise. **Note:** this is the persisted-metadata environment (app version / adapter / device), not a full SDK-version cross-reference against each error's presence; raw line-content diffing remains in [session-compare.ts](src/modules/compare/session-compare.ts).

### ~~17. Error Attention Score~~ — DONE (scorer + bug report; panel re-ranking pending)

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

**Status:** Shipped (the scorer + a bug-report surface). [error-attention.ts](src/modules/analysis/error-attention.ts) computes the composite from the factor table above (app code +3, recently changed +3, recurring +2, FIXME nearby +2, first-time +1, in docs +1, common SDK −1, framework-only −2), clamped to a floor of 0, with an ordered factor breakdown. The markdown bug report shows an "Attention Score" section ([bug-report-formatter.ts](src/modules/bug-report/bug-report-formatter.ts)) built from the signals it already collects (app frames, line-range history, cross-session count, doc matches). **Pending:** running it per-error to re-order the analysis panel's error list (the scorer is ready; the panel re-rank + the FIXME-nearby and common-SDK inputs remain). The FIXME-nearby and common-SDK factors are defined in the scorer but not yet fed by the bug report (no annotation field on its file analyses).

### ~~18. "Why Did This Break?" Story Mode~~ — DONE (in the bug report)

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

**Status:** Shipped. [why-narrative.ts](src/modules/bug-report/why-narrative.ts) weaves the bug report's collected facts — git blame on the crash line (author, date, commit + message), recent commits to the surrounding code, and cross-session frequency — into a short prose "Why this might have broken" section with a suggested-investigation line keyed to the strongest signal (recently-changed + recurring → regression; stable + recurring → look outward; thin history → capture more). It renders in the markdown bug report ([bug-report-formatter.ts](src/modules/bug-report/bug-report-formatter.ts)) just after the executive summary, and is omitted when there is too little history. This complements the rule-driven [build-hypotheses.ts](src/modules/root-cause-hints/build-hypotheses.ts) (what kind of failure) with the per-line story (what happened to this line). **Not done:** an in-panel narrative banner (the prose currently lives in the bug report, not the live analysis panel) and weaving import changes into the story.

### ~~19. Session Health Score~~ — DONE (history trend arrows pending)

Rate each debug session with a simple health score:

```
Session 2025-01-16 14:30 — Health: 72/100
  -15: 3 errors (2 recurring)
  -8:  framework warnings
  -5:  output volume spike
  +0:  no new errors
```

**The magic:** Developers can glance at the session history and see trend arrows. A score dropping from 85 to 60 over three sessions means something is getting worse.

**Status:** Shipped. [session-health.ts](src/modules/misc/session-health.ts) computes a 0–100 per-session score from the session's detected signals (errors −10 each, ANR −25, memory −8, network −5, slow ops −3, warnings −2, each capped so one noisy category can't dominate), with a factor breakdown. The Signal Report overview shows a "Health: N/100" row, and the markdown export appends the factor breakdown. This is distinct from the pre-existing lint-impact [health-score.ts](src/modules/misc/health-score.ts) used by bug reports. **Pending:** session-history trend arrows (the score is computed per session but not yet persisted per-session for a worsening/improving trend across the Logs list).

### 20. Workspace Pulse Dashboard — NOT BUILT

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

**Implementation:** Combine error trend analysis, hot file data with git freshness, and session health scores over time. Render as a webview dashboard. (Today [analysis-project-insights.ts](src/ui/analysis/analysis-project-insights.ts) is single-session, not workspace-level.)

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
| ~~Error trend chart~~ | ~~Medium~~ | ~~High~~ | ~~High~~ | **Done** |
| ~~Session groups (automatic)~~ | ~~Medium~~ | ~~Medium~~ | ~~Medium~~ | **Done** |
| ~~Regression signals (new/gone errors)~~ | ~~Medium~~ | ~~High~~ | ~~High~~ | **Done** |
| ~~Predictive error surfacing (session-end trigger)~~ | ~~Medium~~ | ~~Very High~~ | ~~Very High~~ | **Done** |
| ~~"What Changed?" auto-summary on session end~~ | ~~Medium~~ | ~~Very High~~ | ~~Very High~~ | **Done** |
| Curated/named investigations | Medium | Medium | Medium | Next |
| ~~Ghost errors reliability tag~~ | ~~Low~~ | ~~Medium~~ | ~~High~~ | **Done** |
| ~~Session health score (per-session model)~~ | ~~Medium~~ | ~~High~~ | ~~High~~ | **Done** |
| ~~"Why Did This Break?" narrative prose~~ | ~~High~~ | ~~Very High~~ | ~~Very High~~ | **Done** (bug report) |
| Code freshness heatmap | Low | High | High | Backlog |
| ~~Error attention score~~ | ~~Medium~~ | ~~High~~ | ~~Very High~~ | **Done** (scorer + bug report) |
| Caller graph | Medium | Medium | Medium | Backlog |
| ~~Semantic error grouping~~ | ~~Medium~~ | ~~Medium~~ | ~~High~~ | **Done** (classifier + label) |
| Session annotations UI | Low | Medium | Low | Backlog |
| Smart context boundaries | Low | Medium | Low | Backlog |
| ~~Environment diff (env-specific)~~ | ~~Medium~~ | ~~Medium~~ | ~~High~~ | **Done** (session delta) |
| ~~Time-travel debugging context~~ | ~~Low~~ | ~~Medium~~ | ~~Medium~~ | **Done** (gap highlight) |
| Workspace pulse dashboard | High | Very High | Very High | Future |
| Debugging velocity score | Medium | Medium | High | Future |
| "Show Log History" for source files | Low | Medium | Low | Future |
| N-way cross-session diff | High | Medium | Medium | Future |

---

## File Inventory

> Line counts exclude blank lines (the project's `max-lines` convention). Captured June 2026; treat as approximate.

### Core Analysis Modules (`src/modules/`)

| File | Lines | Role |
|------|-------|------|
| [analysis/line-analyzer.ts](src/modules/analysis/line-analyzer.ts) | 56 | Token extraction from log lines |
| [source/source-linker.ts](src/modules/source/source-linker.ts) | 295 | Parse `file.dart:42` references from text |
| [misc/workspace-analyzer.ts](src/modules/misc/workspace-analyzer.ts) | 121 | Source lookup, git history, annotations |
| [git/git-blame.ts](src/modules/git/git-blame.ts) | 45 | `git blame` for a specific line |
| [git/git-diff.ts](src/modules/git/git-diff.ts) | 36 | Commit diff summary (`git show --stat`) |
| [git/github-context.ts](src/modules/git/github-context.ts) | 98 | `gh` CLI: blame-to-PR, file PRs, issue search |
| [analysis/error-fingerprint.ts](src/modules/analysis/error-fingerprint.ts) | 53 | Normalize + FNV-1a hash for error grouping |
| [misc/cross-session-aggregator.ts](src/modules/misc/cross-session-aggregator.ts) | 93 | Hot files + recurring errors from metadata |
| [analysis/correlation-scanner.ts](src/modules/analysis/correlation-scanner.ts) | 38 | Extract `file:` and `error:` tags |
| [analysis/stack-parser.ts](src/modules/analysis/stack-parser.ts) | 300 | Frame classification, stack detection, date extraction |
| [misc/docs-scanner.ts](src/modules/misc/docs-scanner.ts) | 115 | Search markdown docs for tokens |
| [source/import-extractor.ts](src/modules/source/import-extractor.ts) | 65 | Parse import statements (12+ languages) |
| [source/symbol-resolver.ts](src/modules/source/symbol-resolver.ts) | 65 | VS Code workspace symbol lookup |
| [analysis/analysis-relevance.ts](src/modules/analysis/analysis-relevance.ts) | 213 | Relevance scoring + section collapse |
| [regression/regression-hint-service.ts](src/modules/regression/regression-hint-service.ts) | 168 | Root-cause correlation (blame vs first-seen) |
| [signals/regression-detector.ts](src/modules/signals/regression-detector.ts) | 159 | New / disappeared error detection across sessions |
| [misc/recurring-signal-builder.ts](src/modules/misc/recurring-signal-builder.ts) | 152 | Recurring signal entries (session count + timeline) |
| [root-cause-hints/build-hypotheses.ts](src/modules/root-cause-hints/build-hypotheses.ts) | 227 | Template-based root-cause hypotheses |
| [compare/session-compare.ts](src/modules/compare/session-compare.ts) | 125 | 3-way session diff engine |
| [compare/baseline-match.ts](src/modules/compare/baseline-match.ts) | 57 | Baseline session selection for comparison |
| [misc/diff-engine.ts](src/modules/misc/diff-engine.ts) | 221 | Line normalization + comparison |
| [misc/health-score.ts](src/modules/misc/health-score.ts) | 132 | Weighted health score (lint-impact based) |
| [bug-report/bug-report-collector.ts](src/modules/bug-report/bug-report-collector.ts) | 246 | Evidence collection orchestrator |
| [bug-report/bug-report-formatter.ts](src/modules/bug-report/bug-report-formatter.ts) | 168 | Markdown report formatter + executive summary |
| [misc/environment-collector.ts](src/modules/misc/environment-collector.ts) | 80 | Git state, runtime, system info |
| [search/log-search.ts](src/modules/search/log-search.ts) | 193 | Cross-session file search |
| [session/session-groups.ts](src/modules/session/session-groups.ts) | 168 | Session grouping rules |
| [session/session-group-tracker.ts](src/modules/session/session-group-tracker.ts) | 223 | DAP-anchored grouping state machine |

### UI Panels (`src/ui/`)

| File | Lines | Role |
|------|-------|------|
| [analysis/analysis-panel.ts](src/ui/analysis/analysis-panel.ts) | 186 | Analysis panel orchestrator (parallel streams + frame analysis) |
| [analysis/analysis-panel-render.ts](src/ui/analysis/analysis-panel-render.ts) | 236 | Progressive HTML rendering + diff + frames |
| [analysis/analysis-panel-styles.ts](src/ui/analysis/analysis-panel-styles.ts) | 156 | CSS + webview script (frame clicks, frameReady handler) |
| [analysis/analysis-panel-summary.ts](src/ui/analysis/analysis-panel-summary.ts) | 14 | Executive summary HTML |
| [analysis/analysis-frame-render.ts](src/ui/analysis/analysis-frame-render.ts) | 145 | Stack frame list + inline mini-analysis |
| [analysis/analysis-related-render.ts](src/ui/analysis/analysis-related-render.ts) | 119 | Related lines, files, GitHub HTML |
| [analysis/analysis-trend-render.ts](src/ui/analysis/analysis-trend-render.ts) | 43 | Per-session error trend bar chart |
| [analysis/analysis-frame-handler.ts](src/ui/analysis/analysis-frame-handler.ts) | 37 | Frame extraction + analysis |
| [analysis/analysis-project-insights.ts](src/ui/analysis/analysis-project-insights.ts) | 70 | Single-session project insights |
| [panels/bug-report-panel.ts](src/ui/panels/bug-report-panel.ts) | 190 | Bug report preview panel |
| [signals/signal-report-panel.ts](src/ui/signals/signal-report-panel.ts) | 279 | Unified Signals dashboard (former insights panel; ~14 files in `src/ui/signals/`) |
| [session/session-comparison.ts](src/ui/session/session-comparison.ts) | 208 | Side-by-side session diff |
| [panels/timeline-panel.ts](src/ui/panels/timeline-panel.ts) | 236 | SVG error/warning timeline |

---

## Finish Report (2026-06-14)

### What shipped

Predictive error surfacing (idea #9). When a capture session ends, the extension now proactively surfaces the session's most actionable errors in a single notification instead of leaving the user to open the Signals panel and hunt. The toast names how many error patterns are *new* to this session (absent from the previous sessions — a likely regression) and how many *recur* across sessions, headlines the single most actionable item, and offers an **Open Signals** action. It stays silent when nothing is actionable.

This supersedes the previous recurring-only notification (`notifyRecurringSignals` in session finalization). The net surface is unchanged — one toast per session end, only when actionable — but the message now also covers new-error regressions and ties recurring signals to the session that just ended, rather than firing on any project-wide recurring signal.

### How it works

On session end, after the fingerprint scans settle (so the current session's fingerprints are persisted), finalization calls `surfacePredictiveSignals(fileUri, out)`. That composes two already-persisted data sources — no new scan, no new storage:

- **New error patterns:** `detectRegressions()` (regression detector F7) compares this session's error fingerprints against the previous sessions loaded via `loadFilteredMetas('all')`, sorted oldest → newest.
- **Recurring errors:** `aggregateSignals('all')` yields cross-session signals; the surfacing keeps those flagged `recurring` whose fingerprint also appears in the current session's fingerprint hashes.

The branch logic that maps the two counts to a message variant, plus label truncation, lives in a vscode-free helper (`session-signal-surfacing-format.ts`) so it is unit-testable under `node --test` without the Extension Host. The host module applies `t()` to the chosen variant key.

### Files changed

- `src/modules/session/session-signal-surfacing.ts` — NEW. Composes new + recurring signals on session end and shows the toast. Fire-and-forget; any failure is caught so finalization is never broken.
- `src/modules/session/session-signal-surfacing-format.ts` — NEW. Pure variant-selection + truncation helpers (no vscode/l10n).
- `src/modules/session/session-lifecycle-finalize.ts` — replaced the `notifyRecurringSignals()` call and removed that function; now calls `surfacePredictiveSignals()`. Dropped the now-unused `aggregateSignals` import.
- `src/l10n/strings-b.ts` — added `action.openSignals` and four `msg.sessionSignals.*` notification keys (counts phrased as values, not pluralized words, because `vscode.l10n.t` has no plural support).
- `src/test/modules/session/session-signal-surfacing-format.test.ts` — NEW. 7 cases covering each count combination (both / new-only / recurring-only / none → null) and label truncation boundaries.
- `CHANGELOG.md` — Unreleased → Added entry.
- `plans/cross-session-analysis.md` — idea #9 and the priority matrix marked Done; this report.

### Verification

- `npm run check-types` — clean.
- `eslint` on the four touched source/test files — clean.
- `npm run verify:l10n-keys` — OK (all referenced `t()` keys resolve).
- `node --test` on the new format test — 7/7 pass.

### Not done

Per-error quick-actions beyond "Open Signals" (the idea text floated "quick-actions to analyze each one") are not built — the Signals panel already lists each item, so the toast links there rather than spawning N actions. No gating setting was added: the prior recurring notification had none, and this enriches that same single surface rather than adding a new one.

---

## Finish Report (2026-06-14) — "What Changed?" auto-summary (idea #10)

### What shipped

After a capture session ends, the **Saropa Log Capture** output channel now logs a "Since last session:" summary describing how the just-ended session differs from its chronological predecessor: error/warning count deltas, error fingerprints that are new versus those no longer present, and source files referenced only this session. It is written silently to the output channel (no toast) so it never competes with the predictive-surfacing notification (idea #9), and it logs nothing when the delta is empty or there is no predecessor.

### How it works

`computeSessionDelta(current, previous)` (pure, in `src/modules/compare/session-delta.ts`) diffs two `SessionMeta` objects using only persisted data: `errorCount`/`warningCount` for the count deltas, the error `fingerprints` hash sets for new/resolved errors (set difference both ways, examples resolved from each side), and the `file:`-prefixed `correlationTags` for new source files. `formatSessionDelta` renders one fact per line and returns an empty string for an empty delta. Session finalization loads the current metadata plus all session metadatas, picks the chronologically previous session (`pickPreviousMeta`, falling back to the most recent other session when the current file's metadata is still settling), and appends the formatted summary to the output channel.

### Files changed

- `src/modules/compare/session-delta.ts` — NEW. Pure delta computation + formatting (no vscode import).
- `src/modules/session/session-lifecycle-finalize.ts` — added `logWhatChanged()` + `pickPreviousMeta()` helpers, called from the post-scan block; new imports for `loadFilteredMetas`/`parseSessionDate`/`LoadedMeta` and the delta module.
- `src/test/modules/compare/session-delta.test.ts` — NEW. 6 cases: no predecessor, count deltas, new/resolved fingerprints, new source files, empty-delta silence, formatting.
- `CHANGELOG.md`, `plans/cross-session-analysis.md` — idea #10 and the priority matrix marked Done; this report.

### Verification

- `npm run check-types` — clean.
- `eslint` on the touched source/test files — clean.
- `node --test` on the new delta test — 6/6 pass.

### Omitted

Raw output-volume (total-line) delta — SessionMeta persists no per-session line count, so it is not derivable without re-reading both log files, which this lightweight summary deliberately avoids. The error/warning counts and new-file signal cover the "what changed" intent without that read.

---

## Finish Report (2026-06-14) — Ghost errors / reliability tag (idea #11)

### What shipped

Each cross-session signal in the Signal panel's "All signals" list now displays a reliability tag — the share of all considered sessions the signal appears in, as a percentage plus a coarse tier (consistent ≥80%, intermittent 25–79%, rare <25%). Intermittent signals are the classic "ghost" bugs that appear in some runs but not others; surfacing the band makes them distinguishable from always-present and one-off signals at a glance.

### How it works

`classifyReliability(sessionCount, totalSessions)` (pure, `src/modules/misc/signal-reliability.ts`) returns a `{ percentage, tier }` or `undefined` when there are fewer than two sessions (a signal seen in the only session carries no reliability information) or a zero count; the count is clamped to the total so a stale duplicate cannot report above 100%. The unified signal builder (`recurring-signal-builder.ts`) passes the total session count (the size of the metadata set it aggregates) into ranking and stamps `sessionPercentage` + `reliability` onto every `RecurringSignalEntry`. The webview signal list renders the tier from three localized templates next to the existing session-count meta.

### Files changed

- `src/modules/misc/signal-reliability.ts` — NEW. Pure classifier (vscode-free, node:test-able).
- `src/modules/misc/recurring-signal-builder.ts` — `RecurringSignalEntry` gains `sessionPercentage` + `reliability`; `rankSignals` takes the total session count and computes them.
- `src/ui/panels/viewer-signal-panel-script-part-b.ts` — render the reliability tag on each signal row.
- `src/ui/panels/viewer-signal-panel-script.ts` — `SignalScriptStrings` + defaults gain three reliability templates.
- `src/ui/panels/viewer-signal-panel.ts` — wire the localized `signal.reliability*` values into the panel strings.
- `src/l10n/strings-b.ts` — define `signal.reliabilityConsistent` / `…Intermittent` / `…Rare`.
- `src/test/modules/misc/signal-reliability.test.ts` — NEW. 6 cases (band boundaries, clamping, not-classifiable).
- `CHANGELOG.md`, `plans/cross-session-analysis.md` — idea #11 marked done; this report.

### Verification

- `npm run check-types` — clean.
- `eslint` on the seven touched source/test files — clean.
- `npm run verify:l10n-keys` — OK (the three new `signal.reliability*` keys resolve).
- `node --test` on the new classifier test — 6/6 pass.

### Not done

A dedicated spark-line glyph for reliability was not added — the existing recurring badge and trend arrow already mark frequency, and the percentage/tier text carries the ghost-error signal without new CSS.

---

## Finish Report (2026-06-14) — Per-session health score (idea #19)

### What shipped

The Signal Report overview now shows a "Health: N/100" score that condenses a session's detected signals into one gauge (100 = clean). It is computed from the session's errors, ANR risk, memory events, network failures, slow operations, and warnings, each contributing a capped penalty so a single noisy category cannot sink the score alone. The markdown export appends the factor breakdown behind the score.

### How it works

`computeSessionHealth(input)` (pure, `src/modules/misc/session-health.ts`) starts at 100 and subtracts a per-signal-type penalty (errors −10, ANR −25 once for any positive risk, memory −8, network −5, slow ops −3, warnings −2) capped per type, then clamps to [0, 100] and returns the score plus an ordered factor breakdown. The Signal Report overview maps the root-cause bundle's signal counts into that input and renders a health row (HTML) and a markdown line carrying the breakdown. This is intentionally separate from the pre-existing `health-score.ts`, which scores lint-violation impact for bug reports — a different input and purpose.

### Files changed

- `src/modules/misc/session-health.ts` — NEW. Pure scoring + capped weighting policy + factor breakdown.
- `src/ui/signals/signal-report-overview.ts` — health row in the panel overview; score + breakdown in the markdown export; bundle→input mapping helper.
- `src/l10n/strings-signals.ts` — `signals.overview.health` label.
- `src/test/modules/misc/session-health.test.ts` — NEW. 5 cases (clean, per-error penalty, per-type cap, ANR once, clamp + ordering).
- `CHANGELOG.md`, `plans/cross-session-analysis.md` — idea #19 marked done; this report.

### Verification

- `npm run check-types` — clean.
- `eslint` on the touched files — clean.
- `npm run verify:l10n-keys` — OK (`signals.overview.health` resolves).
- `node --test` on the new test — 5/5 pass.

### Pending

Session-history trend arrows (a worsening/improving indicator across the Logs list) are not built — the score is computed per session for the report but not yet persisted per session for cross-session trend rendering.

---

## Finish Report (2026-06-14) — "Why did this break?" narrative (idea #18)

### What shipped

The markdown bug report now carries a short "Why this might have broken" section just after the executive summary: a prose synthesis of who last changed the crash line (author, date, commit + message), how many sessions the error has recurred across, and whether the surrounding code changed recently — closed by a suggested-investigation line keyed to the strongest available signal. It is omitted when there is too little history to say anything non-obvious.

### How it works

`buildWhyNarrative(facts)` (pure, `src/modules/bug-report/why-narrative.ts`) takes a flat facts struct (blame author/date/message/short-hash, cross-session count + first-seen session, recent line-range commit count) and emits one sentence per available fact plus a suggestion. The suggestion branches on signal strength: recently-changed + recurring → regression in the last change here; recently-changed only → start with the most recent commit; stable + recurring → look outward at inputs/dependencies; thin history → capture another session. The bug report formatter maps `BugReportData` (blame, crossSessionMatch, lineRangeHistory) into the struct and inserts the section; nothing renders when the narrative is empty. English-only by design — the bug report markdown stays English for pasting into GitHub/Slack, like the rest of the export.

### Files changed

- `src/modules/bug-report/why-narrative.ts` — NEW. Pure narrative builder (vscode-free, node:test-able).
- `src/modules/bug-report/bug-report-formatter.ts` — `formatWhyNarrative()` maps the report data into facts and inserts the section after the summary.
- `src/test/modules/bug-report/why-narrative.test.ts` — NEW. 6 cases (empty, blame sentence, recurrence, regression suggestion, outward suggestion, singular phrasing).
- `CHANGELOG.md`, `plans/cross-session-analysis.md` — idea #18 marked done; this report.

### Verification

- `eslint` on the touched files — clean.
- `node --test` on the new narrative test — 6/6 pass.
- Type-checking of the changed files is clean; a tree-wide `check-types` currently fails only inside an unrelated, in-progress OpenTelemetry integration (`otel-traces.ts` + its `integrationsOtel` config), which is outside this change set.

### Not done

An in-panel narrative banner (the prose lives in the bug report, not the live analysis panel) and weaving import changes into the story are not built.

---

## Finish Report (2026-06-14) — Semantic error grouping (idea #13)

### What shipped

Error lines are now classified into a meaning-based category — network, filesystem, permission, validation, concurrency, or memory — independent of the exact class name or fingerprint hash. The markdown bug report tags the error with its category, so failures that mean the same thing read alike even when their wording differs.

### How it works

`classifyErrorSemantics(text)` (pure, `src/modules/analysis/error-semantics.ts`) scans an ordered pattern library and returns the first matching category, or `'other'` when nothing matches. Ordering encodes precedence: memory and permission are checked before network/filesystem/validation so a line that could match several (a permission denial mentioning a file) lands in the most informative bucket. The bug report's Error section appends a `**Category:**` line, omitted for `'other'` to avoid a noisy non-label.

### Files changed

- `src/modules/analysis/error-semantics.ts` — NEW. Pure ordered pattern-library classifier (vscode-free, node:test-able).
- `src/modules/bug-report/bug-report-formatter.ts` — `formatError` tags the error with its semantic category.
- `src/test/modules/analysis/error-semantics.test.ts` — NEW. 6 cases (network, filesystem, validation, permission precedence, memory/concurrency, other/empty fallback).
- `CHANGELOG.md`, `plans/cross-session-analysis.md` — idea #13 marked done; this report.

### Verification

- `npm run check-types` — clean (full tree).
- `eslint` on the touched files — clean.
- `node --test` on the new classifier test — 6/6 pass.

### Pending

Using the category to visually group the "all errors" / cross-session signal lists under semantic headings — the classifier is ready; only the grouped list render remains.

---

## Finish Report (2026-06-14) — Environment diff in the session delta (idea #16)

### What shipped

The "Since last session:" summary (the output-channel auto-summary from idea #10) now also reports environment fields that changed versus the previous session — app version, debug adapter, and target device — rendered as "app version: 1.1.0 → 1.2.0" lines. This puts an environment change right next to any errors that appeared or disappeared, so a coincidence (an error showing up the same run the SDK/app version changed) is easy to spot.

### How it works

`computeSessionDelta` (pure, `src/modules/compare/session-delta.ts`) gained an `environmentChanges` field. `environmentChanges()` compares a fixed set of persisted `SessionMeta` fields (`appVersion`, `debugAdapterType`, `debugTarget`) and reports only fields present in both sessions and differing — a field newly populated (absent before) is not a "change", avoiding noise on first capture. The change participates in `isEmptyDelta` (so an env-only change still surfaces) and `formatSessionDelta` (one "label: from → to" line each).

### Files changed

- `src/modules/compare/session-delta.ts` — `SessionDelta` gains `environmentChanges: EnvironmentChange[]`; new `environmentChanges()` helper; wired into compute, empty-check, and formatting.
- `src/test/modules/compare/session-delta.test.ts` — +3 cases (changed field reported, newly-populated not a change, env-only change is non-empty and formatted).
- `CHANGELOG.md`, `plans/cross-session-analysis.md` — idea #16 marked done; this report.

### Verification

- `npm run check-types` — clean (full tree).
- `eslint` on the touched files — clean.
- `node --test` on the session-delta test — 9/9 pass (6 prior + 3 new).

### Note

This diffs the persisted-metadata environment (app version / adapter / device), not a full SDK-version cross-reference computed against each individual error's presence; raw line-content diffing of two sessions remains available in `session-compare.ts`.

---

## Finish Report (2026-06-14) — Time-travel context: pre-error pause (idea #15)

### What shipped

The markdown bug report's Log Context section now highlights the largest pause among the lines that precede the error — "⏱ Largest pause in this context: 5.2s before `<line>`". A long pause is an operation boundary (the app waited on a network call, a lock, a frame) and the error followed the wait; surfacing it tells the developer the failure was downstream of a wait rather than part of a tight burst.

### How it works

`findLargestContextGap(lines)` (pure, `src/modules/bug-report/time-travel-context.ts`) walks the context lines, pulls each line's leading timestamp with the dependency-free `extractTimestamp` (not the anchored `parseTimestamp`, which would reject a full log line), and returns the largest consecutive gap ≥ 1s plus the line that follows it. Untimed lines are skipped without resetting the previous timestamp, so an interleaved untimed line can't hide a real gap. `formatContextGapNote` renders the one-line note in seconds, or '' when nothing qualifies; the bug report appends it under the Log Context block.

### Files changed

- `src/modules/bug-report/time-travel-context.ts` — NEW. Pure gap finder + note formatter (node:test-able).
- `src/modules/bug-report/bug-report-sections.ts` — `formatLogContext` appends the gap note.
- `src/test/modules/bug-report/time-travel-context.test.ts` — NEW. 5 cases (largest gap + following line, no timestamps, sub-threshold, note rendering, empty).
- `CHANGELOG.md`, `plans/cross-session-analysis.md` — idea #15 marked done; this report.

### Verification

- `npm run check-types` — clean (full tree).
- `eslint` on the touched files — clean.
- `node --test` on the new test — 5/5 pass.

### Pending

The full reconstructed "last N messages with a YOU ARE HERE marker" mini-timeline view is not built — the largest-pause highlight is the highest-signal slice; the annotated timeline render remains.

---

## Finish Report (2026-06-14) — Error attention score (idea #17)

### What shipped

A generated bug report now carries an "Attention Score" section: a composite ranking of how actionable the error is, built from signals the report already collects — whether the stack trace reaches app code, whether the referenced code changed recently, whether the error recurs across sessions, whether it's first-seen, and whether it's referenced in documentation. The factor breakdown is shown so the number is explainable.

### How it works

`scoreErrorAttention(factors)` (pure, `src/modules/analysis/error-attention.ts`) sums the weighted factors from the idea's table (app code +3, recently changed +3, recurring +2, FIXME nearby +2, first-time +1, in docs +1, common SDK −1, framework-only −2) and clamps to a floor of 0 so a net-negative error reads as "no attention needed" rather than a confusing negative. It returns the score plus an ordered (most-positive-first) contribution list. The bug report formatter derives the booleans from `BugReportData` (app frames, line-range history, cross-session count, doc matches) and renders the section, omitting it when no factor is active.

### Files changed

- `src/modules/analysis/error-attention.ts` — NEW. Pure weighted scorer + breakdown (node:test-able).
- `src/modules/bug-report/bug-report-formatter.ts` — `formatAttention()` derives factors and renders the section.
- `src/test/modules/analysis/error-attention.test.ts` — NEW. 5 cases (empty, summation, negative floor, net-above-floor, ordering).
- `CHANGELOG.md`, `plans/cross-session-analysis.md` — idea #17 marked done; this report.

### Verification

- `npm run check-types` — clean (full tree).
- `eslint` on the touched files — clean.
- `node --test` on the new test — 5/5 pass.

### Pending

Running the scorer per-error to re-order the analysis panel's error list (the panel re-rank). The FIXME-nearby and common-SDK factors are defined in the scorer but not yet fed by the bug report, which has no annotation field on its file analyses.
