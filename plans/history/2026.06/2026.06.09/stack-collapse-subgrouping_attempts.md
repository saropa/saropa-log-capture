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

## Finish Report (2026-06-09)

**This work will be reviewed by another AI.**

### Scope
**(B)** VS Code extension (TypeScript webview scripts + tests). No Flutter/Dart, no docs-only.

### Deep review
- Logic/safety: owner promotion runs only when `!activeGroupHeader` and the
  immediately-preceding item is an eligible normal line; null-guarded; no
  recursion. The child-push path is reused (no duplicated frame logic). Fallback
  to first-frame-header preserves standalone-trace grouping (R2).
- Guards: database/SQL preceding lines are skipped so Drift repeat-collapse
  (bug_003) is untouched; blank lines and separators are excluded; an already-
  promoted line (`groupId !== -1`) is not re-promoted.
- Click safety: whole-row owner toggle is selection-guarded (`isCollapsed`) and
  skips `.deco-counter-row` (chevron handled by the peek listener) so a single
  click never both toggles and opens; source-link/url clicks still resolve first.
- Architecture: reuses `groupHeaderMap` + `toggleStackGroup` + `calcItemHeight`
  unchanged (frame visibility keyed off the owner's `collapsed`). `getCounterAffordance`
  gained one `|| item._stackOwner` term. No render.ts edit (kept under the 300-LOC cap).
- Perf: one extra backward look at `allLines[length-1]` per first-frame ingest — O(1).

### Testing
- Audit (mandatory): grepped tests for `stack-header`, `_stackOwner`,
  `getCounterAffordance`, `addToData`, the changed condition string. Affected:
  `viewer-stack-unwrapped-dart` (fed message+frames → updated to owner-mode),
  `viewer-stack-header-repeat` (plain-line-break tests → marker break / owner
  assertions), `viewer-peek-chevron` (pinned the exact condition string → updated
  to the owner-inclusive form). Unaffected (feed frames directly, fallback path):
  `viewer-stack-async-gap`, `viewer-stack-elided-summary`, `viewer-dart-frame-format`,
  `viewer-stack-detection-parity`, `viewer-stack-frame-click`, `viewer-stack-frame-hidden-gap`.
- New: `viewer-stack-owner-toggle.test.ts` (promotion, no-owner fallback, database
  guard, affordance condition, whole-row click wiring).
- Run: full stack suite via a Mocha-globals shim (vscode stubbed) — 101 → after
  updates all green; owner-toggle + peek-chevron = 27 pass / 0 fail. Mocha/Extension-
  Host execution happens in CI / `npm run test` (not run in this environment).
- Gates: `npm run check-types` clean; eslint clean on all touched files (line-count
  + max-params resolved); `npm run compile` green (NLS, webview catalogs, host-outbound,
  list-commands, dist-size 4.55 MiB).

### l10n
SKIPPED [B-NOT-IN-SCOPE] — extension TS, no Flutter ARB. The stack tooltip strings
reuse existing `viewer.affordance.stack*` keys (unchanged).

### Maintenance
- CHANGELOG: entry under `[Unreleased] → Fixed`.
- README: verified — no update needed (collapse behavior described generically; line 96
  collapse-cycle text still accurate).
- guides reviewed; `docs/LAUNCH_TEST.md` not present in repo — SKIPPED.
- Bug archived: bugs/stack-collapse-subgrouping_attempts.md → plans/history/2026.06/2026.06.09/stack-collapse-subgrouping_attempts.md
- Finish report appended: plans/history/2026.06/2026.06.09/stack-collapse-subgrouping_attempts.md

### Files changed (this fix — commit 3e26a780, archival follow-up commit)
- src/ui/viewer/viewer-data-add-stack-ingest.ts (owner promotion + guards)
- src/ui/viewer/viewer-data-divider.ts (getCounterAffordance owner condition)
- src/ui/viewer/viewer-script-click-handlers.ts (owner whole-row toggle)
- src/test/ui/viewer-stack-owner-toggle.test.ts (new)
- src/test/ui/viewer-stack-unwrapped-dart.test.ts, viewer-stack-header-repeat.test.ts, viewer-peek-chevron.test.ts (updated)
- CHANGELOG.md (Unreleased → Fixed)
- (already in HEAD from prior session) viewer-data-helpers-render-stack.ts gap-reveal chevron; viewer-script-click-handlers.ts frame click-to-open

### Outstanding
- On-device (F5) visual confirmation pending — code-verified only.
- Whether the user ALSO wants Drift `database` traces in owner-mode is deferred
  (currently guarded to preserve repeat-collapse).
