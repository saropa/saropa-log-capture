# Bug 040 — Stop queue drain races logcat process shutdown

## Status: Open

## Severity: Medium

Log lines emitted by logcat during session stop may be lost or cause write-after-close errors.

## Problem

When a debug session ends, `logSession.stop()` drains the pending line queue while the session state is still `recording`. Meanwhile, the logcat child process continues appending new lines. `stopLogcatCapture()` only runs after the drain completes, so late logcat lines may arrive after the file is "closed" — they are either lost or cause write-after-close errors.

## Reproduction

1. Start a debug session with logcat capture enabled.
2. Trigger a burst of logcat output right as the session stops.
3. Call `logSession.stop()`.
4. Observe that lines emitted by the still-running logcat process after the drain starts are dropped or trigger a write error.

**Frequency:** Intermittent (timing-dependent on how fast logcat emits relative to drain/stop sequencing).

## Root Cause

`src/modules/session/session-lifecycle-finalize.ts:97,120-124` — the logcat child process is stopped *after* the queue drain completes, instead of before. This leaves a window where new lines can still be produced by logcat while (or after) the drain is finalizing the file.

## Proposed Fix

Stop the logcat child process first, then drain remaining buffered lines, then finalize the file. This ensures no new lines arrive after drain starts.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
