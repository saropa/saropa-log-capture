# Integration: Database Query Logs

## Problem and Goal

Many applications log **request IDs**, **transaction IDs**, or **query identifiers** in their debug output while the same identifiers appear in **database query logs** (slow query logs, general logs, or APM tools). When debugging a failure, correlating a log line like "Request abc123 failed" with the exact SQL that ran (and its duration, plan, or errors) is invaluable. Today that correlation is manual: open DB logs, search by ID or time. This integration allows **linking debug log lines to database query log entries** (or to a local query log file / exporter) so that "what the app said" and "what the DB did" are visible together.

**Goal:** Enable correlation between Saropa-captured debug output and database activity by (1) **ingesting or tailing** a database query log (file or stream), and (2) **aligning** log lines with queries via shared identifiers (request ID, correlation ID, timestamp) or by time windows, so that the viewer or export can show "related queries" for a selected line or time range.

---

## Data Sources

| Source | Format | How to get it |
|--------|--------|----------------|
| **App-generated query log file** | Project writes SQL + request ID to a file (e.g. `logs/sql.log`) | User configures path; extension tails or reads on demand |
| **Database server log** | MySQL general/slow log, PostgreSQL log, SQL Server trace | Often requires DB access or export; user exports to file or uses agent |
| **APM / observability** | Datadog, New Relic, Application Insights SQL events | API or export; match by request ID / trace ID from app logs |
| **ORM / framework logs** | TypeORM, Sequelize, Entity Framework logging to console | Already in Debug Console; can be **parsed** and indexed as "queries" within the same log |
| **Custom correlation** | App logs `[requestId=xyz] SELECT ...` in stdout | Parser extracts requestId + query; store in sidecar index for lookup |

The most portable and low-friction approach is **file-based**: the app (or a middleware) writes a dedicated query log file with request/correlation IDs and optionally timestamps; the extension tails or indexes it and correlates by ID or time with the main debug log.

---

## Integration Approach

### 1. Modes of operation

- **Mode A — Tail query log file:** User sets `saropaLogCapture.database.queryLogPath` (e.g. `logs/sql.log`). During a debug session, the extension tails this file (or reads it at session end). Lines are parsed (e.g. JSON: `{ requestId, query, duration, time }` or regex). Build an in-memory index: requestId → [queries]. When the user selects a log line in the viewer, if the line contains a request ID (from a configurable regex), look up queries and show them in a "Related queries" panel or hover.
- **Mode B — Parse from same log:** The debug console already contains SQL (e.g. from ORM). A **parser** (regex or structured) identifies "query blocks" in the captured log (e.g. "Executing (default): SELECT ..."). Store line ranges or snippets in a sidecar index. Viewer can "Highlight query blocks" or "Show query at this line" (expand/collapse). No separate file needed.
- **Mode C — External API:** User configures an API endpoint (e.g. Application Insights query) that accepts request ID or time range and returns query list. Extension calls it when user clicks "Related queries" (with consent and token). More setup; document as advanced.

**Recommended first step:** Mode B (parse from same log) for zero config; then Mode A (query log file) for teams that already write a SQL log file.

### 2. Correlation keys

- **Request ID / correlation ID:** App logs `[req=abc-123] Error ...`; query log has `requestId: "abc-123"`. Match by exact string. Config: `saropaLogCapture.database.requestIdPattern` (regex to extract from log line).
- **Timestamp:** No ID; correlate by time window (e.g. "queries in the 5 seconds before this line"). Less precise but works when no ID is logged.
- **Line proximity:** For Mode B, "query block" is defined as a contiguous range of lines; "related" = the query block containing this line or the previous block.

### 3. Where to show correlated data

- **Viewer panel:** "Related queries" section: when the user selects a line (or right-clicks "Show related queries"), show a list of queries (text, duration, time) in a panel below or beside the log. Click to copy or open in a scratch SQL file.
- **Header / sidecar:** Optional: at session end, write a `*.queries.json` sidecar with all parsed queries and their line numbers or request IDs, for export or external tools.
- **Bug report:** Option to include "Related queries (last N)" in the bug report when the selected line has associated queries.

---

## User Experience

