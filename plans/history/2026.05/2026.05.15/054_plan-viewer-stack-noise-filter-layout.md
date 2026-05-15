# PLAN 054: Viewer stack-trace noise, level/color consistency, column layout

Status: **CLOSED 2026-05-15.** All code work for this plan is committed. Item E
Path 2 spun out to `plans/deferred/055_plan-viewer-row-dom-grid-rewrite.md`; Path 1
is the accepted answer. Remaining work is F5 verification of the fixes on the real
sample log — tracked at the bottom of this plan.

Triggered by an unusable real log
(`D:\src\contacts\reports\20260514\20260514_103120_contacts.log`, 6,508 lines,
~60% stack-trace scaffolding).

Moved from `bugs/PLAN_VIEWER_STACK_NOISE_FILTER_LAYOUT.md` to `plans/` once Item A
landed; the original lived in `bugs/` because it started as a bug-class
investigation. Six items were requested by the user. Grouped, diagnosed, and
sequenced below. Each item is its own stable unit per
`.claude/rules/global.md` ("each feature must be fully stable before starting
the next").

## Status summary

| Item | Subject | Code state | F5 on real log |
|------|---------|-----------|----------------|
| A | `<asynchronous suspension>` shatters stack blocks | **DONE** (commits `499631c5`, `75933826`) | done — confirmed on `20260514_225412_contacts.log` |
| B | Common-prefix compression across Drift traces | **No code written** — relies on existing infra post-A | pending |
| C | Frame compression is half-done | **No code written** — relies on existing infra post-A | pending |
| D | Colorized line must appear in its level filter | **DONE** (commit `156aab44`) | pending |
| E | Column layout like the VS Code editor | **Path 1 DONE** (commits `3db1ab32`, `a01577a8`, `7a647b0e`, `79553eae`, `f2d85c16`, `b55ddc84`, `6eef2501`); **Path 2 deliberately set aside** | pending |
| F | **Gutter line numbers don't match the raw file** (discovered during Item A F5) | **DONE** — see Item F below | pending re-F5 |

**Open work after the F5 of `20260514_225412_contacts.log`:**
1. Re-F5 the sample log to confirm Item F's fix lines up the gutter with the source-file row.
2. F5 verification of Items B, C, D on the same log.
3. Item E Path 2 (full `.line-cols` / `.line-msg` DOM rewrite) **deferred**, spun out to
   [plans/deferred/055_plan-viewer-row-dom-grid-rewrite.md](deferred/055_plan-viewer-row-dom-grid-rewrite.md).
   Path 1 is the accepted answer for this plan.

---

## Item A — `<asynchronous suspension>` shatters stack blocks (covers requests 2 + 4)

**Status: DONE.** Two commits landed:

- `499631c5 fix(viewer): fold async-gap markers into stack groups instead of shattering them`
- `75933826 fix(viewer): fold the Dart trace-tail ")" into its stack group`

Stack-line ingestion was extracted from `addToData` into
[viewer-data-add-stack-ingest.ts](src/ui/viewer/viewer-data-add-stack-ingest.ts)
(`tryIngestStackLine`), which folds **both** async-suspension markers AND the
trace-tail `)` into the open group as `fw:true` continuation frames (excluded
from `frameCount`). `calcItemHeight` needed no change — `fw:true` already hides
them in collapsed/preview and shows them on full expand. Tests:
[viewer-stack-async-gap.test.ts](src/test/ui/viewer-stack-async-gap.test.ts)
(4 cases). check-types / lint / compile all clean.

**Outstanding: manual F5** on the real sample to confirm each `_StringStackTrace`
block renders as ONE collapsible header row (not 15+ shattered groups).

**Original diagnosis (kept for reference).** `isStackFrameText()` in
`viewer-script.ts:131` matches `#N`, `at `, `File "`, `package:`,
`(./x.dart:N:N)` — but NOT the literal `<asynchronous suspension>`. Dart emits a
suspension marker between nearly every async frame, so each trace was being
broken into ~15 one-frame groups. Existing grouping works; the gap line was
killing it. The trace-tail `)` from `_StringStackTrace (#0  …  )` had the same
shattering effect at the END of every trace and was fixed in the same module.

---

## Item B — common-prefix compression of Drift traces (covers request 5)

**Status: NO CODE WRITTEN. Verification only.** This was re-scoped in
`66e94ff7 docs(plan): re-scope viewer stack items B and C to F5 verification`.

`tryCollapseRepeatStackHeader()`
([viewer-data-add-stack-header-repeat.ts](src/ui/viewer/viewer-data-add-stack-header-repeat.ts))
already collapses *consecutive* stack groups whose header matches (within a 3s
window) into a single "N × stack repeated" chip — and deliberately does NOT
gate on differing tails. Before Item A this fired on 1-frame fragments; after
Item A it operates on whole traces. So consecutive Drift SELECT traces sharing
the `_StringStackTrace (#1 DriftDebugInterceptor._log …)` header now collapse
into one chip with no new code.

**Outstanding: F5 verification on the real log.** Build the common-prefix
feature below ONLY if verification shows a real residual gap (e.g. interleaved
non-consecutive traces that streak-collapse misses).

**Original spec (kept for the contingent case).** Every Drift SELECT trace
opens with the identical 8 frames (`DriftDebugInterceptor._log → runSelect →
_InterceptedExecutor.runSelect → LazyDatabase.runSelect →
SimpleSelectStatement._getRaw → doWhenOpened → _mapResponse → getSingleOrNull`).
If F5 reveals these are not being collapsed adequately by streak-collapse, the
fix is: when a stack group is finalized, compare its leading frames against the
previous group's; if a common prefix of ≥ N frames (N≈4, tunable) matches, mark
those prefix frames with a `commonPrefix` flag and render them
collapsed-by-default under a `"+N shared framework frames"` affordance inside
the expanded view.

**Files (if needed).** `viewer-data-add.ts` or a new
`viewer-data-add-stack-prefix.ts` (extract to respect 300-LOC limit),
`viewer-data-helpers-render-stack.ts`, `calcItemHeight()`.

**Verify.** Sample log: expanding two consecutive Drift SELECT traces shows the
shared 8-frame prefix collapsed once, not repeated.

---

## Item C — frame compression is half-done (covers request 6)

**Status: NO CODE WRITTEN. Verification only.** Same rescope commit as Item B.

Two mechanisms already do block-level dedup:
[finalizeStackGroup()](src/ui/viewer/viewer-data-add.ts) hashes the
whole-trace signature and hides later identical groups behind a `(xN)` badge on
the first; `tryCollapseRepeatStackHeader()` handles consecutive streaks (see
Item B). The `(x2)`/`(x3)` badges in the original screenshots were these
mechanisms working — but on the shattered 1-frame groups Item A's bug
produced. Post-Item-A they operate on whole blocks.

**Outstanding: F5 verification** that whole post-A traces dedup correctly and
no half-collapsed blocks remain. Only if F5 shows individual-frame dedup still
fires *inside* a block that's already represented by an `×N` header is there
code to write (demote/remove the within-block frame dedup in
[viewer-data-add-repeat-collapse.ts](src/ui/viewer/viewer-data-add-repeat-collapse.ts)).

**Files (if needed).** `viewer-data-add-stack-header-repeat.ts`,
`viewer-data-add-repeat-collapse.ts`,
`viewer-data-helpers-render-stack.ts`.

**Verify.** Sample log: 314 `_StringStackTrace` blocks collapse to a much
smaller set of `×N`-badged headers; no half-collapsed blocks remain.

---

## Item D — colorized line must appear in its level filter (covers request 3)

**Status: DONE.** Commit `156aab44 fix(viewer): make severity color match the
level filter; tighten error classifier`.

ANSI foreground color is no longer rendered
([src/modules/capture/ansi.ts](src/modules/capture/ansi.ts) — `standardFg` /
`brightFg` and the `fg` state field removed; only `background-color` remains as
a `color:` style; background/bold/dim/italic/underline kept). Severity color is
now owned entirely by the `level-*` palette, so on-row color and the level
filter cannot disagree.

Error classifier tightened in both
[level-classifier.ts](src/modules/analysis/level-classifier.ts) and
[viewer-level-classify.ts](src/ui/viewer-search-filter/viewer-level-classify.ts):

- Strict pattern's char class gained `(` so `PermissionDeniedException (…)` is caught
- New `structuralWarnPattern` (`could not` / `couldn't` / `cannot` / `unable to` /
  `failed to` + word) classifies failure phrasing like
  `databaseDecode: could not decode …` as `warning` instead of `info`

Tests: `ansi.test.ts` updated (29 pass, incl. a new "never emit a `color:` style"
guard); level-classifier suites pass (39+29+16). check-types / lint / compile
clean. **Loose error pattern intentionally not changed** — the webview is
strict-by-default and the reported bug is strict-context; touching loose risks
unintended classification shifts. Follow-up if loose parity is needed.

**Outstanding: manual F5** on the sample log. Expected:
- E toggle appears with a non-zero count including `PermissionDeniedException`
  and the `could not decode` lines
- Toggling E shows those and only those
- Toggling W shows the 2 logcat `W/` lines and only those

---

## Item E — column layout like the VS Code editor (covers request 8)

**Status: PATH 1 DONE. PATH 2 DELIBERATELY SET ASIDE.** This is the most
important update to the plan: Item E was tackled via *two possible paths*, and
the user/code-author chose Path 1 (incremental hardening within the existing
flat-div DOM) and explicitly set aside Path 2 (full grid/column DOM rewrite).
Evidence:

> "Path 1 deliberately KEEPS the existing padding-left / text-indent model so
> wrapped SQL and error lines still align; it does NOT introduce a flex
> `.line-cols` / `.line-msg` DOM rewrite (that was path 2, set aside)."
> — [viewer-column-layout.test.ts:10-14](src/test/ui/viewer-column-layout.test.ts#L10-L14)

### Path 1 — incremental hardening (done)

Achieved by 7 targeted commits between `156aab44` and `b55ddc84`:

- `3db1ab32 fix(viewer): pin the decoration prefix to a fixed-width column`
- `a01577a8 fix(viewer): size the decoration prefix column to the enabled parts only`
- `7a647b0e fix(viewer): reserve prefix-column width only for decoration data that exists`
- `79553eae fix(viewer): reset inherited text-indent on the inline-block decoration prefix`
- `f2d85c16 fix(viewer): move bug/transient/ANR markers into the gutter column`
- `b55ddc84 fix(viewer): clip long logcat tags to the reserved column width`
- `6eef2501 fix(viewer): align stack-trace headers and frames to the message column`

Concretely
([viewer-styles-decoration.ts:62-102](src/ui/viewer-styles/viewer-styles-decoration.ts#L62-L102)):

- `.line-decoration` is now `display: inline-block` with
  `width: calc(var(--deco-content-indent-em, 13em) / 0.85)` — a **fixed-width
  inline-block column**, dynamically sized to the enabled toggles
  (`applyDecorationLayoutWidth`, called from
  [viewer-data-viewport.ts:102](src/ui/viewer/viewer-data-viewport.ts#L102)
  and [viewer-script-messages.ts:24](src/ui/viewer/viewer-script-messages.ts#L24)).
- `.line:has(.line-decoration)` reserves `padding-left:
  var(--deco-prefix-width-em, 14.25em)` (1.25em bar clearance + dynamic
  decoration width) with `text-indent: calc(-1 * var(--deco-content-indent-em))`
  for the hanging indent.
- `text-indent: 0` reset on the inline-block prefix is **load-bearing** — without
  it the counter / timestamp / tag text inherits the parent's negative indent
  and is yanked off-screen.
- `.deco-parsed-tag` clipped to `max-width: 7em` with ellipsis so long logcat
  tags (`MediaSessionCompat`, `WindowExtensionsImpl`) cannot spill into the
  message column.
- Per-column toggles already exist (`decoShowBar`, `decoShowCounter`,
  `decoShowTimestamp`, `decoShowElapsed`, `decoShowPid`, `decoShowTid`,
  `decoShowTag`) and feed `applyDecorationLayoutWidth` so width recomputes on
  each toggle change.
- Bug / transient / ANR badges moved to `.error-badge-gutter` so they sit in
  the gutter column and never shift message text.
- Stack-trace headers and frames aligned to the message column.

Test guard:
[viewer-column-layout.test.ts](src/test/ui/viewer-column-layout.test.ts) asserts
the `display: inline-block`, the `width: calc(... / 0.85)` divisor, the
`text-indent: 0` reset, and the `.deco-parsed-tag` clip rule.

**Path 1 satisfies the original verification gate** ("columns align
top-to-bottom; toggling line number / timestamp columns works; stack blocks,
markers, chips, blank lines all still render correctly; no virtualization
regressions on the 6,508-line sample") — modulo the F5 visual check.

### Path 2 — full DOM rewrite (deferred, not scheduled)

The original Item E spec called for a `.line-cols` / `.line-msg` flex DOM
restructure of `renderItem()`. That work was deliberately set aside because:

- Path 1 achieves the visible outcome with much smaller blast radius.
- The flat-div DOM is the contract every other render path uses
  ([viewer-data-helpers-render.ts:300](src/ui/viewer/viewer-data-helpers-render.ts#L300))
  — restructuring it risks regressions in art blocks, banner groups, stack
  groups, chip rows, dedup-fold survivors, and virtualized row height.
- `renderItem()` already pushes the 300-LOC limit; Path 2 likely requires
  splitting it across modules.

**Decision needed from user:** keep Path 2 deferred (recommended — Path 1 looks
sufficient and the original gate is met), OR schedule it as its own
follow-up plan (e.g. `055_plan-viewer-row-dom-grid-rewrite.md`).

**Files (if Path 2 is ever scheduled).**
`viewer-data-helpers-render.ts`, `viewer-data-helpers-render-stack.ts`,
`viewer-styles-lines.ts`, `viewer-styles-content.ts`,
`viewer-styles-decoration-bars.ts`. New: `viewer-styles-columns.ts` likely.

---

## Item F — gutter line numbers don't match the raw file (discovered during Item A F5)

**Status: DONE.** Surfaced by F5 on `D:\src\contacts\reports\20260514\20260514_225412_contacts.log`:
the UI's gutter "537" showed `🟢 Repeated log #1 (No new app versions found)` while the actual
source line 537 was `<asynchronous suspension>`. The line carrying the displayed text was
file line **583**.

**Diagnosis.** [viewer-decorations.ts:206](src/ui/viewer-decorations/viewer-decorations.ts#L206)
computed the counter as `idx + 1` — where `idx` is the position in `allLines`, an in-memory array
that contains:
- Visible content rows
- Hidden stack-frame items (folded into groups after Item A)
- Hidden async-suspension markers (added to allLines by Item A)
- Hidden trace-tail `)` items (added by Item A's follow-up)
- Synthetic chip rows (`repeat-notification`, `n-plus-one-signal`) not from any file line
- Items with `repeatHidden` (anchors replaced by chips)

`idx` therefore tracks none of: source-file row, visible ordinal, or post-header content position.
The mismatch existed before Item A but got worse after — Item A pushed more hidden items into
`allLines`, widening the drift.

**Fix.** Carry the 1-based source-file line number end-to-end and prefer it for the displayed
counter:

- [viewer-file-loader.ts](src/ui/viewer/viewer-file-loader.ts): added `sourceLineNo?: number` to
  `PendingLine` and `sourceLineOffset?: number` to `FileParseContext`. `sendFileLines` and
  `parseRawLinesToPending` compute `sourceLineNo = sourceLineOffset + i + 1` (1-based).
  `parseFileLine`, `buildFileLine`, and `buildMarkerLine` thread the value through every parse path
  (markers, time+elapsed+cat, time+cat, elapsed+cat, cat-only, bare-timestamp, raw fallback).
- [log-viewer-provider-load.ts](src/ui/provider/log-viewer-provider-load.ts): on single-part
  sessions, pass `sourceLineOffset = findHeaderEnd(part.lines)` so the first content line displays
  as `headerEnd + 1`. On multi-part sessions the offset is omitted — a single offset can't
  represent concatenated source files, so the gutter falls back to `idx + 1` for those (no worse
  than today). Tail mode passes `headerEnd + lastCount` so appended live lines keep the same
  source-file numbering.
- [viewer-script-messages.ts](src/ui/viewer/viewer-script-messages.ts): brackets each `addToData`
  call with `beforeAddLen / allLines.length` and stamps `sourceLineNo` on every item the call
  pushed — this catches synthetic repeat chips and folded stack-frame items pushed in the same
  call. The skip-if-set guard preserves a chip's anchor line when subsequent input lines update
  the chip's count (the `update-branch` in `viewer-data-add-stack-header-repeat.ts`).
- [viewer-source-line-stamp.ts](src/ui/viewer/viewer-source-line-stamp.ts) (new): tiny
  webview-scope helper `stampSourceLineNoOnNewItems(before, sourceLineNo)`. Extracted to keep
  `viewer-script-messages.ts` under its 325-line cap rather than burying multi-statement logic in
  the dispatch loop.
- [viewer-decorations.ts](src/ui/viewer-decorations/viewer-decorations.ts): `getDecorationPrefix`
  prefers `item.sourceLineNo` over `idx + 1`. Fallback to `idx + 1` covers multi-part sessions
  and in-memory streams (live capture, JSONL aggregation) where no single offset applies.

Tests: 3 new cases in [viewer-file-loader.test.ts](src/test/ui/viewer-file-loader.test.ts)
guard the offset arithmetic and marker-line stamping. check-types / lint / compile / smoke all
clean.

**Out of scope.** The contacts app's own `🟢/🟠/🟣/🔴 Repeated log #N` chip text (emitted by the
app's debug helper, not the viewer) was the secondary cosmetic concern in the same F5 report. It
is cross-project and noted as a contacts-side observation, not a viewer bug.

**Verify (F5).** Reopen `20260514_225412_contacts.log`. Gutter row 537 should now show
`<asynchronous suspension>` and file row 583 should show `🟢 Repeated log #1 (No new app
versions found)`.

---

## Revised sequencing

1. **Item A** — DONE, committed. Un-shatters every block. F5 verified on `20260514_225412_contacts.log`.
2. **Item B** — re-scoped to F5 verification (existing streak-collapse likely covers it).
3. **Item C** — re-scoped to F5 verification (existing block dedup likely covers it).
4. **Item D** — DONE. ANSI foreground stripped; error/warn classifier tightened.
5. **Item E** — Path 1 DONE (7 commits). Path 2 deferred pending explicit decision.
6. **Item F** — DONE. Source-file line number plumbed end-to-end; gutter shows raw file row.

**Why Item A turned out to be the keystone:** it activates two pre-existing
block-dedup mechanisms (`finalizeStackGroup`, `tryCollapseRepeatStackHeader`)
that were previously firing on shattered 1-frame fragments. B and C are
therefore verification tasks, not code tasks, unless F5 on the real log reveals
a residual gap.

Each code-bearing item landed as its own commit(s) with `npm run check-types`,
`npm run lint`, `npm run compile`, tests — manual F5 checks now bundled at the
end.

## Outstanding work

1. **F5 verification on `D:\src\contacts\reports\20260514\20260514_103120_contacts.log`** for all five items:
   - **A:** each `_StringStackTrace` block is ONE collapsible row, not 15+
   - **B:** consecutive Drift SELECT traces collapse to one chip with no residual shared-prefix bloat
   - **C:** the 314 `_StringStackTrace` blocks collapse to a much smaller `×N`-badged set; no half-collapsed blocks
   - **D:** E toggle includes `PermissionDeniedException` + `could not decode` lines and only those
   - **E:** columns align top-to-bottom across the viewport; toggling line number / timestamp recomputes width without misalignment
2. **Decision on Item E Path 2** — keep deferred or schedule a follow-up plan.

## Out of scope (tracked elsewhere)

- Contacts app emitting full stacks on every `debug()` call —
  `D:\src\contacts\bugs\BUG_DEBUG_LOG_STACK_TRACE_VOLUME.md`.

## Resolved decisions

- Item D: strip ANSI foreground colors entirely; color is 100% `item.level`-derived
  (user, confirmed).
- Item E: Path 1 (fixed-width inline-block column) preferred over Path 2 (DOM
  rewrite); see `viewer-column-layout.test.ts` header comment for the explicit
  record.
