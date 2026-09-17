# PLAN 119 — Run-Scoped Signal Correlation API

**Status: Closed**

<!-- Status values: Open → Accepted → In Progress → Closed -->

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
3. **Marker id from a rotated/split log file** — a marker id resolves to `sessionKey` +
   `baseFileName` + a `MarkerPosition` (`partNumber` + `physicalLineIndex`) recorded when the
   marker write lands, so it stays resolvable across a split; `readWindow` walks every part
   between the two bounds.
4. **Settle window for delayed signals** — left to the caller, as originally proposed: this API is
   a pure read with no internal timers. (Distinct from the marker *write* settling, below.)
5. **High-frequency callers** — reads straight from disk on every call, same "never cached"
   posture as `getDailySummary`, but every read is bounded: 25 MiB per part, 50,000 lines of
   history (read backwards from the marker), 50,000 lines of window.
6. **Marker still queued when `getSignalDelta` is called** — `insertMarker` returns its id
   synchronously but the write is enqueued, so a caller bracketing a very fast command can ask
   before the marker lands. `getSignalDelta` waits up to 2s for the position, then returns
   `undefined` rather than guessing a boundary.
7. **Marker never written at all** — a session stopped, or a dead write stream, refuses the
   append. `insertMarker` returns `undefined` instead of an id that could never resolve.
8. **Two marker ids from different sessions** — returns `undefined`. Reachable in normal use: a
   bracketed command (an install, a `pm clear`) can itself restart the app and the debug session.
9. **Empty window** — a bracketed command that logged nothing resolves nothing. Absence of
   logging is not evidence that a signal stopped.

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

**Marker resolution.** `SessionManagerImpl.insertMarker` records a `MarkerRecord` in a new
in-memory `MarkerRegistry` (`src/modules/session/session-marker-registry.ts`) in two steps, because
`LogSession.appendMarker` only *enqueues* the write:

1. `record()` reserves the id the caller needs synchronously — `{ sessionKey
   (vscode.debug.activeDebugSession.id), baseFileName, logDirUri }`, position still unknown.
2. `appendMarker` is handed a `RawWriteCallback`; the append queue invokes it when it reaches the
   marker (after any split that block triggered, before the block is written), and
   `settle()` fills in `{ partNumber, physicalLineIndex }`.

The first cut of this recorded `LogSession.physicalLineCount`/`partNumber` at *call* time and
claimed that was "lines written before the marker". It is not: anything already queued gets
written after that index but before the marker, so it lands on the wrong side of the boundary, and
if the queue splits the file in between, the recorded part number names a file the marker was
never written to. `src/test/modules/capture/log-session-marker-position.test.ts` pins both cases
against the real `LogSession`.

