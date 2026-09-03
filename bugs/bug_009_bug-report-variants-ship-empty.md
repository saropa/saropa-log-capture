# Bug 009 — GitHub Issue and Handoff bug-report variants ship empty

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files and what they verify. -->

## Commits
<!-- Add commit hashes as fixes land. -->
