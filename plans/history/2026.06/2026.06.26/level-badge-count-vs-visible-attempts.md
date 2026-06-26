# Level badge count ≠ rows shown on focus — attempt history

**Status:** Fixed (commit 27c46391)

Symptom (user, 2026-06-26): badge says `E 32`, double-click the Error dot → **zero** rows.
Same family as `DB 202 → 1 row` and `D 81 → none` reported earlier the same day.

## Root cause (confirmed by reading the code, not guessed)

The badge count and the row filter use **two different level values** for the same line:

- **Badge count** — `updateStatsFromLines` (`src/ui/viewer/viewer-stats.ts:92`) runs raw
  `classifyLevel(plainText, category)` on every incoming `addLines` item. `E/gralloc4`,
  `E/Badge`, `E/FBI` → `error`. All 32 counted as errors.
- **Row filter** — `applyLevelFilter` matches `enabledLevels.has(item.level)`. But
  `addToData` (`src/ui/viewer/viewer-data-add.ts:135`) **demotes** device-other
  `error`/`warning` to `info` (plan 050: framework `E/` logcat is benign system noise).
  So those 32 rows carry `item.level === 'info'`, `originalLevel === 'error'`.

Soloing `error` enables only `error`; the 32 demoted rows are `level:'info'` → all filtered
out → zero visible, while the badge still reads 32. The two consumers are structurally
independent (`viewer-stats.ts` message listener vs the `addToData` loop in
`viewer-script-messages.ts:30`) and have silently diverged since the demotion landed.

The same split poisons the other direction: soloing `info` would *show* those rows
(level:info) but the `info` badge did **not** count them (raw said error) — so any per-line
demotion (device-other, ascii-art `viewer-data-add-ascii-art-detect.ts:135`, banner
override) breaks count↔filter agreement for *both* affected levels.

## Prior attempts this session (all real but none fixed the count split)

1. **Relax tiers on solo** — `resetTiersToAll()` wired into `soloLevel`
   (`viewer-stack-filter.ts`, `viewer-level-filter.ts`). Fixes the case where Device/External
   tier=`warnplus` hid an isolated level. Does **nothing** here: tiers were already `all`
   in the screenshot, and the rows are hidden by *level*, not tier.
2. **Drift inline-annotation frame misdetection** — guard in `isStackFrameLine` /
   `isStackFrameText` so `… » Member (./path.dart:line:col)` SQL lines are not eaten as
   stack frames. Fixes Drift rows vanishing, not the error-count split.

Both shipped in commit `cf5814c7`. They were correct for their own defects but the headline
"badge ≠ focus" grievance survives because the count is computed from a different level than
the filter.

## Why the next fix is different

The next change targets the **single-source-of-truth** violation directly: count the badge
from the *same* effective `item.level` the filter reads, instead of a parallel raw
`classifyLevel` pass. After it, every badge equals exactly what soloing that level shows,
for every level, because both read one field.

Open product decision before coding: counting effective level makes the Error badge drop
from 32 to the true app-error count (device `E/` noise counts as `info`). Alternative is to
keep 32 and make the *filter* error-aware of `originalLevel` — but that re-splits info↔error
the other way unless level is forked into filter-level vs color-level (larger refactor).
Recommend the effective-level count: minimal, fully consistent, honors the existing demotion.

## Finish Report (2026-06-26)

Resolved via the effective-level count (user chose "count what's shown", with the hard
requirement "the numbers MUST AGREE … count what is shown and what WILL be shown").

**Change.** `viewer-stats.ts`: replaced the raw `updateStatsFromLines(msg.lines)` pass
(which re-ran `classifyLevel` on incoming text) with `recomputeStatsCounters()`, which
tallies `item.level` over `allLines`, skipping markers — the exact field and population the
level filter reads. `viewer-script-messages.ts`: the `addLines` handler calls
`recomputeStatsCounters()` right after `trimData()`, so the tally reads the post-batch array
after `addToData` + repeat-collapse + trim have settled (driving it from there, not a second
message listener, removes the listener-ordering race). The stats listener now only handles
`reset`/`clear`.

**Why it agrees by construction.** Badge and filter now both read one field, `item.level`.
A demoted device `E/` line is `info` for both → it leaves the Error badge and shows under
Info focus. A collapsed SQL streak contributes its single `repeat-notification` row → the
badge counts what will be shown, not the raw pre-collapse line count.

**App errors safe.** Demotion (`viewer-data-add.ts:135`) only fires for `lineTier ===
'device-other'` (fw === true: Android-native logcat / framework frames). Flutter/Dart app
output is tier `flutter` (fw false, or the print() default) and is never demoted, so genuine
app errors keep `error` and stay counted as errors.

**Verification.** `tsc --noEmit` clean; `node esbuild.js` builds. The generated stats script
was evaluated in a vm against a synthetic `allLines` (real app error + stack-frame, two
demoted device errors, a collapsed SQL repeat row, a marker): result `error:2, info:2,
database:2`, rest 0 — demoted device errors counted as info, marker excluded, collapse
counted as one row. Existing detection-parity (39) and stack-parser (55) tests unaffected
(no detector logic touched).

**Residual / not built.** Counts refresh on each `addLines` batch. Toggling compress mode or
expanding a collapsed group after load does not live-recount until the next batch; for a
static loaded log (the reported scenario) the final post-load counts are correct and stable.
Live recount on compress-toggle is an adjacent concern, not built (would need a hook in the
compress/expand path).
