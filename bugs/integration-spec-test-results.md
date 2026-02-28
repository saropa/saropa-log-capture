# Spec: Test Results Integration

**Adapter id:** `testResults`  
**Status:** Not implemented  
**Full design:** [docs/integrations/test-results.md](../docs/integrations/test-results.md)

## Goal

Attach last test run summary (pass/fail counts, failed test names) and link to failing tests.

## Config

- `saropaLogCapture.integrations.adapters` includes `testResults`
- `saropaLogCapture.integrations.testResults.*`: source (file | junit), lastRunPath, junitPath, fileMaxAgeHours, includeFailedListInHeader, includeInBugReport

## Implementation

- **Provider:** `onSessionStartSync`: read lastRunPath (JSON) or junitPath (XML); parse summary + failed list; return header line(s) + meta. If file stale, skip.
- **Viewer:** "Test results" section with summary and failed list; click to open file:line.
- **Performance:** Sync read; small file. JUnit parse with size cap.
- **Status bar:** "Tests" when contributed.

## UX

- No spinner (sync). Section shows "45/50 passed (2 failed)" with links.
