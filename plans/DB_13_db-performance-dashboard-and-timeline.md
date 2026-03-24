# DB_13 DB Performance Dashboard and Full Timeline Analytics

## Progress (incremental)

- **Shipped:** **Database** tab (`viewer-performance-panel.ts`, `viewer-performance-db-tab.ts`, CSS in `viewer-styles-performance.ts`): rollup KPIs, top fingerprints, slow share + duration histogram, timeline from DB-tagged timestamps with **bucket count** aligned to the SQL minimap via `session-time-buckets.ts` / `viewer-scrollbar-minimap.ts`, **viewport band** (scroll-sync, passive), **brush → time filter** (`timeRangeFiltered` on lines + `viewer-time-range-filter.ts`) composed with existing filters, **Drift Advisor** row from meta + optional `{base}.drift-advisor.json` (`drift-advisor-db-panel-load.ts`, `setDriftAdvisorDbPanelMeta`).
- **Follow-ups:** minimap SQL density is still **Y-by-scroll** while the DB timeline is **time-by-timestamp**—only **N** (bucket count) is shared; document or add a time-projected minimap later if product wants pixel-locked alignment.

## Goal
Go beyond minimap density (`DB_09`) and burst markers (`DB_08`) with a dedicated **analytics surface**: time-aligned DB load, slow-query concentration, and summary KPIs for the session.

## Scope
- In scope: timeline or structured summary driven by **aggregates only** (total queries, fingerprint top-N, slow share, optional duration histogram); **two related time UX features** (see below); Drift Advisor strip when integration data exists.
- Out of scope: server-side APM replacement; automatic narrative root cause (see `DB_14`); exporting or sharing the dashboard as a separate artifact (unless a later plan adds it).

## Time UX (clarify before implementation)

These are **not** the same control; specify behavior for each.

1. **Viewport / scroll sync (passive)**  
   The visible log time span (or primary scroll position) updates a **read-only** highlight or caret on the timeline so users see “where they are” in session time. Does **not** change filters or selection by itself.

2. **Brush / range filter (active)**  
   User selects a time range on the timeline; that range becomes a **time filter** composed with existing log filters (AND). Optional follow-up: scroll the main log to the start of the range **only when** the user applies the brush (not on every passive scroll).  
   **Regression guard:** opening the Performance panel or Database tab must not apply a brush or reset scroll unless the user explicitly sets a range.

**Sequencing:** Implement viewport indicator only after bucket boundaries are stable (see bucketing). Brush can ship after viewport sync or in the same change set if the shared bucket module exists.

## Bucketing

- **Target:** One shared bucketing helper (or documented shared constants + tests) used by the SQL minimap and the Database tab timeline so bucket widths and edge behavior stay aligned.
- **Interim (if blocked):** Duplicate logic is acceptable **only** with a parity test or comment linking both sites and a tracked follow-up to merge; avoid shipping brush sync on divergent bucket definitions.

## Implementation plan

1. Extract or unify session time-bucket aggregation with minimap bucketing; keep global aggregates (totals, top-N, slow share) in the same build pass where practical.
2. Extend the Database tab: chart/table from aggregated arrays only (no per-line DOM for the full series).
3. Add viewport-linked timeline indicator wired from existing scroll/viewport state.
4. Add optional brush → time filter message path; compose with current filter model; document interaction with “clear filters.”
5. **Drift Advisor row** (when data present): read session meta key `saropa-drift-advisor` and/or sidecar `{baseFileName}.drift-advisor.json` per [SAROPA_DRIFT_ADVISOR_INTEGRATION.md](./SAROPA_DRIFT_ADVISOR_INTEGRATION.md). Show a compact summary line or sub-row: performance-oriented fields when available (e.g. totals, slow-query hints, link/open affordance consistent with the rest of the viewer). If the snapshot is missing, timed out, or partial, show available fields and a neutral empty/partial state—**do not** block the rest of the tab.

## Relationship to DB_15

Session detectors (`DB_15`) emit structured results (markers, rollups, annotations). The dashboard **consumes** existing rollup/session aggregates and detector outputs where already exposed to the viewer; it **does not** reimplement detector logic.

## UX rules

- Lazy-load panel timeline/brush work on first open of the relevant tab; keep default viewer lightweight.
- Clear empty state when no duration data (still show counts if available).

## Test plan

- Unit: aggregation matches a synthetic session (known query times, counts, fingerprints); bucket boundaries match minimap fixtures if a shared module exists.
- Performance: 100k+ line session remains responsive with the panel closed; first open of Database tab stays within agreed budget (no full-scan DOM).
- Regression: opening the panel does not reset scroll or selection; brush applies only on explicit user action; clearing the brush restores prior filter set.

## Risks

- Chart dependencies vs bundle size; prefer CSS, simple canvas, or patterns already used in the performance panel.

## Done criteria

- [ ] Timeline shows session-wide DB activity in time buckets consistent with the minimap bucketing.
- [ ] User can see **which fingerprints dominated** (top-N) and **overall load** (totals / slow share) without scanning the raw log.
- [ ] Viewport indicator reflects current log position in time without unintended filter side effects.
- [ ] Optional brush restricts the log to a selected time window and composes correctly with other filters.
- [ ] When Drift Advisor session data exists, the Database tab surfaces a concise summary row; when it does not, the tab still works from log-derived rollups only.

## Related plans

- `DB_08`, `DB_09` ([implemented — history](history/20260323/DB_09_sql-minimap-density.md)), `DB_10`, **`DB_15`** ([DB_15_db-detector-framework.md](./DB_15_db-detector-framework.md)) — detectors and compare inputs feed aggregates; UI stays here.
- [SAROPA_DRIFT_ADVISOR_INTEGRATION.md](./SAROPA_DRIFT_ADVISOR_INTEGRATION.md) — meta and sidecar shape for the summary row.
