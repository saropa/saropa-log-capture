# Plan: Incremental index for search (search in all logs)

**Feature:** Extend the project indexer (or search) so "search in all logs" uses an incremental index and scales to many sessions/files.

---

## What exists

- Project indexer and/or find-in-files style search over logs (exact behavior in codebase may vary).
- Search may currently scan files on demand or use a simple in-memory index.

## What's missing

1. **Incremental index** — Index log files incrementally (on open, on write, or on schedule); avoid re-scanning entire directory on every search.
2. **Search in all logs** — User can run a search that covers all sessions in the workspace log directory (or selected investigations); results show file + line.
3. **Scale** — Index and search should perform well with hundreds of log files and millions of lines (e.g. chunked index, line-level or block-level granularity).

## Implementation

### 1. Index structure

- Decide granularity: per-file (path + optional line ranges) or per-line (file, line number, content snippet).
- Store index in workspace state or under `.saropa/` (e.g. SQLite or JSON chunks) keyed by log file path and optional session id.
- Track last-modified or checksum per file to know when to re-index.

### 2. Incremental updates

- On new session / new log file: index that file and merge into index.
- On session list refresh or workspace scan: add new files to index; remove or mark stale entries for deleted files.
- Optional: background job that periodically reconciles index with filesystem.

### 3. Search API

- Query interface: text (and optional regex), date range, session filter; returns matches with file, line, snippet.
- Search runs against index first; fall back to live file read only for unindexed or modified files if needed.

### 4. UI

- "Search in all logs" command or panel; results list with file, line, snippet; click navigates to viewer at that line.
- Option to limit scope (e.g. current investigation, last N days).

## Files to create/modify

| File | Change |
|------|--------|
| New: `src/modules/search/log-index.ts` (or under project-indexer) | Index structure, incremental add/remove, query |
| New: index storage (e.g. `.saropa/log-index.*`) | Persisted index format |
| Search command / panel | Use index for "search in all logs"; display results |
| Session/list lifecycle | Hook to trigger index updates on new/deleted logs |

## Considerations

- Memory: avoid loading full content of all logs; index should be compact (e.g. line offsets + snippets).
- Concurrency: index updates should not block UI; use worker or chunked work.
- Deletions: when a log file is deleted, remove or mark index entry stale.

## Effort

**5–8 days** depending on current search implementation and index design.
