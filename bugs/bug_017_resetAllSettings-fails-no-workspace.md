# Bug 017 — resetAllSettings fails without a workspace

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
