# Bug 038 — Status bar opens raw log file instead of viewer

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
