# DB_18b Deferred: SQL History render virtualization + readable sample SQL

Active continuation of **DB_18** (archived at `plans/history/2026.06/2026.06.08/DB_18_always-on-sql-history-dashboard.md`). DB_18's core (always-on cumulative, persisted index, Drift Advisor + Saropa Lints dashboard) shipped 2026-06-08. These two items were deliberately held back.

## 1c — Virtualized / windowed panel render (deferred, low priority)
**Status:** deferred by design, NOT a known problem.

The panel table (`renderSqlQueryHistoryPanel`) builds the entire `<tbody>` innerHTML in one pass, unlike the main log view which virtualizes via `renderViewport`/`calcItemHeight`. DB_18's honest scale analysis concluded distinct fingerprints are bounded (≤500 persisted per log; merged realistically hundreds-to-low-thousands), and the dominant per-load cost — the O(N-log-files) metadata rescan — was already fixed by the persisted index (1b).

**Do this only if real-world fingerprint counts prove large** (e.g. a workspace surfaces multi-thousand-row panels with visible jank). Then: window the table render to visible rows, and add scale-gated host-side paging (`sqlHistoryRequestPage`/`sqlHistoryPage`) that engages past a threshold (~2000), keeping the simple full-payload path below it. Isolated change to the render layer; no data-model impact.

## 1d — Schema v2 readable sample SQL (needs explicit go/no-go)
**Status:** surfaced as a blast-radius decision; recommendation = SKIP.

Cross-log rows currently render the **normalized fingerprint**, which IS readable parameterized SQL (`SELECT * FROM contacts WHERE id = ?`) — not an opaque hash. 1d would show a *concrete* example (real values) instead, requiring:
- bump `DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION` 1 → 2 with a back-compat reader accepting both,
- add optional `samplePreview` (≤120 chars) per persisted fingerprint entry,
- capture first sample SQL text per fingerprint in `scanSaropaLogDatabaseFingerprints`,
- thread `samplePreview` through the aggregator, the cumulative index, and the webview merge,
- migrate/guard existing v1 on-disk summaries and update the aggregator/index tests.

Per the blast-radius gate this schema migration needs explicit owner sign-off. **Recommendation: skip** — the migration risk outweighs the marginal gain over the already-legible normalized form. If approved, do it as a self-contained change with explicit v1↔v2 back-compat tests.

## Done Criteria
- 1c: only undertaken if a real large-row-count regression is observed; if so, windowed render + scale-gated paging with no behavior change below threshold.
- 1d: explicit go/no-go recorded. If GO, v1 and v2 summaries coexist (back-compat tests pass) and cumulative-only rows show concrete sample SQL.
