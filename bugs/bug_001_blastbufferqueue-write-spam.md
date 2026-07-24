# Bug 001 — BLASTBufferQueue spam: 213k lines (91% of all cataloged events) persisted to log files

## Status: Open

## Problem

The file writer persists every `BLASTBufferQueue` `acquireNextBufferLocked` line to `.log` files — hundreds of thousands of junk lines per session. Sessions reach multi-MB `.log` files that slow every downstream grep/triage pass.

The viewer already classifies unknown device tags as `device-other` and hides them by default (`src/modules/analysis/device-tag-tiers.ts`), but the **write path has no content-aware suppression** — the noise hits disk regardless.

The write path does have four guards, but none catches these lines:

- **FloodGuard** (`src/modules/capture/flood-guard.ts`) — suppresses after >100 **byte-identical** messages within a 1-second window (`repeatThreshold = 100`, `windowMs = 1000`). BLASTBufferQueue lines vary per frame (frame number, buffer id), so each is a "different message" and resets the counter (line 42).
- **Exclusion rules** (`session-manager-events.ts`) — user-configured pattern exclusions. No built-in pattern targets this spam.
- **`captureDeviceOther` setting** (`adb-logcat-capture.ts:207`) — drops `device-other` tier lines on the logcat capture path. Irrelevant here because these lines arrive through stdout (DAP `output` event), not the ADB logcat side-channel.
- **Capture-side `Deduplicator`** (`src/modules/capture/deduplication.ts`) — groups byte-identical consecutive lines within a 500 ms window. Intentionally **bypassed** since 2026.04 (`log-session.ts:220`); even if active, would not collapse lines that vary per frame.

```
[16:32:44.931] [stdout] E/BLASTBufferQueue(14935): [SurfaceView[com.saropamobile.app/...MainActivity]#1](f:1,a:6) acquireNextBufferLocked: Can't acquire next buffer. Already acquired max frames
```

The viewer-side numeric-variant collapse (display-only, in `viewer-data-add-repeat-collapse.ts`) can fold consecutive lines differing only by digits, but that is post-write — the damage to file size is already done.

## Environment

- Extension version: v9.3.1
- OS: Android 12+ devices (BLAST buffer submission moved in-process in Android 12)
- Source project: `d:\src\contacts` (Flutter app), but the fix is extension-side

## Reproduction

1. Run a Flutter app on an Android 12+ device
2. Trigger any main-thread jank (e.g. heavy list scroll, complex build)
3. Observe `BLASTBufferQueue` lines emitted at 60-120 Hz per jank burst
4. Open the captured `.log` file — it contains hundreds of thousands of these lines

**Frequency:** Always (on Android 12+ devices during any jank)

## Root Cause

Since Android 12, `SurfaceView`/window buffer submission uses BLAST (Buffer Layer As Surface Transaction) in the app process. When the Flutter raster produces a frame while all buffers are still acquired (compositor hasn't released one), the system logs an E-level line and drops the frame — retrying next vsync. This fires per attempted frame during jank, so bursts produce 60-120 lines/sec.

The line arrives through `[stdout]` (app's debug-console stream forwarded by `flutter run`), NOT the `[logcat]` side-channel — a logcat-side filter would not catch it.

It is NOT an app defect — the app-side symptom (main-thread jank) is tracked separately via `Choreographer: Skipped frames` events.

## Evidence

From the contacts project error catalog (`reports/20260723/20260723_220326_error_catalog.csv`):

- **213,326 events** across 48 session files, 2026-06-29 to 2026-07-23
- **91% of ALL 232,971** cataloged events in the entire reports tree
- `counts_by_kind` is 100% `log:stdout`

## Proposed Fix

Rate-limit or suppress high-frequency benign device tags **at capture/write time**, not just in the viewer:

### Option 1 (recommended — targeted)

Add a small write-time suppression list for known per-frame platform spam. First entry: `BLASTBufferQueue` `acquireNextBufferLocked: Can't acquire next buffer`. Replace runs with one summary line (`suppressed N BLASTBufferQueue lines in this burst`), preserving first/last occurrence timestamps.

### Option 2 (broader)

Normalize volatile fields (frame number, buffer id) before FloodGuard or the capture-side `Deduplicator` so per-frame variants collapse into byte-identical runs. This would require re-enabling the bypassed `Deduplicator` on the write path and adding a normalization step upstream.

Option 1 is the smaller, targeted change and keeps the suppression auditable in one list. Option 2 requires reversing the 2026.04 deduplicator bypass decision and adds normalization complexity.

## Changes Made

<!-- Fill in when a fix is written. -->

## Tests Added

<!-- Fill in when a fix is written. -->

### Acceptance criteria

- A capture session on the affected device produces zero raw `acquireNextBufferLocked` lines in the `.log` file
- A summary line appears instead (count + first/last timestamps)
- Catalog re-run against new captures drops os-noise events by ~200k

## Commits

<!-- Add commit hashes as fixes land. -->
