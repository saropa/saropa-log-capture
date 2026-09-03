# Bug 046 — Screenshot sidecars survive log deletion (unbounded disk growth)

## Status: Fixed

## Severity: Medium

Deleting a log leaves its screenshots on disk forever. Captures are ~1–2 MB PNGs,
so the orphaned data outgrows the logs it belonged to.

## Problem

Screenshot capture writes two sidecars next to each log:

- `<base>.screenshots/` — the PNG files
- `<base>.screenshots.json` — the index

No deletion path removes either. This holds for **every** route by which a log
leaves:

- File retention (`maxLogFiles`) — soft-trashes via metadata
- The trash commands
- Permanent delete

The captures are full-resolution PNGs — plan 114's live verification recorded a
2,027,510-byte capture and later ~1.14 MB ones. A user who runs capture for a
while and prunes logs keeps 100% of the image bytes with none of the logs that
gave them meaning.

Note bug 012 (`maxLogFiles` never deletes old files) is a *different* defect on
the same surface. Fixing 012 makes this one worse: retention starts deleting
logs, and every deletion then orphans a screenshot directory.

## Reproduction

1. Enable screenshot capture and run a Dart/Flutter debug session that raises
   errors, so `<base>.screenshots/` fills.
2. Delete that log — any path: trash command, permanent delete, or retention.
3. Inspect the reports directory.
4. `<base>.screenshots/` and `<base>.screenshots.json` are still present.

**Frequency:** Always.

## Root Cause

Screenshot capture was added (plan 114, 2026-07-28) without wiring sidecar
cleanup into the pre-existing deletion paths. The log-deletion code predates the
sidecars and has no knowledge of them.

## Proposed Fix

Wire sidecar removal into whatever single path physically deletes a log file, so
every caller inherits it — do not patch each of the three call sites separately.

Then add a verification case: deleting a log removes its `<base>.screenshots/`
directory and `<base>.screenshots.json` index.

Sequence this **with or before** bug 012 — fixing retention first turns a static
leak into a growing one.

## Changes Made

Followed the proposed fix: cleanup was wired into the single choke point every physical
delete already shares (bug_016's `cleanupDeletedSessionMetadata()`), not patched into each
call site separately.

- `src/modules/session/session-metadata.ts` — added `deleteScreenshotSidecars()`, called from
  `cleanupDeletedSessionMetadata()` after the metadata/search-index cleanup. Removes
  `<base>.screenshots/` (`vscode.workspace.fs.delete(dir, { recursive: true, useTrash: false })`)
  and `<base>.screenshots.json` (`vscode.workspace.fs.delete(sidecar, { useTrash: false })`),
  each independently try/caught — most logs never captured a screenshot, so a missing sidecar
  is the common case, not an error, and must never block the metadata cleanup it runs
  alongside.
- No changes needed in the three callers (`src/commands-session.ts` single-file delete,
  `src/commands-trash.ts` empty-trash, `src/modules/features/delete-command.ts` bulk delete)
  — all three already call `cleanupDeletedSessionMetadata()` after the physical file delete,
  so they inherit sidecar cleanup automatically.
- File retention (`src/modules/config/file-retention.ts`) needed no change: it only
  soft-trashes (`metaStore.setTrashed`), never a hard delete (see bug_012) — the sidecars stay
  intact until the user runs Empty Trash, which already routes through the shared cleanup.

## Tests Added

- `src/test/modules/session/session-metadata.test.ts` — new suite
  `cleanupDeletedSessionMetadata screenshot sidecar cleanup (bug_046)`: writes a log plus a
  `.screenshots/` PNG and `.screenshots.json` sidecar in a temp directory (mirroring the
  flow-map cross-session test pattern), runs `cleanupDeletedSessionMetadata()`, and asserts
  both are gone (`vscode.workspace.fs.stat` rejects on each). A second case asserts the
  cleanup does not throw for a log with no sidecars at all (the common case).

## Commits
<!-- Add commit hashes as fixes land. -->
