# Spec: Security and Audit Logs Integration

**Adapter id:** `security`  
**Status:** Not implemented  
**Full design:** [docs/integrations/security-audit-logs.md](../docs/integrations/security-audit-logs.md)

## Goal

Optionally attach security/audit event summary (Windows Security log, app audit file) with explicit opt-in and redaction.

## Config

- `saropaLogCapture.integrations.adapters` includes `security`
- `saropaLogCapture.integrations.security.*`: windowsSecurityLog (default false), auditLogPath, redactSecurityEvents (default true), includeSummaryInHeader, includeInBugReport (default false)

## Implementation

- **Provider:** `onSessionEnd` only. If windowsSecurityLog, query Security channel (same as Windows events); redact; write sidecar. If auditLogPath, read/tail and write sidecar. Meta: summary only (e.g. "3 logon events"); no raw events in meta. First-time enable: show info message about sensitivity.
- **Viewer:** "Security / audit" with warning and "Open file"; do not inline event list.
- **Performance:** Run at end; redaction in memory. Do not fail on access denied.
- **Status bar:** "Security" when contributed; only if user explicitly enabled.

## UX

- No spinner. Clear warning in UI. Never include raw security events in bug report by default.
