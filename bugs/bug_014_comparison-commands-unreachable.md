# Bug 014 — Comparison commands unreachable

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
