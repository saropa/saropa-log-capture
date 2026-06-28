# Bug 001 — Viewer Live-Batch: unbounded `pendingLines` backlog crashes the extension host with a V8 heap OOM under high log volume

## Status: Fixed

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Problem

During a high-volume debug session (a Flutter app streaming full Android logcat + Drift query logs + app console — hundreds of lines/sec), the live-line viewer's `pendingLines` queue grows faster than it drains and is never bounded. The VS Code **extension host** climbs to the ~4 GB V8 heap ceiling and is killed by a V8 fatal OOM (illegal-instruction abort) roughly every **~7 minutes**. Because the Dart debug adapter runs inside that same extension host, every crash terminates the active debug session — the user sees the debugger "randomly" disconnect over and over.

```
# VS Code main process log (…\Code\logs\<session>\main.log):
Extension host with pid 26484 exited with code: 3221225501, signal: unknown.
[error] [UtilityProcess id: 1, type: extensionHost, pid: 26484]: crashed with code -1073741795 and reason 'crashed'
# 3221225501 = 0xC000001D = STATUS_ILLEGAL_INSTRUCTION (V8 `ud2` fatal)

# Recovered from the extension-host minidump (Code\Crashpad\reports\*.dmp) memory:
Allocation failed - JavaScript heap out of memory
electron.v8-oom.is_heap_oom 1
<--- Last few GCs --->
[26484:...]  414603 ms: Scavenge 3980.6 (3992.3) -> 3978.7 (3992.5) MB ... allocation failure;
```

User-visible symptom: `"Debug adapter process has terminated unexpectedly (Extension host shut down)"`, repeating every few minutes.

## Environment

- VS Code version: 1.126.0
- Extension version: saropa-log-capture v9.0.9
- OS: Windows 11 Pro 10.0.22631 x64
- Debug adapter / language: Dart-Code 3.136.1, Flutter app debugged on a physical Android device (very high logcat + Drift-interceptor output volume). The viewer was open/visible during the session.

## Reproduction

