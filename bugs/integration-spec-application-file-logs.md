# Spec: Application and File Logs Integration

**Adapter id:** `externalLogs`  
**Status:** Not implemented  
**Full design:** [docs/integrations/application-file-logs.md](../docs/integrations/application-file-logs.md)

## Goal

Tail one or more external log files (app.log, nginx, etc.) during the session and write sidecars so both debug and external logs are in one place.

## Config

- `saropaLogCapture.integrations.adapters` includes `externalLogs`
- `saropaLogCapture.integrations.externalLogs.*`: paths[], writeSidecar, prefixLines, maxLinesPerFile, createIfMissing

## Implementation

- **Provider:** Start tailing at session start (subscribe to file or poll); buffer lines. `onSessionEnd`: flush buffers to sidecar files `basename_<label>.log`. Use fs.watch or FileSystemWatcher + read; respect maxLinesPerFile.
- **Viewer:** When sidecars exist, add tabs (Debug | app.log | nginx). Load sidecar content on tab switch.
- **Performance:** Tail only configured paths; cap lines per file. Do not block session start; tail in background.
- **Status bar:** "External logs" when adapter enabled and tailing (could contribute at end when sidecars written).

## UX

- No spinner; tabs appear when sidecars exist. Optional status "Tailing N files" during session.
