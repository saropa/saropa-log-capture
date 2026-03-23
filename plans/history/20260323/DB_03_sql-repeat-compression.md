# DB_03 SQL Repeat Compression (completed)

**Archived:** 2026-03-23. Active plans live under `plans/`; this file is historical context only.

## Completion summary

- Fingerprint-keyed real-time repeat collapse for **`database`**-tagged Drift `Sent` SQL (`level + '::sqlfp::' + fingerprint`), with **SQL repeated #N** copy and snippet preview (`viewer-data-add.ts`, `viewer-data-helpers-core.ts`).
- **`emitDbLineDetectors`** runs on both full-line and repeat-collapse paths so N+1 / DB_15 detectors still see every physical line (`viewer-data-add-db-detectors.ts`).
- **Single parse per line:** `parseSqlFingerprint(plain)` runs once per ingest; repeat key, `dbInsight`, and detectors share **`sqlMeta`** (2026-03-23 follow-up).
- **Tests:** `src/test/ui/viewer-data-add-embed.test.ts` (single-parse + database-tag gate for sqlfp); string-level embed checks in `viewer-n-plus-one-embed.test.ts`.

---

# DB_03 SQL Repeat Compression

## Goal
Extend **real-time repeat suppression** (the `repeatTracker` path that emits `Repeated #N` rows) so repeated Drift SQL lines group by **normalized SQL fingerprint**, not by raw line text (first 200 chars). Same statement shape with different literals/args should count as one streak.

## Scope

### In scope
- Fingerprint-aware **repeat tracker** hash and preview/label for eligible lines (see below).
- Existing repeat summary row type (`repeat-notification`, `Repeated #N` pattern) with **DB-specific** copy so users know SQL-shaped repeats are grouped.
- Preserve scroll/height behavior for `repeatHidden` originals and appended repeat rows; marker/separator reset behavior unchanged.

### Out of scope
- Drilldown UI for expanded repeat details (separate plan).
- **Compress dedup modes** (`compressLinesMode` / `compressNonConsecutiveMode`, `lineDedupeKey` in `applyCompressDedupModes`): those use a different pipeline and keys. This plan does **not** change them unless a follow-up explicitly extends DB_03.

## Current code (do not reimplement blindly)

- `parseSqlFingerprint` and Drift normalization already run from `addToData` (embedded script in `viewer-data-n-plus-one-script.ts`). Reuse that result; do not duplicate parsing logic in another file.
- For Drift SQL with a parseable fingerprint, the repeat key is **`level + '::sqlfp::' + fingerprint`** (see `viewer-data-add.ts`); non-SQL lines still use `generateRepeatHash(level, plainText)`.
- **N+1:** the same SQL path calls **`emitDbLineDetectors`** on both normal and repeat-collapse branches so arg-variant bursts still feed **`db.n-plus-one`** (**DB_15**).

## Status
Core fingerprint-keyed repeat collapse and SQL-specific repeat row copy are **implemented**. Remaining gap vs this plan is mostly **DB_06** (drilldown) if product wants expanded inspection of collapsed streaks.

## Implementation Plan

1. For lines where repeat grouping should use SQL shape: `sourceTag === 'database'` **and** `parseSqlFingerprint(plain)` returns a non-null `fingerprint`, compute repeat key as **`level + '::sqlfp:' + fingerprint`** (or equivalent single stable string). Otherwise keep **`generateRepeatHash(level, plain)`** unchanged.
2. Keep **preview text** for the repeat row useful: e.g. prefer `sqlSnippet` / truncated fingerprint from parse result when in SQL-repeat mode; keep existing plain-text preview for non-SQL.
3. Adjust **visible label** on the repeat row (still same row type/CSS family) so it reads as SQL repeat compression, not a generic duplicate.
4. **N+1 detector** (**DB_15** `db.n-plus-one`): **implemented** on both branches—repeat-collapse rows still call **`emitDbLineDetectors`** so hits are not silently dropped when lines fold into `repeat-notification`.

## UX Rules

- Same time window (`repeatWindowMs`), marker cleanup (`cleanupTrailingRepeats`), and eligibility rules as today unless explicitly changed.
- Summary line must clearly indicate **SQL / fingerprint-style** grouping, not generic “repeated message” wording.

## Test Plan

- Unit: same SQL shape + different args → **one** repeat streak (count increases; not treated as new message each time).
- Unit: different SQL fingerprints → **do not** merge.
- Unit: `database` line where `parseSqlFingerprint` returns null → **fallback** to existing `generateRepeatHash` behavior (unchanged from pre-DB_03).
- Regression: non-database or non-SQL lines → repeat suppression unchanged.
- Regression: marker / run boundary still resets repeat state and does not leave stuck `repeatHidden` heights (existing `cleanupTrailingRepeats` contract).

## Risks

- Collapsing many lines can hide one-off differences in args or timing; **peek/expand** (or drilldown) stays a follow-up.
- If N+1 and repeat logic both key on fingerprint, align semantics so insights are not misleading (see implementation step 4).

## Done Criteria

- For Drift `database` lines with a parseable fingerprint, consecutive repeats within the repeat window collapse into fingerprint-keyed repeat rows with copy that identifies SQL grouping (**SQL repeated #N** when in SQL mode).
- Non-SQL and unparseable DB lines behave exactly as before for repeat tracking.
- Compress dedup toggles are unaffected unless a separate task explicitly extends this work.

## Related plans
- **DB_02** (normalization), **DB_15** (detector pipeline + N+1 on repeat path), **DB_06** (drilldown).
