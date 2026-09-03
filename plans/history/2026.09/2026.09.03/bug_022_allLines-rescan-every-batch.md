# Bug 022 — allLines rescan on every batch

## Status: Closed

## Severity: High

Root-cause-hint collection re-scans the entire log buffer on every batch, stalling the UI thread on large sessions.

## Problem

Every `addLines` batch triggers a full re-scan of the entire `allLines` array: three complete passes running `stripTags()`, `replace(/\s+/g, ' ')`, ~40 `indexOf` probes, and 3 regex matches per line. A 100k-line session performs ~300k `stripTags` calls per batch, stalling the UI thread.

## Reproduction

1. Start a session and let it accumulate ~100k lines
2. Continue streaming new lines in small batches
3. Observe UI thread stalls / jank on each batch as line count grows

**Frequency:** Always (scales with session size)

## Root Cause

Root-cause-hint collectors scan from index 0 on every batch instead of maintaining an incremental cursor from the last-scanned position.
(`src/ui/viewer/viewer-script-messages.ts:63` → `viewer-root-cause-hints-embed-collect-*.ts`)

## Proposed Fix

Add a `lastScannedIndex` cursor to each collector. On each batch, scan only from `lastScannedIndex` to the end of the new data. Reset the cursor on session change.

## Changes Made

`collectGeneralSignals()` already carried an incremental cursor from an earlier fix.
`collectBurstSignals()` (`viewer-root-cause-hints-embed-collect-bursts.ts`) and the
error/n-plus-one loops in `collectRootCauseHintBundleEmbedded()`
(`viewer-root-cause-hints-embed-collect.ts`) still re-scanned `allLines` from index 0
on every batch. Both now follow the same pattern:

- A `lastScannedIndex` cursor and the collector's output arrays/sliding-window state
  persist at module scope in the concatenated webview script (`rchBurstsLastScannedIndex`
  + `rchBurstsEscalations`/`rchBurstsSilenceBursts`/`rchBurstsFrameBudgetClusters`/
  `rchBurstsWarnWindow`/`rchBurstsSlowWindow`/`rchBurstsPrevTs`/`rchBurstsPendingBurst`;
  `rchBundleErrorsLastScannedIndex` + `rchBundleErrorsAccum`;
  `rchBundleNPlusOneLastScannedIndex` + `rchBundleNPlusOneAccum`).
- Each collector's for-loop starts at its own cursor instead of 0, and advances the
  cursor to `allLines.length` at the end of the call.
- A shrink of `allLines.length` below the stored cursor (caused by `trimData()`
  splicing lines off the front once the buffer exceeds `MAX_LINES`) resets the
  accumulator — the same self-heal guard the general collector already used.
- `errors` in the bundle collector used to be extracted by scanning backward from the
  end for the 50 most recent qualifying lines; it is now built by an incremental
  forward scan that appends and caps at 50 by dropping the oldest entry — equivalent
  result (consumers group by fingerprint, order-independent), no full rescan.
- `clearRootCauseHintHostFields()` (called from `resetRootCauseHypothesesSession()` on
  session reset) now also calls `resetGeneralSignalsAccumulator()`,
  `resetBurstSignalsAccumulator()`, and the new `resetBundleSignalsAccumulator()` —
  previously the general collector's reset function existed but was never wired to the
  session-reset path, so a new session's `allLines` (starting back at index 0) could be
  misread as "already scanned" by a stale cursor.
- `collectBurstSignals()`'s silence-burst finalization at the end of each call is now a
  best-effort snapshot against lines seen so far (there is no true "end of stream" once
  scanning is incremental) — it nulls the pending burst after emitting so a burst that
  keeps growing across batches is under-reported rather than duplicated.

## Tests Added

No new automated test — this file's collectors are plain JS text embedded via
TypeScript template literals and exercised through the webview's Extension Development
Host runtime, matching the existing (untested-in-isolation) pattern for the
`collectGeneralSignals()` fix this change mirrors. Verified via `npx tsc --noEmit`
(0 errors) and `npm run compile` (all 12 gates pass).

## Commits
<!-- Add commit hashes as fixes land. -->
