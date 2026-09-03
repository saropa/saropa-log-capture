# Bug 012 — File retention never deletes

## Status: Open

## Severity: High

`maxLogFiles` retention never frees disk space; files are only marked trashed, not deleted.

## Problem

The `maxLogFiles` setting description says "oldest log files will be deleted" but the retention logic only sets `trashed=true` in the session metadata. Actual bytes are never removed from disk until the user manually runs "Empty Trash". Users relying on `maxLogFiles` to manage disk space see unbounded growth.

(`src/modules/config/file-retention.ts:97-107`)

## Reproduction

1. Set `maxLogFiles` to a small number (e.g. 5)
2. Generate more than 5 log sessions
3. Observe old sessions are marked trashed in metadata
4. Check disk usage — old log files are still present on disk

**Frequency:** Always

## Root Cause

The retention handler marks files for trash but never calls the delete/unlink operation.

## Proposed Fix

Either auto-delete after marking as trashed (matching the setting description), or update the description to say "oldest log files will be moved to trash". If auto-deleting, add a confirmation setting or grace period.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
