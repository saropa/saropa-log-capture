# bug_011 — `[flowmap]` exit / error / back tags (dialog-dwell fix + failure + return direction)

**Status:** Fixed

## Problems

1. **Dialog dwell is inflated (the bug).** `[flowmap] enter dialog "X"` produces a `nav` event, so
   the dialog becomes the *current* surface and accrues dwell until the next `enter`. Dismissing a
   dialog and sitting on the screen behind it charges that idle time to the dialog, not the screen.
   There is no signal for "this surface closed."
2. **No way to mark a failure on the surface where it happened.** Per-node issue badges come only
   from the hardcoded `classifyWarning` patterns and the single crash detector. An app that catches
   its own exception (`debugException` chokepoint) cannot say "this screen is where it broke."
3. **A re-entry reads as forward navigation.** `recordTransition` infers back-navigation from the
   open-surface stack, but a fresh re-entry the app *knows* is a back step still draws a forward edge.

## Fixes — three tags

### `exit <kind> "<Name>"` (fixes problem 1)

New `TimelineEvent` kind `exit`. `applyExit` charges the closing surface's dwell up to the exit
timestamp, pops it (and anything above it) off the navStack, and makes the revealed caller current
again — resuming its dwell from the exit moment. An exit that does not name the current surface is
ignored (a stray tag must not rewind onto the wrong screen). Emit from the dialog's return point
(e.g. `showDialogCommon`).

### `error "<Category>"` (fixes problem 2)

New `IssueEvent` produced in the parser (so it appears in the Issue Report table, time-ordered),
carrying `explicit: true`. `attachIssues` badges it onto the surface active at that time — and,
unlike heuristic issues, onto dialog surfaces too (the `explicit` flag relaxes the dialog guard that
otherwise exists to keep window-matched noise off the synthetic crash node). Emit from
`debugException`.

### `back` flag on `enter`

Optional trailing `back` token on the `enter` grammar. When set, `recordTransition` forces the
return-edge path (a `back: true` edge, reusing the existing back-arrow rendering) even when the
navStack heuristic would not have detected the return. The app's back handler is authoritative; the
flag supersedes the heuristic.

## Scope

- `src/modules/flow-map/flow-map-model.ts` — `exit` kind, `back?` on `TimelineEvent`, `explicit?`
  on `IssueEvent`.
- `src/modules/flow-map/flow-map-breadcrumbs.ts` — `FLOWMAP_EXIT` + `parseFlowMapExit`; optional
  `back` group on `FLOWMAP_TAG`; wiring in `classifyBreadcrumb`.
- `src/modules/flow-map/flow-map-issues.ts` — `FLOWMAP_ERROR` + `parseFlowMapError`.
- `src/modules/flow-map/flow-map-log-parser.ts` — call the error parser in `scanLine`.
- `src/modules/flow-map/flow-map-builder.ts` — `applyExit`, `forceBack` in `recordTransition`,
  `explicit` relaxation in `attachIssues`.
- `src/test/modules/flow-map/flow-map-tags.test.ts` — dwell-fix, error-badge, back-edge tests.
- `plans/guides/flowmap-tag-navigation.md`, `CHANGELOG.md`.

## Verification

- Extension Host runs of the two flow-map test files pass.
- `npm run compile-tests` clean; scoped eslint zero warnings.

## Finish Report (2026-07-09)

### Defects

1. Dialog/sheet surfaces stayed *current* after dismissal, so their dwell ran until the next
   `enter` — idle time on the revealed caller was charged to the dialog.
2. No app-driven way to place a failure badge on the surface where an exception was caught; per-node
   issue badges came only from hardcoded heuristic patterns and the single crash detector.
3. A re-entry the app knew was a back step could draw a forward edge when the open-surface stack had
   already popped the target.

### Change — three `[flowmap]` verbs

- **`exit <kind> "<Name>"`** (`flow-map-breadcrumbs.ts` `FLOWMAP_EXIT`/`parseFlowMapExit` →
  `TimelineEvent` kind `exit`; `flow-map-builder.ts` `applyExit`). Closes the current surface's dwell
  at the exit timestamp, pops it off the navStack, and restores the revealed caller as current with
  its dwell resuming from the exit moment. An exit not naming the current surface is ignored so a
  stray tag cannot rewind the timeline.
- **`error "<Category>"`** (`flow-map-issues.ts` `FLOWMAP_ERROR`/`parseFlowMapError` →
  `IssueEvent` with `explicit: true`; pushed from `flow-map-log-parser.ts` `scanLine`, un-deduped).
  Appears in the Issue Report table and badges the active surface.
- **`back` flag on `enter`** (optional group on `FLOWMAP_TAG`; `TimelineEvent.back`;
  `recordTransition` `forceBack` path). Forces the return-edge treatment even when the navStack did
  not detect the return; reuses the existing back-arrow rendering.

### Attribution fix uncovered during testing

The `exit` tag re-extends a revealed caller's dwell window over the span its dialog was open, so a
screen's and its dialog's windows overlap. The original first-match-by-insertion attach in
`attachIssues` handed an explicit error fired *inside* the dialog to the outer screen. `attachIssues`
was refactored (`targetNodeForIssue` + `issueWithin`): explicit issues now attach to the INNERMOST
open node (greatest `firstTsMs` among containing windows), which is the surface actually current at
that instant; heuristic issues keep the prior first-containing-non-dialog rule unchanged.

### Verification

- `flow-map-tags.test.js` 14 passing, `flow-map.test.js` 27 passing (Extension Host); the new suites
  cover the dialog-dwell fix (dialog 2s vs the pre-fix 20s, caller keeps 18s), the stray-exit ignore,
  the error table row + screen badge, the explicit-error dialog badge, and the off-stack forced back
  edge.
- `npm run compile-tests` (tsc typecheck + emit) clean; scoped eslint over all six touched files
  zero warnings.
- ReDoS review of `FLOWMAP_EXIT` / `FLOWMAP_ERROR` / the widened `FLOWMAP_TAG`: no nested
  quantifiers; same linear-backtracking shape as the shipped enter/handoff/action regexes.
