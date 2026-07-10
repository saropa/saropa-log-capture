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

## Finish Report (2026-07-09) — follow-up viewer defects

Two further log-viewer defects surfaced from the same investigation (screenshots of the
contacts session showing `[perf] [frame-stall]` frame-stall lines): a redundant severity
tag left inline, and a level filter that dimmed rather than hid a disabled level.

### Redundant `[perf]` head tag left in the message body

**Defect.** Structured logcat lines such as `I/flutter (24400): [perf] [frame-stall] total=…`
rendered with the `[perf] [frame-stall]` tags still in the body. The severity is already
conveyed by the row color and level chip, so the leading `[perf]` restates it. Root cause:
`renderItem` (`src/ui/viewer/viewer-data-helpers-render.ts`) has two prefix-strip branches —
the non-structured branch strips ALL leading `[bracket]` tags, but the structured branch
(taken for logcat lines) called only `stripHtmlPrefix(structuredPrefixLen)`, which removes
the `I/flutter (…):` header and leaves any app head tags that followed it.

**Fix.** The structured branch now also strips leading head tags, but only those that RESTATE
the severity — `/^(?:\[(?:perf|performance|warn|warning|error|err|notice|todo|debug|info)\]\s?)+/i`,
guarded on `item.sourceTag`. A descriptive head tag such as `[frame-stall]` (or `[jank]`,
`[db]`) is kept as the line's tag, so `[perf] [frame-stall] total=…` renders as
`[frame-stall] total=…`. The same strip is mirrored in `lineDedupeKey`
(`src/ui/viewer/viewer-data.ts`) so dedup keys match the displayed text. The regex is
anchored and linear-time; the front-to-back match stops at the first non-severity tag.

### Disabling a level dimmed its lines instead of hiding them

**Defect.** Turning off the Performance level left the perf lines visible but dimmed. Root
cause: `applyLevelFilter` (`src/ui/viewer-search-filter/viewer-level-filter.ts`) ran its
±`contextLinesBefore` reveal (default 3) whenever ANY level was disabled. That reveal
un-hides level-filtered lines as dimmed CONTEXT within N rows of any still-shown line. With
7 of 8 levels enabled, nearly every perf line neighbors a shown line, so they returned as
dimmed context instead of hiding. Trouble Mode is orthogonal and had no effect on this, which
matched the report that toggling it made no difference.

**Fix.** The context reveal is gated to a focused selection —
`var focused = enabledLevels.size <= Math.floor(allLevelNames.length / 2)` — so excluding
one or two levels hides their lines cleanly, while soloing or narrowing to a few levels still
reveals surrounding context. `isContext`/`isContextFirst` are reset for every row before the
gated block, so skipping it leaves no stale context state; `recalcAndRender()` still runs.

### Tests

- `src/test/ui/viewer-bracket-prefix-strip.test.ts` — structured branch strips only the
  severity-label set and not arbitrary tags; a behavioral case asserts `[perf]` is removed and
  `[frame-stall]`/`[retry]` survive.
- `src/test/ui/viewer-level-filter-context-focus.test.ts` (new) — runs the real
  `applyLevelFilter` in a VM: excluding one level hides (no `isContext`), solo-error reveals
  context, 3/8 focused reveals vs 6/8 hides.

Verification: `npm run check-types` clean; targeted suites green — bracket-prefix (10),
context-focus (3), context-line-muting (5), compress-and-search (30), peek-chevron (22).
Commits c7c42e3b (initial) and ac7cffa9 (narrowed strip to severity-only after review that a
descriptive tag like `[frame-stall]` should be kept). CHANGELOG updated under Unreleased →
Fixed.