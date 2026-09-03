# Bug 037 — Lifecycle commands give no feedback when no session is active

## Status: Fixed

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

`start`, `stop`, `pause`, and `insertMarker` in `src/commands-session.ts` now each have an `else` branch that
surfaces `vscode.window.showInformationMessage()` when there is no session to act on, using two new symbolic
l10n keys added to `src/l10n/strings-a.ts`: `msg.noActiveCaptureSession` ("No active capture session.") for
stop/pause/insertMarker, and `msg.noActiveCaptureSessionStart` ("No active capture session. Start debugging to
begin capturing.") for `start`, which points the user at the action that actually creates a session rather than
just repeating the negative. `insertMarker` checks for a session before showing the input box, so the user is
told immediately instead of typing marker text that would silently be discarded. Both new keys' English values
are present in `l10n/bundle.l10n.json` and every locale bundle (`l10n/bundle.l10n.<locale>.json`) as identity
entries pending translation; `npm run verify:l10n-keys` confirms every referenced key resolves.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
