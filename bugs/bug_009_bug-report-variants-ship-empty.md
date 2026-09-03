# Bug 009 — GitHub Issue and Handoff bug-report variants ship empty

## Status: Fixed

## Severity: Critical

Two of the three bug-report output formats produce no usable content.

## Problem

The GitHub Issue and Handoff bug-report variants produce completely empty output — empty fingerprint, empty output body, empty sessionInfo. Only the default "Markdown" variant actually generates content. (`src/ui/panels/bug-report-panel.ts` → `src/ui/panels/report-variant-runner.ts:27`)

## Reproduction

1. Open the bug-report panel and generate a report using the default Markdown variant; observe full content.
2. Switch the variant to "GitHub Issue" and generate; observe empty fingerprint/body/sessionInfo.
3. Switch to "Handoff" and generate; observe the same emptiness.

**Frequency:** Always

## Root Cause

The variant runner dispatches to format-specific builder functions for each variant, but the builders for the GitHub Issue and Handoff templates were never implemented — they exist as stubs that return empty strings, and no error is surfaced when this happens.

## Proposed Fix

Either implement the GitHub Issue and Handoff variant builders using the same underlying data the Markdown variant already assembles, or remove the broken variants from the UI selector until they are implemented. Add a test that generates a report for a sample session in every registered variant and asserts none of fingerprint/body/sessionInfo is empty.

## Changes Made

- The `exportGitHubIssue` / `copyHandoffBundle` commands were already removed from the
  command palette and `package.json` in an earlier pass — verified against current
  `src/commands-bug-report.ts`, only `saropaLogCapture.createReportFile` (the working
  Markdown variant) is registered.
- Follow-up cleanup in this pass: `src/modules/bug-report/report-variant-runner.ts` and
  `report-file-variants.ts` (the broken GitHub Issue / Handoff formatters, which
  hardcoded `sessionInfo`/`fullOutput`/`fullOutputLineCount` to empty) had been kept in
  the tree "for the future fix" but had zero live callers — `collectAndFormatVariant()`
  was referenced only in comments, not imported by any command, and had no test
  coverage. Deleted both files rather than carry dead scaffolding indefinitely; a real
  fix should be built fresh against `collectBugReportData()` when the feature is
  reintroduced, rather than resurrecting this runner.
- Updated the explanatory comment in `commands-bug-report.ts` to stop pointing at the
  now-deleted `report-variant-runner.ts`.

## Tests Added

None — this pass only deleted unreferenced dead code; no behavior changed. Re-adding the
GitHub Issue / Handoff variants needs new formatter tests per the original proposed fix.

## Commits
<!-- Add commit hashes as fixes land. -->
