# Bug 012 — File retention never deletes

## Status: Fixed

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

Docs-only fix (proposal's option B — trash-and-keep-bytes stays intentional, see `file-retention.ts:100-104` comment referencing this bug). Verified the setting description already matches the trash-only behavior:

- `package.nls.json` → `config.maxLogFiles.description`: "Maximum number of log files to retain (including subdirectories when enabled). When the number of log files exceeds this limit, the oldest sessions are moved to trash. Set to 0 for unlimited." — says "moved to trash", not "deleted".
- The retention notification the user sees on each sweep (`msg.fileRetentionMoved` in `src/l10n/strings-*.ts`, fired from `file-retention.ts:113-118`) also says "moved"/trash, not "deleted".

No code change needed — the description was already corrected in a prior pass. Freeing disk space still requires the user's explicit "Empty Trash" action, by design.

## Tests Added
None — docs-only.

## Commits
<!-- Add commit hashes as fixes land. -->
