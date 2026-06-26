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

## Implemented (v2 — 2026-06-25 status correction)

The items below were listed as deferred but are in fact shipped (verified against code):

- **`createIfMissing`** — [external-log-tailer.ts](../src/modules/integrations/external-log-tailer.ts) `ensureFileExists()`; setting `saropaLogCapture.integrations.externalLogs.createIfMissing`.
- **`followRotation`** — passed to `TailWorker` ([external-log-tail-worker.ts](../src/modules/integrations/external-log-tail-worker.ts)); setting `…externalLogs.followRotation`.
- **Glob paths** — [external-log-glob.ts](../src/modules/integrations/external-log-glob.ts) (`isGlobPattern`, `pickLatestMatch`, `resolveExternalLogPath`); a `*`/`?` wildcard in the final path segment tails the latest-modified match.
- **Status bar “Tailing N logs”** — [external-log-tail-status.ts](../src/ui/shared/external-log-tail-status.ts), driven by the tailer’s active-count callback; wired in session lifecycle init/finalize.

## Deferred

- Optional JSONL unified stream (see complete-debug plan Phase 4).
