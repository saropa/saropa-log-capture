# ENH: adb-logcat capture source (device/emulator system log)

Status: proposed / not started.

## 1. Why

Today the extension captures only the VS Code debug stream — DAP `output` events routed
through `SaropaTracker.onDidSendMessage` → `SessionManager.onOutputEvent`
([tracker.ts](../src/modules/capture/tracker.ts)). That stream contains only what the debug
adapter forwards. Detail the system logs but the adapter does **not** forward is invisible to
the extension:

- **ANR stacks.** When an ANR fires, `ActivityManager` dumps the header (`ANR in com.saropa…`)
  and the frozen main-thread stack to **logcat**, not to the Dart/Flutter debug console. So the
  richest ANR evidence never reaches the current capture path.
- **Native crashes / tombstones, `lowmemorykiller`, `SurfaceFlinger`/`Choreographer` system
  warnings** — system-tag lines that surface via logcat.

`adb logcat` reads all of this from a **running device or emulator** without app cooperation.
This is a new *capture source*, complementary to the DAP stream — not a replacement.

Related: [BUG_Better_Support_ANR.md](../plans/history/2026.07/2026.07.16/BUG_Better_Support_ANR.md) §5 defers device-side ANR
detail; this file is that deferred path made concrete.

## 2. Capability boundaries (verified platform facts)

- `adb logcat` yields the full system log on any connected device/emulator; the ANR stack that
  `ActivityManager` dumps is in it. No root needed for logcat itself.
- **Emulator / `userdebug` builds:** `adb root` then `adb shell cat /data/anr/anr_*` reads the
  raw trace files directly. Production hardware blocks that via SELinux — logcat remains the
  portable path there.
- **`ApplicationExitInfo` stays app-only** (UID-bound API); it is NOT reachable via adb. But its
  trace *content* overlaps what logcat/`/data/anr/` expose, so adb still delivers the detail.
- `adb` is on the PATH of any Flutter developer (Android SDK platform-tools). The extension must
  still degrade gracefully when it is absent or no device is attached.

## 3. Design

### 3.1 New source module
Add `src/modules/capture/adb-logcat-source.ts`:
- Spawn `adb -s <serial> logcat -v threadtime` (threadtime is already a first-class format the
  classifier parses — `threadtimeLevelPattern` in
  [level-classifier.ts](../src/modules/analysis/level-classifier.ts)).
- Stream stdout line-by-line, wrap each line as a synthetic `DapOutputBody`
  (`{ output, category: 'stdout' }`) and feed the **existing** ingestion entry point so all
  downstream machinery (classification, dedup, flood-guard, viewer) is reused unchanged. Target
  injection: a new `SessionManager` method (e.g. `onExternalLine(sessionId, body)`) that funnels
  into the same path as `onOutputEvent` — do NOT fork the pipeline.
- Register the child process for disposal on `context.subscriptions` and on session stop
  ([session-manager-stop.ts](../src/modules/session/session-manager-stop.ts)); kill the `adb`
  child in the deactivation order so no orphan `adb` survives the window.

### 3.2 Device / emulator selection
- `adb devices -l` to enumerate; when >1, prompt (quick-pick) or follow a
  `saropaLogCapture.adbDeviceSerial` setting. Single device → auto-select.
- Optional PID scoping: the DAP `process` event already gives the debug target PID
  (`SaropaTracker` `onProcessId`). `adb logcat --pid=<pid>` narrows the system log to the app,
  cutting unrelated device noise. Provide a toggle — unscoped logcat is what surfaces ANR-killer
  and `lowmemorykiller` lines that name the app from *another* process, so PID scoping must be
  opt-in, not forced.

### 3.3 Dedup against the DAP stream
Flutter forwards *some* logcat lines into the debug console already, so an adb source will double
lines. Reuse the existing dedup ([deduplication.ts](../src/modules/capture/deduplication.ts)) and
flood-guard ([flood-guard.ts](../src/modules/capture/flood-guard.ts)); verify they key on line
content in a way that collapses a DAP copy and an adb copy of the same line. If they key on
arrival source or timing, extend the dedup key — do not add a parallel dedup.

### 3.4 Settings (new)
- `saropaLogCapture.adbLogcat.enabled` (bool, default false — passive until proven, per house
  rules on new capture surfaces).
- `saropaLogCapture.adbLogcat.deviceSerial` (string, optional).
- `saropaLogCapture.adbLogcat.pidScoped` (bool, default false).
- `saropaLogCapture.adbLogcat.adbPath` (string, optional override when `adb` is not on PATH).
Each needs the full add-a-setting chain (package.json + config reader + NLS locale files +
catalog regen). No machine translation.

## 4. Risks / open questions

1. **Double capture volume.** Unscoped logcat on a busy device is high-rate; the flood-guard
   ceiling and dedup must hold or the viewer floods. Measure before shipping unscoped as default.
2. **adb absent / multiple adb versions / device offline** — every failure path must log to the
   `Saropa Log Capture` output channel and no-op, never throw from the source.
3. **Buffer overlap window.** `adb logcat` without `-T`/`-t` replays the whole ring buffer on
   start; scope to `adb logcat -T 1` (only new lines) so a session doesn't ingest minutes of
   pre-attach backlog.
4. **Process lifecycle races.** The `adb` child must be killed exactly once, in the deactivation
   order, and re-spawned cleanly on device reconnect.
5. **Non-Flutter / iOS sessions.** The source is Android-only; gate it so it never spawns for a
   debug session with no Android device.

## 5. First concrete steps

1. Spike `adb-logcat-source.ts` behind the `enabled` setting, threadtime format, single auto-
   selected device, `-T 1`, feeding a new `SessionManager.onExternalLine`.
2. Confirm an emulator ANR (`adb shell am crash` / a deliberate main-thread block) surfaces the
   `ANR in …` stack in the viewer, classified via the existing threadtime path.
3. Verify dedup collapses DAP-forwarded duplicates.
4. Only then: PID scoping toggle, multi-device pick, `/data/anr/` direct read on rooted emulator.

## 6. Explicitly out of scope

- Reading `ApplicationExitInfo` (app-only API — belongs in
  `D:\src\contacts\bugs\BUG_anr_telemetry_debug_suppression.md`).
- Any device write / `adb shell` mutation. This source is read-only logcat.
