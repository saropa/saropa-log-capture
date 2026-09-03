# Bug 033 — Export timestamps mislabeled UTC

## Status: Open

## Severity: Medium

Exported log files carry incorrect timestamps and can show the wrong date for lines logged after local midnight.

## Problem

Exported log files label timestamps as UTC (with `Z` suffix) but actually use local wall-clock time via `toTimeString()`. The date header is UTC (`toISOString().split('T')[0]`). Sessions that span midnight get the wrong date for lines after midnight — the UTC date rolls over at a different time than local midnight.
(`src/modules/export/export-formats.ts:197-208`)

## Reproduction

1. Start a capture session shortly before local midnight, in a timezone offset from UTC.
2. Let the session continue past local midnight.
3. Export the log and inspect the date header and per-line timestamps.
4. Observe the date header uses UTC date-rollover timing while the per-line time is local, and the local time carries an incorrect `Z` (UTC) suffix.

**Frequency:** Always (visible impact only near midnight / for non-UTC timezones)

## Root Cause

Mixed use of local time for the time component and UTC for the date component, with a UTC suffix incorrectly applied to local times.

## Proposed Fix

Use either all-UTC or all-local consistently. If UTC, use `toISOString()` for both date and time. If local, drop the `Z` suffix and use `toLocaleDateString()`/`toLocaleTimeString()` or `Intl.DateTimeFormat`.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
