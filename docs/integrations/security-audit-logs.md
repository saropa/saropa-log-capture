# Integration: Security and Audit Logs

## Problem and Goal

Some failures are security-related: **authentication** changes, **permission** denials, or **audit** events (who did what, when). Correlating debug output with **security and audit logs** (e.g. Windows Security log, application audit logs, or auth provider logs) helps answer "was there a login failure just before this error?" or "did permissions change?" This integration optionally attaches **time-bounded security/audit event summaries** to the session—with strong **privacy and consent**—so that security-relevant context is available for incident or support analysis without exposing raw audit data by default.

**Goal:** Optionally and **with explicit user opt-in**, attach a **summary** of security/audit events for the session time range: (1) **Windows Security log** (logon, logoff, failure, policy) — only when user enables and understands implications; (2) **Application audit file** — user-configured path to an audit log (e.g. app-generated); (3) **No cloud auth by default** — do not connect to Azure AD, Okta, etc. in v1; only local or file-based. Display: short summary in header or sidecar (e.g. "3 logon events, 1 failure"); full details only in sidecar with clear labeling and optional redaction.

---

## Data Sources

| Source | Content | How to get it |
|--------|---------|---------------|
| **Windows Security log** | Event IDs 4624/4625 (logon/failure), 4634 (logoff), etc. | Same as Windows Event Log integration; channel "Security"; requires elevation or audit policy; **opt-in only** |
| **App audit log** | Custom format (JSON lines or text) | User-configured path; extension tails or reads at session end; same pattern as application-file-logs |
| **Linux audit** | audit.log, journalctl (auth) | When extension runs in WSL/SSH; `journalctl -b -u systemd-logind` or audit logs; **opt-in** |
| **Cloud / IdP** | Sign-in logs (Azure AD, Okta) | API with token; **out of scope for v1** (privacy and token scope) |

**Recommended v1:** (1) **Windows Security log:** Reuse Windows Event Log integration with a separate setting `includeSecurity: true` (already in that doc); document that this may require admin or audit rights. (2) **Application audit file:** New setting `saropaLogCapture.security.auditLogPath`; tail or read at session end; write to sidecar with clear filename (e.g. `basename.audit.log`). (3) **No automatic cloud:** Do not call Azure AD or other IdPs; user can manually attach exported audit file if desired.

---

## Integration Approach

### 1. When to collect

- **Session end (or on demand):** When user has **explicitly** enabled security/audit capture:
  - **Windows Security:** Query "Security" channel for session time range (same as Windows Event Log); filter by event IDs (e.g. 4624, 4625, 4634, 4647). Write to sidecar `basename.security-events.json` or `.txt` with **redaction** option (e.g. strip user names or replace with "USER").
  - **App audit file:** Tail or read `auditLogPath` during session; at end write to `basename.audit.log`. Do not parse; treat as opaque text (or optional JSON lines for summary count).
- **Session start:** Do not query security logs at start (no need). Optionally record in header: "Security/audit capture: enabled" (so it’s clear in the log that audit was attached).

### 2. Where to store and display

- **Sidecar only (no header summary by default):** Write `basename.security-events.json` (Windows) and/or `basename.audit.log` (app). **Do not** put security event details in the main header (could leak into copies). Optional: one line in header: `Security events: see basename.security-events.json (opt-in)` only when user enabled and events were captured.
- **Viewer:** When sidecar exists, show "Security / audit" tab or section with **warning** that content may be sensitive; "Open file" button. No inline display of raw events in viewer by default (user opens file explicitly).
- **Bug report:** **Do not** include security/audit content in bug report by default. Option `includeSecurityInBugReport: false` (hardcoded or setting); if ever true, only summary counts (e.g. "3 logon events") and no user identifiers.

### 3. Privacy and consent

- **Settings:** All under `saropaLogCapture.security.*` with **defaults that are off**. Require user to set `enabled: true` and optionally `includeSecurityLog: true` (Windows). Show a **one-time info message** when first enabled: "Security log capture may contain sensitive data. Only enable in trusted workspaces. Data is stored in session folder."
- **Redaction:** Setting `redactSecurityEvents: true` (default): replace user names, IPs (optional), and other identifiers in stored sidecar with placeholders. Document what is redacted.
- **Retention:** Same as log retention; user controls reports/ folder. Document that security sidecars should be treated as sensitive.

---

## User Experience

### Settings (under `saropaLogCapture.security.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Master switch for any security/audit capture |
| `windowsSecurityLog` | boolean | `false` | Include Windows Security channel (requires opt-in and possibly elevation) |
| `auditLogPath` | string | `""` | Path to application audit log file (tail/read at session end) |
| `redactSecurityEvents` | boolean | `true` | Redact user names and optional IPs in stored events |
| `includeSummaryInHeader` | boolean | `false` | Add one line "Security events: N; see ..." in header (no details) |
| `includeInBugReport` | boolean | `false` | Never include raw events; if true in future, only counts |

### Commands

- **"Saropa Log Capture: Attach security/audit events to this session"** — On demand: run Windows Security query and/or read audit log; write sidecars. Show confirmation.
- **"Saropa Log Capture: Open security events for this session"** — Open sidecar file in editor (with reminder that content is sensitive).

### UI

- **Viewer:** When sidecar exists, show "Security / audit" with "Open file" and short warning. No inline event list by default.
- **First-time enable:** Info message: "You enabled security log capture. Data may be sensitive. Store only in trusted locations."

---

## Implementation Outline

### Components

1. **Windows Security**
   - Reuse Windows Event Log provider; when `security.windowsSecurityLog` and `security.enabled`, add "Security" to the logs list for the existing query. Apply **redaction** to message and any user/id fields before writing to sidecar. Event IDs to include: configurable (default 4624, 4625, 4634, 4647). Write to `basename.security-events.json` with array of `{ time, id, level, messageRedacted }`.

2. **App audit file**
   - Same as application-file-logs: resolve `auditLogPath`; at session end read or tail content; write to `basename.audit.log`. No parsing; optional line count in summary. Label file clearly so user knows it’s audit.

3. **Session end hook**
   - If security.enabled, run Windows Security query (if windowsSecurityLog) and audit file read (if auditLogPath set). Redact; write sidecars. Do not block session end on failure (e.g. access denied to Security log).

4. **Viewer**
   - When `basename.security-events.json` or `basename.audit.log` exists, add "Security / audit" section with warning and "Open file." Do not send event content to webview; only "file exists" and path for Open.

5. **Documentation**
   - Doc: "Security log capture is off by default. Enabling may require admin rights on Windows. Stored files may contain sensitive data; restrict access to reports/ and do not commit to version control."

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.security.*`; all off by default.
- **Redaction:** Document which fields are redacted (e.g. TargetUserName, IpAddress → "REDACTED").

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| Sensitive data leakage | No header details; redaction; not in bug report; warning in UI |
| Access denied (Security log) | Graceful skip; log to Output Channel; do not fail session |
| Compliance | Document that user is responsible for handling audit data per policy |
| Cloud / IdP | Not in v1; no tokens or API calls for sign-in logs |

**Alternatives:**

- **No Windows Security:** Only app audit file; avoid elevation and platform-specific code.
- **Summary only:** Store only event counts and timestamps (no messages); even lower risk.

---

## References

- Windows Security log: [Event IDs](https://docs.microsoft.com/en-us/windows/security/threat-protection/auditing/audit-logon-events)
- Existing: windows-event-log.md (query, sidecar, levels), application-file-logs (tail, path).
