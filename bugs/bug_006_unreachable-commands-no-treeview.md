# Bug 006 — Four command families are unreachable: no TreeView registered

## Status: Fixed

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

Removed the four unreachable command families instead of building a TreeView for them
(no plan approved a TreeView, so the "remove" branch of the proposed fix was taken):

- `showTimeline` and its registration deleted (`src/commands-timeline.ts` removed). The
  `timeline-panel.ts:showTimeline()` implementation is left in place as dead code — it is
  no longer wired to any command, tracked as a separate cleanup, not part of this fix.
- `rescanTags` command registration removed.
- `correlateSession` command registration removed.
- `compareWithMarked` command registration removed. This conflicted with bug_014, which
  had added a context-menu entry point for it — see bug_014's Changes Made for how the
  conflict was resolved (the menu item was removed, not the command re-added).
- Removed the now-dead `msg.noSessionMarked` l10n key from `src/l10n/strings-a.ts` — it
  was the "no log marked" message read only by the deleted `compareWithMarked` handler.
- Verified `package.json` `contributes.commands`/`contributes.menus` carry no
  `viewItem`-gated entries for any of the four removed commands.

## Tests Added

No new test needed — `src/test/ui/viewer-session-context-menu.test.ts` already carries a
regression test ("should NOT include the removed Compare with Marked Log action") added
under bug_014 covering the shared conflict.

## Commits
<!-- Add commit hashes as fixes land. -->

