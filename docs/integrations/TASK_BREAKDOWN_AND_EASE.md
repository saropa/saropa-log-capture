# Pending Integrations: Task Breakdown & Ease Ranking

Task lists for each of the 8 pending integrations, then ranked **easiest → hardest** to implement.

---

## 1. Performance (performance-profiling.md)

**Why easiest:** No file tailing, no new viewer tabs (Session tab and placeholders already exist). Reuse `os` and optional env snapshot patterns. All work is in one provider + wiring Session tab to `meta.integrations.performance`.

### Task list
- [ ] Add config: `integrations.performance.*` (enabled, snapshotAtStart, sampleDuringSession, sampleIntervalSeconds, processMetrics, profilerOutputPath, includeInHeader) in `integration-config.ts` and config types.
- [ ] Create provider `performance-snapshot.ts`: `getSystemSnapshot()` (os.cpus(), os.freemem(), os.totalmem()), optional `getProcessSnapshot(pid)` (platform-specific: wmic/ps).
- [ ] Provider `onSessionStartSync`: if enabled + snapshotAtStart, return header line(s) + meta payload (snapshot); optional PID from DAP/context if we have it.
- [ ] Provider `onSessionEnd`: if sampleDuringSession was enabled, read in-memory samples array (populated by a timer started at session start from lifecycle), write `basename.perf.json`; return meta + sidecar. (Session lifecycle must start/stop the sampling timer and pass buffer to provider or provider receives buffer via context—design: store buffer in a module the provider reads at end.)
- [ ] Optional: command "Attach profiler output" → copy file to session folder, write `basename.profiler-ref.json`, add to meta.
- [ ] Wire Performance panel Session tab to `meta.integrations.performance` and sidecar: show snapshot text, "Open perf.json", "Open profiler file" when present.
- [ ] Register provider in `extension-activation.ts`; add `performance` to integrations UI and adapter list.

**Rough size:** 1 new provider (~150–200 LOC), config slice, small viewer Session-tab wiring.

---

## 2. Terminal output (terminal-output.md)

**Why easy:** Single data source (VS Code Terminal API), no path config for “which file to tail.” Buffer in memory, write one sidecar at end. Viewer tab pattern already exists (e.g. Windows events “Open file”; can add Terminal tab that loads sidecar).

### Task list
- [ ] Add config: `integrations.terminal.*` (captureEnabled, whichTerminals, writeSidecar, prefixTimestamp, maxLines, preserveAnsi) in integration-config and types.
- [ ] Create provider that **does not** fit sync/end-only: it must **subscribe at session start** and **unsubscribe at session end**. So lifecycle must support “start capture” / “stop capture” callbacks or the provider is invoked differently (e.g. register a hook that session-lifecycle calls when session starts/stops). **Design:** Provider exposes `startCapture(context)` / `stopCapture(context)`; registry or lifecycle calls them; at stop, provider returns contributions (meta + sidecar) from buffered data. Or: separate module “terminal-capture” that lifecycle starts/stops, and a thin provider that at `onSessionEnd` reads from that module’s buffer and returns sidecar. Latter keeps “provider only contributes at start/end” and moves “continuous capture” to a helper.
- [ ] Implement terminal capture: subscribe to `vscode.window.onDidWriteTerminalData` (or correct API name) for chosen terminal(s) (all / active / linked); buffer per terminal; respect maxLines; optional timestamp prefix per line.
- [ ] On session end: build `basename.terminal.log` content from buffer(s); return meta + sidecar. If multiple terminals, merge with `[Terminal: name]` prefix or write multiple sidecars.
- [ ] Viewer: when sidecar exists, add “Terminal” tab or “Open terminal log” and load sidecar content (reuse existing “open sidecar” / load file in webview pattern).
- [ ] Commands: “Capture this terminal”, “Stop capturing this terminal” (update linked set); “Open terminal log for this session.”
- [ ] Register provider; add `terminal` to UI and adapter list.

**Rough size:** 1 provider + 1 capture module (~200 LOC), config, viewer tab + commands.

---

## 3. WSL / Linux logs (wsl-linux-logs.md)

**Why easy–medium:** No continuous tailing. At session end run 1–2 shell commands (dmesg, journalctl), capture stdout, write one sidecar. Detection for “extension in WSL” vs “Windows host, target WSL” then spawn accordingly.

