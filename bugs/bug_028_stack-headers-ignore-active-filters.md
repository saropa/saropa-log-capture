# Bug 028 — Stack headers ignore active filters

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
