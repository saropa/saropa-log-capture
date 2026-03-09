# Plan: Performance — profilerOutputPath and process memory

**Adapter:** `performance`
**Provider:** `src/modules/integrations/providers/performance-snapshot.ts`

## What exists

- `onSessionStartSync`: system snapshot (CPUs, total/free RAM, load average) → header + meta
- `onSessionStartAsync`: starts periodic sampling (free mem, load avg) if `sampleDuringSession` is true
- `onSessionEnd`: stops sampling, writes `basename.perf.json` sidecar
- `PerformanceSnapshot.processMemMb` field exists but is never populated

## What's missing

1. **`profilerOutputPath`**: at session end, copy/link an external profiler output file into the session folder
2. **Process memory**: populate `processMemMb` from the debug target's PID

## Sub-features

### 1. profilerOutputPath

**Config additions:**

Add to `IntegrationPerformanceConfig`:
- `profilerOutputPath`: `string` (default `""`)

Add to `package.json`:
- `saropaLogCapture.integrations.performance.profilerOutputPath` — string, default `""`
- Description: "Path to an external profiler output file (e.g. .cpuprofile, .trace). Copied into the session folder at session end."

**Implementation:**

In `onSessionEnd`, after writing the samples sidecar:

1. If `profilerOutputPath` is non-empty:
   - Resolve the path relative to workspace (support `${workspaceFolder}` variable substitution)
   - Check if the file exists and is within a reasonable size limit (e.g. 100 MB)
   - Copy it to the session folder with filename `${baseFileName}.profiler${ext}` (preserving original extension)
   - Add a sidecar contribution for the copied file
   - Add `profilerFile` to the meta payload
2. If the file doesn't exist or copy fails, log to output channel and continue

### 2. Process memory (processMemMb)

**Implementation:**

Populate `PerformanceSnapshot.processMemMb` when a debug target PID is available:

1. Check if context provides a DAP session or process ID
   - VS Code `vscode.debug.activeDebugSession` may expose process info
   - The debug adapter may send a `process` event with `systemProcessId`
2. If a PID is available:
   - **Windows**: use `wmic process where ProcessId=<pid> get WorkingSetSize` or `tasklist /FI "PID eq <pid>"`
   - **macOS/Linux**: read `/proc/<pid>/status` for VmRSS, or use `ps -o rss= -p <pid>`
   - Parse the result and convert to MB
3. Include in the snapshot and in periodic samples if sampling is active

**Config additions:**

Add to `IntegrationPerformanceConfig`:
- `processMetrics`: `boolean` (default `false`)

Add to `package.json`:
- `saropaLogCapture.integrations.performance.processMetrics` — boolean, default `false`
- Description: "Capture memory usage of the debug target process (requires active debug session)."

### 3. Files to modify

| File | Change |
|------|--------|
| `src/modules/config/config-types.ts` | Add `profilerOutputPath` and `processMetrics` to `IntegrationPerformanceConfig` |
| `src/modules/config/integration-config.ts` | Read new settings |
| `package.json` | Add `profilerOutputPath` string and `processMetrics` boolean settings |
| `src/modules/integrations/providers/performance-snapshot.ts` | Add profiler copy logic in `onSessionEnd`; add process memory collection |

### 4. Considerations

- Profiler output files vary widely in size — the 100 MB cap prevents accidental disk abuse
- Process memory collection is platform-specific and may fail silently — that's acceptable (optional field)
- The DAP `process` event isn't guaranteed — some debug adapters don't send it. The feature should degrade gracefully
- `processMemMb` in periodic samples would require storing the PID and re-querying each interval — only do this if `processMetrics` is true and PID was obtained
- File copy should use `vscode.workspace.fs.copy()` per project rules
