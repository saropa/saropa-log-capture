# DB_02 DB Noise Guardrails (implemented)

**Moved from** `plans/DB_02_db-noise-guardrails.md` **on 2026-03-23.**

## Summary of implementation

- **Normalization** — `src/modules/db/drift-sql-fingerprint-normalize.ts`: literals, UUIDs, numbers, whitespace, keyword uppercasing; `DRIFT_SQL_KEYWORD_ALT` shared with `viewer-data-n-plus-one-script.ts` embed.
- **Parser** — `parseDriftSqlFingerprint` in `drift-n-plus-one-detector.ts` uses the normalizer; `argsKey` remains separate from the fingerprint.
- **UI** — Filters panel **SQL Patterns** (`viewer-sql-pattern-tags.ts`, `viewer-filters-panel-html.ts`): min chip count 2, **`__other_sql__`** bucket, composed filter via `sqlPatternFiltered` in `calcItemHeight`.
- **Performance** — Streaming uses `applySqlPatternFilterForNewLine` (no scroll anchor); trim uses batched `unregisterSqlPattern` + `finalizeSqlPatternState` with anchored `applySqlPatternFilter`.
- **Tests** — `src/test/modules/db/drift-sql-fingerprint-normalize.test.ts` (shape collapse, UUID, args isolation, false-positive distinct statements).
- **Examples** — `examples/sql-fingerprint-guardrails-sample.txt`.
- **DB_15** — All embed detectors (`parseSqlFingerprint` → **`db.n-plus-one`**, repeat key **`::sqlfp::`**, rollup keys) must keep using this normalizer; do not fork fingerprint strings in new detector modules.

## Original plan (archived)

## Goal
Prevent high-cardinality or low-value SQL-derived tokens from polluting filters and analysis UI.

## Scope
- In scope: fingerprint normalization rules, token suppression rules, chip eligibility policy.
- Out of scope: detector algorithms that depend on durations or session diffs.

## Implementation Plan
1. Define SQL fingerprint normalization (uppercase keyword shape, literals replaced, whitespace collapsed).
2. Exclude raw args, UUIDs, timestamps, and one-off values from chip generation.
3. Add minimum frequency threshold for SQL chips (similar to source tag min chip).
4. Add fallback "other-sql" bucket for low-frequency statements.

## UX Rules
- Show stable patterns only; never expose noisy raw argument values as chips.
- Keep chip count bounded and predictable.

## Test Plan
- Unit: fingerprints from same query shape collapse to same key.
- Unit: UUID-rich variations do not create unique chips.
- Unit: low-frequency patterns remain hidden by default.

## Risks
- Over-normalization can merge distinct statements; tune by preserving table + verb + major clauses.

## Done Criteria
- SQL filter surface remains compact and useful on noisy sessions.
