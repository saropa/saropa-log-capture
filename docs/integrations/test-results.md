# Integration: Test Results

## Problem and Goal

Debug sessions often follow **test runs** (unit, integration, e2e). When a failure appears in the debug log, knowing whether "the last test run passed or failed" and **which tests failed** helps decide if the issue is regression or environment. Today test results live in the Test view or in output files (JUnit XML, TAP, etc.). This integration **links the last test run** to the session so that the context header or a panel shows test summary (pass/fail counts, failed test names) and optionally a deep link to the failing tests—making "did tests pass before this run?" visible at a glance.

**Goal:** Optionally attach **last test run** information to each session: (1) **Summary:** total, passed, failed, skipped; (2) **Failed tests:** list of names (and optional file:line); (3) **Source:** from a **file** (e.g. JUnit XML, TAP, or a simple JSON written by the test runner) or from **VS Code Test API** if the run was in the same workspace. Store in header and/or sidecar; viewer shows "Last test run" with link to open test results or jump to failing tests.

---

## Data Sources

| Source | Format | How to get it |
|--------|--------|----------------|
| **JUnit XML** | junit.xml, test-results.xml | User configures path; extension reads after session start or on demand |
| **TAP** | .tap output | Parse TAP stream or file |
| **VS Code Test API** | TestRunResult, test states | If tests were run in VS Code, we can read last run from TestController (if exposed) |
| **Custom JSON** | User or script writes last-run.json | e.g. `{ passed, failed, skipped, failedTests: [{ name, file, line }] }` |
| **Mocha / Jest** | JSON reporters, or stdout in Debug Console | If test run is captured in the same debug session, we could parse (complex). Simpler: separate file. |
| **Azure Pipelines / GitHub** | Test run from CI | See Build/CI integration; CI often has test results; link to "Test results" tab in pipeline |

**Recommended v1:** **File-based:** User (or test script) writes a **last test run** file to a known path (e.g. `.saropa/last-test-run.json` or `test-results/last-run.json`) with a simple schema. Extension reads at session start and attaches to header/meta. Optional: **parse JUnit XML** from a configured path (e.g. `coverage/junit.xml`) so that tools that already produce JUnit can be used without a custom writer.

---

## Integration Approach

### 1. When to collect

- **Session start:** If `saropaLogCapture.testResults.enabled`, read **last test run file** (and/or **JUnit path**). Parse and get summary + failed list. Append to SessionContext (e.g. `testResults?: TestResultsSummary`) and write in header and/or .meta.json. If file is missing or stale (e.g. older than 24 h), skip or show "No recent test run."
- **On demand:** Command "Saropa Log Capture: Refresh test results" re-reads file and updates meta for current session.

### 2. What to store

- **Header:** `Last test run: 45 passed, 2 failed, 3 skipped` and optional `Failed: foo.test.ts, bar.test.ts`. Or one line: `Tests: 45/50 passed (2 failed); see basename.test-results.json`.
- **.meta.json:** `testResults: { total, passed, failed, skipped, failedTests: [{ name, file?, line? }], sourcePath?, timestamp? }`.
- **Sidecar (optional):** Copy or link to full JUnit/JSON for "Open full results."

### 3. Viewer

- When meta has testResults, show "Last test run" in header block: summary and list of failed tests; each failed test clickable (open file:line if available). Optional "Open test results file" if we stored path.

---

## User Experience

### Settings (under `saropaLogCapture.testResults.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable test result context |
| `source` | `"file"` \| `"junit"` | `"file"` | File = custom JSON; junit = parse JUnit XML |
| `lastRunPath` | string | `".saropa/last-test-run.json"` | Path to last run file (file source) |
| `junitPath` | string | `""` | Path to JUnit XML (junit source); e.g. test-results/junit.xml |
| `fileMaxAgeHours` | number | `24` | Ignore file older than this |
| `includeFailedListInHeader` | boolean | `false` | List failed test names in header (can be long) |
| `includeInBugReport` | boolean | `true` | Include test summary and failed list in bug report when available |

### Commands

- **"Saropa Log Capture: Refresh test results"** — Re-read last run file / JUnit and update current session meta.
- **"Saropa Log Capture: Open last test results"** — Open the source file (last-run.json or junit.xml) or full results sidecar.
- **"Saropa Log Capture: Go to failing test"** — Quick pick of failed tests; open file:line.

### UI

- **Header:** One line summary; optional second line with failed count and "see ...".
- **Viewer:** "Test results" section: summary + list of failed tests (click → open file).
- **Bug report:** Section "Last test run" with summary and failed list.

---

## Implementation Outline

### Components

1. **Last-run file schema**
   - Expected JSON: `{ timestamp?: string, total: number, passed: number, failed: number, skipped?: number, failedTests?: [{ name: string, file?: string, line?: number }] }`. Read with fs; check mtime vs fileMaxAgeHours.

2. **JUnit parser**
   - Parse XML (use fast-xml-parser or built-in); extract from `<testsuites>`: totalTests, failures, errors, skipped; from `<testcase>` with failure/error: name, file, line (from classname or optional file attribute). Map to same TestResultsSummary shape. Handle large files: only read summary and first N failed tests (e.g. 50).

3. **Session start**
   - If enabled, read from source (file or junit); build TestResultsSummary. Add to SessionContext or write to .meta.json (if meta is written at start; else store in memory and write at session end). In generateContextHeader, if testResults present, append line(s).

4. **Viewer**
   - Read meta; if testResults, render "Last test run" with failed list; each item: command "open file:line" with uri and line.

5. **Bug report**
   - Include testResults in bug report when includeInBugReport and data available.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.testResults.*` as above.
- **File format:** Document last-test-run.json schema for test scripts (e.g. in post-test script: write summary to .saropa/last-test-run.json).

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| Stale results | fileMaxAgeHours; show "No recent test run" when stale |
| Many failed tests | Cap list in header; full list in viewer and bug report |
| JUnit variants | Support common structure; document supported format |
| Tests run in different workspace | lastRunPath is workspace-relative; user can point to shared path |

**Alternatives:**

- **VS Code Test API:** Subscribe to test runs and store last result in extension state. Tighter integration but depends on Test API surface.
- **CI test results:** Link to "Test results" tab in GitHub Actions / Azure (see Build/CI); separate from "last local run."

---

## References

- JUnit XML: [Schema / common format](https://llg.cubic.org/docs/junit/)
- Existing: build-ci (file-based build info), package-lockfile (file read at start), bug report sections.
