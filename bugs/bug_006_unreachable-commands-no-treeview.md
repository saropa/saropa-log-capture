# Bug 006 — Four command families are unreachable: no TreeView registered

## Status: Open

## Severity: Critical

An entire class of contributed commands can never be invoked by users.

## Problem

Four command families require tree-view context items (`viewItem` in their `when` clause) that are never provided because no TreeView is registered for the relevant view container:

- `showTimeline` / timeline navigation commands (`src/commands-timeline.ts:12-15`)
- `correlateSession` / correlation commands
- `rescanTags`
- `compareWithMarked` (also blocked separately by bug_014)

All of these commands exist in `package.json` under `contributes.commands` and are registered at activation time, but their `when` clauses require `viewItem` context supplied by a TreeView that `src/extension-activation.ts:133` never creates. As a result they never appear in any context menu and cannot be invoked.

## Reproduction

1. Search `package.json` `contributes.menus` for `viewItem == ` clauses referencing `showTimeline`, `correlateSession`, `rescanTags`, `compareWithMarked`.
2. Search `src/extension-activation.ts` for `vscode.window.createTreeView` / `registerTreeDataProvider` — none registers the view ID these menus target.
3. Observe the commands never appear in any UI surface (command palette entries with `when` scoped to the missing view are also filtered out).

**Frequency:** Always

## Root Cause

Tree view registration was either removed during refactoring or never implemented, but the dependent commands, `package.json` contributions, and `when`-clause wiring were left behind.

## Proposed Fix

Either implement the TreeView and its `TreeDataProvider` to supply the expected `viewItem` context, or remove the unreachable commands and their `package.json` contributions/registration code entirely. If the TreeView is still wanted, file it as a separate feature plan per the "feature needs a plan" discipline before implementing.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files and what they verify. -->

## Commits
<!-- Add commit hashes as fixes land. -->
