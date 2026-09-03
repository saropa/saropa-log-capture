# Bug 046 — Screenshot sidecars survive log deletion (unbounded disk growth)

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
