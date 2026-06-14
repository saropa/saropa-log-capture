# Investigate: Missing Debug Console Lines Not Captured via DAP

## Status: Partly shipped — manual reproduction still open

**Done (shipped v8.0.4):** the dropped-category diagnostic for the `captureAll: false` case (Step 3, Outcome B path) and the README "Known Limitations" note (Step 2, Outcome A path). See the Finish Report below.

**Still open:**

1. **The actual investigation (Step 1) — still operator work, but now self-service.** Classifying a real missing line as Outcome A ("VS Code never delivers it via DAP, so it cannot be captured") vs Outcome B ("we received it but filtered it out") requires running a live Flutter/Dart debug session and watching the output. This can't be done from a code-only environment — but it no longer needs the hard-to-read raw `verboseDap` dump. Turning on `saropaLogCapture.diagnosticCapture` now traces every received DAP output event with its fate (see "Done" below): a Debug Console line that appears in the trace is Outcome B (the disposition names why it dropped); one that never appears is Outcome A.
**Done since the original finish report.**

- **`captureAll: true` exclusion diagnostic.** The original dropped-category diagnostic only fired when `captureAll` was **false**, so it emitted nothing for the reported scenario (App Only OFF = `captureAll: true`). With `captureAll` on, the only in-extension drop that leaves no trace is an `saropaLogCapture.exclusions` match — flood suppression already surfaces a `[FLOOD SUPPRESSED: N]` summary in the log, and only triggers on 100+ identical lines/sec, so it can't explain a single missing line. `processOutputEvent` now reports each matching exclusion pattern once to the **Saropa Log Capture** output channel, naming the pattern and how to recover the lines.
- **Per-line fate trace under `diagnosticCapture`.** When `saropaLogCapture.diagnosticCapture` is on, every received DAP output event is logged to the output channel with its disposition: `captured`, `dropped (category not in capture list)`, `dropped (exclusion "<pattern>")`, or `flood-suppressed` (text truncated to 80 chars). This is the decisive Outcome A vs B classifier and replaces the need to read the raw `verboseDap` dump for this investigation.

Files: `src/modules/features/exclusion-matcher.ts` (new `findExclusionMatch` returning the matched rule), `src/modules/session/session-manager-events.ts` (`reportExcludedLine` + `excludedRulesLogged` memo, `traceOutcome` helper + per-disposition calls), `src/modules/session/session-manager.ts` (field wiring), tests in `src/test/modules/session/session-manager.test.ts`, README + CHANGELOG.

## Summary

Some system/framework logs (e.g., Android logcat `D/`, `I/`, `W/`, `V/`) appear in the VS Code Debug Console but are missing from the captured log file, even with "App Only: OFF" (`captureAll: true`). The capture backend is correct — the root cause is likely external (DAP adapter behavior).

## Background

The original bug (002) was reclassified on 2026-02-06. The `captureAll` mechanism works correctly. This plan covers the remaining investigation into **why** certain lines are absent.

---

## Investigation Steps

### Step 1: Reproduce with verbose DAP logging

**Goal:** Determine whether missing lines are DAP `output` events at all.

1. Open VS Code Settings, enable `saropaLogCapture.verboseDap`
2. Ensure `saropaLogCapture.captureAll` is `true` (default)
3. Ensure `saropaLogCapture.exclusions` is empty (`[]`)
4. Start a Flutter/Dart debug session that produces both app and system/framework logs
5. Let the session run long enough to generate a mix of log types
6. Stop the debug session

**Examine results:**

1. Open the captured log file — with `verboseDap` enabled it contains raw DAP message dumps (direction, timestamp, category, body)
2. Open the Debug Console side-by-side
3. Identify specific lines visible in the Debug Console but absent from the normal (non-verbose) log output
4. Search for those lines in the verbose DAP dump

**Outcome A — Line is NOT in the DAP dump:**
The line reached the Debug Console through a non-DAP channel (e.g., adapter-internal logging, process stdout captured directly by VS Code). This extension only receives DAP `output` events via `DebugAdapterTracker.onDidSendMessage()`. Proceed to Step 2.

**Outcome B — Line IS in the DAP dump:**
The extension received the line but something filtered it out. Proceed to Step 3.

