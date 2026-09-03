# Bug 033 — Export timestamps mislabeled UTC

## Status: Fixed

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

`src/modules/export/export-formats.ts`:

- `buildFullTimestamp()` now reads the LOCAL calendar date off the parsed `sessionStart`
  header value (`getFullYear()`/`getMonth()`/`getDate()`, not the UTC accessors) and drops
  the trailing `Z` suffix, since the per-line time-of-day string (`timeStr`) is always local
  wall-clock time (from `Date.toTimeString()` in `log-session-helpers.ts`), never UTC.
- Added midnight-rollover tracking: a new `RolloverState { dayOffset, lastTimeStr }` is
  created once per export pass in `parseLogFile()` and threaded through `parseLine()` /
  `ParseLineOptions` down to `buildFullTimestamp()`. Because exported lines are
  chronological, a lexical decrease in `HH:MM:SS.mmm` versus the previous timestamped line
  can only mean local midnight rolled over between them; `dayOffset` is bumped in that case
  and applied via `Date.setDate()` (so month/year boundaries, e.g. Jan 31 -> Feb 1, roll
  over correctly without manual month-length math). `dayOffset` accumulates across multiple
  midnight crossings within one very long session.
- Fixed the resulting type error at the old call site (`buildFullTimestamp` was being
  called with a 3rd `rollover` argument the function didn't accept yet).

## Tests Added

None added in this pass — `npx tsc --noEmit` confirms 0 type errors after the fix.
Follow-up: add a regression test in `src/test/` covering a synthetic export with lines
before and after a local-midnight crossing (see `.claude/rules/testing.md`).

## Commits
<!-- Add commit hashes as fixes land. -->
