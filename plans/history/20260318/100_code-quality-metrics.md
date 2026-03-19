# Integration: Code Quality Metrics

**Status: Implemented (Phase 3 complete).** Moved to `bugs/history/20260318/` after implementation. Commands "Show code quality for frame" and "Open quality report"; quality popover on stack frame context menu; `includeInBugReport` and bug-report section; heatmap line backgrounds; codeQuality payload sent to viewer on load.

**Context (Insights):** Quality metrics are **viewer- and session-centric**: coverage badges and quality data apply to the log being viewed and the stack frames in it. The **Insights panel** (lightbulb icon) unifies Cases, Recurring errors, Frequently modified files, Environment, and Performance; it does not replace the viewer's per-frame quality UI. Commands like "Show code quality for frame" and the expandable quality panel live in the **log viewer** and **Analysis panel** (error analysis). The `quality.json` sidecar remains the session-end artifact. No change to the code quality integration scope.

---

## Implementation Status

| Phase | Component | Status | Files |
| ----- | --------- | ------ | ----- |
| 1 | Per-file coverage parser (LCOV/Cobertura/Istanbul) | Done | `coverage-per-file.ts`, `coverage-per-file.test.ts` |
| 1 | Coverage badges on stack frames in viewer | Done | `viewer-quality-badge.ts`, `viewer-styles-quality.ts` |
| 1 | Coverage map → webview data flow (`lookupQuality`) | Done | `viewer-provider-helpers.ts`, `viewer-data.ts` |
| 1 | Flat `quality.json` sidecar from coverage provider | Done | `code-coverage.ts` |
| 2 | Shared quality types (`FileQualityMetrics`, etc.) | Done | `quality-types.ts` |
| 2 | Lint report reader (ESLint JSON) | Done | `quality-lint-reader.ts`, `quality-lint-reader.test.ts` |
| 2 | Comment density scanner | Done | `quality-comment-scanner.ts`, `quality-comment-scanner.test.ts` |
| 2 | `codeQuality` provider (orchestrator + enriched sidecar) | Done | `code-quality-metrics.ts`, `code-quality-metrics.test.ts` |
| 2 | Settings (`lintReportPath`, `scanComments`, `coverageStaleMaxHours`) | Done | `package.json`, `config-types.ts`, `integration-config.ts` |
| 3 | Commands ("Show code quality for frame", "Open quality report") | Done | `commands-quality.ts`, `viewer-message-handler-panels.ts`, context menu |
| 3 | Expandable quality panel in viewer | Done | Quality popover: `viewer-quality-popover-script.ts`, `code-quality-handlers.ts`; `setCodeQualityPayload` on load |
| 3 | Bug report integration (`includeInBugReport` setting) | Done | `config-types.ts`, `integration-config.ts`, `bug-report-collector.ts`, `bug-report-sections.ts`, `bug-report-formatter.ts` |
| 3 | Heatmap (color-code frames by coverage) | Done | `viewer-data-helpers-render.ts`, `viewer-styles-quality.ts` |
| — | Dart analyze JSON lint format | Not started | — |
| — | `enabled` / `coverageReportPath` / `includeUncoveredRanges` settings | Not needed (reuses `coverage` provider settings) | — |

---

## Problem and Goal

When a log contains stack traces or file references, developers often need to answer: "How well-tested is this code? Is it documented? Does it have known lint issues?" Today that context requires switching to coverage reports, lint output, and documentation browsers — all separate from the log. This integration **overlays per-file quality metrics on code referenced in the captured log** so that the viewer can show, for each stack frame or file reference, how healthy that code is.

**Goal:** At session end, extract all source file references from the captured log (stack frames, file paths), look up quality data for each (coverage, test association, lint status, documentation density), and present a **per-file quality summary** in the viewer and sidecar — so that "the code that failed" comes with its quality context.

This complements the existing `coverage` and `testResults` providers, which give **project-wide aggregates** in the header. This integration gives **per-file, per-frame granularity** tied to the code that actually appeared in the log.

---

## Data Sources

| Source                    | Format                                                      | What it provides                                                                                   |
| ------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **lcov.info**             | LCOV                                                        | Per-file line and branch coverage (DA:, BRDA: records per SF: section)                             |
| **cobertura.xml**         | Cobertura XML                                               | Per-file / per-class line and branch rates                                                         |
| **coverage-summary.json** | Istanbul JSON                                               | Per-file line, statement, branch, function percentages                                             |
| **Lint output**           | JSON (ESLint `--format json`, `dart analyze --format=json`) | Per-file warning and error counts                                                                  |
| **Test mapping**          | lcov SF→TN or custom test-to-file map                       | Which test suites cover a given file                                                               |
| **Source files**          | Raw source                                                  | Comment density (lines of comments / lines of code) and JSDoc/dartdoc presence on exported symbols |

