# Bug 029 — Keyboard accessibility issues

## Status: Fixed

## Severity: Medium

Multiple keyboard-accessibility defects prevent keyboard-only users from operating viewer controls correctly.

## Problem

Three accessibility issues in the viewer:
1. **Space hijacks buttons:** `Space` triggers `togglePause` with `preventDefault()` on any non-input target. Keyboard users on `<button>` or `<select>` cannot activate controls via Space. Type-ahead letters (`f`,`s`,`o`,`b`,`l`,`i`,`q`,`t`,`c`,`h`,`v`,`w`,`m`,`p`,`n`,`a`) also toggle capture features instead of typing. (`viewer-script-keyboard.ts:77,88`)
2. **Level severity dots not keyboard-operable:** `role="button"` but no `tabindex` attribute, so they're unreachable via Tab. (`viewer-toolbar-html.ts:28,74`)
3. **Export modal lacks dialog semantics:** Missing `role="dialog"`, no Escape-to-close handler, no focus trap or return-focus on close. (`viewer-export-html.ts:17`)

## Reproduction

1. Tab to a button or select element in the viewer toolbar and press Space — observe `togglePause` fires instead of activating the focused control
2. Tab through the toolbar — observe severity dots are skipped entirely
3. Open the export modal, press Escape — observe it does not close, and focus is not trapped or returned on close

**Frequency:** Always

## Root Cause

Keyboard event handling doesn't distinguish interactive elements from the viewport background; accessibility attributes incomplete.

## Proposed Fix

(1) Check `event.target` before handling Space/letter keys — skip if target is a button, select, or other interactive element. (2) Add `tabindex="0"` to level dots. (3) Add `role="dialog"`, `aria-modal="true"`, Escape handler, and focus management to the export modal.

## Changes Made

- All three original issues were already addressed in an earlier pass: `viewer-script-keyboard.ts` now checks `event.target`'s tag before handling Space/type-ahead keys so focused buttons/selects are not hijacked; the level severity dots gained `tabindex="0"`; and the export modal (`viewer-export-init.ts`) gained Escape-to-close and a Tab focus trap, verified against current source.
- Follow-up cleanup in this pass: `bindExportModalKeyboardHandlers()` in `src/ui/viewer-panels/viewer-export-init.ts` was a separate function containing the Escape/Tab-trap listeners, but `initExportModal()` never called it — it duplicated the same two listeners inline instead, leaving the extracted function completely dead (confirmed via repo-wide grep: only its own definition matched). Deleted the dead function; the inline listeners in `initExportModal()` (the ones actually wired up) are unchanged and still active.

## Tests Added

None — this pass only deleted a dead function whose logic was already duplicated and running inline; no behavior changed.

## Commits
<!-- Add commit hashes as fixes land. -->
