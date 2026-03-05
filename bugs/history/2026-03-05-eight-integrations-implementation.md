# Eight integration adapters — implementation complete

**Date:** 2026-03-05  
**Status:** Done

## Summary

Implemented the eight previously pending integration adapters so all items in [integration-specs-index.md](../integration-specs-index.md) are now **Done**.

| Adapter       | Provider / module | Behaviour |
|---------------|-------------------|-----------|
| **performance** | `performance-snapshot.ts` | System snapshot (CPUs, RAM) at session start; optional periodic sampling → `basename.perf.json`; Performance panel Session tab shows snapshot and samples. |
| **terminal**    | `terminal-capture.ts` + `terminal-output.ts` | Capture Integrated Terminal output during session (when API available); write `basename.terminal.log` at end. Lifecycle starts capture in `initializeSession`. |
| **linuxLogs**  | `linux-logs.ts` | At session end run dmesg/journalctl (local or via `wsl -e` on Windows); write `basename.linux.log`. |
| **externalLogs** | `external-logs.ts` | At session end read last N lines from configured paths; one sidecar per path (e.g. `basename.<label>.log`). No live tail in v1. |
| **security**   | `security-audit.ts` | Windows Security channel (PowerShell, optional redaction); optional app audit file → `basename.security-events.json`, `basename.audit.log`. |
| **database**   | `database-query-logs.ts` | File mode: read query log (JSONL) at session end → `basename.queries.json`. |
| **http**       | `http-network.ts` | Read request log (JSONL) at session end → `basename.requests.json`. |
| **browser**    | `browser-devtools.ts` | File mode: read browser console log (JSONL/JSON) at session end → `basename.browser.json`. |

Config: all under `integrations.<id>.*`; enable via `saropaLogCapture.integrations.adapters`. Design docs: [docs/integrations/](../../docs/integrations/). Task breakdown and ease order: [docs/integrations/TASK_BREAKDOWN_AND_EASE.md](../../docs/integrations/TASK_BREAKDOWN_AND_EASE.md).

## Notes

- **Performance:** Sampling buffer cleared after copy in `stopPerformanceSampling()` to avoid cross-session leak. Session tab shows "Loading…" until `performanceData` is received.
- **Terminal:** Uses `onDidWriteTerminalData` when present (may be proposed/Insiders-only); no-op when unavailable.
- **Registry:** `getHeaderContributions` is sync; async `isEnabled` is treated as false (see registry comment).
