# Bug 011 — Pause drops lines inconsistently

## Status: Fixed

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

Two halves:

1. **Pause-check unification (broadcast path).** `processOutputEvent()` and
   `writeOneLine()` in `src/modules/session/session-manager-events.ts` now check
   `session.state !== 'recording'` ONCE, before the file-write and broadcast paths
   diverge, and return immediately if paused. Previously `LogSession.appendLine()`
   already no-op'd while paused, but `target.broadcastLine()` was called
   unconditionally afterward — so the viewer kept showing lines that never reached
   the saved file (source: `src/modules/capture/log-session.ts:201`).
2. **Bookmark line-number desync.** Bookmarks were keyed on the viewer's `allLines`
   array index (`lineIdx`), which drifts from the on-disk file line count via
   synthetic rows (markers, stack headers, repeat-notification chips) and any
   trim/filter change. Both bookmark entry points now send the FILE line number
   (`lineData.sourceLineNo`, falling back to the array index only for an unstamped
   row):
   - Right-click "Bookmark" — `src/ui/viewer-context-menu/viewer-context-menu-line-actions.ts`
   - Keyboard bookmark shortcut — `src/ui/viewer/viewer-script-keyboard.ts` (this was
     the follow-up gap: the context-menu path was fixed first, but the keyboard
     shortcut still sent the raw array index)

## Tests Added
<!-- No new automated test file added; verified via `npx tsc --noEmit` (0 errors) and code inspection of both bookmark entry points and both broadcast call sites. -->

## Commits
<!-- Add commit hashes as fixes land. -->
