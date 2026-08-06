# Bug 002 — Smart bookmark modal fires on pre-launch device backlog

## Status: Fixed

<!-- Status values: Open -> Investigating -> Fix Ready -> Fixed (pending review) -> Closed -->

## Problem

When a log file is opened in the viewer, the smart bookmark modal ("First error at line N") fires on logcat device-backlog errors that precede the app launch. These errors (e.g. `E/AndroidRuntime: FATAL EXCEPTION`) are device noise from previous processes, not the user's app. The modal is both useless (line 1 is already visible) and annoying (blocks the viewer on every open).

```
07-29 08:39:15.769 24445 24458 E AndroidRuntime: FATAL EXCEPTION: video
07-29 08:39:15.769 24445 24458 E AndroidRuntime: PID: 24445
07-29 08:39:15.769 24445 24458 E AndroidRuntime: DeadSystemException: The system died; earlier logs will point to the root cause
```

These lines appear at lines 2-4 of the log, before any "Launching ... in debug mode" line.

## Reproduction

1. Capture a Flutter debug session where the device has logcat errors from a previous process
2. Open the resulting `.log` file in the viewer
3. A modal dialog immediately appears: "First error at line 2"

**Frequency:** Always (when device backlog contains errors)

## Root Cause

`findFirstErrorLines` scans content lines starting from index 0 with no awareness of app-launch boundaries. The trouble chart already solves this same problem for its histogram (via `viewer-trouble-chart-launch.ts`), and the feed already inserts a green "App started" divider at the launch line (via `viewer-run-app-start-divider.ts`). The smart bookmark scanner was the only consumer that lacked this boundary awareness.

## Changes Made

### File 1: `src/modules/bookmarks/first-error.ts`

- Added optional `skipBeforeLine` to `FirstErrorOptions`
- `findFirstErrorLines` starts scanning from `skipBeforeLine` instead of 0 when set

### File 2: `src/ui/provider/log-viewer-provider-load-helpers.ts`

- `getSmartBookmarksFirstErrorAndWarning` now calls `detectRunBoundaries` + `getRunStartIndices` to find the first launch line index, and passes it as `skipBeforeLine`
- Logs with no launch line (plain logs, non-Flutter) scan from the beginning as before

### File 3: `src/test/modules/bookmarks/first-error.test.ts`

- Added regression tests: errors before `skipBeforeLine` are skipped; errors after are found; no skip when undefined/0

## Sample log data

Source: `d:\src\contacts\reports\20260805\20260805_175344_contacts.log`

```json
[
  {
    "line": 2, "level": "error", "category": "logcat",
    "tag": "AndroidRuntime", "source": "debug",
    "text": "07-29 08:39:15.769 24445 24458 E AndroidRuntime: FATAL EXCEPTION: video"
  },
  {
    "line": 3, "level": "error", "category": "logcat",
    "tag": "AndroidRuntime", "source": "debug",
    "text": "07-29 08:39:15.769 24445 24458 E AndroidRuntime: PID: 24445"
  },
  {
    "line": 4, "level": "error", "category": "logcat",
    "tag": "AndroidRuntime", "source": "debug",
    "text": "07-29 08:39:15.769 24445 24458 E AndroidRuntime: DeadSystemException: The system died"
  }
]
```

## Design note

The trouble chart and trouble mode already solve error navigation in a richer way (histogram, click-to-scroll, app-start divider). The smart bookmark modal remains useful for users who don't use trouble mode: a single prompt on load pointing to the first real app error, with Focus/Copy/Bookmark/Ignore actions. With the pre-launch skip, the modal only fires when there is a genuinely interesting error after the app started.

## Finish Report (2026-08-06)

### Defect

The smart bookmark modal ("First error at line N") fired on logcat device-backlog errors that preceded the app launch. These are noise from previous processes (e.g. `E/AndroidRuntime: FATAL EXCEPTION`) appearing at the top of the log, making the modal both useless (line 1 is already visible) and intrusive (blocks the viewer on every open).

### Root cause

`findFirstErrorLines` in `src/modules/bookmarks/first-error.ts` scanned content lines starting from index 0. The trouble chart already solved the same pre-launch noise problem via launch-boundary detection, but the smart bookmark scanner lacked this boundary awareness.

### Fix

Added an optional `skipBeforeLine` field to `FirstErrorOptions`. When set, `findFirstErrorLines` begins its scan at that index instead of 0. The caller `getSmartBookmarksFirstErrorAndWarning` in `log-viewer-provider-load-helpers.ts` now calls `detectRunBoundaries` + `getRunStartIndices` to find the first launch line index and passes it as the skip point. Logs with no launch line (plain logs, non-Flutter sessions) continue scanning from the beginning.

### Hardening

- `findFirstErrorLines` now counts error-level lines in the skipped pre-launch region and returns `skippedPreLaunchErrors` in its result
- `LoadResultFirstError` and `LoadContentResultLike` carry the count through the load pipeline
- `maybeSuggestSmartBookmark` logs the skipped count to the Saropa Log Capture output channel when pre-launch errors are suppressed
- Edge case verified: no launch line → `startIndices[0]` is `undefined` → `skipBeforeLine` is `undefined` → scans from line 0 (correct for plain logs)

### Files changed

| File | Change |
|---|---|
| `src/modules/bookmarks/first-error.ts` | Added `skipBeforeLine` to `FirstErrorOptions`; added `FindFirstErrorResult` with `skippedPreLaunchErrors` count |
| `src/ui/provider/log-viewer-provider-load-helpers.ts` | `getSmartBookmarksFirstErrorAndWarning` detects first launch boundary; returns skipped count |
| `src/ui/provider/log-viewer-provider-load.ts` | `LoadResultFirstError` carries `skippedPreLaunchErrors` |
| `src/extension-activation-helpers.ts` | Logs skipped pre-launch error count to output channel |
| `src/test/modules/bookmarks/first-error.test.ts` | 3 regression tests with `skippedPreLaunchErrors` assertions |
| `CHANGELOG.md` | `[Unreleased]` entry |

### Verification

- `npm run compile`: all 12 gates pass
- `npm run test:file -- out/test/modules/bookmarks/first-error.test.js`: 9/9 pass
- Needs F5 manual verification with a log containing pre-launch logcat errors
