# PLAN 119 — Run-Scoped Signal Correlation API

**Status: In Progress**

GitHub issue: https://github.com/saropa/saropa-log-capture/issues/86

Created: 2026-09-17
Type: New command / Tooling / Infrastructure (public API surface, `api.ts` / `api-types.ts`)
Related: `getDailySummary` (`src/api-daily-summary.ts`), `insertMarker`/`registerIntegrationProvider` (`src/api.ts`), `buildSignalsFromMetas` (`src/modules/misc/cross-session-aggregator.ts`), `loadFilteredMetas`/`TimeRange` (`src/modules/session/metadata-loader.ts`)

---

## Summary

Add a small extension to the public `SaropaLogCaptureApi` so a sibling extension can ask, for a
specific bracketed window of a capture session: **what new signals appeared, and what previously
recurring signals stopped recurring, between two points in time.** Concretely: `insertMarker()`
starts returning an opaque marker id/timestamp instead of `void`, and a new
`getSignalDelta(sinceMarkerId, untilMarkerId?)` method returns the new/resolved signal sets for
that window.

## Motivation

Saropa Workspace (`saropa_workspace`, the "Control Center" extension) is building a command
catalog — initially an ADB command catalog, generalizing to any workspace-run command/shortcut —
and wants to answer a concrete question for the developer: **did running this command cause an
issue, or fix one that was already recurring?** (e.g. "did `adb shell pm clear <pkg>` make a
crash signature disappear", "did installing this APK introduce a new ANR signal").

Today's public API already covers *presence* — `insertMarker(text)` writes a visual marker into
the active session log, and `registerIntegrationProvider` lets a sibling contribute header/meta
data at session start/end — but nothing lets a caller ask Log Capture's own signal detector
*what changed* around that marker. The nearest existing primitive, `getDailySummary(date)`, is
calendar-day granularity and built from `buildSignalsFromMetas(metas)` over a full day's worth of
session metas (`src/api-daily-summary.ts:85`) — too coarse for "this one 20-second command run."

## Behavior

### User flow (from the consuming sibling's side)

1. Sibling extension is about to run a command (adb or otherwise). It calls
   `const markerId = api.insertMarker('Saropa Workspace: adb install app-debug.apk')` if a
   session is active (`api.getSessionInfo()?.isActive`).
2. The command runs; its stdout/stderr are the sibling's own concern (unrelated to this API).
3. After the run (and after a short settle window, since some signals — ANRs, delayed crashes —
   land a beat after the triggering event), the sibling calls
   `const delta = await api.getSignalDelta(markerId)`.
4. `delta.newSignals` / `delta.resolvedSignals` let the sibling annotate its own run-history UI
   ("this run: +1 new crash signature", "this run: resolved 'ANR: MainActivity'") without
   parsing or duplicating Log Capture's own signal detection.

### API shape

```typescript
// api-types.ts

export interface SaropaLogCaptureApi {
  // ...existing members unchanged...

  insertMarker(text?: string): string | undefined;

  getSignalDelta(
    sinceMarkerId: string,
    untilMarkerId?: string,
  ): Promise<SaropaSignalDelta | undefined>;
}

export interface SaropaSignalDelta {
  readonly newSignals: readonly SaropaDailyTroubleItem[];
  readonly resolvedSignals: readonly SaropaDailyTroubleItem[];
}
```

---

## Edge Cases

1. **No active session when `insertMarker` is called** — returns `undefined`. Implemented as-is.
2. **Session ends between the two markers** — `getSignalDelta` resolves against whatever exists on
   disk up to session end rather than throwing; implemented via `findEndOfSessionBound` in
   `src/api-signal-delta.ts`.
3. **Marker id from a rotated/split log file** — the marker id itself (`sessionKey` +
   `baseFileName` + `partNumber` + `physicalLineIndex`, see Implementation Notes) stays resolvable
   across a split; `readWindow` walks every part between the two bounds.
4. **Settle window for delayed signals** — left to the caller, as originally proposed: this API is
   a pure read with no internal timers.
5. **High-frequency callers** — reads straight from disk on every call, same "never cached"
   posture as `getDailySummary`.

---

## Alternatives Considered

- **Reuse `getDailySummary` as-is (no new API)** — rejected: daily granularity can't attribute a
  signal to one specific command run among dozens executed that day.
- **Expose raw signal read access instead of a delta** — rejected: more public-API commitment than
  a pre-computed delta.
- **A new `onDidDetectSignal` event instead of a pull API** — not mutually exclusive with this,
  deferred to a future proposal if a real-time use case shows up.

---

## Decision

**Accepted, with one scope change from the original proposal**, surfaced during review of GitHub
issue #86 before implementation started:

The original proposal said `getSignalDelta` would reuse `buildSignalsFromMetas` /
`loadFilteredMetas` — the same pipeline `getDailySummary` uses. That pipeline reads exclusively
from `SessionMeta` fields (`fingerprints`, `warningFingerprints`, `perfFingerprints`,
`signalSummary`, `driftSqlFingerprintSummary`) persisted to `.session-metadata.json`. All of those
are written **only at session finalization** (`session-lifecycle-finalize.ts`, called from
`stopSessionImpl`) — never incrementally while a session is still recording. Since the plan's own
primary use case is bracketing a short command *inside* a still-running session, a delta built
from that pipeline would find nothing for the "after" side of an active-session window: not
because nothing happened, but because the data isn't extracted yet.

**Resolution:** `getSignalDelta` reads the session's log file(s) directly off disk (both while the
session is active and after it ends — the file exists either way) and re-runs the line-level
fingerprint scanners live, scoped to the marker-bounded slice, instead of going through the
persisted-metadata pipeline. This is Alternative 3 from the implementation exploration
(bypass the persisted-meta path, scan the live file) rather than the two blocking options
(building a whole new incremental-scan-on-write pipeline, or restricting the API to
already-ended sessions only).

