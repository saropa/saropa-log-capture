# Integration Spec — Deferred Items

Carried forward from archived integration specs (009, 010, 011, 013) during
plans/ cleanup 2026-09-03. Original specs in `plans/history/2026.06/`.

## Application File Logs (009)

- Optional JSONL unified stream (see complete-debug plan Phase 4)

## HTTP Network (010)

- Auto-detect HAR from browser DevTools export (`harPath` setting never built)
- Request/response body preview (with size cap and redaction)
- Latency histogram in Performance panel
- Group requests by endpoint pattern

## Database Query Logs (011)

- Multi-database support (separate logs per DB instance)
- Query plan / EXPLAIN display for selected queries
- Slow query highlighting with configurable duration threshold
- Aggregated stats (query count, total duration per session)

## Security Audit Logs (013)

- Linux audit log support (`auditd` / `journalctl`)
- macOS Unified Log security events
- Event correlation with application log lines by timestamp
- Configurable redaction patterns (beyond built-in defaults)
