# DB_05 SQL Fingerprint Chips (implemented)

**Archived:** 2026-03-23. Spec and shipped work for **Top SQL Patterns** filter chips.

## Summary (what shipped)

- Filters panel section title **Top SQL Patterns** (`viewer-filters-panel-html.ts`).
- Settings **`saropaLogCapture.viewerSqlPatternChipMinCount`** (1–50, default 2) and **`saropaLogCapture.viewerSqlPatternMaxChips`** (1–100, default 20): read in `config.ts`, injected via `getSqlPatternTagsScript`, synced on webview load and on config change through **`setViewerSqlPatternChipSettings`** (`viewer-script-messages.ts`, `ViewerBroadcaster`, `activation-listeners`, `extension-activation`, sidebar + pop-out).
- Embedded **`applyViewerSqlPatternChipSettings`** re-runs promote/demote over `sqlPatternRawCounts`, prunes stale `hiddenSqlPatterns`, applies `ensureAtLeastOneTagVisible`, then anchored layout refresh.
- Tests: `viewer-sql-pattern-tags-config.test.ts`, `viewer-script-syntax.test.ts`, `viewer-filters-panel-clarity.test.ts`.

Core chip behavior remains as in **DB_02** (`registerSqlPattern` / `sqlPatternFiltered`).

---

## Goal
Expose top SQL fingerprints as filter chips (same interaction model as source/class tags) so users can isolate repeated patterns in noisy database sessions.

## Current state (implemented under DB_02)
Core behavior lives in **`src/ui/viewer-stack-tags/viewer-sql-pattern-tags.ts`** and integrates via **`registerSqlPattern`** / **`unregisterSqlPattern`** (`viewer-data-add.ts`, `viewer-data.ts` trim). Lines use **`sqlPatternFiltered`** (not `sqlFiltered`) in height recalculation (`viewer-data-helpers-core.ts`).

Treat DB_05 as the **product/spec anchor** for this surface; file new work against gaps below rather than re-specifying the whole feature.

## Scope
- In scope: chip section, counts, toggle filtering by fingerprint, composition with other filters.
- Out of scope: full SQL drilldown (**DB_06**), cross-session analytics (**DB_11**).

## Behavior (canonical)
- **Eligible lines**: `line`, `repeat-notification`, and `n-plus-one-insight` with **`sourceTag === 'database'`** only.
- **Chip key**: normalized SQL fingerprint from **`drift-sql-fingerprint-normalize`** / parse path; never use raw `with args` text for keys or labels.
- **Min count**: fingerprints with raw count below **`sqlChipMinCount`** (default **2**, aligned with source-tag chips) bucket to **`__other_sql__`** (“Other SQL”); crossing the threshold promotes/demotes **`sqlPatternChipKey`** on matching lines.
- **Cap**: up to **`sqlPatternMaxChips`** (default **20**) top patterns; overflow behavior stays consistent with existing sort/truncation in script.
- **Selection**: same contract as log tags—**`ensureAtLeastOneTagVisible`**-style rules so toggling cannot leave an all-hidden chip set without fallback.
- **Performance**: streaming uses light updates + viewport refresh; trim and chip toggles use anchored **`applySqlPatternFilter`** (see module header comments).

## Relation to DB_15
Chips are **UI/filter** surface area; fingerprint keys should stay aligned with **`dbInsight`** / normalization. New duration- or window-based detectors (**DB_08**, etc.) must **not** duplicate fingerprint counting—prefer shared viewer state or future **`session-rollup-patch`** once rollup moves into the framework.

## UX Rules
- Show only fingerprints at or above min count (except the aggregated Other bucket).
- Short, readable labels; count badge on each chip.

## Test Plan
- Unit: chips render sorted by count (respecting max chips).
- Unit: chip click toggles visibility and updates viewport/height counts.
- Regression: source/class tag filters compose correctly with **`sqlPatternFiltered`**.

## Risks
- Filter composition complexity; mitigate with the shared anchored filter + height recalculation path (avoid divergent “SQL-only” layout passes).

## Done Criteria
- Users can quickly isolate a repeated SQL pattern from noisy sessions using fingerprint chips, without breaking other filters.

## Related plans
- **DB_02**: noise guardrails and SQL pattern chip implementation.
- **DB_06**: drilldown from a fingerprint (out of scope here).
- **DB_11**: history / cross-session (out of scope here).
- **DB_15**: shared fingerprint identity; avoid parallel count state.
