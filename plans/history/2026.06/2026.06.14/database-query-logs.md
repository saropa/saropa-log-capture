# Database Query Logs — Deferred Work (COMPLETE)

All deferred items below have shipped. Authoritative spec:
[011_integration-spec-database-query-logs.md](011_integration-spec-database-query-logs.md).
Implementation: [database-query-logs.ts](../src/modules/integrations/providers/database-query-logs.ts)
and sibling modules.

The `database` integration (gated by `saropaLogCapture.integrations.adapters`
containing `"database"`) runs at **session end** in `parse`, `file`, or `api`
mode, can **live-tail** the query log during a session, optionally **redacts**
SQL literals, and surfaces correlated queries via a popover, a **per-line
badge**, and the `.queries.json` sidecar. A separate `otel` adapter detects
OpenTelemetry trace IDs and deep-links them to a trace backend.

This file tracked items the original design raised that were not in spec 011's
own "Deferred" list (multi-database support, EXPLAIN/plan display, slow-query
highlighting, aggregated stats — those remain in spec 011 and are NOT covered
here).

---

## Completed items

1. **External API mode** — `mode: api` POSTs the session time range to a
   configured `integrations.database.apiUrl` and writes the returned queries;
   bearer token in Secret Storage via the Set/Clear Database API Token commands.
   See [database-api.ts](../src/modules/integrations/providers/database-api.ts).
2. **Live tailing during the session** — `integrations.database.liveTail` tails
   the file (fs.watch, in-session appends only) and streams formatted query
   lines into the viewer. See
   [database-query-tailer.ts](../src/modules/integrations/database-query-tailer.ts)
   and [database-query-format.ts](../src/modules/integrations/providers/database-query-format.ts).
3. **Per-line DB badge** — request-ID-correlated lines show a clickable 🗃 badge
   opening the related-queries popover. See
   [database-line-correlation.ts](../src/modules/integrations/providers/database-line-correlation.ts)
   and [database-line-badges.ts](../src/ui/provider/database-line-badges.ts).
4. **Sensitive-SQL redaction** — `integrations.database.redactLiterals` replaces
   string/numeric literals with `?` before the sidecar is written (`redactSqlLiterals`).
5. **OpenTelemetry trace correlation** — new `otel` adapter; detects trace IDs
   and writes a `.traces.json` sidecar with backend deep links. See
   [otel-trace-parse.ts](../src/modules/integrations/providers/otel-trace-parse.ts)
   and [otel-traces.ts](../src/modules/integrations/providers/otel-traces.ts).

Also previously completed (folded in): plain-text file formats (PostgreSQL /
MySQL slow logs) and the 512 KB tail read for large/rotated logs.

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
VS Code extension (TypeScript). New settings, one new command pair, one new
integration adapter, and viewer additions. No Flutter/Dart code.

### What shipped
The five remaining deferred items of the Database Query Logs integration were
all implemented, plus a new OpenTelemetry adapter. Each shipped as its own
commit with targeted tests.

- **API mode** (`database-api.ts`): `fetchSessionQueries` POSTs
  `{startTime,endTime}` to `integrations.database.apiUrl` with an optional
  Bearer token and writes the returned queries as the sidecar;
  `queriesFromResponseBody` accepts `{queries:[...]}` or a bare array. The token
  is read in `onSessionStartAsync` (extensionContext is only wired into the
  start context) into a per-session promise awaited at end. Failures log and
  return `[]`. Set/Clear Database API Token commands store it in Secret Storage.
- **Live tail** (`database-query-tailer.ts`, `database-query-format.ts`):
  `integrations.database.liveTail` watches the file from its current end and
  streams `SQL: [req] … (Nms)` lines via the streaming-writer pattern;
  `onSessionStartStreaming` starts it, `onSessionEnd` + finalize stop it.
- **Per-line badge** (`database-line-correlation.ts`, `database-line-badges.ts`):
  request-ID matches are computed at load and pushed via `setDatabaseQueryLines`;
  `renderItem` draws a clickable `.db-query-badge` whose click reuses the
  existing `showRelatedQueries` handler. Timestamp-only correlation stays with
  the popover (no whole-window badging).
- **Redaction** (`redactSqlLiterals` / `redactQueryRecord`):
  `integrations.database.redactLiterals` replaces single-quoted strings and
  numeric literals with `?` before the sidecar is written; double-quoted
  identifiers are preserved.
- **OpenTelemetry** (`otel-trace-parse.ts`, `otel-traces.ts`): new `otel`
  adapter detects W3C `traceparent` and `trace_id` forms, writing a
  `.traces.json` sidecar of `{traceId,url,lineCount,lines}` with backend deep
  links from `integrations.otel.traceUrlTemplate`. Surfaces and links traces;
  does not embed a trace-timeline view (deferred).

### Verification
- `npm run compile` — clean (check-types, lint, verify-nls, nls-coverage,
  webview + host-outbound + list-commands catalogs, l10n-keys, esbuild,
  dist-size all pass).
- Targeted tests, all passing: `database-query-logs` (24), `database-line-correlation`
  (4), `database-query-format` (8), `database-api` (3), `otel-trace-parse` (9).

### Notes
- New `.title` keys were synced across all `package.nls.*` locales; the two new
  token commands use inline titles, matching the Build/CI token-command
  convention (the title-sync script only covers `config.*` keys).
- The two viewer files the badge touches (`viewer-data-helpers-render.ts`,
  `viewer-script-messages.ts`) were already over the line cap before these
  edits; additions there are minimal and essential. New badge code lives in its
  own modules to avoid creating new cap violations.

### Plan status
COMPLETE — all five deferred items shipped. This plan is archived to history.
