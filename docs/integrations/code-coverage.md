# Integration: Code Coverage

## Problem and Goal

When debugging a failure, knowing **which code paths were (or weren’t) covered** in the run can explain missing error handling or unexpected branches. Coverage reports (lcov, Cobertura, OpenCover) are usually viewed in a separate tool. This integration **links the last coverage run** to the session so that the context header or viewer can show "Coverage: 78%" and optionally "Open coverage report" or highlight covered/uncovered lines when navigating from the log to source.

**Goal:** Optionally attach **code coverage context** to the session: (1) **Summary:** overall line (and optional branch) coverage percentage; path to coverage report file. (2) **Source:** From a **coverage file** (e.g. `coverage/lcov.info`, `coverage/cobertura.xml`) written by the test/run in the workspace. (3) **Display:** One line in header; viewer shows "Coverage" with link to open report or to a coverage viewer. Optional: when user navigates from log to source, show whether that line was covered (e.g. gutter or hover)—requires parsing coverage and matching to open file.

---

## Data Sources

| Source | Format | How to get it |
|--------|--------|----------------|
| **lcov** | coverage/lcov.info | Read after session start; parse summary (lines hit/total) |
| **Cobertura** | cobertura.xml | Parse XML for line-rate, branch-rate |
| **Istanbul / NYC** | coverage/coverage-final.json | JSON with file → coverage map; compute summary |
| **VS Code Coverage** | Extension that exposes coverage | If Coverage extension API exists, query last run |
| **Custom** | User writes .saropa/coverage-summary.json | e.g. `{ linePercent, branchPercent?, path }` |

**Recommended v1:** **File-based.** User configures path to coverage summary file or to lcov/Cobertura. Extension reads at session start; parses summary (line coverage %); stores in meta and optional header line. "Open coverage report" opens the file or the HTML report (e.g. coverage/index.html) if path points to dir.

---

## Integration Approach

### 1. When to collect

- **Session start:** If `saropaLogCapture.coverage.enabled`, read coverage file from configured path (e.g. `coverage/lcov.info` or `coverage/coverage-summary.json`). Parse summary; add to SessionContext or .meta.json. Do not block on large files—parse only summary section (lcov: look for "end_of_record" and aggregate; or read first N lines for summary).

### 2. What to store

- **Header:** `Coverage:    78% lines (see coverage/lcov.info)`.
- **.meta.json:** `coverage: { linePercent, branchPercent?, reportPath }`.
- **Viewer:** "Coverage" line with "Open report" button.

### 3. Optional: line-level for "Go to source"

- If we store path to lcov/cobertura and user clicks "Go to source" from log, we could look up that file:line in coverage data and show "Covered" or "Uncovered" in hover. Heavier; phase 2.

---

## User Experience

### Settings (under `saropaLogCapture.coverage.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Include coverage context |
| `reportPath` | string | `"coverage/lcov.info"` | Path to lcov.info, cobertura.xml, or coverage-summary.json |
| `includeInHeader` | boolean | `true` | Add coverage line to header |

### Commands

- **"Saropa Log Capture: Open coverage report"** — Open reportPath (file or directory for HTML).

---

## Implementation Outline

- **Parser:** For lcov, read file and sum hit/total from LF/LC lines. For cobertura, parse XML line-rate. For coverage-summary.json, read linePercent. Return `{ linePercent, branchPercent?, reportPath }`. Write to meta and header. Viewer: show line and "Open report" (vscode.open with reportPath).

---

## Risks and Alternatives

- **Stale report:** Coverage from previous run; document "Run tests with coverage before debugging."
- **Large lcov:** Parse only summary; or read last run from a small summary file written by user script.

---

## References

- [lcov format](http://ltp.sourceforge.net/coverage/lcov.php); [Cobertura XML](https://cobertura.sourceforge.io/xml/coverage-04.dtd).
