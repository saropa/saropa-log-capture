# DB_12 Static ORM / Code-Level Analysis

## Progress (incremental)

- **Shipped:** Fingerprint → **search tokens** (`drift-sql-fingerprint-code-tokens.ts`) and **Static sources** on N+1 insight rows → host QuickPick over indexed workspace files (`viewer-message-handler-static-sql.ts`). Labeled suggestive in UX copy; not proof of execution site.
- **Not yet:** Broader ORM API mapping table, symbol-level “open at query”, dedicated setting to disable static search.

## Goal
Connect observed SQL patterns (fingerprints, N+1 hints from **`DB_15`** / `db.n-plus-one` and history **`DB_07`**) to **likely source locations** in the workspace using static analysis and/or project indexing—not only log text.

## Scope
- In scope: heuristics over indexed Dart/TS/Kotlin (etc.) for common ORM/query APIs; optional "open file at symbol" from a fingerprint or insight row.
- Out of scope: runtime proof of which line executed (that remains log/stack based); full IDE debugger integration.

## Implementation Plan
1. Define mapping table: SQL shape hints → search patterns (e.g. Drift `select`/`watch` call sites, table names extracted from fingerprint).
2. Reuse or extend project indexer / token extractor to find candidate files and line ranges.
3. From viewer: "Find in codebase" or similar on a fingerprint opens peek/results list; rank by table name match and usage frequency.
4. Document confidence as **suggestive** only; never label as definitive without stack correlation.

## UX Rules
- Clear labeling: "Possible sources (static)" vs "From stack trace."
- Graceful empty state when indexer has no matches.

## Test Plan
- Unit: table name from normalized fingerprint extracts expected search tokens.
- Integration (light): fixture project with Drift/Room-style snippets returns ordered candidates.
- Regression: feature disabled when indexer unavailable.

## Risks
- High false-positive rate; keep behind setting or low-key UI until tuned.

## Done Criteria
- Users get a actionable next step from SQL noise toward code, beyond Drift Advisor alone.

## Related Plans
- **`DB_15`** (detector ids / synthetic insight rows), **`DB_02`** (fingerprints), history **`DB_07`**, project indexer docs.
