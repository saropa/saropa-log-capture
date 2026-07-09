1. blanks showing with expander arrows
2. drift (db) issues SLOW and REPEAT maybe should appear even if DB is turned off. they are performance warnings, aren't they? review what the db toggle captures and whther we can and show split out performance


--

ref: d:\src\contacts\reports\20260708\20260708_185613_contacts.log

Status: Fixed

## Finish Report (2026-07-09)

Two independent viewer defects, both reproduced against the reference SDA/contacts
capture (Drift `[database]`-tagged performance lines interleaved with Choreographer
frame-drops and filtered device noise).

### Item 2 — Drift SLOW / REPEAT hidden by the Database level toggle

**Defect.** The Drift `DriftDebugInterceptor` emits `Drift SLOW <n>ms <VERB>: …` for
over-threshold queries and `Drift REPEAT x<n> in ≤<n>ms …` for N+1 batches. Both lines
begin with the app's `[log] [database]` head tag, so `classifyLevel` resolved them via
the head-tag dictionary (`[database]` → level `database`). The viewer's "DB" toolbar
badge is the `database` **level** filter, so disabling it hid these lines. They are
performance signals (slow query / query storm), not routine SQL traffic, and should
survive with the Database level off.

**Fix.** Added `driftPerfPattern` (`/\bDrift\s+(?:SLOW\s+\d+\s*ms|REPEAT\s+x\d+)\b/i`)
to both classifier copies — `src/modules/analysis/level-classifier.ts` (host) and
`src/ui/viewer-search-filter/viewer-level-classify.ts` (webview string template). The
check runs after the stderr short-circuit and **before** both `driftStatementPattern`
(→ database) and `matchesError`, so these lines classify as `performance` regardless of
the `[database]` tag, and a stray `…Error` enum value inside the logged SQL args cannot
force `error`. Plain `Drift SELECT:` statements still classify as `database`. The pattern
is linear-time (a fixed two-branch alternation after `\bDrift\s+`, no re-partitioning
inner quantifier), consistent with the repo's ReDoS discipline.

### Item 1 — blank rows rendering with an expander arrow

**Defect.** Blank content lines (empty console output / paragraph-break slivers) render
at a quarter-height (> 0px), so `computeRowAffordances` in
`src/ui/viewer/viewer-data-divider.ts` accepted a blank row as the `prevVis` anchor and
stamped the filter-hidden-gap reveal chevron (`_hiddenAfter`) on it whenever the blank
sat immediately above a run of filter-hidden rows — a blank sliver carrying an expander
arrow.

**Fix.** `computeRowAffordances` now skips blank `type === 'line'` rows as affordance
anchors (`isLineContentBlank` guard), so the reveal chevron attaches to the nearest
non-blank visible row instead. `countHiddenNonBlank` already excludes blanks from the
gap count, so a blank-only separation between two visible rows produces no false chevron.

### Tests

- `src/test/modules/analysis/level-classifier-special.test.ts` — 4 cases: SLOW → performance,
  REPEAT → performance, SLOW-with-`…Error`-enum → performance (not error), plain
  `Drift SELECT:` → database.
- `src/test/ui/viewer-level-classify-parity.test.ts` — 3 corpus rows exercising both
  classifier copies (host + webview) for the new behavior.
- `src/test/ui/viewer-blank-row-affordance.test.ts` (new) — blank row before a hidden gap
  must not host `_hiddenAfter` (the prior non-blank row does); blank-only separation yields
  no chevron.

Verification: `npm run check-types` clean; targeted runs green — level-classifier-special
(41), classifier parity (17), blank-row affordance (2), stack-frame-hidden-gap (2, no
regression). Changelog entries added under Unreleased → Fixed.