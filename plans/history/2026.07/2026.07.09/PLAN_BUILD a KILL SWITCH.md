# Plan: Global Capture Kill Switch

## Status: Complete (2026-07-09) — see Finish Report at the end

## Objective

Make disabling capture actually kill all capture work — including work already in flight.
A user flipping capture off (for a sensitive task, or to eliminate background overhead) must
get a true zero-activity state: no open log stream, no file watchers, no spawned processes,
no per-event string processing.

## What already exists — do NOT rebuild

Most of the original draft proposed surfaces that shipped long ago. Verified inventory:

| Surface | Where | Behavior today |
|---|---|---|
| Master setting `saropaLogCapture.enabled` | `package.json`; read via `getConfig().enabled` | Gates session start (`src/modules/session/session-manager-start.ts:46`), session init (`src/modules/session/session-lifecycle-init.ts:55`), and every live DAP output event (`src/modules/session/session-manager-events.ts:53,190`) |
| Toggle command `saropaLogCapture.toggleCapture` | `src/commands-session.ts:52-67` | Flips the setting (Workspace scope when a workspace is open, else Global) and shows a toast |
| Status bar toggle | `src/ui/shared/capture-toggle-status-bar.ts` | Always-visible item, priority 52: `$(circle-filled)` on, `$(circle-outline)` + warning color off; click runs `toggleCapture` |
| Options panel checkbox | `src/ui/viewer-panels/viewer-options-panel-html.ts:38-40`, synced by `viewer-options-panel-script.ts` from the host `captureEnabled` message (`src/ui/provider/log-viewer-provider-setup.ts:86`) | Master capture checkbox already at the top of the Options panel |
| External-change sync | `src/activation-listeners.ts:82-86` | Settings-UI / settings.json edits update the status bar item |
| Per-session pause | `saropaLogCapture.pause` → `sessionManager.togglePause()` (`src/modules/session/session-manager.ts:261-265`) | Pauses/resumes writes for the active session only — a different feature; leave untouched |

