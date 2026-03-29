# DB_09 SQL Minimap Density

**Status: Implemented.** Moved here from `plans/DB_09_sql-minimap-density.md` after ship (same convention as `DB_07` in this folder).

## Goal
Visualize database activity density on the minimap/timeline to make SQL bursts obvious at a glance.

## Scope
- In scope: minimap density encoding for SQL lines and slow SQL lines.
- Out of scope: full timeline analytics panel.

## Implementation Plan
1. Extend minimap aggregation to count SQL-tagged lines per vertical bucket.
2. Add dual intensity channel: base SQL density and slow SQL density.
3. Render subtle DB color band overlays that compose with existing severity bands.
4. Add setting toggle to disable SQL minimap layer.

## UX Rules
- Keep colors subdued; avoid overpowering error/warning indicators.
- Tooltip/legend should explain density meaning.

## Test Plan
- Unit: bucket aggregation includes SQL counts.
- Visual regression: minimap remains readable with multiple overlays.
- Performance: no measurable render slowdown in large sessions.

## Risks
- Too many overlays reduce clarity; keep DB layer optional and low-contrast.

## Done Criteria
- Users can visually locate SQL-heavy intervals without scanning raw lines.

---

## Implementation summary (2026-03-23)

- Minimap: vertical bucket aggregation for SQL vs slow-SQL; right-side low-alpha bands; `sourceTag === 'database'` plus SQL keyword heuristic; slow = `performance` level or `slow` + `query|sql` text.
- Setting: `saropaLogCapture.minimapShowSqlDensity` (default `true`), NLS on all `package.nls*.json`.
- **Fix:** SQL buckets are filled **independently** of “show info markers” so info-only DB traffic still shows density when info dots are hidden.
- Tests: `src/test/ui/viewer-scrollbar-minimap-sql-heuristics.test.ts` (heuristics, bucket index, injected-pattern alignment).
