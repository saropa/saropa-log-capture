# Bug 036 — Report clicks evict session logs

## Status: Fixed

## Severity: Medium

Clicking signal hypothesis reports can silently delete real session log files via retention eviction.

## Problem

Every hypothesis "open report" click in the Signals panel auto-writes a `<timestamp>_signal_<template>.md` file into the reports directory. The `.md` file is treated as a tracked file type and counts toward the `maxLogFiles` retention limit. Clicking 10 hypotheses writes 10 `.md` files, potentially evicting 10 real session log files.
(`src/ui/signals/signal-report-panel.ts:63,294-321`)

## Reproduction

1. Set `maxLogFiles` to a small number (e.g. 5).
2. Accumulate several real session log files up to the limit.
3. Open the Signals panel and click "open report" on several hypotheses.
4. Observe real session log files evicted from the reports directory to make room for the generated `.md` report files.

**Frequency:** Always

## Root Cause

Signal reports are written to the same directory and namespace as session logs, and the retention logic doesn't distinguish between file types.

## Proposed Fix

Either write signal reports to a separate directory (e.g., `reports/`), or exclude `.md` files from the `maxLogFiles` retention count. Add a report-specific retention limit if needed.

## Changes Made

`src/modules/config/config-file-utils.ts` now excludes the `reports/` subdirectory from file-retention scanning:

- Added `RETENTION_EXCLUDED_DIR = 'reports'` — the directory signal-report clicks write generated `.md` hypothesis reports into (`signal-report-panel.ts`).
- `collectFiles()` (backs `readTrackedFiles`, used by `enforceFileRetention` in `file-retention.ts`) now skips recursing into any directory named `reports` during its subfolder walk, in addition to the existing dotfile skip.
- `collectFilesStreaming()` (backs `readTrackedFilesStreaming`, used by the Project Logs sidebar streaming preview) got the same skip so the two file-listing code paths stay consistent — reports still appear in the file browser (they're not excluded from `isTrackedFile`), they just no longer compete with session logs for the `maxLogFiles` slot.

Root cause was that `enforceFileRetention` calls `readTrackedFiles` with `includeSubfolders: true` by default, and `.md` is in `DEFAULT_FILE_TYPES`, so generated reports were silently recursed into and counted toward the eviction limit alongside real session logs — exactly as the sweep report predicted.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