### Settings (under `saropaLogCapture.database.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable database query correlation |
| `mode` | `"parse"` \| `"file"` \| `"api"` | `"parse"` | Parse from log, tail file, or call API |
| `queryLogPath` | string | `""` | Relative to workspace: path to query log file (Mode A) |
| `queryLogFormat` | `"json"` \| `"text"` | `"json"` | Each line is JSON or plain text (regex extraction) |
| `requestIdPattern` | string | `""` | Regex to extract request/correlation ID from log line (one capture group) |
| `queryBlockPattern` | string | `""` | Regex to detect start of a query block in log (Mode B); optional |
| `timeWindowSeconds` | number | `5` | For time-based correlation: window before selected line |
| `maxQueriesPerLookup` | number | `20` | Cap queries shown per "Related queries" request |
| `includeInBugReport` | boolean | `false` | Include related queries in bug report when available |

### Commands

- **"Saropa Log Capture: Show related queries"** — From viewer with selected line (or current line), show "Related queries" panel with queries correlated by request ID or time.
- **"Saropa Log Capture: Copy query"** — Copy the selected query text to clipboard.

### UI

- **Viewer:** Context menu on a line: "Show related queries." Panel shows query text, duration, timestamp; optional "Copy all."
- **Indicator:** When a line has correlated queries, show a small icon or badge (e.g. DB icon) next to the line number.

---

## Implementation Outline

### Components

1. **Query log parser (Mode B)**
   - **Log line analyzer:** In `line-analyzer` or a new `query-parser.ts`, scan captured lines for known patterns (e.g. "Executing (default):", "query:", "SQL:") and extract query text (multiline). Store in a structure: `{ lineStart, lineEnd, requestId?, queryText, duration? }`. Index by line number and optionally by requestId.
   - **Configurable patterns:** Use `queryBlockPattern` and a second regex for request ID extraction from surrounding lines. Default patterns for common ORMs (TypeORM, Sequelize) can be shipped; user can override.

2. **Query log file tailer (Mode A)**
   - When session starts and `mode === "file"` and `queryLogPath` is set, start **tailing** the file (using `fs.watch` + read new content, or read full file at session end). Parse each line as JSON or text. Build map: requestId → queries (or time → queries). Store in memory and optionally in sidecar `*.queries.json` at session end.
   - **Path:** Resolve `queryLogPath` relative to workspace root; support single file only for v1.

3. **Correlation engine**
   - Given (log line index, line text), extract request ID with `requestIdPattern` or use line timestamp. Look up in query index. Return list of queries (and optionally highlight in viewer the lines that "contain" those queries in Mode B).
   - **Viewer message:** New message type from extension to webview: `relatedQueries: { queries: Array<{ text, duration?, time? }> }`. Webview shows panel.

4. **Sidecar and bug report**
   - At session end (Mode A or B), optionally write `basename.queries.json`: `{ requestIds: { [id]: queries }, byLine: { [line]: queries } }` for offline use. Bug report section "Related queries" reads from current selection’s correlation result.

### Performance and safety

- **Tail only when session active:** Do not tail when capture is off; avoid reading huge files—cap at last N lines or size.
- **Parsing:** Avoid blocking main thread; parse in chunks or on session end. For Mode B, parsing can be incremental as lines arrive (single pass).
- **No DB connection:** Extension never connects to a database; it only reads files or calls an optional HTTP API with user-configured token.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.database.*` as above.
- **Security:** If API mode is used, store token in secret storage; document that query log files may contain sensitive SQL (redact in bug report option?).

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| Query log file huge or binary | Tail only; read last 500 KB or 5000 lines; support rotation (new file per run) |
| Request ID not in log | Fall back to time-window correlation; document pattern requirements |
| Sensitive SQL in bug report | Option to redact (e.g. replace literals with ?) or exclude from bug report |
| Multiple query log formats | Start with JSON lines; add "text" with regex for common formats |

**Alternatives:**

- **Direct DB connection:** Extension connects to DB and runs "SHOW FULL PROCESSLIST" or reads from information_schema. Adds dependency and security concerns; not recommended for v1.
- **Trace ID from OpenTelemetry:** If app uses OTel and exports trace IDs in logs, correlate with trace backend (Jaeger, etc.) for full trace view; can be a separate integration.

---

## References

- Existing: `line-analyzer.ts`, stack trace parsing; bug report sections. No existing DB code in extension.
