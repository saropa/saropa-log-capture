# Bug 016 — deleteSession orphans metadata

## Status: Fixed

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

Shared `cleanupDeletedSessionMetadata()` helper (`src/modules/session/session-metadata.ts`)
was already wired into the single-file delete (`commands-session.ts`) and
empty-trash (`commands-trash.ts`) paths in an earlier pass. This pass closed the
third and last gap: bulk delete.

`handleDeleteCommand()` in `src/modules/features/delete-command.ts` now takes a
`SessionMetadataStore` parameter (passed in by its one caller,
`src/commands-session.ts:132`, via `historyProvider.getMetaStore()`) and calls
`cleanupDeletedSessionMetadata(uri, metaStore)` after each file deletion in the
bulk quick-pick loop, so all three deletion paths (single delete, bulk delete,
empty trash) now share the identical cleanup call instead of the bulk path
silently orphaning metadata/search-index entries.

## Tests Added
<!-- No new automated test file added; verified via `npx tsc --noEmit` (0 errors) that the new `metaStore` parameter threads correctly through the one call site. -->

## Commits
<!-- Add commit hashes as fixes land. -->