1. Open a workspace whose debug target emits a sustained high-rate output stream (full logcat + per-query DB logging — anything exceeding the drain rate below; ~2000+ lines/sec with bursts).
2. Open the Saropa Log Capture viewer (sidebar or pop-out) and keep it **visible** (the live-batch append path is gated on `visible`).
3. Start the debug session and let it run.
4. Command Palette → "Developer: Open Process Explorer" and watch the `extensionHost` row climb steadily toward ~4 GB.
5. At ~4 GB the extension host crashes (a minidump is written to `…\Code\Crashpad\reports\`), the debug session drops, the host restarts, and the cycle repeats.

**Frequency:** Always, given sustained output above the drain rate. In the reported session: 7+ crashes in one evening, ~7 min between crashes, every dump showing the identical OOM signature.

## Root Cause

A producer/consumer imbalance in the live-line batch path, with **no upper bound on the staging queue** and a load response that makes it worse:

**1. Producer appends with no cap** — `appendLiveLineToBatch` (`src/ui/provider/log-viewer-provider-batch.ts:79-82`):
```ts
export function appendLiveLineToBatch(target: BatchTarget, line: PendingLine, rawText: string): void {
    if (!target.getView()?.visible) { return; }
    processLineForThreadDump(target.threadDumpState, line, rawText, target.pendingLines);
}
```
Every output event (when the view is visible) pushes a `PendingLine` onto `target.pendingLines` with no length check, no cap, no drop-oldest. Each `PendingLine` is a heavy object: a fully-built HTML string (`text`), the `rawText`, plus `category`, `tier`, `fw`, `sourcePath`, optional `qualityPercent`, and `lintErrors` / `lintWarnings` arrays (`buildPendingLineFromLineData`, same file, lines 41-76). Order of ~1–5 KB retained per line.

**2. Consumer drains only a fixed slice per flush** — `flushBatch` (`src/ui/provider/viewer-provider-helpers.ts:121-137`):
```ts
export const MAX_LINES_PER_BATCH = 800;
export function flushBatch(pendingLines, isReady, postMessage, sendNewCategories): void {
    if (pendingLines.length === 0 || !isReady) { return; }
    const take = Math.min(pendingLines.length, MAX_LINES_PER_BATCH);
    const lines = pendingLines.splice(0, take);          // drains at most 800
    postMessage({ type: "addLines", lines, lineCount: lines[lines.length - 1].lineCount });
    sendNewCategories(lines);
}
```
At most **800 lines per flush**.

**3. The flush cadence SLOWS under backlog** — `scheduleNextBatch` (`log-viewer-provider-batch.ts:114-127`):
```ts
const BATCH_INTERVAL_MS = 200;
const BATCH_INTERVAL_UNDER_LOAD_MS = 500;
const BATCH_BACKLOG_THRESHOLD = 1000;
...
const delay = target.pendingLines.length > BATCH_BACKLOG_THRESHOLD ? BATCH_INTERVAL_UNDER_LOAD_MS : BATCH_INTERVAL_MS;
```

Drain capacity is therefore:
- Normal (≤1000 backlog): 800 × (1000/200) = **4000 lines/sec**.
- Backlogged (>1000): 800 × (1000/500) = **1600 lines/sec**.

The moment the backlog crosses 1000, the drain rate is **cut to 1600/sec** — the opposite of backpressure. Any sustained arrival rate above 1600/sec (trivially exceeded by a full-logcat + per-query firehose, and spiked by logcat bursts) makes `pendingLines` grow without bound. There is no cap, no drop-oldest, and no path that ever shrinks the queue except the rate-limited flush. The queue grows until the extension host exhausts the V8 old-space heap (~4 GB default) and V8 aborts via `ud2` (the `0xC000001D` illegal-instruction in `Code.exe` seen in the dump).

Note the codebase already has the correct bounded pattern elsewhere: `EarlyOutputBuffer` (`src/modules/session/session-event-bus.ts:12`) caps at `maxEarlyBuffer = 500` and counts/reports drops. The live-batch queue simply never got the same treatment. (Confirmed NOT the leak: `EarlyOutputBuffer` is bounded; the hidden-view path returns early so a hidden viewer doesn't grow the queue; `flushBatch` returns when `!isReady`.)

Data-flow chain: `SaropaTracker.onDidSendMessage` → `SessionManager.onOutputEvent` → `ViewerBroadcaster.addLine` → `appendLiveLineToBatch` → **`pendingLines` (unbounded)** → `flushBatch` (≤800/flush, slows under load).

## Changes Made

**APPLIED** (see Finish Report below). Two independent fixes; (A) is the mandatory safety net, (B) removes the anti-backpressure that accelerates the blowup.

### Fix A (REQUIRED): hard-cap `pendingLines` with drop-oldest + a one-line notice

Bound the staging queue the same way `EarlyOutputBuffer` bounds its buffer. When full, drop the OLDEST pending lines (they have not reached the webview yet, but the full stream is already persisted to the session log file, so nothing is lost from the durable record) and surface a single "N live lines dropped (viewer backlog cap reached)" marker so the drop is visible, not silent.

### File 1: `src/ui/provider/log-viewer-provider-batch.ts` (in `appendLiveLineToBatch`, ~line 79)

**Before:**
```ts
export function appendLiveLineToBatch(target: BatchTarget, line: PendingLine, rawText: string): void {
    if (!target.getView()?.visible) { return; }
    processLineForThreadDump(target.threadDumpState, line, rawText, target.pendingLines);
}
```

**After:**
```ts
// Hard ceiling on the un-flushed staging queue. The webview is a separate
// renderer; if the extension host appends faster than it can post+drain (a
// high-rate logcat/DB firehose), an uncapped queue grows until the host hits
// the ~4GB V8 heap limit and V8 aborts — taking the debug adapter (and the
// user's debug session) with it. The full stream is still on disk in the
// session log, so dropping the OLDEST un-posted lines loses nothing durable.
const MAX_PENDING_LINES = 20_000;

export function appendLiveLineToBatch(target: BatchTarget, line: PendingLine, rawText: string): void {
    if (!target.getView()?.visible) { return; }
    processLineForThreadDump(target.threadDumpState, line, rawText, target.pendingLines);
    if (target.pendingLines.length > MAX_PENDING_LINES) {
        // Drop oldest in a chunk (not one-at-a-time) to avoid O(n) splice churn
        // on every append once at the cap.
        const overflow = target.pendingLines.length - MAX_PENDING_LINES;
        target.pendingLines.splice(0, overflow + 1_000);
        target.droppedLiveLines = (target.droppedLiveLines ?? 0) + overflow + 1_000;
    }
}
```
(Add `droppedLiveLines?: number` to `BatchTarget`, and on the next flush post a single marker line — `[Saropa Log Capture] {n} live lines dropped (viewer backlog cap {MAX_PENDING_LINES} reached; full stream is in the session log file)` — mirroring `EarlyOutputBuffer.formatDroppedNotice`.)

### Fix B (RECOMMENDED): make the cadence back-pressure correctly

The under-load branch currently *halves* throughput exactly when the queue is growing. Invert it: when backlogged, flush at the FAST interval (or raise the per-flush `take`) so the consumer speeds up, not slows down.

### File 2: `src/ui/provider/log-viewer-provider-batch.ts` (`scheduleNextBatch`, ~line 116)

**Before:**
```ts
const delay = target.pendingLines.length > BATCH_BACKLOG_THRESHOLD ? BATCH_INTERVAL_UNDER_LOAD_MS : BATCH_INTERVAL_MS;
```

**After:**
```ts
// When backlogged, drain FASTER, not slower — the slow branch was
// anti-backpressure and let the queue run away. (The webview-payload size is
// already bounded by MAX_LINES_PER_BATCH; flushing more often is the lever.)
const delay = BATCH_INTERVAL_MS;
```
Alternatively keep two intervals but reverse them, and/or raise the per-flush slice (`take`) when `pendingLines.length` is large so drain capacity scales with backlog. Either way, the drain rate must rise with the backlog, never fall.

## Tests Added

<!-- Proposed regression coverage. -->

- `src/test/ui/viewer-batch-backlog-cap.test.ts`:
  - Flood `appendLiveLineToBatch` with 200k lines against a target whose `getView()` reports `visible: true` but never flushes; assert `target.pendingLines.length` never exceeds `MAX_PENDING_LINES` and `target.droppedLiveLines` reflects the overflow.
  - Assert a single drop-notice marker is posted on the next flush (not one per dropped line).
  - Happy path: with arrival below the cap, no drops occur and every line is eventually posted (no behavior change under normal volume).
  - Cadence: with `pendingLines.length > BATCH_BACKLOG_THRESHOLD`, the next scheduled delay is the FAST interval (regression guard for Fix B).

## Commits

<!-- Add commit hashes as fixes land. -->

---

## Finish Report (2026-06-28)

Both fixes applied as described, with a small deviation on Fix B (chose the "reverse the two intervals" variant over deleting the slow branch, so backlog still flushes faster than rest without removing the cadence knob).

**Code — `src/ui/provider/log-viewer-provider-batch.ts`:**
- Added `MAX_PENDING_LINES = 20_000` (exported) and `PENDING_DROP_CHUNK = 1_000`.
- Added `droppedLiveLines?: number` to `BatchTarget` (optional, so the two concrete targets — `LogViewerProvider`, `PopOutPanel` — need no change).
- `appendLiveLineToBatch` now calls `capPendingLines(target)`, which drops `overflow + PENDING_DROP_CHUNK` oldest lines on overflow and accumulates the count. The chunk gives hysteresis so the O(n) splice runs rarely, not on every append at the ceiling.
- `maybeEmitDropNotice(target)` prepends ONE notice marker to the front of the queue (the gap is at the oldest/front end) and resets the counter. Wired into both flush paths: `flushPendingBatch` and the `scheduleNextBatch` timer callback.
- Fix B: `BATCH_INTERVAL_UNDER_LOAD_MS` changed from `500` (slower) to `50` (faster). Extracted `computeBatchDelay(pendingCount)` (exported) used by `scheduleNextBatch`, so the under-load branch now returns the FAST interval.

**Test — `src/test/ui/viewer-batch-backlog-cap.test.ts` (4 cases, all passing):**
- Flood of 200k lines: `pendingLines.length` stays `≤ MAX_PENDING_LINES`; kept + dropped conserves the full arrival count.
- Exactly one drop-notice marker is posted on drain (not one per dropped line); counter resets.
- Below the cap: zero drops, every line eventually posted.
- Cadence: `computeBatchDelay(backlog) < computeBatchDelay(0)` and the at-rest interval is unchanged at 200ms.

**Verification:** `npm run check-types` clean; `npm run compile-tests` then scoped `npm run test:file -- out/test/ui/viewer-batch-backlog-cap.test.js` → 4 passing.

**Not done / out of scope:** the thread-dump grouping buffer (`ThreadDumpState.current.frames`) is a separate accumulator that `capPendingLines` does not touch; it is bounded by an individual dump's frame count, not by stream volume, so it is not part of this OOM path.

---

### Appendix — how this was diagnosed (from the reporting Saropa Contacts session)

The extension-host crash was attributed by parsing the VS Code minidump directly (no WinDbg): exception `0xC000001D ILLEGAL_INSTRUCTION`, faulting module `Code.exe` (the V8 abort path, not any `.node` addon), and the dump's memory carried V8's own `Allocation failed - JavaScript heap out of memory` / `electron.v8-oom.is_heap_oom 1` plus a `Last few GCs` log pinned at ~3990 MB against the ~3992 MB cap. Two separate crashes (pids 26484, 14436) showed the identical OOM at ~7–8 min uptime. Disabling this extension for a multi-hour debug session eliminated the crashes entirely. A sibling extension (`saropa_drift_advisor`) was initially co-suspected but cleared: its accumulation store (`QueryIntelligence._patterns`) keys on `normalizeQuery` (strips digits + quoted literals), so it is bounded by distinct query *shapes*, not volume.
