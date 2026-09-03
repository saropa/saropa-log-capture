# Bug 011 — Pause drops lines inconsistently

## Status: Open

## Severity: High

Paused capture desyncs the viewer from the saved file, corrupting bookmarks and exports.

## Problem

When capture is paused, `appendLine` drops lines from the file but `broadcastLine` still runs. The viewer shows lines that are absent from the saved file. Bookmarks and line numbers reference viewer rows that don't exist in the file, corrupting exports and goto-line.

(`src/modules/capture/log-session.ts:201`, `src/modules/session/session-manager-events.ts:115-121`)

## Reproduction

1. Start a session and pause capture
2. Trigger log output while paused
3. Observe the lines appear in the viewer
4. Open the saved log file and see the lines are missing
5. Bookmark a line that only exists in the viewer, then export or goto-line

**Frequency:** Always

## Root Cause

Pause flag checked in the file-write path but not in the broadcast path.

## Proposed Fix

Check the pause flag in `broadcastLine` as well, or (better) check it once at the entry point before both paths diverge. Ensure bookmarks reference file line numbers, not viewer indices.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
