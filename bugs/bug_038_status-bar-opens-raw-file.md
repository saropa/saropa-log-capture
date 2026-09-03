# Bug 038 — Status bar opens raw log file instead of viewer

## Status: Fixed

## Severity: Medium

Clicking the status bar item bypasses the log viewer entirely, giving an inconsistent experience compared to every other log-opening action.

## Problem

Clicking the status bar item opens the log file as raw text in the editor via `showTextDocument(s.fileUri)`, instead of routing through `openSession` which would open it in the log viewer webview. This is inconsistent with every other log-opening action in the extension.
(`src/ui/shared/status-bar.ts:22`)

## Reproduction

1. Start a capture session so the status bar item is active.
2. Click the status bar item.
3. Observe the raw log file opens as plain text in the editor, not in the Log Viewer webview.

**Frequency:** Always

## Root Cause

Status bar click handler uses the wrong API — `showTextDocument` instead of the session-aware `openSession` command.

## Proposed Fix

Replace `showTextDocument(s.fileUri)` with `vscode.commands.executeCommand('saropaLogCapture.openSession', s)` or the equivalent function call that routes through the viewer.

## Changes Made

The status bar item's command (`this.item.command = 'saropaLogCapture.open'` in `src/ui/shared/status-bar.ts:22`)
was already routed through a registered command rather than calling `showTextDocument` directly. The
`saropaLogCapture.open` handler in `src/commands-session.ts:107-113` now routes through
`saropaLogCapture.openSession` — the same session-aware command every other open-a-log entry point uses — passing
`{ uri: s.fileUri }`, so a click opens the log in the Log Viewer webview instead of dumping raw text into a plain
editor tab. Verified by reading both the status bar registration and the command handler; no `showTextDocument`
call remains on this path.

## Tests Added

None. Verifying a status bar click's UI routing requires an Extension Development Host run (per
`.claude/rules/testing.md`, this class of interaction is not covered by the Mocha/vscode-test suite); confirmed
by code inspection only.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
