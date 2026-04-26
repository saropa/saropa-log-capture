# Bug 003 — Stack-Header Dedup Consistency

## Status: Fixed (in-tree; see `viewer-data-add-stack-header-repeat.ts` + tests)

## Problem

Identical single-frame stack headers are rendered one per line instead of collapsing into a "N × repeated" chip. SQL lines above and below the same block collapse correctly, so the user sees an inconsistent UX: the surrounding SQL repeats compress, but the stack headers between them do not.

Real example from a Drift debug interceptor:

```
14 × SQL repeated: SELECT * FROM "activities" ORDER BY rowid LIMIT 1000
⠀ » DriftDebugInterceptor._log (./lib/database/drift/drift_debug_interceptor.dart:92:5)
⠀ » DriftDebugInterceptor._log (./lib/database/drift/drift_debug_interceptor.dart:92:5)
⠀ » DriftDebugInterceptor._log (./lib/database/drift/drift_debug_interceptor.dart:92:5)
⠀ » DriftDebugInterceptor._log (./lib/database/drift/drift_debug_interceptor.dart:92:5)
... (14 total)
33 × SQL repeated: SELECT * FROM "country_cities" ORDER BY rowid LIMIT 1000
```

Expected: the 14 identical `DriftDebugInterceptor._log` headers collapse to a single "14 × repeated" chip, matching the SQL dedup above it.

## Environment

- Source: Flutter / Drift debug interceptor logs
- Marker: `⠀ »` (Saropa stack-frame marker)
- Format: each interceptor call produces a single-frame stack (header only, no body)

## Reproduction

1. Capture a Drift session where `DriftDebugInterceptor._log` fires repeatedly on identical or varied SQL.
2. Observe the viewer: SQL lines collapse via fingerprint dedup (`14 × SQL repeated`).
3. The identical interceptor headers between them do NOT collapse — one row per call.

**Frequency:** Always (any repeated single-frame stack).

## Root Cause

