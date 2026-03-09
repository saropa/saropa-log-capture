# Spec: Performance and Profiling Integration

**Adapter id:** `performance`  
**Status:** Implemented
**Design:** Implemented; see provider in `src/modules/integrations/providers/performance-snapshot.ts` and this spec.

## Goal

Attach system/process snapshot at session start and optional periodic samples; link to profiler output file.

## Config

- `saropaLogCapture.integrations.adapters` includes `performance`
- `saropaLogCapture.integrations.performance.*`: snapshotAtStart, sampleDuringSession, sampleIntervalSeconds, processMetrics, profilerOutputPath

## Implementation

- **Provider:** `onSessionStartSync`: get os.freemem, os.totalmem, cpus (from env or os); if PID available from DAP, get process stats (platform-specific). Return header line + meta. `onSessionEnd`: if sampleDuringSession, write basename.perf.json from buffered samples; if profilerOutputPath set, copy/link file to session folder.
- **Performance:** Snapshot is sync and minimal. Sampling: setInterval with low frequency; cap samples.
- **Status bar:** "Performance" when contributed.

## UX

- No spinner for snapshot. Optional "Performance" tab in viewer with mini chart from sidecar; "Open profiler output" link when attached.
