# DB_17 Cumulative SQL Query History Across Sidebar Logs

## Goal
Make the SQL Query History panel aggregate fingerprints across **all logs in the sidebar**, not just the currently displayed one. Today the panel resets to empty whenever the active log lacks Drift output, even though the workspace as a whole has captured many SQL fingerprints. Builds on `DB_11` (per-log live rollup) and `DB_10` (per-session persisted summary).

## Scope
- In scope:
  - Two-step rollout (Step 1 ships first, Step 2 depends on it).
  - Read-only aggregation across persisted `driftSqlFingerprintSummary` entries on every sidebar log.
  - New webview message `setCumulativeSqlFingerprintSummary` (host → webview).
  - Panel UI: `Cumulative across logs` toggle (default off so per-log behavior is unchanged).
  - Cross-log jump: clicking a row whose `firstIdx` belongs to an inactive log opens that log first, then scrolls.
  - Schema v2 (Step 2) — also persist a sample SQL preview per fingerprint so cumulative rows are readable.
- Out of scope:
  - Re-scanning logs that have **no persisted summary** yet (those still need a finalize pass via existing `scanAndPersistDriftSqlFingerprintSummary`).
  - Cross-workspace aggregation — only the active workspace's sidebar logs are aggregated.
  - Sorting/filtering changes beyond what the existing panel already supports.
  - Collapsing the per-log live view; cumulative is a layered toggle, not a replacement.

## Integration with existing rollups
- **Live data (active log)** continues to flow through `recordSqlQueryHistoryForAppendedItem` into `sqlQueryHistoryByFp` exactly as today.
- **Persisted data (other logs)** is read host-side from `SessionMeta.driftSqlFingerprintSummary` (the v1 shape from `drift-sql-fingerprint-summary-persist.ts`) and posted to the webview as a separate map, e.g. `cumulativeSqlFingerprintMap`.
- Active log's own persisted entry is **excluded from the cumulative baseline** — otherwise its rows double-count once `sqlQueryHistoryByFp` covers them live.
- Render layer merges the two maps when the toggle is on; per-log rendering stays unchanged when the toggle is off.

## Step 1 — Toggle + fingerprint-only cumulative view
1. Host: when the log group changes, scan every sidebar `SessionMeta.driftSqlFingerprintSummary` (skip the active one), aggregate by fingerprint (sum `count`, max `maxDurationMs`, sum `slowQueryCount`, keep first `{logId, firstLine}` for jumps).
2. Host: post `setCumulativeSqlFingerprintSummary` payload to the webview after each log-group change and after any session finalize.
3. Webview: store in `cumulativeSqlFingerprintMap`; merge with `sqlQueryHistoryByFp` inside `getSqlQueryHistoryRowsForRender()` when toggle is on. Active log entries always win on `preview` / `sampleSql`.
4. Panel UI: add toggle next to the search input. Default off. Persist user's choice the same way other panel prefs are persisted.
5. Jump button: if the row's source log is the active one → existing scroll path. Otherwise → post `openLogFromGroup` (existing message) with `{ logId, scrollToLine }` and let the log-loader take it from there.
6. **Empty-state copy** updates: distinguish "no SQL in any log" from "no SQL in this log; toggle Cumulative to see the rest".

## Step 2 — Schema v2: sample SQL preview
1. Bump `DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION` to 2; add optional `samplePreview` (≤120 chars) per fingerprint in `PersistedDriftSqlFingerprintEntryV2`.
2. `summaryMapToPersistedV1` becomes `summaryMapToPersistedV2`; back-compat reader accepts v1 (no preview) and v2 alike.
3. `scanSaropaLogDatabaseFingerprints` captures the first matching SQL text per fingerprint alongside `firstLineByFingerprint` and persists it.
4. Cumulative view uses `samplePreview` when present, falls back to fingerprint string for v1 entries.

## UX Rules
- Toggle off (default) → panel matches today's per-log behavior exactly. No regression risk for existing users.
- Toggle on → header shows e.g. `Cumulative across 7 logs (current excluded)`; row count badge in the icon bar reflects the merged total.
- Cross-log row click shows a one-line transient hint `Opening Contacts_20260513_193957.log…` while the load is in flight.
- Sort headers stay; sort is applied AFTER merge.

## Test Plan
- Unit: aggregation merges two persisted summaries with overlapping fingerprints — counts add, `maxDurationMs` takes the max, first-line jump record points at the earliest log/line pair.
- Unit: active log is excluded from the cumulative baseline (no double counting).
- Unit: v1 and v2 persisted entries can co-exist in the same aggregate; preview falls back gracefully.
- Webview VM: with toggle off, render output matches DB_11 baseline tests exactly.
- Webview VM: with toggle on, rows from inactive logs render with `r.crossLog === true` and disable the live jump path.
- Integration: switching active log re-posts cumulative payload (active log changes, exclusion set changes).
- Regression: empty workspace + no persisted summaries → toggle is hidden, panel shows existing empty-state copy.

## Risks
- **Stale persisted summaries:** logs captured before `scanAndPersistDriftSqlFingerprintSummary` ran have no summary on disk — they silently contribute zero. Mitigation: surface a one-line hint when at least one sidebar log lacks a summary, with a `Re-scan now` action.
- **Memory:** capped per `SQL_QUERY_HISTORY_MAX_FP` after merge. Eviction stays LRU by `lastSeen`; Step 1 falls back to count when `lastSeen` is unknown for cumulative-only rows.
- **Schema migration (Step 2):** v1 readers must not crash on v2 payloads; cover with explicit version-check tests.

## Done Criteria
- Step 1: toggling Cumulative on with multiple sidebar logs shows merged fingerprint counts; toggle off restores per-log view; cross-log jump opens the source log and scrolls.
- Step 2: cumulative-only rows show readable SQL text (not bare fingerprints) for any log captured after the v2 migration; v1 entries still render (fingerprint fallback) without errors.
- All existing `DB_11` tests still pass unchanged; new tests above pass.
- `npm run check-types`, `npm run lint`, `npm run compile`, full test suite green.

## Related Plans
- `DB_10` session comparison + persisted summary (data source).
- `DB_11` per-session SQL query history panel (live data + UI baseline).
- `DB_15` ingest/trim lifecycle (panel must stay consistent under trim — unchanged here, just verify).
