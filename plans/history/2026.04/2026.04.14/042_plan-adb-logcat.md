# 042 — adb logcat Integration

## Status: Phase 2 complete

## Problem

When debugging Android/Flutter apps, the VS Code Debug Console only shows DAP output events — not the full system logcat stream. Developers resort to running `adb logcat` in a separate terminal and manually cross-referencing timestamps.

## Solution

Phase 1 (done): Spawn `adb logcat` as a child process alongside the debug session, stream lines through `logSession.appendLine()` with category `'logcat'`, buffer for `.logcat.log` sidecar at session end. PID filtering from DAP process event. Auto-connects for Dart/Flutter sessions when adb is on PATH — no opt-in required.

Phase 2 (done): Extended `IntegrationProvider` with `onSessionStartStreaming(context, writer)` and `onProcessId(pid)`. Migrated logcat spawning from hardcoded `session-lifecycle-init` into the provider. Registry calls `runOnSessionStartStreaming()` after session start and `dispatchProcessId()` on DAP process events. Auto-detect for Dart sessions moved into the provider's `isEnabled`.

## Key files

- `src/modules/integrations/adb-logcat-parser.ts` — threadtime format parser
- `src/modules/integrations/adb-logcat-capture.ts` — spawn/stop/buffer management
- `src/modules/integrations/providers/adb-logcat.ts` — integration provider (header, sidecar)
- `src/modules/config/config-types-integrations.ts` — `IntegrationAdbLogcatConfig`

## Settings

Auto-connects for Dart/Flutter sessions when adb is on PATH. Can also be explicitly enabled via `"adbLogcat"` in `saropaLogCapture.integrations.adapters` for non-Dart debug adapters.

| Setting | Default | Description |
|---------|---------|-------------|
| `integrations.adbLogcat.device` | `""` | Device serial (`adb -s`) |
| `integrations.adbLogcat.tagFilters` | `[]` | Tag filter expressions |
| `integrations.adbLogcat.minLevel` | `"V"` | Minimum level (V/D/I/W/E/F/A) |
| `integrations.adbLogcat.filterByPid` | `true` | Filter by debug target PID |
| `integrations.adbLogcat.maxBufferLines` | `50000` | Buffer cap for sidecar |
| `integrations.adbLogcat.writeSidecar` | `true` | Write `.logcat.log` at session end |
