# Bug 016 — deleteSession orphans metadata

## Status: Open

## Severity: High

Deleting a session directly leaves stale metadata and search-index entries behind.

## Problem

`deleteSession` deletes the log file but does not clean up its metadata entry or search-index entry. `emptyTrash` includes both `metaStore.deleteMetadata(uri)` and `getGlobalSearchIndex()?.removeFile(uri)`, but the direct delete path skips them. Orphaned metadata accumulates over time and may cause phantom entries in the sidebar.

(`src/commands-session.ts:196-204`)

## Reproduction

1. Delete a session directly from the sidebar (not via trash)
2. Inspect the metadata store — the entry for the deleted session remains
3. Search the global index — the deleted file's content is still indexed

**Frequency:** Always

## Root Cause

The delete path was written separately from the trash-empty path and missed the cleanup steps.

## Proposed Fix

Extract the cleanup logic (metadata + search index + any other per-session state) into a shared `cleanupSession(uri)` helper and call it from both `deleteSession` and `emptyTrash`.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
