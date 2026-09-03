# Bug 043 — Undeclared commands in package.json

## Status: Open

## Severity: Medium

Four commands are callable internally but invisible in the Command Palette, with no title, icon, or category metadata.

## Problem

Four commands are registered via `registerCommand` at activation but have no corresponding entry in `package.json` `contributes.commands`. They are callable internally but invisible in the Command Palette and have no title, icon, or category metadata.

- `saropaLogCapture.refreshVitals` (`src/activation-providers.ts`)
- `saropaLogCapture.refreshRecurringSignals` (`src/commands-signals.ts`)
- `saropaLogCapture.openSettings` (`src/commands-tools.ts`)
- `saropaLogCapture.openChangelog` (`src/commands-tools.ts`)

## Reproduction

1. Open the Command Palette (Ctrl+Shift+P).
2. Search for "Refresh Vitals", "Refresh Recurring Signals", "Open Settings" (Saropa-specific), or "Open Changelog".
3. Observe none of the four commands appear, despite being invokable via `vscode.commands.executeCommand`.

**Frequency:** Always.

## Root Cause

Commands added in code but not in the manifest; `verify:list-commands` may not catch commands that exist in code but not in `package.json` (it may only check the reverse).

## Proposed Fix

Add all four commands to `package.json` `contributes.commands` with proper titles, categories, and when clauses. Update `verify:list-commands` to check bidirectionally.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
