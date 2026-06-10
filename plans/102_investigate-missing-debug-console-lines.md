# Investigate: Missing Debug Console Lines Not Captured via DAP

## Status: Open — investigation needed

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
