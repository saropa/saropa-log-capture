# Bug 037 — Lifecycle commands give no feedback when no session is active

## Status: Open

## Severity: Medium

Users invoking capture commands with no active session get no indication anything happened, making the extension appear broken or unresponsive.

## Problem

The `start`, `stop`, `pause`, and `insertMarker` commands all use `if (activeSession) { ... }` with no `else` branch. When no session is active, the user invokes the command from the palette and nothing happens — no error message, no status bar update, no notification.
(`src/commands-session.ts:77-103,111-117`)

## Reproduction

1. Ensure no debug/capture session is active.
2. Run "Saropa Log Capture: Pause" (or Stop, or Insert Marker) from the command palette.
3. Observe no message, no status bar change, no visible outcome at all.

**Frequency:** Always

## Root Cause

Commands assume a session is always active; there is no fallback branch for the no-session case.

## Proposed Fix

Add an `else` branch that shows an informational message: "No active capture session. Start debugging to begin capturing." For `start`, consider starting a session or showing the quick pick.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