---

### Step 2: Document as known limitation (if Outcome A)

If missing lines are confirmed to bypass the DAP protocol entirely:

1. Add a note to `README.md` under a "Known Limitations" section:
   > Some Debug Console lines are rendered by VS Code directly and are not available to extensions via the Debug Adapter Protocol. These lines cannot be captured.
2. Close this investigation as "by design / external limitation"

---

### Step 3: Check for unexpected DAP categories (if Outcome B)

**Goal:** Determine whether lines arrive with non-standard categories that get filtered.

1. Look at the session footer stats in the captured log file — the `categoryCounts` block shows every DAP category received and how many lines each produced
2. Check for unexpected category names (e.g., `important`, `telemetry`, or custom adapter-specific strings)
3. With `captureAll: false`, only configured categories are captured — any non-standard category would be silently dropped

**If unexpected categories are found:**

- Consider logging unrecognized categories to the `Saropa Log Capture` output channel so users can diagnose filtering gaps
- Consider adding a "capture unrecognized categories" option, or document which categories to add manually

**If no unexpected categories are found:**

- Re-examine the exclusion patterns — the user may have patterns that match system/framework log formats
- Check whether lines are being deduplicated or flood-suppressed

---

## Priority

Low — the backend capture logic is correct; this is a diagnostic investigation.

## Origin

Reclassified from bug 002 (`002_app-only-off-does-not-capture-all.md`, moved to `bugs/history/20260206/`).

## Finish Report (2026-06-10)

This work will be reviewed by another AI.

**Scope:** (B) VS Code extension (TypeScript) + (C) docs. No Flutter/Dart app code.

**What shipped.** I cannot run a live Flutter debug session in this environment, so the Step 1 reproduction remains operator work. Instead I built the concrete code deliverables that both investigation outcomes call for, so the feature is complete regardless of which branch the live repro lands on:

- **Step 3 (Outcome B path) — dropped-category diagnostics.** `processOutputEvent` previously dropped any line whose DAP category was not whitelisted (`captureAll` off) with no trace — the most likely cause of a "missing Debug Console line." It now calls `reportDroppedCategory()`, which logs each unrecognized category exactly once to the **Saropa Log Capture** output channel, naming the category and how to capture it (`enable captureAll` or add the category). Memoized via a per-`SessionManagerImpl` `droppedCategoriesLogged` Set to avoid flooding.
- **Step 2 (Outcome A path) — known-limitation note.** README → Known Limitations now documents that some Debug Console lines are rendered by VS Code itself and never reach extensions via DAP, so they cannot be captured; and that the dropped-category diagnostic now surfaces whitelist filtering.

**Files changed:**
- `src/modules/session/session-manager-events.ts` — `OutputEventDeps` gains optional `outputChannel` + `droppedCategoriesLogged`; new `reportDroppedCategory()` helper; filter branch now reports before returning.
- `src/modules/session/session-manager.ts` — new `droppedCategoriesLogged` field; passes it + `outputChannel` into `processOutputEvent`.
- `src/test/modules/session/session-manager.test.ts` — new test: each dropped category logs exactly once and names the category.
- `README.md` — Known Limitations entry.
- `CHANGELOG.md` — `[Unreleased]` Added entry.

**Tests:** `npm run test:file -- out/test/modules/session/session-manager.test.js` → 8 passing (includes the new case). `npm run check-types`, `npm run lint` (0 errors; pre-existing warnings only, none in changed files), `npm run compile` (all verify gates OK).

**Outstanding:** the manual Step 1 reproduction (verbose-DAP capture on a real Flutter session, compare Debug Console vs verbose dump) is still required to classify a specific user-reported missing line as Outcome A vs B. The diagnostic now makes that classification self-service. Plan left active for that manual step.

**Finish report appended:** plans/102_investigate-missing-debug-console-lines.md

## Finish Report (2026-06-14)

**Scope:** (B) VS Code extension (TypeScript) + (C) docs. No Flutter/Dart app code.

