# Bug 025 — Viewer trim drifts indexed structures

## Status: Open

## Severity: Medium

Trimming old lines from the head of the buffer desyncs pins, annotations, badges, and selection state from their intended rows.

## Problem

When `trimData()` removes old lines from the head of `allLines` to stay under `MAX_LINES`, four index-keyed data structures are NOT re-indexed:
1. `pinnedIndices` — pins shift to wrong rows (`viewer-pin.ts:9-19`)
2. Annotation maps — annotations appear on wrong rows (`viewer-annotations.ts:8-18`)
3. Badge maps — badges appear on wrong rows
4. `selectionStart/End` and `lastClickedIdx` — not cleared on log switch; Ctrl+C and Shift+Arrow act on stale indices of the new file (`viewer-copy.ts:12-13`, `viewer-selection-keyboard.ts:23`)

## Reproduction

1. Pin a line, add an annotation, and add a badge to a line near the head of a long session
2. Continue streaming until `MAX_LINES` is exceeded and the head is trimmed
3. Observe the pin/annotation/badge now appear on a different (unrelated) row
4. Switch to a different log file with an active selection, then press Ctrl+C or Shift+Arrow
5. Observe the action applies to stale indices from the previous file

**Frequency:** Always (once trim or log-switch conditions are hit)

## Root Cause

`trimData()` splices the array head but does not adjust any of the secondary index maps.
(`viewer-script-messages.ts:77-131`)

## Proposed Fix

In `trimData()`, subtract the trim offset from every key in each index map. Clear selection state in the `clear` handler.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
