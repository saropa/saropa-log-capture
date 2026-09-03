# Bug 004 — Walkthrough and "first error" modal disrupt live debugging

## Status: Fixed

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

- Walkthrough auto-open on first debug session was removed/deferred (see CHANGELOG "Walkthrough and first-error dialog no longer interrupt active debug sessions").
- `src/extension-activation-helpers.ts` (`showSmartBookmarkModal`): `suggestFirstError`'s dialog was changed from a modal (`{ modal: true }`) to a non-modal `vscode.window.showInformationMessage()` toast so it no longer blocks the editor, breakpoints, or debug toolbar.
- **Gap closed this session:** the non-modal toast was still passing `{ detail: candidate.lineText }` as its options argument. Per the VS Code API, `MessageOptions.detail` only renders when `modal: true` — a non-modal toast silently drops it, so the actual error line text was no longer shown to the user after the modal was removed. Fixed by folding `candidate.lineText` directly into the primary message string (`` `${message}\n${candidate.lineText}` ``) instead of relying on `detail`, so the line text reaches the user in both modal and non-modal form.

## Tests Added
<!-- No new test — this is a two-line string-composition change with no existing test scaffolding around vscode.window.showInformationMessage in this module. Verified by reading the VS Code API contract for MessageOptions.detail and by `npx tsc --noEmit` / `npx eslint` passing clean. -->

## Commits
<!-- Add commit hashes as fixes land. -->
