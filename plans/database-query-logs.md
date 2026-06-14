# Database Query Logs — Deferred Work

The core integration is **shipped**. Authoritative spec:
[011_integration-spec-database-query-logs.md](011_integration-spec-database-query-logs.md).
Implementation: [database-query-logs.ts](../src/modules/integrations/providers/database-query-logs.ts).

What ships today: a `database` integration provider (gated by
`saropaLogCapture.integrations.adapters` containing `"database"`) that runs at
**session end** in `parse` mode (scan captured output for SQL blocks) or `file`
mode (read an external query log), writes a `*.queries.json` sidecar, and
exposes a related-queries popover/command plus a status-bar "DB" indicator.
File mode auto-detects JSON-lines vs plain text and parses PostgreSQL
`log_min_duration_statement` and MySQL slow query logs, reading only the last
512 KB of large or rotated logs.

This file tracks only the items the original design raised that are **not built
and not already in spec 011's "Deferred" list** (which covers multi-database
support, EXPLAIN/plan display, slow-query highlighting, and aggregated stats —
do not duplicate those here).

> **Done (was items 1 and 4):** plain-text file formats and the read-size /
> rotation cap shipped together — file mode auto-detects JSON vs text, parses
> Postgres `log_min_duration_statement` and MySQL slow logs, and tail-reads the
> last 512 KB. See [database-query-parsing.ts](../src/modules/integrations/providers/database-query-parsing.ts)
> (`parseTextQueryLog`, `detectQueryLogFormat`) and the `readTailUtf8` cap in
> [database-query-logs.ts](../src/modules/integrations/providers/database-query-logs.ts).

---

## Deferred items

### 1. External API mode (Mode C)
Call an observability backend (Datadog, New Relic, Application Insights) with a
request/trace ID or time range and return the query list on demand. The `mode`
enum is `"parse" | "file"` today; this would add `"api"`. Requires a configured
endpoint + token in VS Code **secret storage** (never a plain setting), explicit
user consent before any network call, and clear documentation as an advanced
mode. Heaviest option by setup cost; lowest priority.

### 2. Live tailing during the session
Today all work happens at session end (deliberate — see spec 011 "Performance":
no work at session start). A live mode would tail the query log with `fs.watch`
and stream correlated queries into the viewer as the session runs. Cost: a
file-watch lifecycle tied to capture start/stop. Only pursue if users ask for
in-session correlation.

### 3. Per-line DB indicator in the viewer
A small DB badge/icon next to the line number when a line has correlated
queries, so users can see at a glance which lines have DB activity without
invoking the popover. Pure UX affordance over data the provider already
produces; gated on the indicator not adding per-row render cost (see the
viewer's `calcItemHeight` single-source-of-truth rule).

### 4. Sensitive-SQL redaction
The `*.queries.json` sidecar and any bug-report inclusion currently write **raw
SQL**, which can contain literal PII/secrets. Deferred: an opt-in redaction pass
that replaces string/number literals with `?` placeholders before the SQL
leaves the session (sidecar and bug report). This is a privacy decision, not
just a feature — worth resolving before query text is surfaced anywhere it can
be shared.

### 5. OpenTelemetry trace-ID correlation
If the app emits OTel trace IDs in its logs, correlate to a trace backend
(Jaeger, Tempo) for a full distributed-trace view rather than just local
queries. This is a **separate integration**, not an extension of this provider;
recorded here only so the idea isn't lost.

---

## Rejected (record the reason, do not build)

- **Direct database connection** (extension opens a DB connection, runs
  `SHOW FULL PROCESSLIST` / reads `information_schema`). Adds a driver
  dependency and a live-credential security surface to what is otherwise a
  read-files-only extension. The file/parse/API approaches all avoid a DB
  connection by design — keep it that way.

---

## Finish Report (2026-06-14)

### Scope
VS Code extension (TypeScript). No Flutter/Dart code, no webview message or
command-catalog changes, no new settings.

### What shipped
File mode of the Database Query Logs integration previously understood only
JSON-lines query logs; a real PostgreSQL or MySQL server log was silently
ignored, and the whole file was loaded into memory before slicing the last 2000
lines. File mode now auto-detects the format from the first non-empty line and
parses plain-text DB server logs in addition to JSON, while bounding memory by
reading only the tail of large or rotated logs.

- **Pure parsing extracted** to `database-query-parsing.ts` (no `vscode`/`fs`
  imports, unit-testable in isolation). It holds the existing `parseQueryBlocks`
  (parse mode) plus the new `parseTextQueryLog` and `detectQueryLogFormat`.
  `database-query-logs.ts` keeps only the I/O and the provider, and re-exports
  the parsing symbols so callers/tests have one entry point.
- **Plain-text formats:** PostgreSQL `log_min_duration_statement`
  (`duration: N ms … statement: <SQL>`) and MySQL slow query logs (a
  `# Query_time:` header in seconds is carried onto the statement that follows).
  Each entry captures the SQL text, duration (ms), and a leading ISO timestamp
  when present, matching the `QueryEntry` shape the related-queries popover
  already consumes.
- **Format auto-detection:** a first non-empty line opening with `{`/`[` is
  treated as JSON; otherwise text. No new `queryLogFormat` setting was added —
  detection is automatic, matching spec 011's intent.
- **Read-size cap:** `readTailUtf8` reads at most the last 512 KB via node `fs`
  (workspace.fs has no ranged read; same pattern as `package-lockfile.ts` /
  `external-log-tailer.ts`), dropping the partial first line on a tail read.
  This handles unbounded growth and per-run rotation by keeping the most recent
  entries. Result count is capped at `maxQueriesPerLookup * 10` for both
  formats.

### Verification
- `npm run check-types` — clean.
- `npx eslint` on the three changed files — clean.
- `npm run test:file -- out/test/modules/integrations/database-query-logs.test.js`
  — 19 passing (10 pre-existing `parseQueryBlocks`, 3 new `detectQueryLogFormat`,
  6 new `parseTextQueryLog` covering Postgres parsing, MySQL Query_time carry,
  the no-bleed guard, request-ID extraction, the cap, and the no-SQL case).

### Compatibility
The `.queries.json` sidecar shape (`{ queries: [...] }`) is unchanged. The
file-mode meta payload gained a `mode: 'file'` field (additive); the related-
queries popover reads the sidecar, not that field. Text-mode entries now carry
real timestamps, which improves time-window correlation that JSON mode depended
on.

### Plan status
Closes deferred items 1 (plain-text file formats) and 4 (read-size / rotation
caps). Five deferred items remain (API mode, live tailing, per-line DB
indicator, sensitive-SQL redaction, OpenTelemetry trace correlation), so this
plan stays active.
