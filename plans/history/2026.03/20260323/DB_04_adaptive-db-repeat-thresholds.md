# DB_04 Adaptive DB Repeat Thresholds — implemented

**Status:** Implemented in-tree (2026-03). Original spec below; summary of what shipped follows.

## Implementation summary

- **Mechanism:** Real-time `repeatTracker` in webview `addToData` (`viewer-data-add.ts`); not compress-lines dedupe.
- **Identity:** `database`-tagged Drift lines repeat-keyed by `level + '::sqlfp::' + normalized fingerprint` (`parseSqlFingerprint` in `viewer-data-n-plus-one-script.ts`).
- **Thresholds:** `getDriftRepeatMinN` in embed; extension host mirror **`driftSqlRepeatMinN`** in `src/modules/db/drift-db-repeat-thresholds.ts` (unit-tested, including false-positive guards for non-`database` source and unknown verbs).
- **Settings:** `saropaLogCapture.repeatCollapseGlobalMinCount`, `repeatCollapseReadMinCount`, `repeatCollapseTransactionMinCount`, `repeatCollapseDmlMinCount` (2–50); pushed via `setViewerRepeatThresholds` and baked into HTML at build.
- **Docs:** `CHANGELOG.md` [Unreleased], `README.md` viewer bullet, `examples/drift-repeat-collapse-thresholds.txt`.
- **Known limitation:** High N + short `repeatWindowMs` — sparse streams may not reach threshold (documented in setting markdown + changelog).
- **DB_15:** Repeat-collapse **thresholds** are unchanged by **`viewerDbInsightsEnabled`**; that toggle only disables **N+1 synthetic rows** and **`dbInsight`** rollup (see `DB_15_db-detector-framework.md`).

---

# DB_04 Adaptive DB Repeat Thresholds (original plan)

## Goal
Tune repeat-compression sensitivity for SQL so read-heavy noise is reduced while important write operations stay visible.

## Dependency
- Assumes **DB_03** (fingerprint-based repeat identity for Drift `database`-tagged SQL). Verb classification should use the **same parse** as `parseSqlFingerprint` (extend its return shape or share a single extractor in the embed) so hash key and threshold stay consistent.

## Mechanism (do not confuse with compress modes)
- Targets the **real-time repeat tracker** in `addToData` (`repeatTracker`, `repeat-notification` rows, `generateRepeatHash` / time window in `viewer-data-helpers-core.ts`).
- **Not** the optional **compress lines / global dedupe** paths in `applyCompressDedupModes` (`viewer-data.ts`), which key on full normalized line text and do not use this threshold model.

## Threshold semantics
- **N** means: the **Nth** matching repeat within `repeatWindowMs` is the first line that **enters** the repeat path (existing behavior from there: hide the tracked original when the UI switches to repeat rows, increment counter, etc.).
- **Today (global baseline):** effectively **N = 2** for all eligible lines (second identical hash within the window triggers repeat handling).
- **Fallback:** Drift SQL lines where verb cannot be classified use the **same numeric default as today’s global behavior** (N = 2 unless settings override the global default).
- **Non–Drift / non-SQL lines:** unchanged; keep global N = 2 (or whatever the single global setting is).

## Scope
- In scope: per-verb **N** for the real-time repeat path, defaults, extension → webview settings hook.
- Out of scope: N+1 detection, burst markers, changing compress-lines / global dedupe.

## Implementation Plan
1. Classify SQL verb from the Drift “Sent …” body (same family as existing `driftSqlPattern`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `WITH`, `PRAGMA`, `BEGIN` / `COMMIT` / `ROLLBACK`).
2. Map verb → **minimum N** before starting repeat collapse; reads lower N, writes higher N.
3. Gate `addToData` repeat branch: only treat as repeat when `repeatTracker.count` (or equivalent) would reach **N** for that verb, not on the second line when N > 2.
4. Add optional config overrides (see below); inject numeric thresholds into the webview bundle or message init, consistent with patterns like `N_PLUS_ONE_EMBED_CONFIG`.
5. Document interaction with **`repeatWindowMs`**: sparse DML may never reach a high N inside the window. Mitigation options (pick one when implementing): longer window for mutation class, verb-specific window, or accept “only applies to bursty repeats” and document it.

## Suggested defaults
| Class | Verbs | N (first repeat collapse on occurrence #N) |
|--------|--------|---------------------------------------------|
| Read-shaped | `SELECT`, `WITH`, `PRAGMA` | 2 |
| Transaction | `BEGIN`, `COMMIT`, `ROLLBACK` | 3 |
| DML | `INSERT`, `UPDATE`, `DELETE` | 4 |

- **Unknown verb** (matched Drift SQL but outside the table): use **global default N** (same as non-SQL: 2 unless user overrides global).
- Adjust if product testing shows `PRAGMA` should be more conservative (e.g. same as DML).

## Config (shape TBD in implementation)
- Prefer a **small number of user-facing knobs** (e.g. global N, optional “read N” / “write N” / “transaction N”) over six separate settings, unless power users need per-verb control.
- Settings live under the same **viewer / log compression** area as other repeat-compression options; webview must receive numbers at load (or via existing config message path).

## Test Plan
- Unit: same fingerprint / repeated `SELECT` enters repeat path **earlier** than repeated `UPDATE` under defaults.
- Unit: `WITH` / `PRAGMA` use the read-shaped N (or documented alternative).
- Unit: unknown verb uses **global** N.
- Unit: non-SQL duplicate behavior unchanged (still global N).
- Regression: lines without `database` tag and non-Drift text unchanged.

## Risks
- Wrong defaults can hide important behavior; ship with **conservative** mutation N and tunable settings.
- High **N** + short **`repeatWindowMs`** rarely triggers for slow streams; document or compensate with window policy.

## Done Criteria
- Drift SQL repeats use verb-specific **N** on the real-time repeat path; non-SQL behavior matches pre-change baseline.
- At least one automated test asserts **SELECT vs UPDATE** threshold ordering.
- User-facing defaults and any verb-specific **repeatWindowMs** behavior are documented in CHANGELOG or settings description.
