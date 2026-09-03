# Bug 014 — Comparison commands unreachable

## Status: Fixed

## Severity: High

The Compare Logs feature has no working UI entry point and is effectively inaccessible.

## Problem

`markForComparison` and `compareWithMarked` have no working UI entry point. They are only callable from the Command Palette, which silently no-ops (bug_013). No context menu item exists for them. The "Compare Logs" feature is completely inaccessible to users.

(`src/commands-comparison.ts:12-41`)

## Reproduction

1. Right-click a session in the sidebar tree
2. Observe there is no "Mark for Comparison" or "Compare with Marked" menu item
3. Run the commands from the Command Palette instead
4. Observe they silently no-op (see bug_013)

**Frequency:** Always

## Root Cause

Context menu contribution missing from `package.json` `contributes.menus`; the commands were registered but never wired to a UI surface.

## Proposed Fix

Add context menu items for these commands in `view/item/context` for the session tree view. Consider also adding them to the editor title menu for log files.

## Changes Made

Added a "Mark for Comparison" item to the webview session context menu
(`src/ui/viewer-context-menu/viewer-session-context-menu.ts`), dispatched through
`handleSessionAction()`'s `markForComparison` case in
`src/ui/provider/viewer-handler-sessions.ts`. The session panel is a webview list (no
native VS Code TreeView backs it — `session-history-provider.ts` implements
`TreeDataProvider` but is never passed to `vscode.window.createTreeView`), so
`contributes.menus`/`view/item/context` has no view to attach to; this HTML context menu
+ dispatch pair is the actual right-click menu.

**Conflict with bug_006:** the original plan for this bug also called for a
"Compare with Marked Log" menu item wired to `compareWithMarked`. Bug_006 deleted the
`compareWithMarked` command registration as unreachable dead code in the same pass, which
would have left this new menu item dispatching a command that no longer exists. Resolved
by NOT adding the "Compare with Marked Log" item — only "Mark for Comparison" ships.
`markForComparison` still records the marked URI in `src/commands-comparison.ts` for a
future comparison entry point (`compareSessions` / `compareThreeSessions`, both reachable
via the Command Palette, remain the working comparison commands today).

## Tests Added

`src/test/ui/viewer-session-context-menu.test.ts`:
- "should include Mark for Comparison action (bug_014)" — asserts the menu item and its
  `data-session-action="markForComparison"` are present.
- "should NOT include the removed Compare with Marked Log action (bug_006/bug_014
  conflict)" — regression test asserting no `compareWithMarked` dispatch survived.

## Commits
<!-- Add commit hashes as fixes land. -->

