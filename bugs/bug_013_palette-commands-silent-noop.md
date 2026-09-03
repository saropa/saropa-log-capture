# Bug 013 — Palette commands silent no-op

## Status: Fixed

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
Palette-invoked guard sites (`!item?.uri` early returns) across `src/commands-session.ts`, `src/commands-comparison.ts`, `src/commands-export-helpers.ts`, and `src/commands-tools.ts` now show `vscode.window.showInformationMessage(t('msg.paletteRequiresLog'))` before returning, each tagged with a `// bug_013:` comment. Verified multiple guard sites in `src/commands-session.ts` (lines ~171, 232, 260, 277, 296) and confirmed `msg.paletteRequiresLog` is defined in `src/l10n/strings-a.ts` and consumed at 4 command files.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
