# DB_10 Session Comparison DB Diff (shipped)

## Summary
Fingerprint-level database comparison between two saved Saropa logs is implemented in the existing
**Saropa Log Comparison** webview: **Database (Drift SQL)** section, jump-to-line, optional SQL
baseline push to live viewers via the broadcaster, and **Open Drift Advisor** when installed.
Per-session **v1** fingerprint summaries are persisted under session metadata (`driftSqlFingerprintSummary`)
with bounded keys and schema version; the live viewer can consume **`baselineFingerprintSummary`**
for compare-aware detectors.

## Key modules
- `src/modules/misc/diff-engine.ts` — `compareLogSessionsWithDbFingerprints` (one read per file).
- `src/modules/db/db-session-fingerprint-diff.ts` — scan, diff rows, first-line lookup fallback.
- `src/modules/db/drift-sql-fingerprint-summary-persist.ts` — v1 schema, trim, baseline record helpers.
- `src/modules/session/session-drift-sql-fingerprint-persist.ts` — finalize-time scan/write.
- `src/ui/session/session-comparison.ts` — panel host, messages, reveal line.
- `src/ui/session/session-comparison-html.ts` / `session-comparison-webview-script.ts` — HTML/JS split for lint budgets.

## Original goal / done criteria
Users can answer **what changed in DB behavior** between two runs in one view; summary schema is
versioned (`schemaVersion: 1`) and validated on read via `isPersistedDriftSqlFingerprintSummaryV1`.

## Related plans
- **DB_02** — fingerprint normalization.
- **DB_15** — detector framework; compare path uses shared summary maps.
