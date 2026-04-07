# Pending Integrations: Task Breakdown & Ease Ranking

Navigation:

- Folder guide and canonical links: [README.md](README.md)
- Active adapter spec index: [001_integration-specs-index.md](001_integration-specs-index.md)
- Empty/missing logs runbook: [010_runbook-missing-or-empty-logs.md](010_runbook-missing-or-empty-logs.md)

Task lists for the 5 remaining pending integrations, ranked **easiest → hardest** to implement.

Performance, Terminal, and WSL/Linux logs are implemented — see providers in `src/modules/integrations/providers/`.

---

## 1. Application / file logs (application-file-logs.md)

**Why medium:** Introduces **file tailing** during session: watch N paths, accumulate lines, write N sidecars at end. Rest is config + viewer tabs; no correlation logic.

### Task list
- [x] Add config: `integrations.externalLogs.*` (paths, writeSidecars, prefixLines, maxLinesPerFile) in integration-config and types. *(createIfMissing / followRotation still optional.)*
- [x] Implement **file tailer** (`external-log-tailer.ts`): `fs.watch`, read new bytes from EOF at session start, per-file buffers, cap at maxLinesPerFile; workspace-relative and absolute paths; UTF-8.
- [x] Session lifecycle: start tailers when session starts and adapter enabled; `onSessionEnd` snapshots buffers then stops watchers (order matters — do not clear buffers before provider runs).
- [x] Provider: `onSessionEnd` meta + sidecars `basename.<label>.log`; fallback read last N lines if no buffers.
- [x] Viewer: unified multi-source load (same as terminal); `external:<label>` sources; discover sidecars via directory listing.
- [x] Commands: Add external log path; Open external logs for this session (with progress when multiple).
- [x] Register provider; `externalLogs` in integrations UI.

**Rough size:** Tailer module (~150–250 LOC), provider (~80), config, viewer tabs. **Blocker for others:** Database, HTTP, and Browser (file mode) can reuse this tailer.

---

## 2. Security / audit logs (security-audit-logs.md)

**Why medium:** Reuse Windows Event Log provider pattern; add “Security” channel and redaction. Optional app audit file = tail one file (reuse tailer from application-file-logs if done first).

### Task list
- [x] Add config: `integrations.security.*` (enabled, windowsSecurityLog, auditLogPath, redactSecurityEvents, includeSummaryInHeader, includeInBugReport) in integration-config and types.
- [x] **Option B:** New provider `security-audit` that only runs on Windows, calls same PowerShell pattern for Security channel only, redacts, writes sidecar.
- [x] Redaction helper: given event message/fields, return copy with TargetUserName, IpAddress, etc. replaced by placeholder.
- [x] App audit file: if `auditLogPath` set, tail or read at session end (reuse tailer or one-off read); write `basename.audit.log`. No parsing; optional line count in meta.
- [x] Event summary in meta (categorized by event ID) and optional header contribution.
- [x] Configurable lead/lag from shared windowsEvents config.
- [x] Register provider (or extend windowsEvents); add `security` to UI and adapter list.
- [x] Viewer: “Security / audit” section with warning + “Open file”; do not send raw events to webview.
- [x] First-time enable: show info message about sensitive data.

**Rough size:** ~100–150 LOC (provider or extension + redaction). Less if tailer already exists for audit file.

---

## 3. Database query logs (database-query-logs.md)

**Why medium:** Two modes. Mode B (parse from same log) = no tailer: parser over captured lines, build index, store in sidecar; viewer “Related queries” panel. Mode A = tail query log file (reuse tailer), then same correlation/panel.

### Task list
- [x] Add config: `integrations.database.*` (enabled, mode, queryLogPath, queryLogFormat, requestIdPattern, queryBlockPattern, timeWindowSeconds, maxQueriesPerLookup, includeInBugReport) in integration-config and types.
- [x] **Mode B (parse):** Parser over log lines (from session or from loaded log): detect query blocks (regex from queryBlockPattern), extract requestId (requestIdPattern); build structures { lineStart, lineEnd, requestId?, queryText, duration? }; index by line and requestId. Run at session end (or when opening log) on stored lines; write `basename.queries.json` and meta.
- [x] **Mode A (file):** Tail or read `queryLogPath` at session end; parse JSON lines or text; build requestId → queries map; same sidecar format.
- [x] Context popover: `.queries.json` loaded by context data loader; queries shown in integration context popover filtered by time window.
- [x] Register provider; add `database` to UI and adapter list.
- [x] Correlation: given (line index, line text), extract requestId or use time window; look up queries; return list for viewer.
- [x] Viewer: “Related queries” panel (new panel or section); context menu “Show related queries” on line; message type `relatedQueries: { queries: [...] }` from extension to webview.
- [x] Commands: “Show related queries”, “Copy query.”

**Rough size:** Parser + index (~150 LOC), tail/read path (~80 if tailer exists), viewer panel + messaging (~100). Total medium.

---

## 4. HTTP / network (http-network.md)

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

## 5. Browser / DevTools (browser-devtools.md)

**Why harder:** Mode A (file) = tail one file, same as other tailers; easy. Mode B (CDP) = WebSocket client, CDP protocol handling, connect/disconnect lifecycle, browser-specific — significantly more work.

### Task list (Mode A — file only, minimal “easiest” slice)
- [x] Add config: `integrations.browser.*` (enabled, mode, browserLogPath, browserLogFormat, maxEvents) in integration-config and types.
- [x] At session end (or tail during session): read/tail `browserLogPath`; parse JSONL or JSON; validate schema; cap at maxEvents; write `basename.browser.json` and meta.
- [x] Viewer: “Browser” tab when sidecar exists; render list (time, level, text); reuse virtual scroll. *(Implemented in unified timeline panel with source filtering, virtual scroll, and level icons.)*

### Task list (Mode B — CDP, adds most effort)
- [ ] CDP client: connect to `cdpUrl` (WebSocket); send Console.enable, Runtime.enable; subscribe to Console.messageAdded; map to same schema as file; optional Network.enable and request/response events.
- [ ] Lifecycle: session start → connect and subscribe; session end → flush events to sidecar, disconnect. Handle disconnect (browser closed) gracefully.
- [ ] Discovery: optional “discover URL from launch config” (e.g. remote-debugging-port) and connect to first page; document.

**Rough size:** Mode A ~100–150 LOC. Mode B +200–400 LOC (WebSocket, CDP, reconnection, platform quirks).

---

## Ease ranking (easiest → hardest)

| Rank | Integration        | Effort   | Main reason |
|------|--------------------|----------|-------------|
| 1    | **Application/file logs** | Medium | New tailer; then N paths, N sidecars, tabs. Unblocks others (file modes). |
| 2    | **Security/audit**  | Medium   | Reuse Windows Events + redaction; optional audit file tail. |
| 3    | **Database queries**| Medium   | Parser (Mode B) or tailer (Mode A); correlation + “Related queries” panel. |
| 4    | **HTTP/network**    | Medium   | Same as database + HAR parser + “Related requests” panel. |
| 5    | **Browser**         | Medium–Hard | File-only = medium; CDP = hard (WebSocket, protocol, lifecycle). |

**Suggested order:** Application/file logs first (unblocks file-mode for others), then Security, Database, HTTP, Browser file-only; Browser CDP last.
