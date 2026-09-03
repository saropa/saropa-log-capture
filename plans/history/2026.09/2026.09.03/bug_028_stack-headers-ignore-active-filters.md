# Bug 028 — Stack headers ignore active filters

## Status: Fixed

## Severity: Medium

New stack trace headers briefly flash visible even when a filter that should hide them is already active.

## Problem

Stack trace headers are born with filter flags omitted or set to `false`, unlike regular lines which are stamped with the current filter state in `addToData()`. When Trouble Mode, scope filter, or class filter is active, each new stack trace header briefly flashes visible in the viewport until the next `recalcHeights()` pass applies the filters.

## Reproduction

1. Enable Trouble Mode, a scope filter, or a class filter that hides stack trace headers
2. Trigger a new stack trace to stream into the viewer
3. Observe the new stack header briefly renders visible before disappearing

**Frequency:** Always (whenever a relevant filter is active during new stack trace ingestion)

## Root Cause

The header creation path in `addToData()` does not check or apply the current filter state.
(`viewer-data-add-stack-ingest.ts:206,210`)

## Proposed Fix

Apply all active filter flags to stack headers at creation time in `addToData()`, the same way regular lines are handled. This follows the existing filter pattern: "Set initial height correctly in `addToData()` — new lines arriving while a filter is active must respect it."

## Changes Made

Class-tag filtering (`hdrClassFiltered` via `isClassFiltered()`) and scope filtering (`hdrScopeFiltered` via `calcScopeFiltered()`) were already applied to stack headers at birth in `tryIngestStackLine()` (`src/ui/viewer/viewer-data-add-stack-ingest.ts`), both folded into the `hdrH` height gate.

Gap closed in this pass: Trouble Mode was not applied to stack headers at birth. Added `hdrTroubleFiltered = calcTroubleFiltered(_hdrLevel)`, mirroring the same call `computeLineBirthHeight()` already makes for regular lines (`viewer-data-add-line-birth.ts`), folded it into the `hdrH` gate alongside the existing class/scope/level checks, and stamped it onto the header object as `troubleFiltered` so `calcItemHeightBase()`'s generic `item.troubleFiltered` check (the same one every other line type relies on) also respects it on the next `recalcHeights()` pass. A stack header born while Trouble Mode is active is now born at height 0 instead of flashing visible for one render.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
