# Bug 007 — Decoration Styles Test: `.deco-counter` assertion collides with `.deco-counter-row`

## Status: Fixed (pending review)

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Problem

The test "no standalone deco-counter color rule (parent handles it)" in `viewer-muted-decorations.test.ts` fails on `main`. It asserts the decoration CSS contains no `.deco-counter` rule, but uses a substring check that also matches the legitimately-present `.deco-counter-row` class (the collapse-affordance row). This is a too-broad **test** assertion, not a product defect.

```
not ok - no standalone deco-counter color rule (parent handles it)
  error: '.deco-counter rule should be removed — parent .line-decoration sets the grey'
  // assert !css.includes(".deco-counter")  → false, because ".deco-counter-row" contains the substring
```

## Environment (if relevant)

- Extension version: 7.13.0
- Discovered on: branch `main` (HEAD `c8f851aa`), pre-existing — fails on clean HEAD (verified by stash).
- Test file: `src/test/ui/viewer-muted-decorations.test.ts` (line 34)
- Source under test: `src/ui/viewer-styles/viewer-styles-decoration.ts` → `getDecorationStyles()`

## Reproduction

1. `npm run compile-tests`
2. `npm run test:file -- out/test/ui/viewer-muted-decorations.test.js`
3. The "no standalone deco-counter color rule" test reports `not ok`.

**Frequency:** Always

## Root Cause

`getDecorationStyles()` concatenates `getCollapseControlStyles()` (`viewer-styles-decoration.ts:200`). That style block defines `.deco-counter-row` and its `[data-affordance-kind]` variants (`viewer-styles-collapse-controls.ts:35-50`) — the per-row counter+chevron wrapper introduced by the severity-gutter / collapse-affordance work (plan 048).

The test's guard is a raw substring check:

```ts
assert.ok(!css.includes(".deco-counter"), ".deco-counter rule should be removed …");
```

`".deco-counter-row".includes(".deco-counter")` is `true`, so the assertion trips on the `-row` class even though the bare `.deco-counter { color: … }` rule the test was written to forbid is genuinely gone. The intent (no standalone `.deco-counter` color rule) is satisfied; the matcher is just imprecise.

Note: a stale compiled twin `src/ui/viewer-styles/viewer-styles-decoration.js` also exists in `src/`; the test imports the `.ts`.

## Changes Made

`src/test/ui/viewer-muted-decorations.test.ts` (the "no standalone deco-counter
color rule" test): replaced the substring guard

```ts
assert.ok(!css.includes(".deco-counter"), …);
```

with a word-boundary regex that rejects only the bare class:

```ts
assert.ok(!/\.deco-counter(?![\w-])/.test(css), …);
```

The negative lookahead `(?![\w-])` excludes `.deco-counter-row` (and any future
`.deco-counterX`) while still tripping on a real standalone `.deco-counter {`,
`.deco-counter:hover`, or `.deco-counter,`. A comment above the assertion
explains the collision so the matcher is not "simplified" back to a substring.
Test-only change — no product code touched; the bare `.deco-counter` color rule
the test forbids is genuinely absent (verified: `getDecorationStyles()` contains
only `.deco-counter-row` / `.deco-chevron`, never a bare `.deco-counter`
selector).

## Tests Added

No new test file. The existing assertion was corrected; the full file is
**8/8 green** (`node --test out/test/ui/viewer-muted-decorations.test.js`).

## Commits

<!-- Uncommitted at time of fix (not requested). Add commit hashes as fixes land. -->

## Follow-up (out of scope, needs permission)

`src/ui/viewer-styles/viewer-styles-decoration.js` is a stale compiled twin that
**is git-tracked** in `src/` (unlike the bug-006 twin, which is git-ignored).
A committed `.js` next to its `.ts` source is a repo-hygiene problem and should
be untracked/removed in a dedicated cleanup.