Stack-frame lines bypass the repeat-detection branch entirely. In [src/ui/viewer/viewer-data-add.ts:75](src/ui/viewer/viewer-data-add.ts#L75), `isStackFrameText(html)` matches (via the Dart-path regex at [src/ui/viewer/viewer-script.ts:181](src/ui/viewer/viewer-script.ts#L181)) and the function takes one of two early-return paths:

- **Inside an active group** ([viewer-data-add.ts:82-100](src/ui/viewer/viewer-data-add.ts#L82-L100)) — pushes a `stack-frame` item and returns at line 100.
- **No active group** ([viewer-data-add.ts:102-134](src/ui/viewer/viewer-data-add.ts#L102-L134)) — allocates a new `groupId`, pushes a `stack-header`, and returns at line 134.

Neither path reaches the repeat-hash logic at [viewer-data-add.ts:197-205](src/ui/viewer/viewer-data-add.ts#L197-L205). Non-frame lines flow past line 75 and get hashed — stack content never does. This was a reasonable default when stack traces were assumed to be multi-frame (frames inside one trace naturally repeat visually and belong under their header). But a single-frame "trace" emitted in a loop produces N separate 1-frame groups that look like duplicate rows and should collapse.

The trailing whitespace on the user's rows is irrelevant — the hash is never computed, so whitespace normalization doesn't matter here.

## Proposed Fix

Extend the repeat-hash path to cover the **new-group** branch only, so consecutive single-frame groups with identical header text collapse into a `repeat-notification` the same way non-frame lines do.

### Scope rules (must be tight)

1. **Only the new-group branch.** Frames inside an active group (`activeGroupHeader` truthy) keep the existing behavior — they belong to their parent trace and must not collapse independently.
2. **Match on header plain-text only, walk-back with two stopper categories.** When a new stack-header is about to be created, walk backward through `allLines`:
   - **Hard stoppers (return -1, reject match):** `marker`, `run-separator`. These are session / save boundaries — a post-marker repeat must not fold into a pre-marker streak even if the anchor text still hashes identically within `repeatWindowMs`.
   - **Streak-neutral (continue walking):** `stack-frame` (belongs to an earlier group, not a peer), `repeat-notification` (SQL chip between stack groups is routine noise, not a content boundary).
   - **Stop and compare:** any other type. If `stack-header` with matching plain-text hash and within `repeatWindowMs`, this is a repeat; otherwise reject.
3. **Any other line type between headers breaks the streak.** A regular `line` or `doc-item` between two matching headers means real content arrived — do not merge.
4. **Hash format.** `level + '::stackhdr::' + stripTags(html).trim().slice(0, 200)`. Namespaced so a stack header never collides with a regular line of the same text.
5. **Same repeat window** (`repeatWindowMs`) and **min-N threshold of 2** — matches the SQL path. No new tunables.
6. **Dedicated tracker** (`stackHdrRepeatTracker`) separate from the line-level `repeatTracker`, so SQL streaks and stack-header streaks don't cross-pollute. Reset on: marker, `fileMode !== 'log'`, and any non-frame line pushed to `allLines` normally (i.e., the shouldShowNormalLine branch, NOT the SQL `handleRepeatCollapse` branch since SQL chips are streak-neutral).

### Tradeoff accepted

Dropping the `frameCount === 1` rule that an earlier draft of this plan specified: the Drift interceptor case in the screenshot is a 2-frame stack (`_log` + `runSelect`) that repeats identically. Requiring `frameCount === 1` would fail to fold it — the same user-visible inconsistency this bug is about. The walk-back + header-text-match rule handles both lone headers and multi-frame stacks.

**Risk:** two genuinely different traces that share their top frame (e.g. a logging helper called from two sites) and fire within 3s would merge, losing the per-site stack detail. Bounded by:
- 3s repeat window (short).
- Any non-frame, non-SQL line between them resets the streak.
- Only the collapsed count is lost; the first stack's frames remain visible as the representative trace.

For the common Drift / logging-helper case where repeated calls produce deterministically identical stacks, this is the correct behavior.

### Implementation sketch

New file: `src/ui/viewer/viewer-data-add-stack-header-repeat.ts`. Contains:

- `stackHdrRepeatTracker` state object (anchorIdx, count, lastTimestamp, lastRepeatNotificationIdx).
- `resetStackHdrRepeatTracker()` for branches that break the streak.
- `tryCollapseRepeatStackHeader(html, plainFrame, lvl, ts, rawText)` — the main function.

In [viewer-data-add.ts:102](src/ui/viewer/viewer-data-add.ts#L102), call `tryCollapseRepeatStackHeader(...)` first. If it returns `true`, the header was absorbed into an existing streak:
- Anchor stack-header (at `prevHdrIdx`) is hidden: `height = 0`, `repeatHidden = true`, `collapsed = true` (hides its frames too).
- `repeat-notification` row is pushed (on count=2) or updated in place (count>2).
- `activeGroupHeader` is pointed at the hidden anchor so incoming frames for this repeat go into its (hidden) group — no metadata pollution since repeated calls produce identical frame content.
- Return early, skip the `nextGroupId++` / header push.

Otherwise fall through to the existing "allocate new group" code unchanged.

Reset points added:
- Marker branch ([viewer-data-add.ts:46-60](src/ui/viewer/viewer-data-add.ts#L46-L60)).
- `fileMode !== 'log'` branch ([viewer-data-add.ts:65-73](src/ui/viewer/viewer-data-add.ts#L65-L73)).
- Normal-line push branch (inside `shouldShowNormalLine === true`, after line 254). Does NOT reset inside `handleRepeatCollapse` — SQL chips are streak-neutral.

## Non-goals

- **Do NOT** fold frames *inside* an active group. The indented `» runSelect` children in multi-frame traces already belong to their header.
- **Do NOT** merge single-frame groups across a SQL line between them. The `14 × SQL` chip is a real boundary — the stack streak must reset when a non-frame non-marker line interrupts it.
- **Do NOT** change the repeat window, min-N threshold, or UI chip format.

## Risks / Things That Could Go Wrong

- **False merge of distinct incidents.** Two unrelated 1-frame stacks with identical headers (e.g. a logging helper fired from two call sites) would collapse. Mitigated by the same repeatWindowMs bound already used for SQL — distinct incidents further apart than the window don't merge.
- **Expanding/collapsing UX.** If a user expands the first `stack-header` of a run, the collapsed repeats behind it must stay reachable. Check how SQL `repeat-notification` handles drilldown and mirror it.
- **Classifier coverage.** `isStackFrameText` must still identify every frame format. The fix must not change the classifier — only what happens AFTER classification.

## Changes Made

### File 1: `src/ui/viewer/viewer-data-add-stack-header-repeat.ts` (new)

New module containing:
- `stackHdrRepeatTracker` state object (anchorIdx, count, lastTimestamp, lastRepeatNotificationIdx).
- `resetStackHdrRepeatTracker()` — clears streak state; called by streak-breaking branches.
- `findPrevStackHeaderForRepeat()` — walks back through `allLines` skipping streak-neutral items (markers, run-separators, stack-frames, SQL repeat-notification chips); returns the most recent stack-header index or -1.
- `buildStackHdrRepeatNotificationHtml(count, preview)` — mirrors the SQL chip's `<span class="repeat-notification">` shape so existing CSS applies.
- `tryCollapseRepeatStackHeader(html, plainFrame, ts, rawText)` — main entry. On match, hides the anchor header (`height=0`, `repeatHidden=true`, `collapsed=true` to hide its frames too), creates or updates a `repeat-notification` row flagged `stackHdrRepeat: true`, and points `activeGroupHeader` at the hidden anchor so any incoming frames flow into its (hidden) group. Computes level via `previousLineLevel()` to match the inheritance rule of the header-creation path.

### File 2: `src/ui/viewer/viewer-data-add.ts`

- Imported `getStackHeaderRepeatScript` and concatenated it into the emitted webview JS.
- Added `tryCollapseRepeatStackHeader(...)` call at the new-group branch (just before `var gid = nextGroupId++;`). If it returns `true`, skip normal header allocation.
- Added `resetStackHdrRepeatTracker()` calls in two streak-breaking branches: `fileMode !== 'log'` and the normal-line push branch. NOT added inside `handleRepeatCollapse` (SQL chips are streak-neutral). NOT added in the marker branch — `cleanupTrailingRepeats` there already restores the anchor, zeros the chip, AND resets the tracker; calling reset before cleanup would clear `anchorIdx` and leave the hidden anchor orphaned.

### File 3: `src/ui/viewer/viewer-data-helpers-core.ts`

- Extended `cleanupTrailingRepeats()` with a symmetric stack-header cleanup block at the top. When a marker arrives with `stackHdrRepeatTracker` active, un-hides the anchor, restores its `collapsed` to the default (`stackDefaultState`), zeroes the trailing chip's height, and clears the tracker. Mirrors the existing SQL anchor-restore logic so pure stack streaks (no SQL involvement) are handled.

### File 4: `eslint.config.mjs`

- Added `src/ui/viewer/viewer-data-add.ts` to the 325-line `max-lines` exception group. `addToData` is a dense dispatch state machine; the bulk of bug_003 logic lives in the new helper file, so only the entry point and three reset hooks were added to the main file. Justification comment added alongside the existing entries.

## Tests Added

### `src/test/ui/viewer-stack-header-repeat-sandbox.ts` (new)

VM-based sandbox that mirrors `viewer-sql-repeat-compression-sandbox.ts` but swaps the `isStackFrameText` stub for a real Dart-path classifier so the stack-frame branch in `addToData` actually fires. Exposes `activeGroupHeader` and `resetStackHdrRepeatTracker` on the VM context so tests can simulate the "non-frame content nulled activeGroupHeader but didn't reset my tracker" boundary (the real Drift pattern achieves this via SQL's `handleRepeatCollapse` path, which is out of scope to set up in unit tests).

### `src/test/ui/viewer-stack-header-repeat.test.ts` (new)

Seven regression tests for `tryCollapseRepeatStackHeader` + cleanup:

1. Three consecutive matching isolated stack-headers collapse to one anchor + one `stackHdrRepeat` chip with `"3 × stack repeated:"`; anchor marked `repeatHidden=true`, `height=0`, `collapsed=true`.
2. A plain-line between isolated matching headers resets the tracker via the normal-line-push reset hook → no chip, both headers remain.
3. Isolated headers with different plain-text hashes do not merge.
4. Isolated matching headers more than `repeatWindowMs` (3000 ms) apart do not merge.
5. Marker cleanup: trailing chip → anchor is restored (`repeatHidden=false`, `height>0`), chip zeroed, and a post-marker matching header starts a fresh anchor (walk-back's marker-stopper rule).
6. A SQL-style `repeat-notification` row injected between matching headers does not break the streak (Drift: SQL chip between identical interceptor stacks).
7. Two independent streaks separated by a plain-line each produce their own chip at count=2 — the second streak does not continue from the first's count.

All seven pass (`npx vscode-test --run out/test/ui/viewer-stack-header-repeat.test.js`).

## Commits

- `d7677f0a` fix(viewer): collapse repeating stack-headers matching SQL chip UX (bug_003)
