# Integration: Windows Event Log

## Problem and Goal

When a debug session fails, crashes, or behaves oddly, the cause is often outside the debuggee itself: a driver update, an antivirus action, a service crash, or a system-wide error. **Windows Event Log** (Application, System, Security, and custom channels) holds that context, but developers rarely open Event Viewer and correlate by time. This integration brings **time-bounded Windows events** into the log capture workflow so that every session can optionally include a summary of relevant system and application events, making it easier to see "what else happened" during the run.

**Goal:** Optionally attach a snapshot of Windows Event Log entries (Application, System, and optionally Security) for the session’s time range (and a short lead/lag) to the session context—either in the log header, a sidecar file, or a dedicated panel—so that debugging and post-mortem analysis can consider system-level events without leaving the editor.

---

## Data Sources

| Source | Log / Channel | Content | Typical use |
|--------|----------------||----------|
| **Application** | `Application` | App crashes, .NET runtime, app errors | Correlate with debuggee crashes |
| **System** | `System` | Kernel, drivers, service start/stop, BSOD precursors | Hardware/driver/service issues |
| **Security** | `Security` | Logon, audit, policy (sensitive) | Optional; off by default, user consent |
| **Setup** | `Setup` | Installer, Windows Update | Less common for debug correlation |
| **Custom** | App-specific channels | e.g. `Microsoft-Windows-PowerShell/Operational` | Configurable by channel name |

Relevant fields per event: **TimeCreated**, **Id**, **Level** (Critical/Error/Warning/Info), **Provider**, **Message**, **MachineName**. Optional: **UserId**, **ActivityId**, **RelatedActivityId** for correlation.

---

## Integration Approach

### 1. When to collect

- **Session start:** Record session start time (already available in `SessionContext.date`).
- **Session end (or on demand):** When the debug session ends (or when user runs "Attach Windows events to current session"), query Event Log for a configurable time range: e.g. from `sessionStart - leadMinutes` to `sessionEnd + lagMinutes` (or "now" if session still active).
- **Scope:** Only on Windows; no-op or clear message on macOS/Linux.

### 2. Where to store and display

- **Option A — Header block:** Append a compact "Windows Events (summary)" section to the context header (e.g. first N events, or only Error/Critical). Risk: header can become large; prefer summary + count.
- **Option B — Sidecar file:** Write `*.events.json` or `*.events.txt` next to the log file (same folder, same base name). Viewer can offer "Open Windows events" that loads this file or shows it in a separate webview/editor.
- **Option C — In-viewer panel:** In the log viewer sidebar, a collapsible "System events" section that shows the same data; can be populated on session end or when opening a saved session (from sidecar).
- **Recommended:** **Option B (sidecar)** for full data and optional **summary line in header** (e.g. "Windows events: 3 Errors, 12 Warnings in Application/System; see *.events.json"). Viewer gets "Open Windows events" when sidecar exists.

### 3. Data shape

- **Collected payload:** Array of events: `{ time, id, level, provider, message, log }` (and optionally machineName, userId if not redacted).
- **Formats:** JSON for programmatic use and filtering; optional plain-text export (e.g. one line per event) for paste into issues.
- **Deduplication:** Optional coalescing of identical messages in the same minute to avoid flooding (e.g. "Application Error, 54 occurrences").

---

## User Experience

### Settings (all under `saropaLogCapture.windowsEvents.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable Windows Event Log collection for sessions |
| `logs` | string[] | `["Application", "System"]` | Event log names to query |
| `levels` | string[] | `["Critical", "Error", "Warning"]` | Include only these levels (Info optional) |
| `leadMinutes` | number | `2` | Minutes before session start to include |
| `lagMinutes` | number | `5` | Minutes after session end to include |
| `maxEvents` | number | `200` | Cap total events per session (oldest dropped or sampled) |
| `includeSecurity` | boolean | `false` | Include Security log (sensitive; require explicit opt-in) |
| `output` | `"sidecar"` \| `"header"` \| `"both"` | `"sidecar"` | Where to write: sidecar file, header summary, or both |
| `headerSummaryOnly` | boolean | `true` | If output includes header: only summary line, not full list |

