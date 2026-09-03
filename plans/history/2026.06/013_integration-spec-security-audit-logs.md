# Spec: Security and Audit Logs Integration

**Adapter id:** `security`
**Status:** Shipped (provider, config, package.json settings, redaction, event summary, header contribution)
**Full design:** Implemented in `src/modules/integrations/providers/security-audit.ts`

## Goal

Optionally attach security/audit event summary (Windows Security log, app audit file) with explicit opt-in and redaction.

## Config

- `saropaLogCapture.integrations.adapters` includes `security`
- `saropaLogCapture.integrations.security.windowsSecurityLog`: read Windows Security event log (default: false)
- `saropaLogCapture.integrations.security.auditLogPath`: path to application audit log file
- `saropaLogCapture.integrations.security.redactSecurityEvents`: redact sensitive fields before writing sidecar (default: true)
- `saropaLogCapture.integrations.security.includeSummaryInHeader`: add event summary to session header (default: false)
- `saropaLogCapture.integrations.security.includeInBugReport`: include security sidecar in bug reports (default: false)

## Implementation

- **Provider:** `onSessionEnd` only. If windowsSecurityLog, query Security channel (same as Windows events); redact; write sidecar. If auditLogPath, read/tail and write sidecar. Meta: summary only (e.g. "3 logon events"); no raw events in meta. First-time enable: show info message about sensitivity.
- **Viewer:** "Security / audit" with warning and "Open file"; do not inline event list.
- **Performance:** Run at end; redaction in memory. Do not fail on access denied.
- **Status bar:** "Security" when contributed; only if user explicitly enabled.

## UX

- No spinner. Clear warning in UI. Never include raw security events in bug report by default.

## Deferred

- Linux audit log support (`auditd` / `journalctl`)
- macOS Unified Log security events
- Event correlation with application log lines by timestamp
- Configurable redaction patterns (beyond built-in defaults)
