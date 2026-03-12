# Spec: Database Query Logs Integration

**Adapter id:** `database`  
**Status:** Not implemented  
**Full design:** [docs/integrations/database-query-logs.md](../docs/integrations/database-query-logs.md)

## Goal

Correlate debug log lines with database query log entries by request ID or time so "related queries" appear for a selected line.

## Config

- `saropaLogCapture.integrations.adapters` includes `database`
- `saropaLogCapture.integrations.database.*`: mode (parse | file), queryLogPath, requestIdPattern, queryBlockPattern, timeWindowSeconds, maxQueriesPerLookup

## Implementation

- **Provider:** `onSessionEnd`: if mode file, tail or read queryLogPath; parse JSON lines; build requestId → queries map; write sidecar and meta. Mode parse: scan log body for query blocks; index by line/requestId.
- **Viewer:** On "Show related queries" (context menu or command), extract requestId from selected line; look up in meta/sidecar; send to webview. Panel "Related queries" with list.
- **Performance:** Tail only during session or read at end with size cap. Parsing in chunks; no huge in-memory index.
- **Status bar:** "Database" when adapter contributed at end.

## UX

- Shimmer/placeholder in viewer for "Related queries" until first lookup or "No related queries." No spinner on session start (work at end).
