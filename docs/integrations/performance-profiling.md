# Integration: Performance and Profiling

## Problem and Goal

Debug output explains *what* happened; it rarely explains *why* the app was slow or *when* CPU or memory spiked. Correlating **performance data** (CPU usage, memory, GC, or ETW/profiler traces) with the log timeline turns "the app hung for 10 seconds" into "during that 10 seconds, GC ran 3 times and memory grew by 200 MB." This integration allows attaching **system and process metrics** (and optionally profiler snapshots) to the session so that the viewer or export can show resource usage alongside log lines—either as a summary in the header, as time-aligned markers in the viewer, or as a separate timeline panel.

**Goal:** Optionally collect **lightweight performance data** during (or around) the debug session: (1) **Snapshot at session start:** CPU count, total/free memory, process memory if available; (2) **Periodic samples during session:** process CPU and memory at intervals (e.g. every 5 s); (3) **Optional:** Link to external profiler output (e.g. CPU trace file) or ETW session. Store in sidecar or header; display as summary and/or timeline so that "what the log said" and "what the machine did" are in one place.

---

## Data Sources

| Source | Data | How to get it |
|--------|------|----------------|
| **Node.js / V8** | process.memoryUsage(), CPU usage (experimental) | In debuggee: not in extension; user can log it. In extension host: os + process. |
| **OS (Node)** | os.freemem(), os.totalmem(), os.loadavg() | At session start and optionally on interval; extension host only. |
| **Process (debuggee)** | PID, CPU%, memory (working set) | Windows: WMI or tasklist; macOS: ps; Linux: /proc or ps. Need PID from DAP (if exposed) or from launch config. |
| **ETW (Windows)** | Kernel/provider traces | Advanced: start ETW session, stop at session end, produce ETL file. Heavy. |
| **Profiler output** | CPU flame graph, heap snapshot | User runs profiler separately; path to output file in config. Extension attaches "see also: trace.etl" in meta. |

**Practical v1:** (1) **Session start snapshot:** OS memory (free/total), CPU count (already in DevEnvironment), and if we have debuggee PID, process memory/CPU from OS tools. (2) **Optional periodic:** Extension host polls OS (freemem, loadavg) every N seconds and appends to a small sidecar (e.g. `basename.perf.json` with array of `{ time, freememMb, loadAvg? }`). (3) **Optional external file:** User sets path to a trace/snapshot file; we copy or link it in session folder and list it in meta. No ETW or profiler execution inside extension for v1.

---

## Integration Approach

### 1. When to collect

- **Session start:** One snapshot: totalMem, freeMem, cpus (we have this in DevEnvironment), and if possible debuggee process memory (if PID known). Write one line in header: `System:  X CPUs, Y MB RAM (Z MB free); process: N MB` (process optional).
- **During session (optional):** Every `intervalSeconds`, read os.freemem(), os.loadavg() (and if we have PID, process stats). Append to in-memory array; at session end write `basename.perf.json`: `{ samples: [ { t, freememMb, loadAvg1? }, ... ] }`. Optionally store process PID in meta so that post-hoc tools can correlate.
- **Session end:** Write sidecar; optionally run a one-off "process stats" for the debuggee if we still have PID (e.g. peak memory from task manager logs—if available).

### 2. Where to store and display

- **Header:** One or two lines: system snapshot at start; optional "Performance: see basename.perf.json".
- **Sidecar:** `basename.perf.json` (samples) and optionally `basename.profiler-ref.json` (paths to user-provided trace files).
- **Viewer:** (1) In header block: show system snapshot. (2) Optional "Performance" tab or panel: simple line chart (time vs freemem or load) from sidecar; click to see value at time T. (3) "Open profiler output" link when user attached a trace file.

### 3. Debuggee PID

- DAP may expose the process ID of the debuggee (e.g. in a custom event or in the launch response). If we have it, we can query OS for that process’s memory and CPU. If not, only system-wide metrics (freemem, loadavg) are available. Document: "Process metrics require debug adapter to report PID."

---

## User Experience

