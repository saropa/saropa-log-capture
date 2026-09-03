# Deferred: DB_18b 1d — Schema v2 readable sample SQL

Carried forward from `DB_18b_deferred-virtualization-and-sample-sql.md` (archived
to `plans/history/2026.06/2026.06.08/`). Items 1a–1c shipped; this is the only
remaining item.

## Status: Deferred (recommendation: SKIP)

## What it would do

Cross-log SQL history rows currently show the **normalized fingerprint** — already
readable parameterized SQL (`SELECT * FROM contacts WHERE id = ?`). This item
would show a *concrete* example (real parameter values) instead.

## Why it's deferred

The migration risk outweighs the marginal gain over the already-legible normalized
form. Implementing it requires:

- Bump `DRIFT_SQL_FP_SUMMARY_SCHEMA_VERSION` 1 → 2 with back-compat reader
- Add optional `samplePreview` (≤120 chars) per persisted fingerprint entry
- Capture first sample SQL text per fingerprint in `scanSaropaLogDatabaseFingerprints`
- Thread `samplePreview` through aggregator, cumulative index, and webview merge
- Migrate/guard existing v1 on-disk summaries; add v1↔v2 back-compat tests

## If reactivated

Do it as a self-contained change with explicit v1↔v2 back-compat tests. The schema
migration needs blast-radius review.
