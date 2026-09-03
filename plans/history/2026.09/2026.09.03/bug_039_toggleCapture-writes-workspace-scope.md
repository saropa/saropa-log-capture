# Bug 039 — toggleCapture writes workspace-scope setting

## Status: Fixed

## Severity: Medium

Toggling capture from the status bar creates an unintended git diff and silently disables capture for the whole team.

## Problem

The `toggleCapture` command writes the `captureAll` setting to `ConfigurationTarget.Workspace`, which creates or modifies `.vscode/settings.json` in the repo root. This file is tracked by git, so disabling capture from the status bar creates a git diff. Teammates who pull the change have capture silently disabled in their workspace.
(`src/commands-session.ts:63-66`)

## Reproduction

1. Open a repo where `.vscode/settings.json` is tracked by git.
2. Click the status bar toggle-capture control to disable capture.
3. Run `git status` — observe `.vscode/settings.json` now shows a diff adding `saropaLogCapture.captureAll: false`.
4. Commit and have a teammate pull — observe their capture is now disabled without any explicit action on their part.

**Frequency:** Always

## Root Cause

Setting written to workspace scope instead of user-global scope.

## Proposed Fix

Write to `ConfigurationTarget.Global` instead of `ConfigurationTarget.Workspace`. If workspace-level override is intentional, add it to `.gitignore` recommendations or use `ConfigurationTarget.WorkspaceFolder` with a notice.

## Changes Made
`src/commands-session.ts` (~line 65) now writes `await cfg.update('enabled', newValue, vscode.ConfigurationTarget.Global)` instead of `ConfigurationTarget.Workspace`, with a comment explaining the git-diff/teammate-contamination reasoning and referencing bug_039 directly.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
