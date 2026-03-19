# Empty or missing log files since v3.1.3 (resolved)

**Summary:** Log files were sometimes empty or content was missing after v3.1.3. Cause: refactor changed execution order so DAP output often arrived before a log session existed or under a different session id; we only replayed the "just started" session's buffer and dropped the rest. Fixed by (1) replaying **all** early buffered output into the first log session created, and (2) single-session fallback (route output for unknown session id to the one active session). Optional `diagnosticCapture` setting logs pipeline events to the output channel for debugging.

- **Runbook:** `bugs/010_runbook-missing-or-empty-logs.md`
- **Investigation:** `bugs/history/20260313_empty-logs-investigation.md`
