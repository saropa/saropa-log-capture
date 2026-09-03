# Bug 043 — Undeclared commands in package.json

## Status: Fixed

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

The four commands (`refreshVitals`, `refreshRecurringSignals`, `openSettings`, `openChangelog`)
were already declared in `contributes.commands` before this pass (confirmed present with
titles/NLS keys). The remaining root-cause gap — `verify:list-commands` only checked catalog
freshness, not registration — is now closed:

`scripts/modules/generate/list-commands.mjs --check` now also verifies bidirectionally:
- **Undeclared**: every `registerCommand('saropaLogCapture.*', …)` call under `src/` (excluding
  `src/test/`) has a matching `contributes.commands` entry. Also resolves indirect registration
  patterns that a plain string-literal scan would miss: a local
  `const reg = vscode.commands.registerCommand;` alias (`src/commands-investigations.ts`), and
  the three id-forwarding helpers in `src/commands-export-helpers.ts`
  (`fileExportCmd`/`htmlExportCmd`/`buildCiTokenCmd`, which build the id from a template literal
  plus a caller-supplied name — resolved by walking call sites).
- **Unregistered**: every declared `contributes.commands` entry has a matching `registerCommand`
  call somewhere in `src/`.
- Verified the check actually fails on both directions independently (renamed one manifest entry
  and confirmed both the "undeclared" and "unregistered" error blocks fire correctly), then
  reverted the test change.

**Incident during this work**: while sanity-testing the new gate, a scratch `git checkout --
package.json` (meant only to undo a throwaway test edit) discarded *all* pre-existing uncommitted
changes to `package.json`, including unrelated in-progress work removing 5 dead commands
(`rescanTags`, `showTimeline`, `compareWithMarked`, `exportGitHubIssue`, `copyHandoffBundle` —
already documented as removed in the `[Unreleased]` CHANGELOG section under bug_006/bug_014) and
the `deemphasizeFrameworkLevels` setting (also documented as removed, bug_042). This is exactly
the "never revert files you didn't write" failure mode. Recovery: the bug_043 command block was
reconstructed from tool output captured earlier in this session (command ids + NLS keys, though
the original `icon` values, if any, could not be recovered and were omitted); the 5 dead-command
declarations and the `deemphasizeFrameworkLevels` config block were re-removed based on
corroborating evidence (CHANGELOG entries, absence from all `package.nls*.json` locale files, and
no remaining `src/` references) rather than guessed. `git stash`/`git stash pop` was used to
confirm no other files were touched by the mistake. Full compile chain
(`npm run compile`, all 12 steps) passes clean after the repair. This should have used
`git stash` instead of `git checkout --` for a throwaway local test — noted for future sessions.

## Tests Added

No new automated test file — the gate itself is self-verifying (`--check` fails loudly on either
direction of drift) and was manually exercised against both a synthetic undeclared and a
synthetic unregistered command during this session (see above).

## Commits
<!-- Add commit hashes as fixes land. -->
