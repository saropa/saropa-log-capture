# Clock-only timestamp rollover across midnight and year boundaries

Log lines frequently carry only a clock (`HH:MM:SS`), not a full date. Three parsers reconstructed an absolute time from that clock under a single-day assumption, so any session or log spanning a midnight or a year boundary was mis-ordered: the Session Flow Map produced negative durations and an empty time span for overnight sessions, Android logcat lines captured in December and read the following January were stamped ~12 months in the future, and the timeline's time-only parser corrected a day rollover in only one direction. This change makes all three resolve the correct calendar day. Identified as finding H4 of the 2026-06-12 codebase audit (`plans/104_plan-codebase-audit-2026-06-12.md`).

## Finish Report (2026-06-12)

### Scope
(B) VS Code extension (TypeScript) — three parser modules and their tests. Plus (C) docs (CHANGELOG, audit plan). No Flutter/Dart code touched.

### What changed
The three sites needed different shapes, so each was fixed in place rather than behind one shared helper (a single signature would not fit all three, and forcing one would be premature abstraction):

- **`src/modules/flow-map/flow-map-log-parser.ts`** — added `resolveClockTimeline(lines)`, a single forward pass that converts each line's `[HH:MM:SS.mmm]` ms-of-day into a value that stays monotonic across the whole session. A backward step of more than half a day marks a midnight crossing and adds 24h to a running offset (sub-second cross-thread reordering never trips the half-day threshold). `parseLog` computes the timeline once and feeds the resolved time into both the event scan and `detectCrash`, so an after-midnight crash sorts after the evening's events. Values stay relative (ms since the first day's midnight); every flow-map consumer uses differences, so no real epoch is required.
- **`src/modules/analysis/structured-line-formats.ts`** — `parseLogcatTimestamp` builds the date with the current year, then rolls the year back one when the result lands more than a day in the future (a one-day margin absorbs clock skew / timezone offset around "now").
- **`src/modules/timeline/timestamp-parser.ts`** — the time-only branch now rolls the day in both directions relative to `sessionStart`: more than half a day earlier rolls forward (past midnight), more than half a day later rolls back (a just-before-midnight line while the session began just after). The prior code rolled forward only, leaving before-midnight stamps ~24h in the future.

### Verification
- `npm run check-types` — exit 0.
- `npm run compile-tests` — exit 0.
- Targeted suites via `npm run test:file`: `flow-map.test.js` + `structured-line-parser.test.js` + `timestamp-parser.test.js` → 30 passing; `viewer-file-loader.test.js` (the other consumer of `parseTimestamp`/`parseLog`) → 32 passing. All exit 0.
- `npx eslint` on the six changed files — exit 0.

New tests pin the corrected behavior and would have failed before the change:
- flow-map: two breadcrumb lines crossing midnight produce events whose times differ by exactly 5s (not ~24h backwards).
- logcat: a `12-31 23:59:59.999` line parses to a time no more than a day past now (would have been ~12 months ahead mid-year).
- timeline: just-after-midnight rolls forward, just-before-midnight rolls back, same-day stays put.

### Risk / regression notes
A session contained entirely within one day yields a zero day-offset, so `resolveClockTimeline` returns values identical to the previous raw ms-of-day — no behavior change for the common case (confirmed by the 30 passing flow-map assertions, all single-day fixtures). `detectCrash` gained a `lineTimes` parameter; it is a private function with no external callers. `parseTimestamp` and `parseLog` keep their public signatures.

### Tracking
Audit finding H4 marked done in `plans/104_plan-codebase-audit-2026-06-12.md` (WS-3) and its open question resolved. The plan remains active — it tracks the full audit backlog; this task closed one item. CHANGELOG `[Unreleased]` gained a `### Fixed` block covering the three corrections. README verified — no updates needed (no product fact changed). No bug archive — task did not close a `bugs/*.md` file (the only file under `bugs/` is the report guide).