### Commands

- **"Saropa Log Capture: Attach Windows events to current session"** — For active session, query events for current time range and write sidecar (and optionally refresh header if session supports append).
- **"Saropa Log Capture: Open Windows events for this log"** — When focus is on a log file or viewer, open the corresponding `.events.json` or `.events.txt` if present.

### UI

- Status bar or viewer: small indicator when Windows events were attached (e.g. "3 errors in system events").
- Viewer: "System events" panel or tab when sidecar exists, with simple list (time, level, provider, message snippet); click to expand or open full sidecar file.

---

## Implementation Outline

### Components

1. **`windows-event-provider.ts`** (or `win-event-log.ts`)
   - Uses Node.js or VS Code API only where possible; on Windows, use **child_process** to run `powershell` (or a small helper) to query events:
     - PowerShell: `Get-WinEvent -FilterHashtable @{ LogName='Application','System'; Level=2,3,4; StartTime=$start; EndTime=$end } -MaxEvents N`
   - Alternatively: **node-native addon** or **ffi** to call `wevtapi.dll` (OpenLog, Query, Read) for better performance and no PowerShell dependency—acceptable as optional dependency.
   - Returns array of `{ time, id, level, provider, message, log }`.
   - Must not throw into extension host: wrap in try/catch, log to Output Channel, return empty array on failure.

2. **Session lifecycle hook**
   - On session end (or on explicit command), if `saropaLogCapture.windowsEvents.enabled` and OS is Windows:
     - Compute time range from session start and end (and lead/lag).
     - Call event provider, respect `maxEvents` and `levels`.
     - Write sidecar to same folder as log file, same base name, extension `.events.json` (or `.events.txt`).
     - If `output` includes `"header"`, append a summary line to a **continuation** or a separate "post-session" header block (current design may not support appending to header; then summary could be written as a single line at end of log file, or only in sidecar + viewer).

3. **Viewer and deep links**
   - When opening a log file, check for presence of `<basename>.events.json` (or from `.meta.json` if we store sidecar path there). Show "Open Windows events" in context menu or toolbar.
   - Optional: embed a simple list view in the webview from the sidecar content (parse JSON in extension, send to webview).

### Permissions and security

- Reading Application/System logs typically requires no admin rights. Security log often requires elevation or audit policy; document that and keep it opt-in.
- Do not log or store event message bodies that might contain sensitive data (e.g. user names in Security) without user awareness; consider truncating or redacting in header summary.
- Sidecar files live in the same user-controlled `reports/` (or configured) directory; same trust as log files.

### Performance

- Query only after session end (or on demand) to avoid blocking the session.
- Limit `maxEvents` and use time bounds so that PowerShell/wevtapi returns quickly.
- Run provider in a separate flow (e.g. `setImmediate` or small delay) so session close and file flush complete first.

---

## Configuration Summary

- **Extension settings:** All under `saropaLogCapture.windowsEvents.*` as above.
- **Workspace vs user:** Prefer user-level default `enabled: false`; workspace can override to `true` and set `logs`/`levels` for team conventions.

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| PowerShell slow or unavailable | Document; consider native wevtapi for performance |
| Huge event volume | Strict `maxEvents`, time bounds, and level filter |
| Privacy (Security log) | Off by default; explicit opt-in and short doc note |
| Non-Windows | Feature disabled; no sidecar; no header line |

**Alternatives:**

- **Event Viewer deep link:** Instead of copying events, write a link like `ms-get-started:eventviewer?start=...&end=...` if such a protocol exists; or document "Open Event Viewer and filter by time."
- **ETW instead of Event Log:** Use ETW for real-time subscription during session; more powerful but more complex; can be a separate integration (see Performance and Profiling).

---

## References

- Windows Event Log: [Querying with Get-WinEvent](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.diagnostics/get-winevent)
- Wevtapi: [Windows Event Log API](https://docs.microsoft.com/en-us/windows/win32/wes/windows-event-log-api)
