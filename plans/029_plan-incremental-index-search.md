# Plan 029 — Incremental index for cross-session search

## Status: Done (2026-06-14)

## Goal

"Search in all logs" currently reads every `.log` file sequentially on each search. For workspaces with hundreds of sessions this is slow. Build an incremental text index that updates as new sessions are written, so cross-session search returns results without scanning every file from scratch.

---

## Scope

### In scope

- Incremental index stored under `.saropa/index/search/`
- Index updated at session end (append new session) and on manual rebuild
- Search queries hit the index first, then fall back to full scan for unindexed files
- Setting to enable/disable (`saropaLogCapture.searchIndex.enabled`, default `true`)
- Setting for max index size (`saropaLogCapture.searchIndex.maxSizeMB`, default `50`)
- Index invalidation when a log file is deleted or modified externally

### Out of scope

- Full-text search ranking or relevance scoring
- Fuzzy matching (regex and literal only)
- Indexing non-log files (source code, docs)
- Remote workspace index sync

---

## Design considerations

### Index format

A trigram index is the simplest approach that supports both literal and regex search without storing full file contents. Each trigram maps to a set of file paths + byte offsets. On query, intersect trigrams from the search term to get candidate files, then verify matches by reading only those files.

Alternative: line-level inverted index (word → file:line). Simpler for keyword search but doesn't support arbitrary regex without fallback to full scan.

### Index lifecycle

- **Build:** On first enable or manual rebuild, scan all `.log` files in the reports directory
- **Update:** At session end, index the new/modified log file incrementally
- **Prune:** When a log file is deleted (retention policy), remove its entries from the index
- **Invalidate:** If a file's mtime differs from what the index recorded, re-index that file

### Storage budget

At ~50MB default cap, the index covers roughly 500MB–1GB of log files (trigram indexes are typically 5–10% of source size). Beyond the cap, oldest sessions are evicted from the index and fall back to direct scan.

---

## Test plan

1. **Index built on enable:** Enable setting, rebuild → index files created under `.saropa/index/search/`
2. **Incremental update:** New session written → index updated without full rebuild
3. **Search hits index:** Search term present in indexed file → result returned without scanning all files
4. **Deleted file pruned:** Delete a log, search → no stale results from deleted file
5. **Max size respected:** Index approaching cap → oldest entries evicted
6. **Fallback for unindexed:** File modified externally → search still finds matches (falls back to scan)
7. **Disable setting:** Turn off → search reverts to sequential scan, index not updated

---

## Risk assessment

| Risk | Mitigation |
|------|------------|
| Index corruption on crash during write | Write to temp file, atomic rename |
| Index grows unbounded | `maxSizeMB` cap with LRU eviction |
| Stale results from modified files | mtime check on query; re-index on mismatch |
| Regex queries bypass trigram optimization | Fall back to sequential scan for complex regex patterns |

---

## Finish Report (2026-06-14)

Implemented as a **pure pruning accelerator**: the index can only remove files that provably cannot contain the query (they lack one of the query's trigrams). Every surviving candidate is still scanned for real, so a stale, partial, missing, or disabled index degrades to a slower scan — never to a wrong or missing result. This kept correctness independent of index freshness and avoided storing full file contents or ranking.

### What shipped

- **Trigram primitives** — [src/modules/search/search-index-trigram.ts](../src/modules/search/search-index-trigram.ts): 24-bit byte-trigrams of the lowercased UTF-8 text, packed sorted into a base64 `Uint32Array`; superset test via binary search. Covered by [src/test/modules/search/search-index-trigram.test.ts](../src/test/modules/search/search-index-trigram.test.ts).
- **The index** — `TrigramSearchIndex` in [src/modules/search/search-trigram-index.ts](../src/modules/search/search-trigram-index.ts), stored at `.saropa/index/search/manifest.json`. Atomic temp-file+rename writes (corruption mitigation), oldest-mtime eviction past `maxSizeMB` (unbounded-growth mitigation), per-query `mtime`/size staleness check with background re-index (stale-results mitigation).
- **Query path** — [src/modules/search/log-search.ts](../src/modules/search/log-search.ts) narrows candidates for literal queries in both `searchLogFiles` and `searchLogFilesConcurrent`; regex queries skip pruning (full-scan fallback).
- **Lifecycle** — incremental update at session end ([session-manager-stop.ts](../src/modules/session/session-manager-stop.ts), after scans settle); entry removal on permanent delete ([commands-trash.ts](../src/commands-trash.ts) `emptyTrash`); full rebuild via the **Rebuild Log Search Index** command ([commands-tools.ts](../src/commands-tools.ts)).
- **Settings** — `saropaLogCapture.searchIndex.enabled` (default `true`) and `saropaLogCapture.searchIndex.maxSizeMB` (default `50`), checked per-operation so toggling needs no reactivation.

### Notes / deviations from the plan

- **Eviction is oldest-mtime, not true LRU.** The plan said "LRU"; access time isn't tracked, and "oldest session" is the intended eviction target anyway, so mtime order is the right key.
- **Pre-existing `SearchIndexManager`** ([src/modules/search/search-index.ts](../src/modules/search/search-index.ts)) is a separate metadata-only (line-count/size) cache wired to nothing but its own test — it does not accelerate content search. Left untouched to avoid an unrequested deletion; the new index has a distinct name (`TrigramSearchIndex`) to avoid collision.
- Test plan item "max size respected" / "fallback for unindexed" are exercised by the design (eviction + the unindexed→scan branch) but covered by unit tests only at the trigram level; the class-level fs behavior runs through the Extension Host suite.