`LogSession` gained a `baseFileName` getter (stable across splits — `getPartFileName(baseFileName,
n)` derives every part's filename) so a marker stays resolvable even if the session rotates after
it was recorded. The registry is in-memory only, capped at 500 markers oldest-first, and a marker
id is valid only within the VS Code window that created it (matching how `getSessionInfo()` etc.
already behave across a window reload).

**Reading a window.** `src/api-signal-delta-window.ts` holds the boundary math behind an injectable
`PartReader`. `readWindow()` walks every part between two `FileBound`s, reading full parts in
between and slicing the boundary parts at their recorded line index. `readHistory()` walks parts
*backwards* from a bound for up to 50,000 lines — bounding I/O as well as memory, and dropping the
oldest lines rather than the most recent ones. `findEndOfSessionBound()` handles `untilMarkerId`
omitted for an ended session, stepping over up to three missing parts so a gap in the sequence
doesn't read as the end; `resolveNowBound()` prefers the live session's position when it is still
alive. All reads are iterative rather than spread-applied (`push(...slice)` throws `RangeError`
past ~125k arguments, and one part can hold more physical lines than that), and `diskPartReader`
honors a 25 MiB per-part ceiling mirroring `api-daily-summary-build.ts`'s `maxSeverityScanBytes`.

**Diffing.** `error-fingerprint.ts` / `warning-fingerprint.ts` / `perf-fingerprint.ts` each gained
a `scanLinesFor*` sibling to their existing `scanFor*(fileUri)` (factored out of the same loop, no
behavior change for existing callers), plus an optional `LineScanOptions` to lift their two caps.
Both caps are presentation defaults — top 30 fingerprints by frequency, and a line cap of 50,000
(5,000 for perf) — and both are wrong for a set difference: a fingerprint missing from the
"before" side is indistinguishable from one that never occurred, so it reports as newly
introduced. `getSignalDelta` scans uncapped.

`computeDelta` compares three slices, not two:

- `after` — the marker-bounded window.
- `history` — up to 50,000 lines before the marker. `newSignals` = in `after`, not in `history`.
- `baseline` — the tail of `history` the same length as `after`. `resolvedSignals` = in
  `baseline`, not in `after`.

The original used `history` for both directions, which made every signal that simply failed to
repeat inside a 20-second window read as "resolved" — a command that logged nothing reported the
session's entire signal set as fixed by it. Matching the lengths makes it like-for-like, and an
empty window now resolves nothing.

`diffFingerprints`/`diffPerf` do the set difference, by hash for error/warning and by operation
name for perf, then map into `SaropaDailyTroubleItem` the same way `api-daily-summary-build.ts`'s
`buildTrouble()` already does, reusing the `saropaLogCapture.openSignal` deep-link contract. Note
that the Signal panel builds its rows from finalized session metadata, so a signal first seen
inside a still-running session may have no row to land on until that session ends —
`SaropaSignalDelta` documents this.

**API version.** `apiVersion` goes to `2`. Additive for callers, but not for implementors (a test
double returning `void` from `insertMarker` no longer satisfies the interface, and
`getSignalDelta` is required), and a sibling built against v2 types on a v1 host needs a runtime
guard — which the literal `1` gave it no way to express.

**Files touched:** `src/api-types.ts`, `src/api.ts`, `src/api-signal-delta.ts` (new),
`src/api-signal-delta-window.ts` (new), `src/modules/session/session-marker-registry.ts` (new),
`src/modules/session/session-manager.ts`, `src/modules/capture/log-session.ts`,
`src/modules/capture/log-session-helpers.ts`, `src/modules/analysis/scanner-line-cap.ts`,
`src/modules/analysis/error-fingerprint.ts`, `src/modules/analysis/warning-fingerprint.ts`,
`src/modules/misc/perf-fingerprint.ts`, `README.md`.

**Tests.** All under `node:test`:

- `src/test/modules/capture/log-session-marker-position.test.ts` — the marker boundary, driven
  against the **real** `LogSession` and real files: a queue backlog, a marker landing several
  splits later, a marker opening a fresh part after a continuation header, and a refused append.
- `src/test/api/signal-delta.test.ts` — `readWindow` / `readHistory` / `findEndOfSessionBound`
  (single-part slicing, multi-part windows, misordered and empty bounds, a missing middle part, a
  bound past a part's real length, the `maxLines` caps, a 250,000-line part), then `computeDelta`
  twice over: with an injected scanner, asserting exactly which slice is compared against which,
  and end-to-end through the real `vscode`-backed scanners, so the fake cannot drift from
  production. Also the pure `diffFingerprints`/`diffPerf` step.
- `src/test/modules/analysis/scanner-line-scan-options.test.ts` — the caps stay put by default and
  actually lift when overridden, for all three scanners.
- `src/test/modules/session/session-marker-registry.test.ts` — record/settle/discard, waiters
  released on settle *and* on discard rather than hanging to the timeout, and oldest-first eviction.

To keep these in `node:test` rather than needing the Extension Development Host,
`scripts/modules/test/vscode-stub.cjs` gained faithful `Uri`, `workspace.getConfiguration` and
`window.createOutputChannel` surfaces. The no-op Proxy could not serve them: it let the *call*
succeed and returned `undefined`, so the next property access threw — which is why the real
scanners and the real `LogSession` were previously untestable there rather than merely degraded.

Still not covered by an automated test: the `vscode.workspace.fs`-backed `PartReader`
(`diskPartReader`) — its stat/read/error branches need the real extension host and a vscode-test
suite. Everything it wraps is now pinned.

## Commits

- `3a45545` feat(api): add run-scoped signal correlation API (PLAN 119)
- `84dc362` test(api): pin the getSignalDelta window/boundary math with node:test
- `896fb40` fix(api): correct getSignalDelta marker boundary, diff semantics and read bounds
- `c6f6d10` docs(plan): record PLAN 119 commit hashes
- `2bce947` docs(changelog): add missing intro line to Unreleased section
- `60c12e9` release: v9.5.0
- `913f163` feat(api): add run-scoped signal correlation API (PLAN 119) (#87) — merged to `main`
