# PLAN: Viewer stack-trace noise, level/color consistency, column layout

Status: DRAFT — awaiting approval. Triggered by an unusable real log
(`D:\src\contacts\reports\20260514\20260514_103120_contacts.log`, 6,508 lines,
~60% stack-trace scaffolding).

Six items requested by the user. Grouped, diagnosed, and sequenced below. Each item is
its own stable unit per `.claude/rules/global.md` ("each feature must be fully stable
before starting the next").

---

## Item A — `<asynchronous suspension>` shatters stack blocks (covers requests 2 + 4)

**Status: DONE.** `isAsyncGapText()` added to `viewer-script.ts`; stack-line ingestion
extracted from `addToData` into `viewer-data-add-stack-ingest.ts` (`tryIngestStackLine`),
which folds async gaps into the open group as `fw:true` continuation frames (excluded
from `frameCount`). `calcItemHeight` needed no change — `fw:true` already hides them in
collapsed/preview and shows them on full expand. Tests: `viewer-stack-async-gap.test.ts`
(4 cases). check-types / lint / compile clean. Manual F5 still pending.

**Diagnosis (confirmed).** `isStackFrameText()` in `viewer-script.ts:131` matches `#N`,
`at `, `File "`, `package:`, `(./x.dart:N:N)` — but NOT the literal
`<asynchronous suspension>`. In `viewer-data-add.ts`, a line that fails
`isStackFrameText()` falls through to line 152, which calls `finalizeStackGroup()` and
clears `activeGroupHeader`. Dart emits a suspension marker between nearly every async
frame, so each trace is broken into ~15 one-frame groups. Existing grouping works; the
gap line kills it.

**Fix.** Treat `<asynchronous suspension>` as a stack-group continuation:
- Add a recognizer (e.g. `isAsyncGapText(html)`) — exact match on trimmed
  `<asynchronous suspension>`.
- In `viewer-data-add.ts`, when `activeGroupHeader` is set and the line is an async gap,
  push it as a `stack-frame` (or a new lightweight `type: 'stack-gap'`) into the active
  group instead of closing the group. Inherit `level`/`levelFiltered`/`groupId` from the
  header like other frames.
- `calcItemHeight()` (`viewer-data-helpers-core.ts:223`): async-gap rows render height 0
  whenever their header is `collapsed` (true or `'preview'`) — same as framework frames.
  When the user expands the block, gaps show at normal height (request 2: "keep them
  expandable"). Never delete the data.
- Confirm an async gap arriving with NO active header (orphan) stays a normal line — do
  not let it start a group.

**Files.** `viewer-script.ts` (recognizer), `viewer-data-add.ts` (grouping branch),
`viewer-data-helpers-core.ts` (height), possibly `viewer-data-helpers-render-stack.ts`
(dim styling for gap rows).

**Verify.** Load the sample log; each `_StringStackTrace` block is ONE collapsible header
row. Expanding shows frames + gaps. Test added: a synthetic trace with suspension markers
yields exactly one group.

---

## Item B — common-prefix compression of Drift traces (covers request 5)

**Status: RE-SCOPED to verification — likely already covered by Item A.** Investigating
the dedup infrastructure showed `tryCollapseRepeatStackHeader()`
(`viewer-data-add-stack-header-repeat.ts`) already collapses *consecutive* stack groups
whose header line matches (within a 3s window) into a single "N × stack repeated" chip —
and it deliberately does NOT gate on differing tails (see its "No frameCount gate" note).
Before Item A, traces were shattered into 1-frame groups so this fired on fragments;
after Item A it operates on whole traces. So consecutive Drift SELECT traces sharing the
`_StringStackTrace (#1 DriftDebugInterceptor._log …)` header should now collapse into one
chip with no new code. **Action: verify in F5 on the real log before writing anything.**
Build the common-prefix feature below ONLY if verification shows a real residual gap
(e.g. interleaved non-consecutive traces that the streak logic misses).

**Original diagnosis.** Every Drift SELECT trace opens with the identical 8 frames
(`DriftDebugInterceptor._log → runSelect → _InterceptedExecutor.runSelect →
LazyDatabase.runSelect → SimpleSelectStatement._getRaw → doWhenOpened → _mapResponse →
getSingleOrNull`). `tryCollapseRepeatStackHeader()` only collapses *whole identical*
traces; it does not compress a shared prefix across traces that differ in their tail.

**Fix.** Depends on Item A (blocks must be whole first). When a stack group is finalized,
compare its leading frames against the previous group's; if a common prefix of ≥ N frames
(N≈4, tunable) matches, mark those prefix frames with a `commonPrefix` flag and render
them collapsed-by-default under a `"+N shared framework frames"` affordance inside the
expanded view. Header preview already shows app frames first, so this only affects the
expanded state.

**Files.** `viewer-data-add.ts` or a new `viewer-data-add-stack-prefix.ts` (extract to
respect 300-LOC limit), `viewer-data-helpers-render-stack.ts`, `calcItemHeight()`.

**Verify.** Sample log: expanding two consecutive Drift SELECT traces shows the shared
8-frame prefix collapsed once, not repeated.

---

## Item C — frame compression is half-done (covers request 6)

**Status: RE-SCOPED to verification — block-level dedup already exists.** Two mechanisms
already do block-level dedup: `finalizeStackGroup()` (`viewer-stack-dedup.ts`) hashes the
*whole-trace signature* and hides later identical groups behind a `(xN)` badge on the
first; `tryCollapseRepeatStackHeader()` handles consecutive streaks (see Item B). The
`(x2)`/`(x3)` badges in the original screenshots were these mechanisms working — but on
the shattered 1-frame groups Item A's bug produced. Post-Item-A they operate on whole
blocks. **Action: verify in F5 that whole post-Item-A traces dedup correctly and no
half-collapsed blocks remain.** Only if verification shows individual-frame dedup still
fires *inside* a block that's already represented by an `×N` header is there code to
write (demote/remove the within-block frame dedup).

**Original diagnosis.** The `(x2)`/`(x3)` badges (`stack-dedup-badge`, `dupCount`) currently
compress *individual repeated frame lines*, not whole blocks. Result: a partially
collapsed block where some frames merged and the block structure is still sprawled.

**Fix.** Depends on Items A + B. Once blocks are whole and prefixes are compressed,
re-scope dedup to operate at the block level: identical *blocks* collapse to one header
with an `×N` badge (this is what `tryCollapseRepeatStackHeader` already aims at — verify
it now works correctly post-Item-A, since previously it never saw whole blocks).
Individual within-block frame dedup should be removed or demoted so it cannot fire on a
block that is already represented by an `×N` header.

**Files.** `viewer-data-add-stack-header-repeat.ts`, `viewer-data-add-repeat-collapse.ts`,
`viewer-data-helpers-render-stack.ts`.

**Verify.** Sample log: 314 `_StringStackTrace` blocks collapse to a much smaller set of
`×N`-badged headers; no half-collapsed blocks remain.

---

## Item D — colorized line must appear in its level filter (covers request 3)

**Diagnosis.** Two independent severity systems disagree:
1. `classifyLevel()` (`viewer-level-classify.ts:98`) sets `item.level`, which drives both
   the E/W/I/P/N/D/DB toggle counts AND the `level-bar-{level}` gutter class.
2. ANSI color codes in the source are rendered into `item.html` independently — a line
   can show red/yellow text while `item.level` is `'info'`.

So a line *looks* like an error but is not counted under E (no E toggle appears), and the
W filter shows lines that are not visibly warnings. The user's rule: **if an item is
colorized as a severity, toggling that severity must show it, and only it.**

Also confirmed defects in `classifyLevel()` independent of ANSI:
- `strictStructuralErrorPattern` requires `Exception`/`Error` followed by `:` `]` `!` —
  `PermissionDeniedException (no OS grant…)` (parenthesis) falls through to `info`.
- `databaseDecode: could not decode … as DatabaseValueType.Json` matches no error/warn
  keyword → `info`.

**Fix.** Single source of truth = `item.level`. **Decision (user, confirmed): strip ANSI
foreground colors entirely** — every color the user sees is derived from `item.level`, so
color and filter membership are guaranteed identical.
- Stop rendering ANSI foreground color codes (`\e[3Xm`, `\e[9Xm`, `\e[38;…m`) into
  `item.html`. Color comes only from the `level-*` palette.
- ANSI may still be *read* as a weak classification input before being discarded (e.g.
  `\e[2m` dim is the one consistently-used code and can boost the "framework"
  classification) — but it never renders and never overrides a text signal. Confirmed
  noise in the sample: `\e[33m` yellow spans ~4 severities, `\e[32m` green just means "DB
  chatter".
- Tighten the error pattern: allow `Exception`/`Error` followed by whitespace/`(`/EOL,
  not only `:` `]` `!`. Add `could not decode` / `failed to decode` style structural
  cues. Mirror the change in extension-side `level-classifier.ts` (the two must stay in
  sync per the file header).
- Renderer: severity tint + gutter bar both driven by `item.level`. Verify the ANSI
  parser / `viewer-data-add` HTML build path so stripped foreground codes do not leave
  stray empty spans.

**Files.** `viewer-level-classify.ts`, `src/modules/analysis/level-classifier.ts`
(extension mirror), `viewer-data-helpers-render.ts` (color-from-level),
`viewer-styles-*` (palette). Tests: `level-classifier*.test.ts`.

**Verify.** Sample log: E toggle appears with a non-zero count including
`PermissionDeniedException` and the `could not decode` lines. Toggling E shows those and
only those. Toggling W shows the 2 logcat `W/` lines and only those.

---

## Item E — column layout like the VS Code editor (covers request 8)

**Diagnosis.** `renderItem()` (`viewer-data-helpers-render.ts:42`) emits a single flat
`<div class="line">` with optional inline decoration spans — not real columns. Severity
is a class on the div, seq/time live in one `line-decoration` span.

**Fix.** Restructure the row into fixed-position columns, all optional except text:
- Col A: severity glyph/bar (always reserved width).
- Col B: line number (optional, toggle).
- Col C: timestamp (optional, toggle).
- Col D…: existing optional decorations (elapsed, quality badge, source tag).
- Col N: message text (flex, wraps).
Use CSS grid or fixed-width spans so columns align down the whole viewport like an
editor gutter. Must preserve: virtualized row height (`calcItemHeight` returns one
`ROW_HEIGHT`), blank-line quarter-height, stack-frame indentation, search highlight,
context-line styling, art blocks.

**Risk.** Highest of the six — touches the DOM contract every other render path uses.
Sequenced LAST so Items A–D are stable first. Likely needs `renderItem()` split across
modules to stay under 300 LOC.

**Files.** `viewer-data-helpers-render.ts`, `viewer-data-helpers-render-stack.ts`,
`viewer-styles-lines.ts`, `viewer-styles-content.ts`,
`viewer-styles-decorations-bars.ts`. New: `viewer-styles-columns.ts` likely.

**Verify.** Manual F5 in Extension Host: columns align top-to-bottom; toggling line
number / timestamp columns works; stack blocks, markers, chips, blank lines all still
render correctly; no virtualization regressions on the 6,508-line sample.

---

## Sequencing

1. **Item A** — DONE, committed. Un-shatters every block.
2. **Item B** — re-scoped to F5 verification (existing streak-collapse likely covers it).
3. **Item C** — re-scoped to F5 verification (existing block dedup likely covers it).
4. **Item D** — independent of A–C; classification + color-from-level. Medium risk. **Next.**
5. **Item E** — last; biggest blast radius; rewrites the row DOM.

**Revised note:** Item A turned out to be the keystone — it activates two pre-existing
block-dedup mechanisms (`finalizeStackGroup`, `tryCollapseRepeatStackHeader`) that were
previously firing on shattered 1-frame fragments. B and C are therefore verification
tasks, not code tasks, unless F5 on the real log reveals a residual gap. Proceeding to
Item D (genuinely broken, independent) rather than writing speculative B/C code.

Each lands as its own commit(s) with `npm run check-types`, `npm run lint`,
`npm run compile`, tests, and an F5 manual check before the next begins.

## Out of scope (tracked elsewhere)

- Contacts app emitting full stacks on every `debug()` call —
  `D:\src\contacts\bugs\BUG_DEBUG_LOG_STACK_TRACE_VOLUME.md`.

## Resolved decisions

- Item D: strip ANSI foreground colors entirely; color is 100% `item.level`-derived
  (user, confirmed).
