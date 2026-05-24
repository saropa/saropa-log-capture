# 052 — Plan: group all Flutter exception copies + fold render-tree descendant dumps

## Status: Fixed

## Problem

A single Flutter layout exception is logged several times (once per sink) and is
followed by a long indented render-tree dump. In the viewer:

1. **Only one copy of each exception grouped.** The banner detector matched only
   the stderr shape `════ Exception caught by …`. The console / wrapped copies —
   `══╡ EXCEPTION CAUGHT BY … ╞══`, `FlutterErrorDetails (══╡ …`, and
   `Potential Null Check Operator Error Detected: ══╡ …` — were never grouped.
   Measured on a real 4,793-line log: **16 of 46** headers grouped, **30 ungrouped**.

2. **The descendant tree was uncollapsible.** `This RenderObject had the
   following descendants (showing up to depth N):` plus its 15–40 indented
   `child…` rows had no handling and rendered as plain lines, burying the error.
   Real log: **30 such dumps, 438 child rows**.

## Root cause

1. `flutterBannerOpenRe = /═{4,}\s+Exception caught by/i` requires 4+ consecutive
   `═` then whitespace. The console shapes break the run after two `═` with the
   corner glyphs `╡` (U+2561) / `╞` (U+255E), so only the stderr shape matched.
2. No detector existed for the descendant-tree block.

## Fix

**Part 1 — `viewer-data-add-flutter-banner.ts`:** broaden the open detector to
`/[═╡╞]{2,}\s*Exception caught by\b/i`. The phrase is the
discriminator; the leading box-run (heavy-horizontal + the two corner glyphs)
guards against prose. ANSI is already converted to `<span>` upstream
(`ansiToHtml`) and stripped via `slp.msg`/`stripTags`, so the regex sees clean
text and the existing close-rule detection fires for every copy.

**Part 2 — new `viewer-data-add-tree-ingest.ts`:** `tryIngestTreeLine()` folds
the descendant dump into a collapsible group, **reusing** the stack-group item
types (`stack-header` + `stack-frame`) so the existing chevron, `toggleStackGroup`,
preview mode, and height/visibility calc apply with no new render code. A
`treeGroup` flag re-words the header tooltip (`renderStackHeader`) to "Render
tree" / "nodes". Owns its lifecycle via a separate `activeTreeHeader` so stack
dedup never silently hides a tree; reset on marker / clear / trim.
Wired into `addToData` after `tryIngestStackLine` (consumed before the banner
classifier, like stack frames). Child indentation is preserved (not stripped) —
it carries the tree hierarchy; `.line` is `white-space: pre-wrap`.

## Verification

- Open regex: all 4 header shapes match; 3 non-headers (incl. "no exception
  caught by …") rejected. Close regex fires on console close rule. (Node-verified.)
- Tree regexes vs. the real log: 30 headers, 438 child rows; 0 prose
  false-positives; child detection tolerates the `I/flutter ( pid):` prefix.
- Tests: `viewer-flutter-banner-group.test.ts` (behavioral — evals the script,
  asserts all 4 formats open a group) and new `viewer-tree-group.test.ts`.
- Gates: `check-types`, `lint`, `compile`, tests.

## Out of scope

Cross-stream **deduplication** (merging the stderr + console + FlutterErrorDetails
copies of the *same* incident into one group). Each copy still groups
individually; merging interleaved multi-stream copies is a separate, larger
feature. The `incident-range` context-menu already spans banner groups for
copy/select.