The most portable approach: **lcov.info** (widely supported across languages) for coverage, plus optional **lint JSON** and **source scan** for documentation density.

---

## Integration Approach

### 1. When to collect

- **Session start:** The `coverage` provider parses the coverage report once and builds a per-file map in memory. As stack frame lines arrive during the session, the extension looks up coverage for each app-code frame and attaches a `qualityPercent` to the line — following the same pattern as the `fw` flag. This gives real-time badges with no re-parsing.

- **Session end:** Writes a `basename.quality.json` sidecar with the per-file coverage map for offline tools or export. Clears the in-memory map.

### 2. File reference extraction

Reuse `stack-parser.ts:isStackFrameLine()` and existing frame parsing to identify lines containing file paths. Extract the file path and optional line number from each frame. Deduplicate to a set of workspace-relative paths. Only app-code files are relevant (skip framework frames via `isFrameworkFrame()`).

Supported frame formats (already handled by the stack parser):

- `    at Function (file.ts:42:10)` — Node/JS
- `#0  main (package:app/main.dart:15)` — Dart
- `  File "app/views.py", line 23` — Python
- `    app/handler.go:45` — Go
- Plain file paths in log messages: `/src/foo/bar.ts:12`

### 3. Per-file quality lookup

For each referenced file:

| Metric                    | Source                                                  | How                                                                             |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Line coverage %**       | lcov `DA:` records for that file's `SF:` section        | Sum hit/found for lines in that file                                            |
| **Branch coverage %**     | lcov `BRDA:` records                                    | Sum hit/found for branches                                                      |
| **Function coverage %**   | lcov `FNDA:` records                                    | Sum hit/found for functions                                                     |
| **Uncovered line ranges** | lcov `DA:lineNum,0`                                     | Collect line numbers with 0 hits; compress to ranges                            |
| **Covering tests**        | lcov `TN:` (test name) preceding the file's `SF:` block | List test names that exercised this file                                        |
| **Lint warnings**         | ESLint/analyzer JSON output                             | Count of warnings and errors for this file path                                 |
| **Comment density**       | Source file scan                                        | `commentLines / codeLines` ratio; presence of JSDoc/dartdoc on exported symbols |

### 4. Viewer experience

- **Quality badge on stack frames:** In the viewer, each app-code stack frame line can show a small badge: e.g. `78%` (green), `32%` (red), `—` (no data). Click to expand.
- **Quality panel:** When a frame is selected, a "Code Quality" panel shows:
  - Coverage: 78% lines, 62% branches, 5 uncovered lines near the frame
  - Tests: `auth.test.ts`, `login.test.ts` cover this file
  - Lint: 2 warnings, 0 errors
  - Docs: 65% of exported functions have JSDoc
- **Heatmap (optional, phase 2):** Color-code stack frames by coverage — green (>80%), yellow (50–80%), red (<50%), grey (no data).
- **Sidecar:** `basename.quality.json` contains all per-file data for offline tools or export.

---

## User Experience

### Settings (under `saropaLogCapture.integrations.codeQuality.*`)

| Setting                 | Type    | Default | Status  | Description                                                                 |
| ----------------------- | ------- | ------- | ------- | --------------------------------------------------------------------------- |
| `lintReportPath`        | string  | `""`    | Done    | Path to cached lint output (ESLint JSON); empty = skip                      |
| `scanComments`          | boolean | `false` | Done    | Scan referenced source files for comment/doc density                        |
| `coverageStaleMaxHours` | number  | `24`    | Done    | Ignore coverage report older than this (hours); 0 = no limit                |
| `includeInBugReport`    | boolean | `false` | Done    | Include quality summary in bug report for referenced files                  |

Coverage report path and enablement are handled by the existing `coverage` provider settings. The `codeQuality` provider is enabled by including `'codeQuality'` in the `integrations.adapters` array.

### Commands

- **"Saropa Log Capture: Show code quality for frame"** — From viewer with a selected stack frame, show the quality panel for that file (viewer/Analysis panel context; not in the Insights panel).
- **"Saropa Log Capture: Open quality report"** — Open the `basename.quality.json` sidecar in the editor.

### UI

- **Viewer:** Badge on stack frame lines; expandable quality panel. Context menu: "Show code quality."
- **Bug report:** Optional section listing referenced files with low coverage or lint issues.

---

## Implementation Outline

### Components — Done

1. **Per-file coverage parser** (`coverage-per-file.ts`) — **Phase 1, complete.**
   - Parses LCOV (`SF:`/`LF:`/`LH:` records), Cobertura XML (`<class>` elements), and Istanbul JSON (`coverage-summary.json`).
   - Auto-detects format by extension. Path normalization handles Windows backslashes, drive letters, and suffix matching.
   - `lookupCoverage(map, filePath)` with exact → suffix → unambiguous basename fallback.
   - 15 unit tests in `coverage-per-file.test.ts`.

