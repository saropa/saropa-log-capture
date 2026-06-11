# Fix 2 stale viewer-render tests + silence node:test pass flood

**Trigger:** User reported a red test run with two failures and asked to (1) fix the
failing test(s) and (2) "stop showing me passed tests" — the terminal was flooded
with one `✔ … (0.3622ms)` line per passing test.

## Finish Report (2026-06-11)

### Scope

(B) VS Code extension (TypeScript tests) + (C) scripts/config. No Flutter/Dart, no
webview runtime code, no user-facing strings. Two test-assertion edits, two new
build scripts, the vscode-test config, `package.json`, and `CHANGELOG.md`.

### Problem 1 — two failing Mocha tests

Both failures were **stale assertions** pinning pre-grid (Plan 055) output, not
regressions in shipped code:

- `src/test/ui/viewer-stack-frame-hidden-gap.test.ts` — the "no hidden gap" case
  asserted the frame still emits the `line-deco-spacer-only` alignment spacer.
  Plan 055 Phase 2 frames carry **no** decoration cell and nest in the message
  track via the CSS grid (documented in
  `src/ui/viewer/viewer-data-helpers-render-stack.ts:140-147`). `renderStackFrame`
  produces `sfDeco = ''` for that case, so there is no spacer and no
  `line-decoration` span. Assertion updated to `!out.includes('line-decoration')`.
- `src/test/ui/viewer-continuation-badge-render.test.ts` — asserted the literal
  `var msgInner = contBadge +`. The recent Flutter-exception banner feature
  prepends `bannerChevron`, so the source is now
  `var msgInner = bannerChevron + contBadge + elapsed + badge + catBadge + html;`
  (`src/ui/viewer/viewer-data-helpers-render.ts:341`). `contBadge` still leads the
  actual message body (before `html`), preserving the test's intent. Assertion
  updated to `renderScript.includes('contBadge + elapsed +')`; the companion guard
  `!renderScript.includes('html + contBadge')` is unchanged and still holds.

No source code changed for Problem 1 — only the two test files.

### Problem 2 — passing-test flood

Root cause: 28 of the project's test files use node's built-in runner
(`import test from 'node:test'`), not Mocha. When `@vscode/test-cli`'s Mocha
`require`s them, node's own runner auto-runs them at process exit using its default
`spec` reporter, which prints one line per passing test. That auto-run path cannot
be configured from any vscode-test/mocha setting (Mocha was already on the silent
`min` reporter).

Fix — split the runners (user chose this over "leave as-is" / "add convenience
script only"):

- `scripts/modules/test/node-test-files.mjs` (new) — scans `out/test/**/*.test.js`
  and classifies each file by whether its source imports `node:test`
  (quote-anchored regex so `node:assert` cannot false-match). Exports
  `listNodeTestFiles()` / `listMochaTestFiles()`. Falls back to `[]` when
  `out/test` is unbuilt.
- `scripts/modules/test/run-node-tests.mjs` (new) — runs `listNodeTestFiles()` via
  `node --test --test-reporter=dot`, propagating the child exit code. Fails loudly
  if the build is missing (so a skipped compile can't masquerade as green).
- `.vscode-test.mjs` — `files` now consumes `listMochaTestFiles()` (283 files), so
  node:test files are excluded from the Extension Host run entirely. Falls back to
  the broad glob if the scan returns nothing.
- `package.json` — added `"test:node"`; `"test"` now runs vscode-test **then**
  `npm run test:node`.

Side benefit: the node:test portion no longer boots the Extension Development Host,
so it runs far faster.

### Verification

- `npm run compile-tests` — clean.
- Full `npx vscode-test` (already-compiled out/) — **3260 passing, 0 failing**; the
  only `✔` lines are vscode-test's own "Validated version" / "Found existing
  install" downloader status, not test passes.
- `npm run test:node` — all 28 node:test files green, **dots only**, exit 0.
- Single-file reruns of the two fixed files: 2 passing + 11 passing.
- Scanner classification sanity-checked: 28 node:test / 283 Mocha, no node:test
  file leaked into the vscode-test `files` list.

### Section 4A audit

Grepped `src/test` for the touched tokens (`line-deco-spacer-only`, `var msgInner`,
`contBadge +`, `line-decoration`). Other files match (`viewer-flutter-banner-group`,
`viewer-ascii-art-block`, `viewer-severity-bar-connector`, `viewer-column-layout`,
`viewer-muted-decorations`) but no source changed, so none of their assertions are
affected — confirmed by the green full-suite run.

### Out of scope / unaffected

- `test:coverage` uses `vscode-test --file ./out/test/coverage-hook.js`, a `--file`
  override that does not read the config `files` list, so the split does not change
  coverage behavior. Left untouched.
- README verified — no product facts changed. Guides reviewed — no change.
  No `docs/launch/LAUNCH_TEST.md` item — no user-facing feature.
- No bug archive — task did not close a `bugs/*.md` file.

### Files changed

- `src/test/ui/viewer-stack-frame-hidden-gap.test.ts` (assertion)
- `src/test/ui/viewer-continuation-badge-render.test.ts` (assertion)
- `.vscode-test.mjs` (exclude node:test files)
- `package.json` (`test` + `test:node` scripts)
- `scripts/modules/test/node-test-files.mjs` (new)
- `scripts/modules/test/run-node-tests.mjs` (new)
- `CHANGELOG.md` (Fixed entry under 8.0.5)

Code committed in `c9e0042d`. This finish-report file lands in a follow-up commit.
