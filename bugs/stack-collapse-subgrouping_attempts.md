# Stack collapse "subgrouping" — attempts log

Status: Fixed (Option A implemented 2026-06-09 — "the message IS the toggle")

## Symptom (user, 2026-06-07 and 2026-06-09)
"Collapsing sections and clickable stacks are COMPLETELY BROKEN." "We should NEVER
have multi-grouping. just 1 level." "I SPECIFICALLY told you not subgrouping!"

Reference logs:
- `d:\src\contacts\reports\20260607\20260607_073856_contacts.log`
- `d:\src\contacts\reports\20260609\20260609_094427_contacts.log`

## Confirmed current behavior (reproduced via real addToData + render-data pipeline)
In file review with defaults (`stackDefaultState=true` collapsed, `showFlutter=all`,
`showDevice=warnplus`), a `[log]` line that is immediately followed by its Dart
stack trace renders as **two rows**:

```
L262  line          "Notifications not yet allowed"            (no toggle)
L263  stack-header   "NotificationService.initNotifications…"   ▶ collapsed
```

The FIRST frame of the trace becomes a separate collapsed `▶` stack-header row
(viewer-data-add-stack-ingest.ts: when the first frame arrives with no active
group, it allocates a NEW header FROM that frame). So every log-with-stack entry
shows the message PLUS a separate collapsible stack item. Ten consecutive startup
entries → ten separate `▶` stack rows. The user reads this two-rows-per-entry
shape as "subgrouping / multi-level."

This is by design in the current code, not a regression — the stack group header
has always been the first frame, distinct from the preceding log message.

## Requirements (to be confirmed with user)
- R1: A log message and its immediately-following stack trace are ONE collapsible
  unit, ONE level. No separate stack-header row hanging off the message.
- R2: Real, independent stack traces (not attached to a preceding app log line)
  still collapse as their own single group.
- R3: Clickable frames (open source) must keep working.

## Rejection log (what was tried and why it did NOT satisfy)
- Attempt 1 — clickability fix (commit 77ab9b6f): made the whole stack-FRAME row
  open its source. Correct and kept, but unrelated to the subgrouping complaint.
- Attempt 2 — hidden-gap reveal chevron on frame rows (commit 62e0274a): surfaced
  filter-hidden device lines after a trace. This ADDED chevrons, arguably making
  the "too many collapsible things" perception WORSE. Did not address subgrouping;
  the separate stack-header row per entry remained.
- Diagnostic error: attempts 1–2 ran the standalone repro with `showDevice='all'`
  (wrong — real default is `warnplus`) and concluded "grouping is correct,"
  missing that the real complaint is the SHAPE (message row + separate stack
  header row), not the frame visibility.

## Implemented fix (Option A — user-confirmed 2026-06-09)
When a stack trace immediately follows a normal `[log]` line (its logical owner),
that LOG LINE is promoted to the stack group's header: the message carries the
`▶`/`▼` chevron and every frame folds under it as one level. No separate
stack-header row.

- `viewer-data-add-stack-ingest.ts` — owner promotion before the first-frame
  header path; `_stackOwner` flag, `groupId`, `collapsed`, `frameCount` on the
  owning line; frames become children. Guarded to SKIP `database`/SQL lines so
  Drift repeat-collapse (bug_003) is untouched; falls back to first-frame-header
  when there is no eligible owner (trace at start, after a marker/separator, or
  after another trace).
- `viewer-data-divider.ts` — `getCounterAffordance` emits the stack chevron for
  `item._stackOwner` (carries `data-stack-gid` → `toggleStackGroup`).
- `viewer-script-click-handlers.ts` — whole-row click on an owner line toggles
  its group (resolved via `data-idx`), selection-guarded; chevron click routes
  through the peek listener.
- `calcItemHeight` (unchanged) hides child frames via `groupHeaderMap[gid].collapsed`.

Tests: `viewer-stack-owner-toggle.test.ts` (new — promotion, fallback, database
guard, affordance + click wiring); updated `viewer-stack-unwrapped-dart`,
`viewer-stack-header-repeat`, `viewer-peek-chevron`. Full stack suite green via
shim; check-types / eslint / `npm run compile` clean.

NOT yet verified on a running device — needs F5 visual confirmation.
