# Bug 045 — Stale "Prev/Next" wording in capture diagnostic message

## Status: Open

## Severity: Low

A user-facing diagnostic tells users to use a viewer control that was removed in
v9.0.6, sending them looking for a button that does not exist.

## Problem

`src/modules/session/session-manager-routing.ts:54` writes this to the
`Saropa Log Capture` output channel when output is routed to the most recent
session:

> Capture diagnostic: routing output to most recent session (incoming
> sessionId=…). If the open log looks empty, use Prev/Next in the viewer to
> switch to the other log.

The viewer's Prev/Next stepper was removed in v9.0.6. Session switching is now
bound to the `[` and `]` keys (`src/ui/viewer/viewer-keybindings.ts:107`,
`prevSession: '['`) plus the Logs panel list. A user following this diagnostic
hunts for a control that no longer exists.

The same stale wording was corrected in `plans/010_runbook-missing-or-empty-logs.md`
but the code string was missed.

## Reproduction

1. Enable `saropaLogCapture.diagnosticCapture`.
2. Start two debug sessions so `ownerSessionIds.size >= 2`.
3. Open the `Saropa Log Capture` output channel.
4. Observe the routing diagnostic instructing use of "Prev/Next in the viewer".
5. Open the viewer — there is no Prev/Next control.

**Frequency:** Always, when `diagnosticCapture` is on with 2+ owner sessions.

## Root Cause

The v9.0.6 stepper removal updated the viewer UI and the runbook plan but did
not sweep source strings referencing the old control.

## Proposed Fix

Reword the diagnostic to name the current affordances — the `[` / `]` keys and
the Logs panel. Suggested:

> If the open log looks empty, press `[` or `]` in the viewer, or pick another
> log from the Logs panel.

Then grep for other survivors of the stepper removal:
`grep -rn "Prev/Next" src/` — note `run-boundaries.ts:68` and
`viewer-session-panel-rendering.ts` are legitimate (run navigation and session
list pagination respectively) and must not be changed.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->
