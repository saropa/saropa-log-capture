# Spec: Application and File Logs Integration

**Adapter id:** `externalLogs`  
**Status:** Implemented (v1) — tail + sidecars + unified viewer sources + commands  
**Full design:** [docs/integrations/application-file-logs.md](../docs/integrations/application-file-logs.md)

## Goal

Tail one or more external log files (app.log, nginx, etc.) during the session and write sidecars so debug and external logs appear together in the viewer (unified list + **Sources** filter).

## Config

- `saropaLogCapture.integrations.adapters` includes `externalLogs`
- `saropaLogCapture.integrations.externalLogs.*`: `paths[]`, `writeSidecars`, `prefixLines`, `maxLinesPerFile`

## Implemented (v1)

- **Tail:** Session start starts `fs.watch` on each existing path; buffers lines appended after start (cap `maxLinesPerFile`). Windows: watch fires with null filename — still reads new bytes.
- **Session end:** Provider snapshots buffers **then** stops watchers; writes `basename.<label>.log`. If buffers empty, reads last N lines per path (fallback).
- **Viewer:** Discovers `basename.<label>.log` (excluding `.terminal.log`); `external:<label>` source id; same **Sources** checkboxes as terminal.
- **Commands:** Add external log path; Open external logs for this session (progress when multiple).

## Deferred

- `createIfMissing`, `followRotation`, glob paths, status bar “Tailing N files”, optional JSONL unified stream (see complete-debug plan Phase 4).
