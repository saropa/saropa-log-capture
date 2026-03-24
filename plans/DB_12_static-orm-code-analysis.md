# DB_12 Static ORM / Code-Level Analysis

## Progress (incremental)

- **Shipped:** Fingerprint → **search tokens** plus **ORM mapping** with **optional path globs** (`**/*.dart` per row, union + default) → filter indexer hits before line scan (`drift-sql-static-orm-patterns.ts`, `drift-static-sql-candidates.ts`). **Line-aware ranking** + QuickPick at best line. **Entry points:** N+1 row, **context menu** (DB line with fingerprint), **integration popover** (Database insight), **SQL repeat drilldown**, **Performance → DB** table “Sources” column. **Fixture acceptance:** `src/test/fixtures/drift-static-sql-mini` + `drift-static-sql-fixture-acceptance.test.ts` (top-3 goal). **Setting** `staticSqlFromFingerprint.enabled`. **`.dart`** in default project-index types. Copy distinguishes **static index vs stack trace** where relevant.
- **Not yet:** **symbol-level “open at query”** (LSP); TS/Kotlin mapping rows.

## Goal

Connect observed SQL patterns (fingerprints, N+1 hints from **`DB_15`** / `db.n-plus-one` and history **`DB_07`**) to **likely source locations** in the workspace using static analysis and/or project indexing—not only log text.

## Scope

- **V1 in scope:** Drift-oriented heuristics on **indexed Dart** (same stack as current Drift Advisor usage): extend the mapping from fingerprint / table tokens → additional search patterns (e.g. generated table getters, `select` / `watch` / query method names). Reuse or extend the existing project indexer / token path; no new language until v1 is stable.
- **Later:** TS/Kotlin (Room, etc.) rows in the same mapping table once patterns are defined; symbol-level navigation (LSP or indexer symbol → range) when a single best candidate exists.
- **Out of scope:** Runtime proof of which line executed (log/stack); full debugger integration.

## Implementation Plan

1. **Mapping table (data):** For each fingerprint “shape hint” (or table-derived token set), define ordered search patterns (string/regex fragments safe for workspace search), optional file globs, and a short rationale comment. Store as structured data (e.g. JSON or TS const) colocated with token extraction—single source for tests and viewer.
2. **Indexer integration:** Reuse or extend the existing indexer / `drift-sql-fingerprint-code-tokens` pipeline to produce **file + line (or offset)** candidates, not only file paths when the indexer exposes them.
3. **Viewer / host:** “Find in codebase” (or equivalent) on a fingerprint or applicable insight row shows a ranked QuickPick or peek list. **Ranking (v1):** (a) candidate line contains the extracted **table identifier** (or Drift table class name) beats token-only file hit; (b) among ties, prefer more **token hits in the same file**; (c) stable tie-break (e.g. path sort). Do not use editor “recently opened” or heuristic “popularity” unless we later add an explicit signal.
4. **Confidence copy:** UI and docs stay **suggestive**; never imply definitive call site without stack correlation.
5. **Setting:** Contribution point + default-on; when off, hide static affordances and do not run static search from those entry points.

## UX Rules

- Clear labeling: “Possible sources (static)” vs “From stack trace.”
- Graceful empty state when indexer has no matches; no error toast for “no hits.”

## Test Plan

- **Unit:** Normalized fingerprint → expected search tokens and mapping rows (table names, Drift-specific fragments).
- **Integration (light):** Fixture Dart/Drift snippets; ranked list puts a known query file above unrelated token matches.
- **Regression (indexer unavailable / disabled):** No uncaught host errors; static entry points hidden or show empty/disabled state per setting; webview remains usable.

## Risks

- High false-positive rate; keep setting + low-key UI until tuning passes the acceptance bar below.

## V1 acceptance (tuning)

- In the **fixture project**, the file containing the intentional query appears in the **top 3** static candidates for at least the covered fingerprint/table scenarios we document in the test. Expand table rows before widening UX prominence.

## Done Criteria

- Users get an actionable next step from SQL noise toward code (ranked static candidates + clear non-definitive labeling), beyond Drift Advisor alone, with an off switch.

## Related Plans

- **`DB_15`** (detector ids / synthetic insight rows), **`DB_02`** (fingerprints), history **`DB_07`**, project indexer docs.
- **`DB_14`** (automatic root-cause hints): keep **hints** (narrative / checklist) separate from **static source lists** (file/line candidates); cross-link in UX only where it reduces confusion, not duplicate wording.
