# Lint-cleanup refactor: test verification and repair

The `max-lines` extraction refactor (`56e66452`) had not been validated against
the test suite before landing; running it surfaced four broken assertions in
webview-script tests that located code via raw string-position proxies
(case-label slicing, `indexOf` ordering, single-file source reads), which the
refactor's code movement invalidated without changing actual behavior.

## Investigation

`npm run compile-tests && npm run test` was run for the first time since
commit `56e66452` (17 files, extraction of 7 `max-lines`-violating webview
script/style/test files into 9 new sibling modules). Result: 4162 passing,
12 failing.

To separate pre-existing failures from refactor-caused regressions, a
temporary git worktree was created at the pre-refactor commit `d034ce73`
(`git worktree add`) and the full suite re-run there: 4162 passing (parent
had 4 more tests, later split into new sibling test files), 8 failing. The
same 8 failures reproduced at both commits — `redactSensitiveContent` (×2,
Bearer-token / multi-secret redaction regex gaps), `SessionManagerImpl`
(×4, `captureAll`/dropped-category/excluded-line/diagnostic-trace logging),
`ViewerSessionContextMenu` (×1, stale "Compare with Marked Log" menu-item
assertion left over from the bug 006/014 conflict), and the webview l10n
bridge (×1, two `vt()` keys — `viewer.session.empty`,
`viewer.session.scanFailed` — missing from the `__VT` map). None relate to
the lint-cleanup refactor or to any file it touched; they predate it.

The 4 refactor-caused failures were each traced to their root cause by
reading the extracted source alongside the failing test's assertion:

- **`viewer-script-null-guards.test.ts`** (2 failures): asserted the
  `clear`-handler's null guards by slicing the concatenated script between
  `case 'clear':` and `case 'updateFooter':`. The extraction moved the
  handler body into `handleClearMessage()` in a new sibling file
  (`viewer-script-messages-clear.ts`), leaving only a delegating call
  (`handleClearMessage(); break;`) between those two case labels — the
  guarded code the test looked for was no longer in that slice.
- **`viewer-stack-frame-click.test.ts`** (1 failure): asserted, via
  `script.indexOf(...)` position comparison, that the frame-click branch's
  text precedes the stack-header-toggle branch's text — encoding a real
  runtime-ordering requirement (a frame click must resolve to open-file
  before header-toggle logic can claim the event). The extraction moved
  header-toggle handling into `handleGroupToggleClicks()`
  (`viewer-script-click-handlers-groups.ts`), concatenated *before* the
  main click-handler file's text, so the header branch's literal
  `.closest('.stack-header')` substring now appears earlier in the
  concatenated script than the frame branch — even though the actual
  click-handler function (read directly) still evaluates the frame branch
  and returns before ever reaching the delegated `handleGroupToggleClicks(e)`
  call. The runtime guarantee was intact; only the test's text-position
  proxy for it was broken by the reordering.
- **`viewer-log-search-and-nav-contracts.test.ts`** (1 failure): read the
  raw source of `viewer-script-messages.ts` directly (not the concatenated
  script) to check the `searchMatchOptionsAlwaysVisible` case uses
  `msg.always === true` (a strict-equality regression guard). The
  extraction moved that case, along with 20 other minimap/toolbar/misc
  cases, into `viewer-script-messages-misc.ts`; the source file the test
  read no longer contained it.

## Changes

- `src/test/ui/viewer-script-null-guards.test.ts` — the two `clear`-handler
  guard tests now slice from `script.indexOf('function handleClearMessage')`
  instead of `script.indexOf("case 'clear':")`, correctly bounding the
  extracted function's body regardless of concatenation position.
- `src/test/ui/viewer-stack-frame-click.test.ts` — the ordering test now
  compares the frame branch's index against the index of the *delegating
  call site* `handleGroupToggleClicks(e)` (searched starting from the frame
  branch's own index, so it cannot match the function's definition site
  earlier in the concatenated text), which is a position proxy that
  actually tracks execution order regardless of where the callee's
  definition text was concatenated.
- `src/test/ui/viewer-log-search-and-nav-contracts.test.ts` — the
  `searchMatchOptionsAlwaysVisible` assertion now reads
  `viewer-script-messages-misc.ts` instead of `viewer-script-messages.ts`.

No production code changed; only the test files' means of locating the code
under test were corrected to match its new location/order. Committed as
`8cbefce3`.

## Tests

`npm run compile-tests && npm run test`: 4162 passing, 8 failing (the same 8
pre-existing, refactor-unrelated failures listed above — confirmed identical
before and after this fix by direct comparison against the `d034ce73`
worktree run).

## Other work in this session

- `docs/handover/finish_sweep_report.md` (gitignored, not committed) was
  updated: bug 010 reclassified from GOOD to ISSUE with the full story (an
  intervening verification pass found the logcat streaming path never
  called `broadcastLine`; the fix was already present in an unmerged stash
  and was reconciled in a later session); bug 021 annotated with the
  schema-vs-code-fallback gap found and closed after the original audit;
  a pre-existing arithmetic error in the summary table (CONCERN listed as
  28 when the list held 27, GOOD listed as 9 when the list held 10) was
  corrected.
- The local safety branch `safety/agent-rewrites-20260903` (commit
  `bb60806c`, a recovery snapshot from an earlier chaotic session whose
  content had been verified reconciled into `main` across two prior
  sessions) was deleted with explicit user confirmation.
