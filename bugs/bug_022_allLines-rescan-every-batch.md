# Bug 022 — allLines rescan on every batch

## Status: Open

## Severity: High

Root-cause-hint collection re-scans the entire log buffer on every batch, stalling the UI thread on large sessions.

## Problem

Every `addLines` batch triggers a full re-scan of the entire `allLines` array: three complete passes running `stripTags()`, `replace(/\s+/g, ' ')`, ~40 `indexOf` probes, and 3 regex matches per line. A 100k-line session performs ~300k `stripTags` calls per batch, stalling the UI thread.

## Reproduction

1. Start a session and let it accumulate ~100k lines
2. Continue streaming new lines in small batches
3. Observe UI thread stalls / jank on each batch as line count grows

**Frequency:** Always (scales with session size)

## Root Cause

Root-cause-hint collectors scan from index 0 on every batch instead of maintaining an incremental cursor from the last-scanned position.
(`src/ui/viewer/viewer-script-messages.ts:63` → `viewer-root-cause-hints-embed-collect-*.ts`)

## Proposed Fix

Add a `lastScannedIndex` cursor to each collector. On each batch, scan only from `lastScannedIndex` to the end of the new data. Reset the cursor on session change.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
