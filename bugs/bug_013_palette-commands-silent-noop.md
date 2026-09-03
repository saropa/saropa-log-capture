# Bug 013 — Palette commands silent no-op

## Status: Open

## Severity: High

21+ commands do nothing when run from the Command Palette, with no feedback to the user.

## Problem

21+ commands invoked from the Command Palette silently do nothing because they return early on `!item?.uri` with no user feedback. The user types a command name, presses Enter, and nothing happens — no error, no status bar message, no notification.

Affected: `openSession`, `deleteSession`, `renameSession`, `markForComparison`, `compareWithMarked`, `exportHtml`, `exportCsv`, `copyDeepLink`, `openExternalLogsForSession`, `groupSelectedSessions`, `ungroupSession`, `exportFlowMap`, `openSessionGroup`, plus 8+ more.

(`src/commands-session.ts`, `src/commands-comparison.ts`, `src/commands-tools.ts`, `src/commands-export-helpers.ts`)

## Reproduction

1. Open the Command Palette
2. Run any of the affected commands (e.g. "Export HTML") without a tree item selected
3. Observe nothing happens — no error, no message

**Frequency:** Always

## Root Cause

Commands designed for tree-item context menus (where `item` is always provided) but also registered in the palette (where `item` is undefined). No fallback behavior — no quick pick, no "select a session first" message.

## Proposed Fix

For palette invocations (when `item` is undefined), either show a QuickPick of available sessions/items, or show an informational message telling the user to right-click in the sidebar. Add a `when` clause to hide commands that require context from the palette.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
