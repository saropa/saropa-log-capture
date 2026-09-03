# Bug 026 — Go-to-Line number mismatch

## Status: Fixed

## Severity: Medium

Go-to-Line and bookmarks use array indices instead of the source line numbers shown in the gutter, so entering the displayed number jumps to the wrong line.

## Problem

The Go-to-Line input interprets the user's number N as `allLines[N-1]` (array index), but the gutter displays `sourceLineNo` (the original file line number). Synthetic rows (markers, stack headers, banners) shift the two numbering systems apart, so typing the number shown in the gutter lands on a different line. Bookmarks also re-scroll via the same broken path.

## Reproduction

1. Open a session with synthetic rows (stack traces, markers, or banners) interspersed
2. Note the `sourceLineNo` shown in the gutter for a line further down
3. Use Go-to-Line and enter that number
4. Observe the viewer scrolls to a different line than expected

**Frequency:** Always (whenever synthetic rows precede the target line)

## Root Cause

Goto-line uses array index while the gutter shows source line numbers; no mapping between the two.
(`viewer-goto-line.ts:90-103`, `viewer-script-messages.ts:269-276`)

## Proposed Fix

Search for the item with matching `sourceLineNo` instead of using the input as an array index. Add a `sourceLineNo` lookup function.

## Changes Made
Added `findAllLinesIndexBySourceLine()` (present in `src/ui/viewer/viewer-source-line-stamp.ts`, `viewer-script-messages.ts`, and `viewer-goto-line.ts`). `viewer-goto-line.ts` (~line 118-121) now resolves the user-typed gutter number to an `allLines` array index via this lookup before calling the existing `scrollToLineNumber()` index-based scroller, instead of treating the typed number directly as an array index. Comment at the call site references bug_026.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
