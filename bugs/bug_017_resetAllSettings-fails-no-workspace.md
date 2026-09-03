# Bug 017 — resetAllSettings fails without a workspace

## Status: Fixed

## Severity: High

Resetting all settings fails and leaves settings partially reset when no workspace is open.

## Problem

`resetAllSettings` tries to reset all 272 settings in both User and Workspace scopes using `Promise.all`. When no workspace folder is open, every `ConfigurationTarget.Workspace` update rejects with "Unable to write into Workspace settings". `Promise.all` fails on the first rejection, leaving settings partially reset. The surviving resets fire 544 individual `onDidChangeConfiguration` events, causing cascading refreshes.

(`src/commands-tools.ts:264-268`)

## Reproduction

1. Close all folders/workspaces (no workspace open)
2. Run "Reset All Settings"
3. Observe an error and that only some settings were reset
4. Observe excessive configuration-change churn/refreshes

**Frequency:** Always (when no workspace is open)

## Root Cause

No check for open workspace before attempting workspace-scope resets; no error handling for individual setting failures.

## Proposed Fix

Check `vscode.workspace.workspaceFolders` before attempting workspace resets. Use `Promise.allSettled` instead of `Promise.all`. Batch configuration changes where possible.

## Changes Made

`resetAllSettings` (`src/commands-tools.ts`) now:

- Gates workspace-scope updates on `vscode.workspace.workspaceFolders` — when no workspace is open, only the Global-scope update is queued for each of the 272 settings, so no update is ever sent against the rejecting Workspace target.
- Uses `Promise.allSettled` instead of `Promise.all` so a single setting's rejection no longer aborts the reset of the other ~271.
- Logs the failure count to the `Saropa Log Capture` output channel via `logExtensionWarn` when any update rejects.
- **This session's fix:** the success toast (`msg.settingsReset`) was previously shown unconditionally, even when `failures.length > 0` — a silent-async violation, since the user had no way to tell a reset was only partial. `resetAllSettings` now branches: on any failure it shows a warning (`msg.settingsResetPartial`, new l10n key in `src/l10n/strings-a.ts`) with the succeeded/total/failed counts and returns early instead of falling through to the success message.

## Tests Added
None — no existing test file covers `resetAllSettings`; manual verification only (see Root Cause reproduction steps, run with no workspace open).

## Commits
<!-- Add commit hashes as fixes land. -->