### Task list
- [ ] Add config: `integrations.linuxLogs.*` or `integrations.wsl.*` (enabled, when, sources, leadMinutes, lagMinutes, maxLines, wslDistro, output) in integration-config and types.
- [ ] Helpers: `isExtensionOnLinux()`, `isTargetWsl(context)` (from launch config / session context).
- [ ] Provider `onSessionEnd`: if not enabled or context doesn’t match (e.g. when=wsl but not WSL), return undefined. Else build time range from sessionStartTime/sessionEndTime + lead/lag.
- [ ] **If extension on Linux (WSL/SSH):** spawn `dmesg -T` and `journalctl -b --since ... --until ... --no-pager -o short-precise`; capture stdout; trim to maxLines.
- [ ] **If Windows host, target WSL:** spawn `wsl -e bash -c "dmesg -T; echo '---'; journalctl ..."` (or `wsl -d <distro> -e` if wslDistro set); capture stdout; trim.
- [ ] Write `basename.linux.log` (or two files); return meta + sidecar(s). Optional header line.
- [ ] Viewer: “Linux” / “System (Linux)” tab or “Open Linux logs” when sidecar exists.
- [ ] Register provider; add `linuxLogs` (or `wsl`) to UI and adapter list.

**Rough size:** 1 provider (~120–180 LOC), config, detection helpers, viewer link.

---

## 4. Application / file logs (application-file-logs.md)

**Why medium:** Introduces **file tailing** during session: watch N paths, accumulate lines, write N sidecars at end. Rest is config + viewer tabs; no correlation logic.

### Task list
- [ ] Add config: `integrations.externalLogs.*` or `saropaLogCapture.externalLogs.*` (enabled, paths, writeSidecars, prefixLines, maxLinesPerFile, createIfMissing, followRotation) in integration-config and types.
- [ ] Implement **file tailer** utility: given a list of paths (resolved vs workspace), start watching (e.g. `fs.watch` or `vscode.workspace.createFileSystemWatcher` + read on change); append new lines to per-file buffers; cap at maxLinesPerFile; support “create if missing.” Path resolution: workspace-relative and absolute; encoding UTF-8.
- [ ] Session lifecycle: when session starts and externalLogs enabled, start tailers; when session ends, stop tailers and ask “external logs” module for buffered content (or provider reads from module). **Design:** Same as terminal: a module holds buffers; provider’s `onSessionEnd` returns sidecars from that module; lifecycle starts/stops the tailer module.
- [ ] Provider: `onSessionEnd` returns meta + one sidecar per tailed file (`basename.<label>.log`). Optional header line.
- [ ] Viewer: tabs or “Open external logs” per sidecar; load content like other sidecars.
- [ ] Commands: “Add external log path”, “Open external logs for this session.”
- [ ] Register provider; add `externalLogs` to UI and adapter list.

**Rough size:** Tailer module (~150–250 LOC), provider (~80), config, viewer tabs. **Blocker for others:** Database, HTTP, and Browser (file mode) can reuse this tailer.

---

## 5. Security / audit logs (security-audit-logs.md)

**Why medium:** Reuse Windows Event Log provider pattern; add “Security” channel and redaction. Optional app audit file = tail one file (reuse tailer from application-file-logs if done first).

### Task list
- [ ] Add config: `integrations.security.*` (enabled, windowsSecurityLog, auditLogPath, redactSecurityEvents, includeSummaryInHeader, includeInBugReport) in integration-config and types.
- [ ] **Option A:** Extend `windowsEvents` provider: when `security.enabled` and `security.windowsSecurityLog`, also query “Security” log (same PowerShell path); filter event IDs (e.g. 4624, 4625, 4634, 4647); apply redaction (replace user names, IPs) before writing; write to `basename.security-events.json` and meta.
- [ ] **Option B:** New provider `security-audit` that only runs on Windows, calls same PowerShell pattern for Security channel only, redacts, writes sidecar.
- [ ] Redaction helper: given event message/fields, return copy with TargetUserName, IpAddress, etc. replaced by placeholder.
- [ ] App audit file: if `auditLogPath` set, tail or read at session end (reuse tailer or one-off read); write `basename.audit.log`. No parsing; optional line count in meta.
- [ ] Viewer: “Security / audit” section with warning + “Open file”; do not send raw events to webview.
- [ ] First-time enable: show info message about sensitive data.
- [ ] Register provider (or extend windowsEvents); add `security` to UI and adapter list.

**Rough size:** ~100–150 LOC (provider or extension + redaction). Less if tailer already exists for audit file.

---

## 6. Database query logs (database-query-logs.md)

**Why medium:** Two modes. Mode B (parse from same log) = no tailer: parser over captured lines, build index, store in sidecar; viewer “Related queries” panel. Mode A = tail query log file (reuse tailer), then same correlation/panel.

