# Copy Error/Warning line numbers offset by the session header length, plus context-line expansion

The log viewer's **Copy Error/Warning JSON** and **Copy Error/Warning** context-menu actions
reported line numbers taken directly from the webview's in-memory `allLines` array index
(`inc.lo + 1` / `inc.hi + 1`), rather than the log file's real line number. Every session log
begins with a header block (session metadata, launch config, git state — 40-50+ lines in a
typical session) that is stripped out before the content lines are loaded into `allLines`, so
the array index undercounts the true file line by the header's length. A capture reported as
`lineStart: 1127` was actually at file line 1176 — an offset of 49 lines, matching the header
block size of the log that surfaced the bug.

## Root cause

`viewer-file-loader.ts` already stamps each loaded line with `sourceLineNo`, a 1-based file line
number computed as `sourceLineOffset + index + 1` where `sourceLineOffset` is the header's line
count (`findHeaderEnd(...)`). This value is the established source of truth used throughout the
viewer — the gutter (`viewer-deco-content.ts`), screenshot-to-log-line matching
(`viewer-screenshots.ts`), and trouble-detail line lookup (`viewer-trouble-detail.ts`) all read
`item.sourceLineNo` instead of the array index.

`viewer-context-menu-block-copy.ts` was the one place that never adopted this convention — both
`copyIncidentBlockAsJson` (feeds the `lineStart`/`lineEnd` fields of the copied JSON payload) and
`copyLineRangePlain` (feeds the "Copied lines L-H" toast text) used the raw array index instead.

## Fix

Both functions now resolve `lo`/`hi` through `allLines[i].sourceLineNo`, falling back to
`index + 1` only when `sourceLineNo` is absent — the same fallback pattern already used in
`viewer-format-markdown-layout.ts`.

## Files changed

- `src/ui/viewer-context-menu/viewer-context-menu-block-copy.ts` — `copyIncidentBlockAsJson` and
  `copyLineRangePlain` now use `sourceLineNo`.
- `src/test/ui/viewer-context-menu.test.ts` — added a regression test asserting both functions
  resolve through `sourceLineNo` before falling back to the array index.
- `CHANGELOG.md` — recorded under `## [9.3.12]`.

## Verification

- `npm run check-types` — clean.
- `npm run compile-tests` + `npm run test:file -- out/test/ui/viewer-context-menu.test.js` —
  35 passing (34 pre-existing + 1 new).

## Related, not touched

The plain-text "Copy Error/Warning" toast fix was included in this same change (user confirmed
after the JSON fix was reported). `viewer-context-menu-line-actions.ts:226` (`explainWithAi`,
`lineIndex: sel.lo`) may have a similar array-index-vs-`sourceLineNo` gap, but that was flagged
to the user as a separate adjacent concern, not investigated or fixed here.

## Follow-up: surrounding-context expansion

As a `/finish` follow-up (user opted in via the reflection-gate checkbox), **Copy Error/Warning**
and **Copy Error/Warning JSON** were extended to include `saropaLogCapture.copyContextLines`
(default 3) lines of surrounding context before/after the incident, reusing the setting
`copy-with-source` already honors (`viewer-context-menu-line-actions.ts`). A new
`expandByContextLines(lo, hi)` helper clamps the expanded range to `allLines` bounds; severity
classification (`incidentBlockLevel`) still runs against the ORIGINAL incident range so a neutral
context line can never dilute the reported error/warning level — only the copied text and line
span grow. `copy-db-cluster-block` and `copy-ascii-art-block` were deliberately left exact (those
groupings are already complete logical units).

`package.nls.json`'s `config.copyContextLines.description` was updated to mention the new
call sites; per-locale translations were left as-is (translation is an operator-run, explicitly
triggered pipeline — not run in this session) and will read slightly stale until the next
translation pass, which is normal/expected drift per the project's l10n process.

### Additional test coverage

- `src/test/ui/viewer-context-menu-block-copy.test.ts` (new): evals the actual generated webview
  script via `Function(...)` (same pattern as `viewer-copy-json.test.ts`) and exercises
  `copyIncidentBlockAsJson` / `handleBlockCopyAction` directly — covering the `sourceLineNo` fix,
  its undefined-fallback branch, a mixed-endpoint case, context-line expansion, boundary clamping,
  and that expansion never changes the reported severity level. 7 tests, all passing.
- `src/test/ui/viewer-context-menu.test.ts` — updated the pre-existing string-presence assertion
  (variable names changed from `inc.lo`/`inc.hi` to `xJ.lo`/`xJ.hi` after the expansion refactor)
  and added a check for `expandByContextLines`' presence.

### Verification

- `npm run compile` (full pipeline: typecheck, lint, all `verify:*` gates, dist bundle) — clean.
- `npm run test:file` across `viewer-context-menu.test.js`, `viewer-context-menu-block-copy.test.js`,
  `viewer-file-loader.test.js`, `viewer-copy-json.test.js` — 35 passing, 0 failing.

### Noted, not fixed

`src/test/ui/viewer-context-menu.test.ts` was already over the project's 300-line file limit
(379 lines) before this session touched it; the new test pushed it to 393. Flagged per the
project's out-of-scope-refactor policy rather than restructured as part of this bug fix.