**Why this work was needed.** The original finish report shipped a dropped-category diagnostic that only fired when `captureAll` was off. The bug it set out to diagnose reproduces with `captureAll: true` (App Only OFF), where that branch is never reached — so for the exact reported scenario, nothing was surfaced. With every category captured, the only in-extension drop that left no trace was an exclusion-pattern match (flood suppression already emits a `[FLOOD SUPPRESSED: N]` summary and only triggers on 100+ identical lines/sec, so it cannot account for a single missing line). There was also no way for an operator to see the fate of every received line without reading the raw `verboseDap` protocol dump, and no control to enable that tracing from the viewer itself.

**What changed.**

- **Exclusion-drop diagnostic (`captureAll: true` path).** `findExclusionMatch` was added to `exclusion-matcher.ts`, returning the matched rule rather than a boolean; `testExclusion` now delegates to it. `processOutputEvent` reports each matching exclusion pattern once (memoized per `SessionManagerImpl` via `excludedRulesLogged`) to the **Saropa Log Capture** output channel, naming the pattern and how to recover the lines.
- **Per-line fate trace under `diagnosticCapture`.** A `traceOutcome` helper logs every received DAP output event with its disposition — `captured`, `dropped (category not in capture list)`, `dropped (exclusion "<pattern>")`, or `flood-suppressed` — text truncated to 80 chars, gated on the existing `diagnosticCapture` setting (default off). This is the decisive Outcome A vs B classifier: a Debug Console line present in the trace was received (the disposition explains why it did not reach the file); one absent was never delivered over DAP and cannot be captured.
- **In-viewer toggle.** The viewer Options panel (Capture section) gains a "Diagnose missing lines (log capture pipeline)" checkbox wired through the same path as the existing capture-enable toggle: webview posts `setDiagnosticCapture`, the host writes `saropaLogCapture.diagnosticCapture` to Workspace scope and echoes `diagnosticCapture` back, the webview syncs the checkbox, and setup seeds the initial state. Both webview message catalogs were regenerated for the new incoming `case` and outbound `type`.

**Files changed:**
- `src/modules/features/exclusion-matcher.ts` — new `findExclusionMatch`; `testExclusion` delegates to it.
- `src/modules/session/session-manager-events.ts` — `excludedRulesLogged` dep, `reportExcludedLine` + `traceOutcome` helpers, per-disposition trace calls.
- `src/modules/session/session-manager.ts` — `excludedRulesLogged` field wiring.
- `src/ui/viewer-panels/viewer-options-panel-html.ts` — diagnostic-capture checkbox row.
- `src/ui/viewer-panels/viewer-options-events.ts` — change listener posting `setDiagnosticCapture`.
- `src/ui/viewer-panels/viewer-options-panel-script.ts` — `syncDiagnosticCaptureUi`.
- `src/ui/provider/viewer-message-handler-panels.ts` — `setDiagnosticCapture` host handler.
- `src/ui/provider/log-viewer-provider-setup.ts` — initial `diagnosticCapture` push.
- `src/ui/viewer/viewer-script-messages.ts` — `diagnosticCapture` receive case.
- `src/l10n/strings-viewer-c.ts` — two new viewer option strings.
- `src/test/modules/session/session-manager.test.ts` — two new tests (exclusion-drop logged once per pattern; every event traced with its fate under `diagnosticCapture`).
- `plans/reference/webview-incoming-message-types.md`, `plans/reference/webview-outbound-message-types.md` — regenerated.
- `README.md`, `CHANGELOG.md` — Known-Limitations and Unreleased entries.

**Tests:** `npm run test:file -- out/test/modules/session/session-manager.test.js` → 10 passing (includes the two new cases); `npm run test:file -- out/test/modules/features/exclusion.test.js` → 11 passing (the `testExclusion` contract is unchanged by the refactor). `npm run check-types` clean; `npm run compile` passes all verify gates and builds the bundle. Lint: 0 errors; one pre-existing `max-lines` warning in `viewer-script-messages.ts` (already 352 lines, over the 325 soft limit, before the 4-line receive case was added).

**Outstanding:** the manual Step 1 reproduction (a live Flutter/Dart debug session, watching the new `diagnosticCapture` trace) remains operator work — it cannot run in a code-only environment. The trace and the in-viewer toggle make that classification self-service. The plan stays active for that manual step.

**Finish report appended:** plans/102_investigate-missing-debug-console-lines.md