2. **Coverage badges on stack frames** — **Phase 1, complete.**
   - `viewer-quality-badge.ts` (webview JS) renders `<span class="quality-badge">` on stack-header and stack-frame lines.
   - `viewer-styles-quality.ts` (CSS) color-codes: green (≥80%), yellow (50–79%), red (<50%).
   - `lookupQuality()` in `viewer-provider-helpers.ts` bridges extension → webview via `PendingLine.qualityPercent`.
   - Toggleable via Decoration Settings (`decoShowQuality`).

3. **Shared quality types** (`quality-types.ts`) — **Phase 2, complete.**
   - `FileQualityMetrics`, `CodeQualityPayload`, `CodeQualitySummary`, `FileLintData`, `FileCommentData`.

4. **Lint report reader** (`quality-lint-reader.ts`) — **Phase 2, complete.**
   - Parses ESLint JSON output (`[{ filePath, messages: [{ severity, line, message }] }]`).
   - Filters to referenced files only (suffix matching). 5 MB file size cap.
   - Output per file: `{ warnings, errors, topMessages }` (top 3 messages).
   - 11 unit tests in `quality-lint-reader.test.ts`.

5. **Comment density scanner** (`quality-comment-scanner.ts`) — **Phase 2, complete.**
   - Language-aware comment counting: C-style (`//`, `/* */`, `///`) and hash (`#`).
   - JSDoc/dartdoc detection on exported symbols (heuristic).
   - Caps: 20 files max, 100 KB per file. Uses `vscode.workspace.fs`.
   - Output per file: `{ commentRatio, documentedExports, totalExports }`.
   - 14 unit tests in `quality-comment-scanner.test.ts`.

6. **`codeQuality` provider** (`code-quality-metrics.ts`) — **Phase 2, complete.**
   - `id: 'codeQuality'`, `onSessionEnd` only.
   - File reference extraction: `extractReferencedFiles()` scans log with `isStackFrameLine()` + `extractSourceReference()`, filters framework frames, deduplicates.
   - Snapshots `getPerFileCoverageMap()` before coverage provider clears it.
   - Checks coverage staleness (`coverageStaleMaxHours`).
   - Orchestrates: coverage lookup → lint reader → comment scanner → `CodeQualityPayload`.
   - Returns enriched `quality.json` sidecar + meta contribution.
   - 10 unit tests in `code-quality-metrics.test.ts`.

7. **Settings** — **Phase 2, complete.**
   - `saropaLogCapture.integrations.codeQuality.lintReportPath` (string, default `""`)
   - `saropaLogCapture.integrations.codeQuality.scanComments` (boolean, default `false`)
   - `saropaLogCapture.integrations.codeQuality.coverageStaleMaxHours` (number, default `24`)
   - Config type: `IntegrationCodeQualityConfig` in `config-types.ts`.
   - Enabled via `'codeQuality'` in `integrationsAdapters` array.

### Components — Phase 3 (Done)

8. **Commands**
   - "Saropa Log Capture: Show code quality for frame" — context menu on stack frames; from palette shows hint to right-click a frame.
   - "Saropa Log Capture: Open quality report" — opens `basename.quality.json` sidecar for current log.

9. **Quality panel in viewer**
   - Webview receives `meta.integrations.codeQuality` when loading a log (`setCodeQualityPayload`).
   - Right-click stack frame → "Show code quality" opens a popover: coverage %, lint warnings/errors, doc density for that file. Data from meta or sidecar.

10. **Bug report integration**
    - `includeInBugReport` setting (default false); when true, bug report includes "Code Quality (referenced files)" table for files with low coverage (<80%) or lint issues.

11. **Heatmap**
    - Stack frame/header lines get class `line-quality-high` / `line-quality-med` / `line-quality-low` when quality badge is shown; subtle background tint in `viewer-styles-quality.ts`.

### Future Enhancements

- **Dart analyze JSON** — extend `quality-lint-reader.ts` to parse `dart analyze --format=json`.
- **Branch/function coverage** — extend `coverage-per-file.ts` to parse `BRDA:` and `FNDA:` records per file.
- **Uncovered line ranges** — collect `DA:lineNum,0` from lcov; compress to ranges.
- **Covering tests** — extract `TN:` (test name) from lcov per-file sections.

### Data shape

Defined in `quality-types.ts`. The implemented types include `linePercent`, `lintWarnings`, `lintErrors`, `lintTopMessages`, `commentRatio`, `documentedExports`, and `totalExports`. Branch/function coverage, uncovered ranges, and covering tests are reserved for future expansion.

### Performance and safety

