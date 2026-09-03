# Bug 034 — Multi-root session contamination

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