### Settings (under `saropaLogCapture.performance.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable performance snapshot and optional sampling |
| `snapshotAtStart` | boolean | `true` | Record system (and process if PID known) at session start in header |
| `sampleDuringSession` | boolean | `false` | Periodically sample OS memory/load and write to sidecar |
| `sampleIntervalSeconds` | number | `5` | Interval for sampling |
| `processMetrics` | boolean | `true` | If debuggee PID available, include process memory/CPU in snapshot and samples |
| `profilerOutputPath` | string | `""` | Optional: path to external trace/snapshot file to attach to session (copy or link into session folder) |
| `includeInHeader` | boolean | `true` | Include snapshot summary in context header |

### Commands

- **"Saropa Log Capture: Open performance data"** — Open `basename.perf.json` or show Performance panel for current log.
- **"Saropa Log Capture: Attach profiler output"** — Prompt for file path; copy to session folder and add to meta.

### UI

- **Header:** `System: 8 CPUs, 16384 MB RAM (4096 MB free); process: 256 MB` (process only if PID known).
- **Viewer:** Optional "Performance" section: mini chart (time vs freemem) and link to sidecar/profiler file.

---

## Implementation Outline

### Components

1. **Snapshot collector**
   - `performance-snapshot.ts`: `getSystemSnapshot(): { cpus, totalMemMb, freeMemMb }` using `os`; `getProcessSnapshot(pid?: number)` using platform-specific call (Node: no built-in for other process; use child_process to run `ps` or `wmic` / `tasklist`) or skip if no PID. Return type: `PerformanceSnapshot`. Do not throw; return partial on error.

2. **Session start hook**
   - In session lifecycle, if `performance.enabled` and `snapshotAtStart`: get snapshot (and if DAP gives us PID, process snapshot). Pass to `SessionContext` or append to header. Extend `SessionContext` with `performanceSnapshot?: PerformanceSnapshot` and in `generateContextHeader` add lines.

3. **Sampling loop**
   - If `sampleDuringSession`: start a timer (setInterval) with `sampleIntervalSeconds * 1000`. Each tick: get freemem, loadavg (and process if PID known); push to array. On session end, clear interval and write `basename.perf.json` to session folder. Use same folder as log file; base name from session.

4. **PID from DAP**
   - Research: does DAP send process ID? (e.g. "process" event in some adapters.) If yes, subscribe and store PID; use for process metrics. If no, document that process metrics require adapter support or manual PID config.

5. **Profiler file attach**
   - Command "Attach profiler output": show open file dialog; user picks a file. Copy to `reports/<date>/<basename>_trace.etl` (or preserve extension). Write `basename.profiler-ref.json`: `{ path: "basename_trace.etl" }`. Viewer shows "Profiler: open file" link.

6. **Viewer**
   - Parse `perf.json`; optional simple chart (e.g. SVG or canvas) time vs freemem. Or just list samples and "Open full data."

### Cross-platform

- **Windows:** Process stats via `wmic process where processid=<pid> get WorkingSetSize` or PowerShell. Or use `tasklist /FI "PID eq <pid>" /V`.
- **macOS/Linux:** `ps -o rss,vsz -p <pid>` or read `/proc/<pid>/status` (Linux). Keep in a small helper; avoid native addons for v1.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.performance.*` as above.
- **Sidecars:** `basename.perf.json`, `basename.profiler-ref.json`; optional copied trace file.

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| Sampling overhead | Low frequency (5 s); minimal work (os.freemem). Optional. |
| No PID | Only system metrics; document. |
| Large trace files | Do not copy by default; store path only (user keeps file elsewhere). Or copy with size limit. |
| ETW complexity | Out of scope for v1; document as future. |

**Alternatives:**

- **Full ETW inside extension:** Start/stop ETW session during debug; large feature and Windows-only.
- **Extension host only:** No debuggee metrics; only "machine state" (freemem, load). Still useful.

---

## References

- Node `os`: [os.freemem(), os.loadavg()](https://nodejs.org/api/os.html)
- Existing: `environment-collector.ts` (cpuCount, totalMemoryMb).
