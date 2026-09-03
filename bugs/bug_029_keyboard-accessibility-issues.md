# Bug 029 — Keyboard accessibility issues

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
