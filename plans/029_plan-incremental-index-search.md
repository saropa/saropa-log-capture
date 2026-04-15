# Plan 029 — Incremental index for cross-session search

## Status: Open

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
