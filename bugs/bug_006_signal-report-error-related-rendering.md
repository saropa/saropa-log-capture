# Bug 006 — Signal Report: `err::` related panel diverges from spec (aggregate count, excerpt-vs-log, overflow)

## Status: Fixed (pending review)

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Problem

Three tests in `signal-report-related.test.ts` for `buildRelatedHtml` fail on `main`. The `err::` (error) rendering branch produces a per-fingerprint-group layout that does not match the contract the tests assert (and that the other branches honor via the shared `wrapList` helper): no single `N error(s)` aggregate count, the raw excerpt is shown even when a real log line is available, and there is no `...and N more` overflow notice.

```
not ok - buildRelatedHtml: should show each error with line number and excerpt
  assert html.includes('2 error(s)')           // FAILS — emits "1 occurrence(s): …" per group
not ok - buildRelatedHtml: should prefer log file content over excerpt
  assert !html.includes('short excerpt')        // FAILS — group summary embeds the raw excerpt
not ok - buildRelatedHtml: should show overflow message when items exceed max
  assert html.includes('...and 5 more')         // FAILS — err:: path never calls wrapList
```

## Environment (if relevant)

- Extension version: 7.13.0
- Discovered on: branch `main` (HEAD `c8f851aa`), pre-existing — fails independent of any uncommitted working-tree changes (verified by stashing to clean HEAD).
- Affected file: `src/ui/signals/signal-report-related.ts`
- Test file: `src/test/ui/signal-report-related.test.ts`

## Reproduction

1. `npm run compile-tests`
2. `npm run test:file -- out/test/ui/signal-report-related.test.js`
3. The three `buildRelatedHtml` tests above report `not ok`.

**Frequency:** Always

## Root Cause

The `err::` branch routes to `buildErrorRelated` → `buildErrorGroupHtml`, which composes its own `<div class="related-summary">` / `<div class="related-list">` markup instead of using the shared `wrapList()` + `itemRow()` convention that every other branch (`warn::`, `net::`, `mem::`, `perm::`, `slow::`, `cls::`) uses. That divergence breaks all three assertions:

1. **Aggregate count.** `buildErrorGroupHtml` emits a per-group summary `` `${group.items.length} occurrence(s): ${group.excerpt}` `` (`signal-report-related.ts:132`). With two distinct excerpts the input splits into two single-item groups, so the output reads `1 occurrence(s): …` twice and the string `2 error(s)` never appears. The other branches emit one top-level `N <label>(s)` summary via `wrapList`.
2. **Excerpt vs. log content.** The group summary interpolates `group.excerpt` verbatim (`:132`/`:137`). The occurrence *rows* correctly call `resolveText(logLines, lineIndex, excerpt)` (which prefers the real log line), but the summary still leaks the raw excerpt, so `short excerpt` remains in the HTML even when a fuller log line exists.
3. **Overflow notice.** `...and N more` is produced only by `wrapList()` (`:248-250`) when `totalCount > maxItems`. `buildErrorRelated` never calls `wrapList` and applies no cap across groups, so no overflow notice is ever rendered for the error path.

`itemRow()` itself is correct — it renders `Line ${lineIndex + 1}` (`:229`), so the 1-based `Line 11` / `Line 51` assertions in test 1 already pass; only the `2 error(s)` assertion in that test fails.

Note: a stale compiled twin `src/ui/signals/signal-report-related.js` also exists in `src/` (should not be committed there); the test imports the `.ts`.

## Changes Made

`src/ui/signals/signal-report-related.ts`:

- **Flattened `buildErrorRelated` onto the shared convention.** It now filters
  out null entries, then renders one `itemRow` per error (line number +
  log-preferred text via `resolveText` + the error `category` as the per-row
  badge) and wraps them with `wrapList('${count} error(s)', rows, count)`. That
  single helper supplies the aggregate count, the log-vs-excerpt preference, and
  the `...and N more` overflow notice — fixing all three assertions at once.
- **Removed the divergent grouping path:** `buildErrorGroupHtml`, the
  `groupErrorsByFingerprint` helper, the `ErrorGroup` interface, and the
  now-unused imports (`hashFingerprint`, `normalizeLine`, `classifyErrorOrigin`,
  `buildFingerprintNote`). File header doc rewritten to describe the uniform
  shape.

**Why flat, not collapse-by-fingerprint.** Fingerprint collapse (one row per
distinct error with a `×N` badge) was tried first, but it is incompatible with
the overflow test: that test feeds 25 errors whose excerpts (`error 0`…
`error 24`) normalize down to ~11 fingerprints — `normalizeLine` rewrites
multi-digit numbers to `<N>` — so a collapsed list never exceeds the 20-item cap
and the "...and N more" notice never fires. The section's overflow contract
counts *occurrences*, not distinct fingerprints, so the list must stay flat. The
cap + overflow already bound a flood of repeats. Dropped along with grouping:
the per-group origin and fingerprint-key transparency badges (they cannot
coexist with the single-badge `itemRow`, and the fingerprint-key note leaked the
raw excerpt — the very thing test 2 forbids). The `category` badge is retained.

## Tests Added

No new tests. The three pre-existing assertions in `signal-report-related.test.ts`
now pass; the full file is **13/13 green** (`node --test out/test/ui/signal-report-related.test.js`).
`npm run check-types` and `eslint` on the file are clean.

## Commits

<!-- Uncommitted at time of fix (not requested). Add commit hashes as fixes land. -->

## Follow-up (out of scope, needs permission)

`src/ui/signals/signal-report-related.js` is a stale compiled twin in `src/` — it
is git-ignored (not tracked), so it is harmless but should be removed during the
next cleanup.
