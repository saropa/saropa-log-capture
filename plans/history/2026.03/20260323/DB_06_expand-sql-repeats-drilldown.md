# DB_06 Expand SQL Repeats Drilldown (implemented 2026-03-23)

## Summary
Shipped: SQL fingerprint `repeat-notification` rows use a **button** toggle to expand an inline panel (fingerprint, time span, capped SQL snippet, up to **10** arg variants in first-seen order, “+N more” when truncated). **Escape** collapses when focus is on the line. Non-SQL **Repeated #** rows unchanged. Heights use a **heuristic** extra block (`estimateSqlRepeatDrilldownExtraHeight`) plus `recalcHeights` after toggle.

## Code
- `src/ui/viewer/viewer-data-helpers-core.ts` — streak accumulation, snapshot, HTML builder, `toggleSqlRepeatDrilldown`, `calcItemHeight` branch.
- `src/ui/viewer/viewer-data-add.ts` — `bumpSqlStreakVariant` on streak lines; attach `sqlRepeatDrilldown` / `repeatPreviewText` on SQL repeat items.
- `src/ui/viewer/viewer-script.ts` — click `.sql-repeat-drilldown-toggle`; `keydown` Escape.
- `src/ui/viewer/viewer-script-messages.ts` — clear new `repeatTracker` fields on `clear`.
- `src/ui/viewer-styles/viewer-styles-sql-repeat-drilldown.ts` + `viewer-styles.ts` — styles.

## Tests & docs
- `src/test/ui/viewer-sql-repeat-compression.test.ts` — DB_06 VM cases (snapshot, cap, toggle height, false positives).
- `examples/drift-repeat-collapse-thresholds.txt`, `README.md`, `CHANGELOG.md`.

## Outstanding (optional follow-ups)
- DOM-measured height vs heuristic if scroll glitches appear in production.
- Automated test for **search/filter** interaction with expanded SQL repeat rows (manual QA only today).

---

## Original plan (archived)

### Goal
Allow users to inspect details behind compressed SQL repeat rows without disabling compression globally.

### Scope
- In scope: drilldown UI for compressed SQL streaks (args/timestamps samples).
- Out of scope: persistent query history panel.

### Design decisions

#### Data model (do not recover samples from HTML)
- While a SQL-fingerprint streak is active, **accumulate** on `repeatTracker` (or equivalent): first-seen line metadata, last-seen line metadata, timestamps, and **distinct argument variants** keyed by `sqlMeta.argsKey` from `parseSqlFingerprint` (same keying as elsewhere for SQL lines).
- **Variant ordering:** keep **first-seen** order up to the sample cap (optional: show per-variant repeat count if cheap to maintain).
- On each emitted **`repeat-notification`** row (`repeat-sql-fp`), attach a **structured field** on the line object (e.g. `sqlRepeatDrilldown`) with an **immutable snapshot** at insert time: fingerprint, SQL snippet (for display), first/last timestamps, and up to **N** distinct `argsKey` samples. The row label’s count already reflects “as of this insert”; the snapshot matches that moment.
- Do **not** rely on parsing `html` for drilldown; escape all rendered strings with the same helpers as the rest of the viewer (`escapeHtml` / shared attr escaping).

#### Which rows drill down
- **SQL-only:** only rows with `repeat-sql-fp` (and existing SQL repeat collapse rules). Non-SQL `repeat-notification` rows: **no** drilldown; clicks behave as today.

#### Row height and virtualization
- The viewer already virtualizes **rows**. An inline expanded block **increases that row’s height**; implementation must update stored row height and run the same layout/scroll adjustment path used for other dynamic-height rows (if none exists, add a minimal path—do not assume a second inner virtualizer).
- With **N ≤ 10**, a simple static block is enough; no nested virtual list required unless profiling says otherwise.

#### Keyboard and focus
- Repeat summary must include a **focusable** control (e.g. `button` or `tabindex="0"` + role) so drilldown is not click-only.
- **Enter** / **Space:** toggle expand/collapse when focus is on that control.
- **Escape:** collapse when focus is inside the open detail panel (or on the toggle), without trapping focus.

### Relation to DB_15
Drilldown is **presentation** on top of existing repeat-collapse rows; do not fork N+1 or burst **detector** state.

### Related plans
- **DB_03** (SQL repeat compression), **DB_05**, **DB_11**, **DB_15**.