- **Only referenced files:** Do not parse coverage for the entire project — only files that appeared in stack frames. This keeps the work proportional to the log content, not the project size.
- **Stale data check:** If coverage report is older than `coverageStaleMaxHours`, skip and note "stale" in meta (viewer shows "coverage data may be outdated").
- **File size caps:** Skip coverage reports > 10 MB, lint reports > 5 MB, source files > 100 KB (for comment scan).
- **No blocking:** Runs at session end (async); does not slow session start or DAP handling.
- **Graceful degradation:** If coverage report is missing, show lint and comments only. If nothing is available, provider returns no contributions silently.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.integrations.codeQuality.*` (follows integration settings convention).
- **Coverage path:** Reuses `saropaLogCapture.integrations.coverage.reportPath` — no duplication.
- **Workspace-specific:** `lintReportPath` varies per project.
- **Enablement:** Add `'codeQuality'` to `saropaLogCapture.integrations.adapters` array.

---

## Relationship to Existing Providers

| Provider          | Scope                         | When            | What                                          |
| ----------------- | ----------------------------- | --------------- | --------------------------------------------- |
| `coverage`        | Project-wide                  | Session start   | Aggregate % in header                         |
| `testResults`     | Project-wide                  | Session start   | Pass/fail summary in header                   |
| **`codeQuality`** | **Per-file (log-referenced)** | **Session end** | **Coverage, lint, docs per stack-frame file** |

The `codeQuality` provider is complementary: `coverage` tells you "project is at 72%", while `codeQuality` tells you "the file that crashed is at 23% coverage, has 5 lint warnings, and no JSDoc on the failing function."

---

## Risks and Alternatives

| Risk                                     | Mitigation                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Coverage report missing or not generated | Graceful skip; show "no coverage data" badge; prompt user to run tests                       |
| Coverage report very large (monorepo)    | Only parse sections for referenced files (seek by `SF:` path match)                          |
| Lint report format varies by tool        | Start with ESLint JSON and Dart analyze; document expected format; allow custom path         |
| Comment scanning slow on many files      | Cap at 20 referenced files; skip files > 100 KB; make opt-in (`scanComments: false` default) |
| Language-specific frame parsing          | Reuse and extend `stack-parser.ts` patterns; unsupported formats just yield no file path     |
| Stale coverage data misleads             | Check mtime; show "stale" warning if older than threshold                                    |

**Alternatives:**

- **VS Code Coverage API:** VS Code has a Test Coverage API (since ~1.88). Could read from that instead of files. Pro: always current. Con: only available if tests ran in the same session via VS Code test runner; not portable.
- **Language server integration:** Query language servers for diagnostics (lint) instead of reading cached files. Pro: always current. Con: requires active language server; complex; varies by language.
- **Real-time overlay:** Instead of session-end batch, show quality data as stack frames arrive during the session. Con: coverage data doesn't change mid-session; adds complexity for minimal benefit.

---

## Known Limitations

- **Live sessions only:** Coverage badges appear during live debug sessions. When reopening a saved `.saropa.log` file, badges are not shown because the coverage map is not persisted. The `quality.json` sidecar contains the data for future offline rendering.
- **Module-level coverage map:** The `activePerFileMap` is a singleton shared across the extension. Overlapping debug sessions can overwrite each other's maps. The `codeQuality` provider snapshots the map at the start of `onSessionEnd` to avoid races with the `coverage` provider clearing it.
- **Basename ambiguity:** If multiple files in the project share the same basename (e.g. `index.ts`), the lookup returns `undefined` rather than guessing wrong.
- **ESLint JSON only:** The lint reader currently supports ESLint `--format json` output. Dart analyze JSON is not yet supported.
- **Export detection heuristic:** The comment scanner uses simple regex patterns to detect exported symbols and preceding doc comments. It may miss complex export patterns or decorators.

---

## References

- **Provider:** `code-quality-metrics.ts` (orchestrator), `quality-types.ts` (shared types).
- **Data sources:** `quality-lint-reader.ts` (ESLint JSON), `quality-comment-scanner.ts` (comment density), `coverage-per-file.ts` (per-file coverage).
- **Reused:** `code-coverage.ts` (aggregate parsing + `activePerFileMap`), `stack-parser.ts` (frame classification), `source-linker.ts` (file:line extraction).
- **Tests:** `quality-lint-reader.test.ts`, `quality-comment-scanner.test.ts`, `code-quality-metrics.test.ts`, `coverage-per-file.test.ts`.
- VS Code Test Coverage API: [TestCoverage](https://code.visualstudio.com/api/extension-guides/testing#test-coverage) — potential future data source.
- lcov format: [lcov geninfo man page](https://linux.die.net/man/1/geninfo) — `SF:`, `DA:`, `BRDA:`, `FN:`, `FNDA:`, `TN:`, `LF:`, `LH:` records.
