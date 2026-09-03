# Bug 034 — Multi-root session contamination

## Status: Fixed

## Severity: Medium

In multi-root workspaces, debug output from one folder can be appended to another folder's log file, corrupting captured logs.

## Problem

In a multi-root workspace, a debug session started in workspace folder B can append its output to folder A's log file if folder A already has an active recording session and folder B's debug adapter emits output within 5 seconds of the session start. No workspace folder check is performed.
(`src/modules/session/session-manager-routing.ts:42-48`)

## Reproduction

1. Open a multi-root workspace with folders A and B.
2. Start a recording session in folder A.
3. Within 5 seconds, start a separate debug session in folder B that emits output immediately.
4. Inspect folder A's log file — observe folder B's output lines appended to it.

**Frequency:** Intermittent (timing-dependent, but reliably reproducible per steps above)

## Root Cause

The session routing logic uses a time-based heuristic to associate debug adapter output with sessions, without checking which workspace folder the debug session belongs to.

## Proposed Fix

Check `debugSession.workspaceFolder` when routing output. Only append output to sessions whose workspace folder matches the debug session's folder.

## Changes Made

The original fix only covered output *routing* (`workspaceFolderMatches()` in
`src/modules/capture/log-session-helpers.ts`, consumed by `resolveEffectiveSessionId()` in
`src/modules/session/session-manager-routing.ts`) — it stopped a DAP output event from being
routed to the wrong session, but did nothing about session *creation*. A follow-up sweep found
the gap was still open one layer up: `session-manager-start.ts`'s two aliasing fallbacks —
the 30s "recent child" path and the 5s race-guard path — called
`getSingleRecentOwnerSession(windowMs)` with no folder argument at all, so a folder-B debug
session starting within either window still got permanently aliased onto folder A's `LogSession`
regardless of routing correctness afterward.

- `getSingleRecentOwnerSession()` (`src/modules/session/session-manager-internals.ts`) now takes
  an optional `workspaceFolder` parameter and returns `null` instead of aliasing when the
  candidate `LogSession`'s recorded workspace folder doesn't match it.
- `getMostRecentOwnerSessionId()` (same file) — used by the multi-owner "most recent session
  wins" fallback in `session-manager-routing.ts` — got the identical folder filter, since it had
  the same "newest timestamp wins regardless of folder" flaw.
- Both call sites in `session-manager-start.ts` (`recentChild`, 30s; `recentRace`, 5s) now pass
  `session.workspaceFolder` through.
- `workspaceFolder` was threaded through the full DI chain that was missing it:
  `StartSessionDeps` → `StartSequenceDeps` (`session-manager-start-sequence.ts`) →
  `SessionManagerImpl` (`session-manager.ts`), and `RoutingState.getMostRecentOwnerSessionId`
  (`session-manager-routing.ts`) similarly.
- `workspaceFolderMatches()` fails open (treats as a match) when the incoming debug session
  reports no `workspaceFolder` at all (e.g. an attach-only launch), preserving existing
  single-root behavior where the field isn't always set.

## Tests Added

- `src/test/modules/session/session-manager-internals.test.ts` (new) — exercises
  `getSingleRecentOwnerSession()` and `getMostRecentOwnerSessionId()` directly against the real
  timing/window logic: same-folder aliasing still works, cross-folder aliasing is refused (the
  bug 034 reproduction), `undefined` folder still aliases (single-root callers unaffected), and
  the multi-owner "most recent wins" fallback skips a newer session in a different folder.
- `src/test/modules/capture/log-session-helpers.test.ts` — added a `workspaceFolderMatches`
  suite covering the match, mismatch, and fail-open-on-undefined cases.

## Commits
<!-- Add commit hashes as fixes land. -->
