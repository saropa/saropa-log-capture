# Spec: Database Query Logs Integration

**Adapter id:** `database`
**Status:** Shipped (file mode + parse mode; context popover; related queries popover + command)
**Full design:** Implemented in `src/modules/integrations/providers/database-query-logs.ts`

## Goal

Correlate debug log lines with database query log entries by request ID or time so "related queries" appear for a selected line.

## Config

- `saropaLogCapture.integrations.adapters` includes `database`
- `saropaLogCapture.integrations.database.mode`: `"parse"` | `"file"`
- `saropaLogCapture.integrations.database.queryLogPath`: path to external query log (file mode only)
- `saropaLogCapture.integrations.database.requestIdPattern`: regex to extract request ID from a log line
- `saropaLogCapture.integrations.database.queryBlockPattern`: regex to extract query blocks from captured output (parse mode only)
- `saropaLogCapture.integrations.database.timeWindowSeconds`: correlation time window when no request ID matches (default: 5)
- `saropaLogCapture.integrations.database.maxQueriesPerLookup`: cap results per lookup (default: 50)

## Modes

### File mode

Read an external query log file (e.g. MySQL slow query log, PostgreSQL `log_min_duration_statement` output, or application-emitted JSON lines). Each entry must include at least a timestamp; request ID is optional. At session end the provider reads/tails `queryLogPath`, parses entries, and builds the request-ID-to-queries map.

**Expected formats:** JSON lines (`{"ts": ..., "query": ..., "requestId": ...}`) or plain SQL log with timestamp prefix. Format auto-detected by first non-empty line.

### Parse mode

Scan the captured debug output (the session's own log) for inline query blocks — e.g. ORM query logging, `SELECT ...` blocks emitted by the application. The provider uses `queryBlockPattern` to locate blocks and indexes them by line number and, when present, request ID.

**When to use which:** Use file mode when the database or proxy writes a separate log. Use parse mode when the application prints queries inline in its stdout/stderr.

## Implementation

- **Provider:** `onSessionEnd`: in file mode, tail or read `queryLogPath`; parse entries; build requestId → queries map; write sidecar (`basename.database.log`) and meta. In parse mode, scan captured log body for query blocks matching `queryBlockPattern`; index by line number and requestId.
- **Viewer:** On "Show related queries" (context menu or command), extract requestId from selected line; look up in meta/sidecar; send results to webview. Show "Related queries" panel with query list. If no requestId, fall back to time-window correlation. If neither matches, show "No related queries."
- **Performance:** File mode: read at session end with size cap. Parse mode: scan in chunks; no huge in-memory index. No work at session start.
- **Status bar:** "DB" when adapter contributed at end.

## UX

- No spinner at session start (all work at end). Viewer: "Related queries" empty until selection, then list or "No related queries."

## Deferred

- Multi-database support (separate logs per DB instance)
- Query plan / EXPLAIN display for selected queries
- Slow query highlighting with configurable duration threshold
- Aggregated stats (query count, total duration per session)
