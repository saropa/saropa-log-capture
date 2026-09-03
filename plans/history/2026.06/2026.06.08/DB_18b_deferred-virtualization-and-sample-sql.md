# DB_18b Deferred: SQL History render virtualization + readable sample SQL

Active continuation of **DB_18** (archived at `plans/history/2026.06/2026.06.08/DB_18_always-on-sql-history-dashboard.md`). DB_18's core (always-on cumulative, persisted index, Drift Advisor + Saropa Lints dashboard) shipped 2026-06-08. These two items were deliberately held back.

## 1c — Virtualized / windowed panel render (deferred, low priority)
**Status:** DONE (2026-06-10) — scale-gated windowing + "Show more" pager shipped. See Finish Report below.

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
- 1c: ✅ windowed render + scale-gated pager, no behavior change below the 2000-row threshold.
- 1d: explicit go/no-go recorded. If GO, v1 and v2 summaries coexist (back-compat tests pass) and cumulative-only rows show concrete sample SQL.

## Finish Report (2026-06-10)

This work will be reviewed by another AI.

**Scope:** (B) VS Code extension (TypeScript webview script + styles + l10n). No Dart/Flutter app code. Item 1c only; 1d remains an unactioned go/no-go (recommendation still SKIP per the blast-radius gate — not built).

**What shipped (1c).** `renderSqlQueryHistoryPanel` built the entire `<tbody>` in one `innerHTML` pass with no upper bound. It is now scale-gated:
- New `SQL_HISTORY_RENDER_CAP = 2000`. When the filtered row set is at or below the cap, `renderCount === filtered.length` — byte-for-byte the previous behavior, zero change for normal-sized logs.
- Above the cap, the render loop is clamped to `sqlHistoryRenderLimit` rows and a pager `<tr>` is appended (spanning all 3 columns, carrying no `.sql-query-history-row` so the expand/restore loops skip it). The pager shows "Showing X of Y rows" and a "Show N more" button.
- "Show more" (`showMoreSqlHistoryRows`) grows the window by one cap-sized chunk and re-renders with `sqlHistoryPreserveLimit = true`; every other render path resets the window to the cap so a fresh search/sort starts from the top.
- Wired via the existing `listEl` click delegation (`.sql-qh-show-more` branch). New CSS for `.sql-qh-pager-cell` / `.sql-qh-show-more`.

**Files changed:**
- `src/ui/viewer-panels/viewer-sql-query-history-panel-render.ts` — cap/window state, clamped loop, pager row, `showMoreSqlHistoryRows`.
- `src/ui/viewer-panels/viewer-sql-query-history-panel-script.ts` — `.sql-qh-show-more` click branch.
- `src/ui/viewer-styles/viewer-styles-sql-query-history.ts` — pager + button styles.
- `src/l10n/strings-webview-b.ts` — `viewer.sqlHistory.showingCapped`, `viewer.sqlHistory.showMore`.
- `src/test/ui/viewer-sql-query-history-panel-script.test.ts` — 2 new tests (scale-gating + pager wiring).
- `CHANGELOG.md` — `[Unreleased]` Changed entry.

**Tests:** `npm run test:file -- out/test/ui/viewer-sql-query-history-panel-script.test.js` → 28 passing (+2 new). `npm run check-types`, `npm run lint` (no warnings in changed files), `npm run compile` (all verify gates OK incl. webview catalogs + dist size).

**Outstanding:** 1d (schema v2 concrete sample SQL) is unbuilt by design — it requires a `DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION` bump with v1↔v2 back-compat and is gated on explicit owner sign-off; recommendation remains SKIP. Plan left active for that decision.

**Finish report appended:** plans/DB_18b_deferred-virtualization-and-sample-sql.md
