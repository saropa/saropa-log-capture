# DB_13 DB Performance Dashboard and Full Timeline Analytics

**Status: Implemented.** Moved here from `plans/DB_13_db-performance-dashboard-and-timeline.md` after ship (same convention as `DB_09` in this folder).

## Progress (incremental)

- **Shipped:** **Database** tab (`viewer-performance-panel.ts`, `viewer-performance-db-tab.ts`, CSS in `viewer-styles-performance.ts`): rollup KPIs, top fingerprints, slow share + duration histogram, **time-based** timeline from DB-tagged timestamps using `session-time-buckets.ts`, **viewport band** (scroll-sync, passive), **brush → time filter** (`timeRangeFiltered` on lines + `viewer-time-range-filter.ts`) composed with existing filters, **Drift Advisor** row from meta + optional `{base}.drift-advisor.json` (`drift-advisor-db-panel-load.ts`, `setDriftAdvisorDbPanelMeta`).
- **Bucketing — read carefully (not the same chart twice):**
  - **Shared:** the **formula** for how many buckets `N` is derived from a pixel height: `max(48, min(180, floor(h/2)))` in `session-time-buckets.ts`, also used by the minimap for SQL density band count.
  - **Not guaranteed equal `N`:** the minimap passes **actual minimap client height `mmH`** (often `N` → 180 on tall panels). The DB tab passes a **fixed nominal height** for the bar track (56px CSS → `floor(56/2)=28` → **clamped to `N=48`**). So in typical layouts the timeline has **fewer buckets than the minimap** even though the formula is the same.
  - **Orthogonal axes:** minimap SQL density buckets are **scroll/layout space** (where the line sits along total content height, projected to the minimap). The DB tab buckets are **clock time** (`timestamp` quantiles across `[tMin, tMax]`). A bucket index `k` on one has **no fixed correspondence** to `k` on the other unless the session is approximately **chronological with time roughly proportional to scroll position** — filtering, compression, stack traces, bursts of short lines, or clock skew break that.
  - **User-facing implication:** the timeline answers “when in **session time** was DB busy?”; the minimap SQL bands answer “where in **this scroll view** is SQL dense?” — complementary, not pixel-synchronized twins.
- **Follow-ups (product / engineering):** (1) Optionally **measure** `.pp-db-bars` after layout and pass that height into `sessionTimeBucketCountForHeightPx` so `N` is intentional vs. an accidental 48-only default. (2) If true **time-aligned** minimap density is required, add a **separate** time-histogram pass on the minimap (or shared precomputed time series) instead of reinterpreting scroll-Y buckets as time.

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

- **Shipped interpretation:** One shared **helper** (`session-time-buckets.ts`) supplies the **bucket-count formula** and **time-index** math for the Database tab; the minimap imports the same **count** function. This satisfies “shared module + tests” and avoids **divergent formulas** for `N`.
- **Deliberate limitation:** “Aligned” here means **same clamped formula**, not same **`N` value**, not same **axis** (scroll-Y vs time). See **Progress → Bucketing — read carefully** above.
- **Interim note:** The original plan’s “bucket widths … stay aligned” is **only** true for the **mathematical shape** of how `N` is chosen from height, not for visual superposition of minimap bands onto the timeline.

## Implementation plan

1. Extract or unify session time-bucket aggregation with minimap bucketing; keep global aggregates (totals, top-N, slow share) in the same build pass where practical.
2. Extend the Database tab: chart/table from aggregated arrays only (no per-line DOM for the full series).
3. Add viewport-linked timeline indicator wired from existing scroll/viewport state.
4. Add optional brush → time filter message path; compose with current filter model; document interaction with “clear filters.”
5. **Drift Advisor row** (when data present): read session meta key `saropa-drift-advisor` and/or sidecar `{baseFileName}.drift-advisor.json` per [SAROPA_DRIFT_ADVISOR_INTEGRATION.md](../../SAROPA_DRIFT_ADVISOR_INTEGRATION.md). Show a compact summary line or sub-row: performance-oriented fields when available (e.g. totals, slow-query hints, link/open affordance consistent with the rest of the viewer). If the snapshot is missing, timed out, or partial, show available fields and a neutral empty/partial state—**do not** block the rest of the tab.

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

- [x] Timeline shows session-wide DB activity in **time** buckets; **same `N` formula** as minimap SQL density, **not** the same axis or typical `N` (see **Bucketing — read carefully**).
- [x] User can see **which fingerprints dominated** (top-N) and **overall load** (totals / slow share) without scanning the raw log.
- [x] Viewport indicator reflects current log position in time without unintended filter side effects.
- [x] Optional brush restricts the log to a selected time window and composes correctly with other filters.
- [x] When Drift Advisor session data exists, the Database tab surfaces a concise summary row; when it does not, the tab still works from log-derived rollups only.

## Related plans

- `DB_08`, `DB_09` ([implemented — history](./DB_09_sql-minimap-density.md)), `DB_10`, **`DB_15`** ([DB_15_db-detector-framework.md](../../DB_15_db-detector-framework.md)) — detectors and compare inputs feed aggregates; UI stays here.
- [SAROPA_DRIFT_ADVISOR_INTEGRATION.md](../../SAROPA_DRIFT_ADVISOR_INTEGRATION.md) — meta and sidecar shape for the summary row.

---

## Implementation summary (2026-03-23)

- **Modules:** `src/modules/viewer/session-time-buckets.ts` (count formula + time index; module header documents minimap vs timeline semantics), `getSessionTimeBucketsScript()`, tests `session-time-buckets.test.ts`; `src/modules/integrations/drift-advisor-db-panel-load.ts`, tests `drift-advisor-db-panel-load.test.ts`.
- **Viewer embed:** `viewer-time-range-filter.ts`, `viewer-performance-db-tab.ts`, `viewer-performance-panel.ts` (`_refreshDbPerfTabAfterTimeFilter`), `viewer-scrollbar-minimap.ts` (calls `sessionTimeBucketCountForHeightPx`), `viewer-content-scripts.ts` (injects bucket script before time filter + performance panel).
- **Filter model:** `timeRangeFiltered` on `type === 'line'`; `calcItemHeight` / compress eligibility; `viewer-filter-badge.ts`, `viewer-presets.ts` (`clearDbTimeRangeFilter`); `viewer-script-messages.ts` (`setDriftAdvisorDbPanelMeta`, clear resets).
- **Host load path:** `log-viewer-provider-load-helpers.ts` (`loadDriftAdvisorDbPanelPayload`), `log-viewer-provider-load.ts` (post meta to webview); unified JSONL load posts `payload: null` for drift meta.
- **Styles:** `viewer-styles-performance.ts` (timeline track, viewport/filter/brush bands, Drift row, time filter bar).
