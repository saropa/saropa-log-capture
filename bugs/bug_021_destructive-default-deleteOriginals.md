# Bug 021 — Destructive default for deleteOriginals

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
