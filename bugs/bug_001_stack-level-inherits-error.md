# Bug 001 — Stack traces always show error severity regardless of parent line

## Status: Fix Ready

## Problem

Stack frames and stack headers are hardcoded to `level: 'error'` in `addToData()`. When a non-error line (e.g. a Drift SELECT classified as `database`) has a stack trace, the parent line shows a cyan dot but the stack lines show red dots. The severity bar looks disjointed — one logical unit (log line + its stack trace) appears as two unrelated events with different severity colors and no connector between them.

Additionally, `.stack-header` CSS hardcodes text color to `errorForeground` (red), so even with level inheritance the text would remain red.

## Reproduction

1. Run a Flutter app that uses Drift with `DriftDebugInterceptor` logging enabled
2. Open the log in Saropa Log Capture
3. Observe: each Drift SELECT line has a cyan/blue dot, but the stack frames below it have red dots
4. The connector bar does not join them because the levels differ

**Frequency:** Always

## Root Cause

In `src/ui/viewer/viewer-data-add.ts`:
- Line 81: stack-frame items hardcode `level: 'error'`
- Line 99: stack-header items hardcode `level: 'error'`

In `src/ui/viewer-styles/viewer-styles-content.ts`:
- `.stack-header` CSS hardcodes `color: var(--vscode-debugConsole-errorForeground)` (red)

## Changes Made

### File 1: `src/ui/viewer/viewer-data-add.ts`

Added `previousLineLevel()` helper that walks `allLines` backward to find the most recent non-marker line's level, falling back to `'error'` at session boundaries.

**Stack header (line 109):** `level: 'error'` → `level: previousLineLevel()`

**Stack frame (line 91):** `level: 'error'` → `level: activeGroupHeader.level`

### File 2: `src/ui/viewer/viewer-data-helpers-render.ts`

Added `hdrLevelCls` computation for stack-header rendering: `var hdrLevelCls = item.level ? ' level-' + item.level : '';` — applied to the stack-header div's class list.

### File 3: `src/ui/viewer-styles/viewer-styles-content.ts`

Added `.stack-header.level-*` CSS rules for warning, performance, info, debug, notice, and database levels. Base `.stack-header` retains error color as fallback for orphan stacks.

### File 4: `src/test/ui/viewer-severity-bar-connector.test.ts`

Added two new test suites (7 tests total):
- "Stack level inheritance from parent line" — verifies `previousLineLevel` exists, stack-header uses it, stack-frame inherits from header, no hardcoded error on items, marker boundary fallback
- "Stack header level CSS class in renderItem" — verifies `hdrLevelCls` is computed and included in class list

## Tests Added

- `src/test/ui/viewer-severity-bar-connector.test.ts`: 7 new tests across 2 suites

## Commits

<!-- Add commit hashes as fixes land. -->
