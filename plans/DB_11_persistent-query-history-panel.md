# DB_11 Persistent Query History Panel

## Goal
Provide a durable, scrollable view of parsed SQL activity for the current session (and optionally saved sessions) that survives line compression and viewport scrolling—complementing inline drilldown (`DB_06`).

## Scope
- In scope: panel UI, session-scoped index of queries/fingerprints, search and copy, optional export snippet.
- Out of scope: cross-session diff (see `DB_10`), static code mapping (see `DB_12`), automatic root-cause text (see `DB_14`).

## Implementation Plan
1. Maintain a lightweight append-only or ring-buffer index as lines are ingested: fingerprint, first/last line index, count, optional duration samples.
2. Add a viewer panel (or slide-out) listing entries sorted by count, recency, or max duration; click jumps to first matching line in the main log.
3. Wire clear/reset on session clear; cap retained rows and memory (align with trim/truncate behavior).
4. Optional: "Copy all visible" or export JSON slice for bug reports.

## UX Rules
- Panel is optional or toggled from filters / command; default off to avoid clutter.
- Reuse existing monospace / SQL-friendly styling where possible.

## Test Plan
- Unit: index updates on add/trim match main `allLines` lifecycle.
- Unit: jump-to-line respects filtered/hidden lines (document behavior).
- Regression: no measurable slowdown on high-throughput ingest (batch index updates if needed).

## Risks
- Memory if every raw SQL string is stored; store fingerprint + short preview + line refs.

## Done Criteria
- Users can browse session SQL history without expanding every compressed streak.

## Related Plans
- `DB_06` (inline drilldown), `DB_05` (fingerprint chips), `DB_10` (session comparison), **`DB_15`** (ingest/trim lifecycle—index updates must stay aligned with **`trimData`** and clear/reset; optional read of rollup maps if unified).