### Task list
- [ ] Add config: `integrations.database.*` (enabled, mode, queryLogPath, queryLogFormat, requestIdPattern, queryBlockPattern, timeWindowSeconds, maxQueriesPerLookup, includeInBugReport) in integration-config and types.
- [ ] **Mode B (parse):** Parser over log lines (from session or from loaded log): detect query blocks (regex from queryBlockPattern), extract requestId (requestIdPattern); build structures { lineStart, lineEnd, requestId?, queryText, duration? }; index by line and requestId. Run at session end (or when opening log) on stored lines; write `basename.queries.json` and meta.
- [ ] **Mode A (file):** Tail or read `queryLogPath` at session end; parse JSON lines or text; build requestId → queries map; same sidecar format.
- [ ] Correlation: given (line index, line text), extract requestId or use time window; look up queries; return list for viewer.
- [ ] Viewer: “Related queries” panel (new panel or section); context menu “Show related queries” on line; message type `relatedQueries: { queries: [...] }` from extension to webview.
- [ ] Commands: “Show related queries”, “Copy query.”
- [ ] Register provider; add `database` to UI and adapter list.

**Rough size:** Parser + index (~150 LOC), tail/read path (~80 if tailer exists), viewer panel + messaging (~100). Total medium.

---

## 7. HTTP / network (http-network.md)

**Why medium:** Same shape as database: requestId extraction, request log (tail or read), optional HAR import; “Related requests” panel. Reuse tailer and correlation/panel pattern from database if done first.

### Task list
- [ ] Add config: `integrations.http.*` (enabled, requestIdPattern, requestLogPath, harPath, timeWindowSeconds, maxRequestsPerSession, includeInBugReport) in integration-config and types.
- [ ] Request ID extractor: apply requestIdPattern (regex) to log lines; store in line index or in-memory map for session.
- [ ] Request log: tail or read at session end (reuse tailer); parse JSON lines; build requestId → request list; write `basename.requests.json` and meta.
- [ ] HAR: command “Attach HAR for this session”; read HAR JSON; filter entries by session time; normalize to same shape; write to sidecar; show in Requests panel.
- [ ] Viewer: “Related requests” panel; context menu “Show related requests”; message type `relatedRequests: { requests: [...] }`.
- [ ] Commands: “Show related requests”, “Attach HAR for this session”, “Open requests for this session.”
- [ ] Register provider; add `http` to UI and adapter list.

**Rough size:** Similar to database (~250–350 LOC total). HAR parsing is extra but well-defined.

---

## 8. Browser / DevTools (browser-devtools.md)

**Why harder:** Mode A (file) = tail one file, same as other tailers; easy. Mode B (CDP) = WebSocket client, CDP protocol handling, connect/disconnect lifecycle, browser-specific — significantly more work.

### Task list (Mode A — file only, minimal “easiest” slice)
- [ ] Add config: `integrations.browser.*` (enabled, mode, browserLogPath, browserLogFormat, maxEvents) in integration-config and types.
- [ ] At session end (or tail during session): read/tail `browserLogPath`; parse JSONL or JSON; validate schema; cap at maxEvents; write `basename.browser.json` and meta.
- [ ] Viewer: “Browser” tab when sidecar exists; render list (time, level, text); reuse virtual scroll.

### Task list (Mode B — CDP, adds most effort)
- [ ] CDP client: connect to `cdpUrl` (WebSocket); send Console.enable, Runtime.enable; subscribe to Console.messageAdded; map to same schema as file; optional Network.enable and request/response events.
- [ ] Lifecycle: session start → connect and subscribe; session end → flush events to sidecar, disconnect. Handle disconnect (browser closed) gracefully.
- [ ] Discovery: optional “discover URL from launch config” (e.g. remote-debugging-port) and connect to first page; document.

**Rough size:** Mode A ~100–150 LOC. Mode B +200–400 LOC (WebSocket, CDP, reconnection, platform quirks).

---

## Ease ranking (easiest → hardest)

| Rank | Integration        | Effort   | Main reason |
|------|--------------------|----------|-------------|
| 1    | **Performance**    | Easiest  | No tailing; Session UI exists; only snapshot + optional sampling + wiring. |
| 2    | **Terminal**       | Easy     | Single API (terminal write), buffer + sidecar; one new viewer tab. |
| 3    | **WSL/Linux logs**  | Easy     | Run 1–2 commands at end; detection + spawn; one sidecar. |
| 4    | **Application/file logs** | Medium | New tailer; then N paths, N sidecars, tabs. Unblocks 5/6/7/8 (file modes). |
| 5    | **Security/audit**  | Medium   | Reuse Windows Events + redaction; optional audit file tail. |
| 6    | **Database queries**| Medium   | Parser (Mode B) or tailer (Mode A); correlation + “Related queries” panel. |
| 7    | **HTTP/network**    | Medium   | Same as database + HAR parser + “Related requests” panel. |
| 8    | **Browser**         | Medium–Hard | File-only = medium; CDP = hard (WebSocket, protocol, lifecycle). |

**Suggested order to implement:** Performance → Terminal → WSL/Linux logs → Application/file logs (then Security, Database, HTTP, Browser file-only; Browser CDP last if desired).
