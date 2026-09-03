# Bug 021 — Destructive default for deleteOriginals

## Status: Fixed

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
1. `src/modules/config/integration-config.ts:284` — code-level fallback changed to `false`
   via `ensureBoolean(cfg.get('integrations.flutterCrashLogs.deleteOriginals'), false)`.
2. `package.json:2288` — schema default changed from `true` to `false` (commit `d347a16d7`,
   2026-09-03). VS Code resolves `cfg.get()` to the schema default for users who haven't
   explicitly set the value, so this was the critical fix — fresh installs now default to
   keeping crash logs.

## Tests Added

None — config default change, no runtime logic altered.

## Commits

- `d347a16d7` (2026-09-03): changed `package.json` schema default to `false`
- Earlier (within 9.4.0 cycle): changed `integration-config.ts` fallback to `false`

## Finish Report (2026-09-03)

The `saropaLogCapture.integrations.flutterCrashLogs.deleteOriginals` setting shipped with
`"default": true` in the `package.json` schema since commit `97a500eb0` (2026-04-14). A
partial fix during the 9.4.0 cycle changed only the code-level `ensureBoolean()` fallback in
`integration-config.ts` to `false`, but that fallback is never reached in practice because
VS Code resolves `cfg.get()` to the schema default before the fallback applies. The effective
default for every user who had not explicitly set the value remained `true`, silently deleting
crash logs after import.

Commit `d347a16d7` corrected the `package.json` schema default to `false`, aligning both
layers. The CHANGELOG entry for 9.4.0 (line 129) was updated to remove the stale caveat that
the schema still declared `true`. Bug report archived to history.
