# Bug 021 — Destructive default for deleteOriginals

## Status: Open (regression — fix incomplete)

## Severity: High

Crash logs are deleted from the workspace root by default, with no confirmation, and users can lose them permanently.

## Problem

The setting `flutterCrashLogs.deleteOriginals` defaults to `true`, meaning the extension deletes `flutter_*.log` files from the workspace root on session end without any user confirmation. Users who are unaware of the setting lose their crash logs permanently after the first debug session.

## Reproduction

1. Install the extension with default settings
2. Trigger a Flutter crash log capture session
3. End the session
4. Observe the original `flutter_*.log` files are deleted from the workspace root without prompt

**Frequency:** Always (on default settings)

## Root Cause

Destructive behavior enabled by default; no confirmation prompt.
(`package.json` setting definition)

## Proposed Fix

Change the default to `false`. Add a one-time notification when the feature is first used: "Saropa Log Capture can clean up flutter crash logs after importing them. Enable?" Consider requiring explicit opt-in rather than opt-out for file deletion.

## Changes Made
PARTIAL / NOT EFFECTIVE. `src/modules/config/integration-config.ts:284` was changed to
`ensureBoolean(cfg.get('integrations.flutterCrashLogs.deleteOriginals'), false)` — the
in-code fallback default is `false`. However `package.json:2287-2292`
(`saropaLogCapture.integrations.flutterCrashLogs.deleteOriginals`) still declares
`"default": true` in the settings schema (confirmed via `git blame`: unchanged since the
setting was introduced in commit `97a500eb0`, 2026-04-14 — never edited to `false`). Because
VS Code resolves `cfg.get()` to the schema default when the user hasn't set the value
explicitly, `ensureBoolean()`'s own fallback is never reached in practice — the effective
default a fresh install ships with is still `true`, and crash logs are still deleted by
default. CHANGELOG.md ("Changed `flutterCrashLogs.deleteOriginals` default to `false` to
prevent accidental file deletion") is inaccurate as of this verification pass and should not
be trusted as evidence the bug is closed. Fix required: change `"default": true` to
`"default": false` in `package.json` for this setting (the TS-side fallback is already
correct and needs no further change).

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
