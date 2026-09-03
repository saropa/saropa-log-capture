# Bug 007 — Viewer row-index/file-line mismatch and 5,000-line scanner cap

## Status: Fixed

## Severity: Critical

Wrong lines get highlighted/extracted, and errors past line 5,000 are invisible to every scanner.

## Problem

Two related data-integrity issues:

1. The analysis panel uses the viewer's in-memory row index as if it were the raw file line index when extracting stack frames and highlighting source lines. Synthetic rows (markers, headers, banners) shift the mapping between viewer row and actual file line, so the wrong lines are extracted and the wrong lines are highlighted. (`src/ui/analysis/analysis-frame-handler.ts:19-24` vs `src/ui/viewer/viewer-script-click-handlers.ts:18-22` — the two sides disagree on what the index means)
2. All session-end scanners (error fingerprint, root-cause hints, regression detector, signal collectors) hard-stop at line 5,000. Crashes or errors that occur after that line are never fingerprinted, never appear in signals, and never trigger regression detection — silently. (`src/modules/analysis/error-fingerprint.ts:14` and four sibling scanner modules)

## Reproduction

1. Capture a session where a marker or banner line is inserted before an error (e.g. a session-start banner).
2. Click "highlight source" / extract frame from the analysis panel for that error; observe the highlighted line does not match the actual error line in the file.
3. Separately, capture a session with more than 5,000 lines where an error occurs after line 5,000.
4. Observe the error is absent from the fingerprint index, root-cause hints, regression detector, and signals panel.

**Frequency:** Always (for sessions with markers before the target line, or content past line 5,000)

## Root Cause

1. No explicit mapping is stored from a viewer row to its originating source line number; code on both sides of the viewer/analysis boundary assumes row index equals line number, which only holds when no synthetic rows have been inserted.
2. The scanners share an arbitrary 5,000-line cap with no configuration option and no warning when content is truncated, so anything past that offset is simply never scanned.

## Proposed Fix

1. Store `sourceLineNo` explicitly on each viewer item at creation time (`addToData()`) and use that field — not the row index — for all file operations (highlighting, frame extraction).
2. Remove or substantially raise the 5,000-line cap; add a `maxScanLines` setting for users with very large sessions; log a warning to the output channel when the cap is actually hit so truncation is visible rather than silent.

## Changes Made

- Fixed the off-by-one regression in `src/ui/provider/viewer-message-handler-panels.ts` (`openErrorAnalysis`
  handler, ~line 160): `msg.sourceLineNo` was passed directly to `showAnalysis()` / `extractFrames()`, which
  index into a 0-based `split('\n')` array. `sourceLineNo` is the 1-based file line number stamped by
  `viewer-file-loader.ts`, so the handler now converts it with `safeLineIndex(msg.sourceLineNo, 0) - 1`,
  matching the existing `sourceLineNo - 1` pattern already used in `locateLine()`
  (`src/ui/shared/handlers/trouble-detail-handler.ts:59`). Without the conversion, frame extraction started
  one line too late for every "open error analysis" request.
- Item 2 (5,000-line scanner cap) was already fixed separately (centralized 50k-line cap) per the sweep
  report and is out of scope for this pass.

## Tests Added
<!-- No new automated test added; fix is a one-line index-offset correction covered by existing
     openErrorAnalysis manual verification. Consider adding a unit test around locateLine/showAnalysis
     index math if this regresses again. -->

## Commits
<!-- Add commit hashes as fixes land. -->
