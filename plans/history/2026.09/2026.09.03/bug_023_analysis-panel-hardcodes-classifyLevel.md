# Bug 023 — Analysis panel hardcodes classifyLevel parameters

## Status: Fixed

## Severity: High

The analysis panel ignores user-configured level detection settings, producing severity classifications that disagree with the main viewer.

## Problem

The analysis panel calls `classifyLevel(loose, stdout)` with hardcoded parameters, ignoring the user's `levelDetection` and `stderrTreatAsError` settings. Users who configure strict level detection or stderr-as-error see different severity classifications in the viewer vs. the analysis panel.

## Reproduction

1. Set `levelDetection` to "strict" and/or enable `stderrTreatAsError`
2. Open the analysis panel for a session with mixed stdout/stderr lines
3. Compare severity classification against the main viewer for the same lines
4. Observe mismatched classifications

**Frequency:** Always (when non-default level settings are configured)

## Root Cause

Analysis panel was written before the configurable level detection settings existed and was never updated to read them.
(`src/ui/analysis/analysis-panel.ts:63-65`)

## Proposed Fix

Read `levelDetection` and `stderrTreatAsError` from the current configuration and pass them to `classifyLevel()`.

## Changes Made
`showAnalysis()` in `src/ui/analysis/analysis-panel.ts` (line ~71) now calls `getConfig()` fresh on every invocation and passes `cfg.levelDetection === 'strict'` and `cfg.stderrTreatAsError` into `classifyLevel()`, instead of the previous hardcoded `false, false`. Comment at the call site explicitly references bug_023.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
