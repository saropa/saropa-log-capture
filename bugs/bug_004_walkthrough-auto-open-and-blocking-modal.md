# Bug 004 — Walkthrough and "first error" modal disrupt live debugging

## Status: Open

## Severity: Critical

First-run UI interrupts and blocks the user's active debug session.

## Problem

Two first-run disruptions occur during debugging:

1. The walkthrough auto-opens synchronously on `onDebugAdapterProtocolTracker` activation during the user's first debug session. Combined with bug_001 (empty walkthrough content), this interrupts debugging with blank tabs at the worst possible moment. (`src/extension-activation.ts:384`)
2. `smartBookmarks.suggestFirstError` (default `true`) fires a modal dialog during a live debug session the moment the first error is found. The modal blocks the editor, breakpoints, and debug toolbar until the user dismisses it. (`src/extension-activation-helpers.ts:80-84`)

## Reproduction

1. Fresh install (or reset global state), open a project, and start a debug session for the first time.
2. Observe the walkthrough tab opens automatically, interrupting the debug view.
3. Continue debugging until the first error/exception is logged.
4. Observe a modal dialog appears and blocks interaction with breakpoints/toolbar until dismissed.

**Frequency:** Always (on first debug session / first error)

## Root Cause

Both features trigger synchronously off debug-session events with no "user is actively debugging" guard and no debounce, so they fire mid-session rather than at a safe idle point.

## Proposed Fix

1. Defer the walkthrough auto-open to after the debug session ends, or only show it when the user explicitly invokes it from the command palette/activity bar.
2. Change `suggestFirstError` from a modal dialog to a non-modal notification (VS Code `showInformationMessage` without `modal: true`), or check `vscode.debug.activeDebugSession` and defer the prompt until the session ends.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files and what they verify. -->

## Commits
<!-- Add commit hashes as fixes land. -->
