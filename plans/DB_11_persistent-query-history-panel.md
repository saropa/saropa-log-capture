# DB_11 Persistent Query History Panel

## Goal
Provide a durable, scrollable view of parsed SQL activity for the **current capture session** that survives line compression and viewport scrolling—complementing inline drilldown (`DB_06`). History lives in memory for that session only; **persisting or reopening history for saved sessions is out of scope for v1** (would pair with session restore work later).

## Scope
- In scope: panel UI, session-scoped in-memory index of queries/fingerprints, search and copy, optional export snippet.
- Out of scope: cross-session diff (see `DB_10`), static code mapping (see `DB_12`), automatic root-cause text (see `DB_14`), loading history from disk for past sessions.

## Integration with existing rollups
- **Prefer one source of truth:** extend or read the existing SQL fingerprint / pattern rollup used for chips (`DB_05`) and `registerSqlPattern` / `unregisterSqlPattern` paths (see `viewer-sql-pattern-tags.ts`) rather than maintaining a parallel index that can disagree on fingerprints or trim behavior.
- If the panel needs extra fields (e.g. export shape), add them to the shared structure or derive them in the panel layer from that rollup.

## Data model and caps
- Per fingerprint (or equivalent key): **count**, **first / last line index** in the main store, **last-seen** (for recency sort), **short preview** (truncated SQL), **optional max duration** (and **min** only if the UI exposes it—otherwise store **max** for “slowest seen” sort).
- **Eviction:** cap **distinct fingerprints** (e.g. LRU by last-seen when over cap). Do not store full repeated SQL text per occurrence—only preview + line refs + aggregates.
- **Lifecycle:** updates on line ingest; **on `trimData`**, remove or adjust entries for dropped line indices the same way other per-line indexes do (see **`DB_15`**); **on session clear**, reset the index.

## Implementation Plan
1. Implement or extend the shared index as above; keep updates **O(1) amortized** per ingested SQL line where practical (batch if profiling shows hot paths).
2. Add a viewer panel or slide-out listing entries sortable by **count**, **recency (last-seen)**, or **max duration**; row click **scrolls the main log** to the **first line index** for that fingerprint (see UX below).
3. Wire toggle from filters and/or a command; default **off**.
4. Optional: “Copy all visible” or export a small JSON slice for bug reports (fingerprints, counts, preview, line refs—no full log).

## UX Rules
- Panel is optional; default off to avoid clutter; reuse existing monospace / SQL-friendly styling where possible.
- **Jump-to-line:** scroll to the stored **physical line index** in the main line store. If filters hide that line, still scroll there and document that the row may be hidden until filters change (alternative: show a one-line notice “target line is filtered out”—pick one behavior and test it).
- Slide-out / panel: **Esc** closes when focused; focus returns sensibly to the main viewer (match patterns used by other viewer panels).

## Test Plan
- Unit: index updates on **add** and **`trimData`** stay consistent with `allLines` / line indices (no stale refs after trim).
- Unit: **session clear** empties the index.
- Unit: many rows with the same fingerprint—**count** and **first/last** line refs update correctly.
- Unit: **empty / no-SQL session**—panel shows empty state; no errors.
- Unit: jump-to-line behavior under **active filters** matches the documented rule.
- Regression: no measurable slowdown on high-throughput ingest (batch index updates if needed).

## Risks
- Memory if every raw SQL string is stored; store fingerprint + short preview + line refs + aggregates only.

## Done Criteria
- User can open the panel, see a sorted list of session SQL fingerprints with counts and preview, search/filter within the list, copy or export visible data as implemented, and click an entry to scroll the main log to the first matching line.
- Trim and session clear keep the index consistent with the main line store; capped fingerprints evict LRU as specified.

## Related Plans
- `DB_06` (inline drilldown), `DB_05` (fingerprint chips), `DB_10` (session comparison), **`DB_15`** (ingest/trim lifecycle—index updates must stay aligned with **`trimData`** and clear/reset).
