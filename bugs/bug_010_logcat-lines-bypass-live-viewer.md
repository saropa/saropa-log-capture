# Bug 010 — Logcat lines bypass live viewer

## Status: Open

## Severity: High

adb logcat output never reaches the viewer or line listeners in real time.

## Problem

adb logcat output is written to the log file but not broadcast to the viewer. The sidebar doesn't show logcat lines until the user reloads. Line listeners (file watchers, screenshot triggers, API callbacks) never receive them during a live session.

(`src/modules/session/session-lifecycle-init.ts:136-139`)

## Reproduction

1. Start a session with logcat capture enabled
2. Trigger device logcat output
3. Observe the sidebar/viewer does not update with the new lines
4. Reload the log file and see the lines are present in the file

**Frequency:** Always

## Root Cause

The logcat capture path writes directly to the file stream, bypassing the `broadcastLine` call that the standard debug adapter output path uses.

## Proposed Fix

Route logcat lines through the same `broadcastLine` pipeline as DAP output so they appear in the viewer in real time and trigger all listeners.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
