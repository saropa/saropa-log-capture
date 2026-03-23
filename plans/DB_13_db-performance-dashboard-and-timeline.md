# DB_13 DB Performance Dashboard and Full Timeline Analytics

## Progress (incremental)

- **Shipped:** **Database** tab inside the existing Performance slide-out (`viewer-performance-panel.ts`, `viewer-performance-db-tab.ts`, CSS in `viewer-styles-performance.ts`): totals, top fingerprints by volume, optional timeline from DB-tagged line timestamps, empty states when rollup/timestamps missing.
- **Not yet:** Scroll-synced time brush, Drift Advisor metric row in this tab, shared bucketing refactor with minimap heuristics.

## Goal
Go beyond minimap density (`DB_09`) and burst markers (`DB_08`) with a dedicated **analytics surface**: time-aligned DB load, slow-query concentration, and summary KPIs for the session.

## Scope
- In scope: timeline chart or structured summary panel (total queries, by fingerprint top-N, slow share, optional duration histogram); time window selection synced with log scroll.
- Out of scope: server-side APM replacement; automatic narrative root cause (see `DB_14`).

## Implementation Plan
1. Aggregate session data into time buckets (reuse minimap bucketing logic where possible) plus global aggregates.
2. Add a panel tab or modal: charts/tables driven by aggregated data only (no per-line DOM for the full chart).
3. Optional brush/zoom: selecting a range filters main log to that time span (compose with existing filters).
4. Integrate Drift Advisor snapshot metrics when present (totals, top slow) for session-end summary row.

## UX Rules
- Lazy-load panel data on first open; keep default viewer lightweight.
- Clear empty state when no duration data (still show counts if available).

## Test Plan
- Unit: aggregation matches synthetic session (known query times/counts).
- Performance: 100k+ lines session remains responsive when panel closed.
- Regression: opening panel does not reset scroll or selection unless user applies range filter.

## Risks
- Chart deps vs bundle size; prefer CSS/simple canvas or existing stack patterns.

## Done Criteria
- Users can answer "when was the DB hot?" and "what dominated?" without raw log scanning.

## Related Plans
- `DB_08`, `DB_09` ([implemented — history](history/20260323/DB_09_sql-minimap-density.md)), `DB_10`, **`DB_15`** (session detectors and future compare summaries as inputs to aggregates), Drift Advisor integration docs.