**Consequence — scope reduction:** only error, warning, and perf signals are covered (the three
kinds derivable purely from log text via `scanForFingerprints` / `scanForWarningFingerprints` /
`scanForPerfFingerprints`). SQL fingerprints, network/memory/slow-op counts, ANR risk, and Drift
Advisor signals live only in `signalSummary` / `driftSqlFingerprintSummary`, which have no live
equivalent to re-run mid-session — they are out of scope for `getSignalDelta` and documented as
such on `SaropaSignalDelta`.

---

## Implementation Notes

**Marker resolution.** `SessionManagerImpl.insertMarker` now records a `MarkerRecord` in a new
in-memory `MarkerRegistry` (`src/modules/session/session-marker-registry.ts`) before enqueueing
the marker write: `{ sessionKey (vscode.debug.activeDebugSession.id), baseFileName, logDirUri,
partNumber, physicalLineIndex }`. `physicalLineIndex` is `LogSession.physicalLineCount` captured
*before* `appendMarker()` runs — the marker write is enqueued, not synchronous, so this is exactly
"lines written before the marker." `LogSession` gained a `baseFileName` getter (stable across
splits — `getPartFileName(baseFileName, n)` derives every part's filename) so a marker stays
resolvable even if the session rotates to a new part after it was recorded. The registry is
in-memory only, like the rest of the live-session state this module already tracks; a marker id
is valid only within the VS Code window that created it (matches how `getSessionInfo()` etc.
already behave across a window reload).

**Reading a window.** `src/api-signal-delta.ts`'s `readWindow()` walks every log part between two
`FileBound`s (`{ partNumber, physicalLineIndex }`), reading full parts in between and slicing the
boundary parts at their recorded line index — so a window that spans a split reads correctly.
`resolveNowBound()` handles `untilMarkerId` omitted: uses the live session's current position if
still alive (`SessionManagerImpl.getLiveSessionState`), or probes forward on disk for the last
existing part if the session already ended.

**Diffing.** `error-fingerprint.ts` / `warning-fingerprint.ts` / `perf-fingerprint.ts` each gained
a `scanLinesFor*` sibling to their existing `scanFor*(fileUri)` (factored out of the same loop, no
behavior change for existing callers) so the before/after line slices can be fingerprinted without
a second file read. `diffFingerprints`/`diffPerf` in `api-signal-delta.ts` do the actual new/
resolved set difference, by hash for error/warning and by operation name for perf, then map into
`SaropaDailyTroubleItem` the same way `api-daily-summary-build.ts`'s `buildTrouble()` already does
for `getDailySummary`, reusing the `saropaLogCapture.openSignal` deep-link contract.

**Files touched:** `src/api-types.ts`, `src/api.ts`, `src/api-signal-delta.ts` (new),
`src/modules/session/session-marker-registry.ts` (new), `src/modules/session/session-manager.ts`,
`src/modules/capture/log-session.ts`, `src/modules/analysis/error-fingerprint.ts`,
`src/modules/analysis/warning-fingerprint.ts`, `src/modules/misc/perf-fingerprint.ts`.

**Tests:** `src/test/api/signal-delta.test.ts` — pins the pure diff step (`diffFingerprints`/
`diffPerf`): new-vs-resolved by hash, same-hash-different-example is not "new", perf keyed by
operation name, singular/plural occurrence wording. File I/O (`readWindow`, marker resolution) and
the line scanners themselves (they consult `vscode` config to classify error/warning lines) need
the real extension host and are exercised via the project's vscode-test suite, not `node:test`.

---

## Commits

<!-- Add commit hashes as implementation lands -->