All capture integrations are **session-scoped** — they start on session start and stop at
session end: external log tailers (`src/modules/integrations/external-log-tailer.ts` — "Start/stop
from session lifecycle"), terminal capture (`src/modules/integrations/providers/terminal-output.ts`),
adb logcat streaming (`providers/adb-logcat.ts`, spawned in `onSessionStartStreaming`), database
live tail (`providers/database-query-logs.ts:186-194`, gated on `integrations.database.liveTail`),
and OTel trace parsing. Because session start is already gated on `enabled`, none of these ever
start while capture is off. **No upstream "Is Switch Enabled?" gate needs to be built into the
pipeline — it exists.**

## The actual gaps

Flipping `enabled` to `false` while a session is running does NOT kill in-flight work:

1. **Running sessions stay alive.** The config listener (`src/activation-listeners.ts:82-86`)
   only repaints the status bar. The log file stream stays open, external tailers keep their
   `fs.watch` handles, the logcat process keeps streaming, terminal capture keeps buffering,
   database live tail keeps watching — all until the debug session happens to end. Live DAP
   lines are dropped per-event, so the user sees "capture off" while watchers and processes
   keep running.
2. **Early-output buffering happens before the enabled check.** In
   `src/modules/session/session-manager-events.ts:50-53` the unknown-session branch buffers
   the event (`earlyBuffer.add`) BEFORE the `enabled` gate. With capture off, every DAP output
   event is still received, string-trimmed, and buffered (up to 500 events per session in
   `EarlyOutputBuffer`). Bounded, so not a leak — but not zero work either, and it contradicts
   the switch's promise.
3. **The Crashlytics watcher ignores `enabled` entirely.** It polls on its own interval
   setting (`src/modules/crashlytics/crashlytics-watcher.ts` — timer stops only when its own
   interval is 0). Network polling continues while capture is "off".

## Design decision

**Reuse `saropaLogCapture.enabled` as the kill switch. Add nothing new.**

- No new setting. A second master boolean (`enableCaptureAndMonitoring`) alongside `enabled`
  splits one concept across two sources of truth; every consumer would have to check both.
- No new commands. `toggleCapture` + status bar + Options checkbox + Settings UI are four
  existing entry points. (If explicit palette verbs are ever wanted, the repo convention is
  flat IDs — `saropaLogCapture.suspendCapture` — never nested `saropaLogCapture.monitoring.suspend`;
  see `.claude/rules/typescript.md` naming.)
- No new status bar item. The existing toggle already shows on/off state; a second
  `Capture Active` text item duplicates it and adds status-bar clutter.
- Off means **stop**, not pause: flipping off finalizes active sessions (flush + close file,
  stop tailers/processes/watchers via the existing session-end path). Rationale: the switch's
  contract is zero overhead, and `stop` reuses the proven `sessionManager.stopAll()` cascade
  already exercised by `deactivate()` (`src/extension.ts`). The already-captured log stays on
  disk. Turning capture back on does not resurrect anything — the next debug session starts
  fresh (matching today's start-gate behavior).

## Implementation steps

Each step names its success check. Run checks per step; do not proceed on assumption.

### 1. Kill in-flight work on flip-off

In `setupConfigListener` (`src/activation-listeners.ts:82-86`), when
`e.affectsConfiguration('saropaLogCapture.enabled')` and the new value is `false`, call
`sessionManager.stopAll()` (fire-and-forget with `.catch()` logged to the output channel —
the listener must not throw). Session stop already flushes the write queue
(`drainPendingLines`, `src/modules/capture/log-session.ts:394-395`), runs `onSessionEnd`
providers (which stop tailers — `providers/external-logs.ts:75`), and tears down
session-scoped streams.

- Comment the WHY at the call site: the switch promises zero background activity, and
  without this the tailers/processes outlive the "off" state until the debug session ends.
- **Check:** F5, start a Flutter debug session with a tailed external log configured, flip
  the setting off mid-run → log file is finalized (footer written), the "Tailing N logs"
  status item disappears, no further lines arrive, the toggle shows `$(circle-outline)`.

### 2. Hoist the enabled gate above early buffering

In `processOutputEvent` (`src/modules/session/session-manager-events.ts:50-53`), check
`deps.config.enabled` BEFORE the unknown-session `earlyBuffer.add` branch. When disabled,
return without buffering. Mirror the same ordering in the second gate at `:190` if it has
the same shape.

- **Check:** existing test file `src/test/modules/session/session-manager-start.test.ts`
  pattern — add a case: disabled + unknown session id → `earlyBuffer` stays empty.

### 3. Gate the Crashlytics watcher

In `crashlytics-watcher.ts`, treat `getConfig().enabled === false` the same as interval 0
(stop the timer), and re-evaluate on config change so flipping capture back on resumes
polling without a reload.

- **Check:** unit test — watcher with a nonzero interval and `enabled: false` does not
  schedule; flipping to `true` schedules again.

### 4. Name what was killed in the toast

The `toggleCapture` toast (`src/commands-session.ts:64-66`) currently says only
enabled/disabled. When disabling stops live work, say what stopped — e.g.
"Capture disabled — stopped 1 active session" (count from `sessionManager`). Add the new
English strings to the runtime l10n catalog (`src/l10n/strings-*.ts`) and reference by key;
never hardcode. Adding English keys is routine; the machine-translation pipeline stays
operator-run — do not trigger it.

- **Check:** flip off during a session → toast names the stopped session count; flip off
  while idle → plain "Capture disabled" toast unchanged.

### 5. Docs

- CHANGELOG.md under `## [Unreleased]`: one `### Changed` line — disabling capture now
  stops in-flight capture work (sessions, tailers, watchers) immediately.
- README: update the capture-toggle description to state that disabling stops active
  capture rather than only blocking new sessions.

## Explicitly out of scope

- **Clearing the viewer batch queues.** The per-target `pendingLines` staging queue is
  already bounded with drop-oldest + faster-under-load drain
  (`src/ui/provider/log-viewer-provider-batch.ts:33-42` — `MAX_PENDING_LINES = 20_000`,
  bug 001 doctrine). On kill the queues must **drain, not be cleared**: every line in them
  is already on disk, and clearing would make the viewer silently omit captured history.
- **Clearing the LogSession write queue.** Same reason, stronger: clearing it would LOSE
  captured data. `stop()` flushes it; that is the correct path.
- **Touching the batch flush timer.** It drains and goes idle on its own; there is nothing
  to "decouple".
- **A quick-pick on status bar click.** The existing one-click toggle follows the style
  guide's "one item, one action"; a picker adds a step to a two-state flip.
- **`saropaLogCapture.pause`** stays as-is (per-session pause is a different tool).

## Quality gates

Standard repo gates — limits come from `.claude/rules/global.md` (functions ≤ 30 lines,
≤ 4 params, files ≤ 300 LOC) and CONTRIBUTING.md. (`bugs/BUG_REPORT_GUIDE.md` is the
bug-report formatting guide, not the source of code limits — the original draft miscited it.)

```bash
npm run check-types
npm run lint
npm run compile   # also runs the catalog/NLS verify gates
npm run test:file -- out/test/modules/session/session-manager-start.test.js  # scoped, not the full suite
```

Manual test in the Extension Development Host (F5) per the checks in each step.

## Corrections carried over from the original draft (do not reintroduce)

- `enableCaptureAndMonitoring` as a new setting — duplicates `saropaLogCapture.enabled`.
- New status bar item / new suspend+resume commands / new Options checkbox — all exist.
- Nested command IDs (`saropaLogCapture.monitoring.suspend`) — repo convention is flat.
- "Purge pendingLines to prevent V8 heap leakage" — the queue is bounded by design; purging
  loses viewer history and the write path must flush, never drop.
- "Abort before evaluating W3C traceparent regex" — OTel parsing is session-scoped provider
  work; stopping the session covers it. No special-case abort needed.

## Finish Report (2026-07-09)

### Status: Complete

Disabling `saropaLogCapture.enabled` while a debug session is running now kills all in-flight
capture work immediately instead of leaving it running until the debug session ends. All five
implementation steps landed; the change reuses the master `enabled` setting as the kill switch
with no new settings, commands, or status-bar items.

### What changed

1. **In-flight teardown on flip-off** — `setupConfigListener` (`src/activation-listeners.ts`) now
   calls `sessionManager.stopAll()` when `saropaLogCapture.enabled` transitions to `false`. The
   call is fire-and-forget with a `.catch()` that logs to the output channel, so the config
   listener cannot throw. `stopAll()` reuses the existing `deactivate()` cascade: it flushes each
   session's write queue and runs the session-end providers that stop external tailers, the adb
   logcat process, terminal capture, and database live tail. The already-captured log stays on
   disk; re-enabling starts fresh on the next debug session.

2. **Enabled gate hoisted (two layers)** — `processOutputEvent`
   (`src/modules/session/session-manager-events.ts`) checks `config.enabled` BEFORE the
   unknown-session `earlyBuffer.add` branch, so a disabled switch performs no per-event buffering
   or string trimming. A caller-level guard was also added at the top of
   `SessionManagerImpl.onOutputEvent` (`src/modules/session/session-manager.ts`): it returns before
   `resolveEffectiveSessionId` runs, which otherwise routed every DAP event (and could trigger a
   late `startSession` attempt that `startSession` then rejected on `enabled=false`) even while
   capture was off. The two guards are defense-in-depth — `processOutputEvent` remains the
   unit-tested contract surface, and the caller guard makes the "zero per-event work" promise
   literal for the live DAP path.

3. **Crashlytics watcher gated** — `CrashlyticsWatcher.intervalMs()`
   (`src/modules/crashlytics/crashlytics-watcher.ts`) returns `0` (which stops the timer via
   `reschedule()`) when the master `enabled` setting is `false`, and the watcher's config listener
   now reschedules on `saropaLogCapture.enabled` changes so flipping capture back on resumes
   polling without a reload.

4. **Toast names the stopped count** — the `toggleCapture` command
   (`src/commands-session.ts`) reads `sessionManager.activeSessionCount` BEFORE writing the setting
   (the config listener's async `stopAll()` would otherwise race the count to zero) and shows a new
   string `captureToggle.disabledStoppedSessions` ("Log capture disabled — stopped {0} active
   session(s).", added to `src/l10n/strings-a.ts`) when at least one session was stopped; the plain
   `captureToggle.disabled` toast is used when idle.

5. **Docs** — CHANGELOG gained a `### Changed` entry under `[Unreleased]`; the README `enabled`
   settings row now states that disabling stops active capture, not only new sessions.

### Verification

- `npm run check-types` — clean.
- `npm run lint` — 0 errors (14 pre-existing warnings in untouched files).
- `npm run compile-tests` — clean.
- New unit test `src/test/modules/session/session-manager-events.test.ts` — 3 passing: disabled +
  unknown session does not buffer; disabled + known session does not broadcast; enabled + unknown
  session buffers once.
- `src/test/modules/session/api-write-line.test.ts` "no-op when capture is disabled" — unaffected
  (the `processApiWriteLine` gate was not moved).

### Not automated (manual verification required)

- The `toggleCapture` toast count logic and the `activeSessionCount`-before-write race fix have no
  automated test (the command is registered against the VS Code host; asserting the toast requires
  driving `showInformationMessage`). Covered by inspection.
- The Crashlytics watcher's enabled gating has no automated test (timer scheduling against a live
  `vscode.workspace.getConfiguration` is not observable as a pure unit). Covered by inspection.

### Known residual (accepted, not a regression)

`intervalMs()` performs uncached `getConfiguration` reads on each `reschedule`/`scan`/`recordFailure`
call — a pre-existing pattern, not introduced by this change.
