# Unified Line Collapsing — Rethink Plan

## Problem

Opening a noisy log (Drift SELECT flood, 11 000+ identical query + stack-trace triples) makes the viewer unreadable:

- Rows of `DriftDebugInterceptor._log` / `.runSelect` stack frames repeat thousands of times.
- The left margin carries four or more different glyphs simultaneously (▼ hidden-chevron, − peek-collapse, `× 11454` marker badge, `[+N frames]`).
- No single control lets the user say "collapse the repetition, show me what's unique."
- The user cannot tell at a glance whether a glyph means "filter hid these lines," "I collapsed these lines," or "these are duplicates of what you just saw."

## Inventory of what currently hides or folds rows

The viewer stacks eleven independent mechanisms. Each has its own glyph, its own state, its own invalidation path.

| # | Mechanism | Glyph | Trigger | File |
|---|-----------|-------|---------|------|
| 1 | Capture-side deduplication | none (count inside the line) | identical consecutive captured lines | `src/modules/capture/deduplication.ts` |
| 2 | SQL-repeat compression | `N × SQL repeated:` row | identical SQL fingerprint within a window | `src/ui/viewer/viewer-data-sql-drilldown-ui.ts` |
| 3 | Non-consecutive line compression | `(×N)` badge inline | user toggle, `type === 'line'` only | `viewer-data.ts` — `applyCompressDedupModes` |
| 4 | Stack-frame grouping (per-group) | `▸` / `[+N frames]` | stack parser builds groups | `viewer-data-add-stack-group-learning-and-toggle.ts` |
| 5 | Repeat-notification | `Repeated log #N` row | repeat detector | repeat-notification renderer |
| 6 | Hidden-chevron | ▼ (vertical ellipsis rendered at 2em) | filter hides non-blank lines between visible ones | `viewer-data-viewport.ts` / `viewer-styles-decoration-bars.ts:111` |
| 7 | Peek-collapse | − (minus) | click on ▼ expanded a group; click − to re-collapse | `viewer-peek-chevron.ts` |
| 8 | DB signal marker visibility | marker hidden / `× N` badge | v7.4.0 — toggle + consecutive collapse on db-signal markers | `viewer-data-marker-filter.ts` |
| 9 | Session-group coalescing | indent + tether | session grouping | `viewer-session-panel-rendering-groups.ts` |
| 10 | Continuation / stack-group collapse | `▸` / `▾` header | user toggle on a group header | `viewer-data-add-continuation.ts` |
| 11 | Stack-frame default state (global) | `[+N more]` in Preview mode | Decorations panel dropdown: Expanded / Preview / Collapsed (+ `stackPreviewCount`, default 3) | `viewer-decorations/viewer-deco-settings.ts:107` |

Mechanism 11 is the existing in-tree answer to "hide the noise in the stack trace": set the global default to Preview and every incoming stack group auto-shortens to its first 3 frames plus a `[+N more]` indicator. It is a per-group row-hiding pass distinct from mechanism 4's per-click toggle, even though they share the same underlying flag.

Nothing ties these together. A row might be hidden by (3) AND sit under a (10) header AND have a (7) peek state — and the user sees four different glyphs for what is semantically "rows you're not looking at."

## What the user asked for

Direct quotes from the thread:

- "just fucking collapse lines with a single collapse / expand function (with tooltip)"
- "▸ is too small to click on"
- `(long label)` breaks line wrapping
- "on the right" is undiscoverable
- "don't tell me what to do"

Translated to requirements:

1. **One collapse/expand concept**, not ten.
2. **Click target is big** — at least the full height of the surviving row, not a 10-px glyph.
3. **Count stays inline with the line body** so it wraps with the text and does not need its own margin column.
4. **Discoverable** — in the natural reading flow, not tucked into a right-edge gutter.
5. **Tooltip** on hover, not a bare number.
6. **Nothing hidden silently** — if rows are folded, the fold row itself must be obvious and actionable.

## The plan

Every visible hint that rows are hidden or folded in the viewer is removed: the ▼ chevron, the `−` peek minus, the `× N` badge on markers, the `[+N frames]` and `[+N more]` stack shorteners, the per-group `▸ / ▾` headers, and the `(×N)` dedup badge. **Nothing new is added to the UI.** The only change is to the existing severity dot in the left-edge gutter.

**State indicator = the existing severity dot, restyled when rows are hidden adjacent to it.**

- **Solid / filled dot** (today's default appearance) — no hidden rows here. This is every normal row.
- **Outlined / hollow dot, larger** — hidden rows are associated with this row. The dot's hollow center must be opaque so the severity connector bar does not show through the hole.

The dot replaces the triangle, the chevron, the peek minus, and the `[+N]` glyph. There is exactly one visual in the gutter regardless of *why* rows are hidden.

**Click target is the entire row**, not the dot. Clicking anywhere on a row whose dot is outlined expands the hidden rows associated with it; clicking again re-hides them. The dot itself is state-only.

**Tooltip on hover** names the cause in one sentence and says what clicking will do. Same sentence pattern across the four cases.

The reason rows are hidden does not change the visual. A dedup fold, a filter-induced gap, a user-collapsed stack group, and a Preview-mode stack trim all look and behave the same. Only the body text (if any) and the tooltip text differ.

No additional row is inserted to announce a hidden run. The hidden run is signalled by the outlined dot on the row that survives (for dedup and group collapse), on the row immediately after the gap (for filter hiding — the render loop streams top-down and marks the first visible row following the hidden range), or on the last visible frame of a trimmed stack (for Preview mode).

## Four cases, one shape

In every diagram below, `○` stands for the outlined/hollow enlarged severity dot (the new state indicator — hidden rows are associated with this row) and `●` stands for the normal solid severity dot (today's look — nothing hidden). The single-column `●`/`○` represents the full left-gutter dot; the severity *connector bar* is not drawn but does run vertically between the dots and must pass behind the opaque center of `○` without showing through the hole.

### Case 1 — Dedup fold (N identical rows)

**Before (what the user sees today, abbreviated):**
```
●  12:34:56.789  » DriftDebugInterceptor._log (./...dart:92:5)
●  12:34:56.789    » DriftDebugInterceptor.runSelect (./...dart:29:7)
●  12:34:56.790  » DriftDebugInterceptor._log (./...dart:92:5)
●  12:34:56.790    » DriftDebugInterceptor.runSelect (./...dart:29:7)
         ... 11 454 copies ...
```

**After:**
```
○  » DriftDebugInterceptor._log (./...dart:92:5)
○    » DriftDebugInterceptor.runSelect (./...dart:29:7)
```
- One surviving row per unique text. All duplicates hidden.
- Dot is outlined/larger ⇒ this row represents many identical rows.
- Click the row to expand back to the full run; click again to re-fold.
- Tooltip on hover: `11 454 identical rows between 12:34:56.789 and 13:02:11.422. Click to expand.`
- Body text = exactly the original row content. No inline count in the body (the dot carries the "there's more" signal).

### Case 2 — Filter hiding (N disparate rows behind a filter)

**Before:**
```
●  12:34:56.789  [INFO]  startup complete
         ▼                                       ← current "something hidden" glyph
●  13:01:22.011  [ERROR] connection reset
```

**After:**
```
●  12:34:56.789  [INFO]  startup complete
○  13:01:22.011  [ERROR] connection reset
```
- The row immediately **after** the filtered gap gets the outlined dot (implementation streams top-down; marking the row-after is in-loop with no post-pass).
- No inserted "3 rows hidden by filter" row in the flow. The gap is signalled by the dot style on the following row, not by a new row.
- Click the row with the outlined dot to reveal the hidden run inline (as today's peek-chevron did); click again to re-hide.
- Tooltip: `3 rows hidden before this line by filters: Database off, Level:warn+. Click to reveal temporarily.`

### Case 3 — User group collapse (stack header the user clicked)

**Before:**
```
●  ERROR  NullPointerException at MyClass.doThing
         ▾                                       ← the user already clicked this
●    » MyClass.doThing (./.../my_class.dart:12:5)
●    » MyClass.run (./.../my_class.dart:7:5)
         [+8 more frames]
```

**After (collapsed state):**
```
○  ERROR  NullPointerException at MyClass.doThing
```
- The stack header's own dot becomes outlined when its frames are collapsed.
- No `▾` chevron on the header row. The dot is the indicator.
- Click the header row anywhere to expand; click again to collapse.
- Tooltip: `Stack trace collapsed · 10 frames · click to expand.`

### Case 4 — Preview stack trim (global default = Preview, N frames shown)

**Before (existing):**
```
●  ERROR  NullPointerException at MyClass.doThing
●    » MyClass.doThing (./.../my_class.dart:12:5)
●    » MyClass.run (./.../my_class.dart:7:5)
●    » main (./.../main.dart:3:5)
         [+5 more]                                ← current preview glyph
```

**After:**
```
●  ERROR  NullPointerException at MyClass.doThing
●    » MyClass.doThing (./.../my_class.dart:12:5)
●    » MyClass.run (./.../my_class.dart:7:5)
○    » main (./.../main.dart:3:5)
```
- Last shown frame gets the outlined dot — signals that more frames exist below it.
- No `[+5 more]` row in the flow.
- Click the last shown frame to reveal all remaining frames; click again to re-trim to Preview.
- Tooltip: `5 more stack frames below · Preview mode showing 3 of 8 · click to show all 8 · change default in Decorations → Stack frames.`

### Shared rules across all four cases

- No new row type is ever inserted to announce a hidden run. The outlined dot on an existing row is the only indicator.
- No `▸`, `▾`, `▼`, `−`, `× N` badge, `[+N frames]`, or `[+N more]` text appears anywhere in the gutter or the line body.
- The outlined dot is larger than the normal dot so it reads as "special" at a glance.
- The outlined dot has an opaque center filled with the viewport background color so the severity connector bar cannot be seen through the hole.
- Click target is the entire row whose dot is outlined. Clicking toggles between hidden and revealed.
- Tooltip on hover of the row (or the dot, whichever is more discoverable) names the cause and the action in one sentence.

## Decisions baked into this plan

Everything below is a default answer. If any of them read wrong, say which and it changes before any code moves.

1. **The state indicator is always the existing severity dot** (outlined + larger when rows are hidden, solid at normal size otherwise). No new glyph, no new row, no added text.
2. **Click target is the whole row whose dot is outlined.** Other rows keep their existing click behavior unchanged.
3. **Stack traces default to hidden.** The `stackDefaultState` preference in Decorations → Stack frames ships set to **Collapsed** out of the box. Users who want the full trace on arrival switch to Expanded or Preview.
4. **Overlap (a row is hidden for more than one reason):** only the outlined-dot state is on the row; the tooltip lists every cause that applies. Expanding reveals rows in their natural order; rows still held by a separate active filter stay invisible until that filter is relaxed.
5. **Persistence of a user expansion:** survives scroll and incoming streamed rows; resets on filter change, session reload, or a toolbar "Collapse all."
6. **Streaming updates:** the outlined-dot state and its tooltip count refresh as new matching rows arrive, through the existing height-recalc path. A 250 ms debounce is acceptable if live refresh turns out to be expensive.
7. **How "identical" is measured for dedup:** exact text match after the row's prefix (timestamp, PID, level, tag) is stripped. No normalization of numeric arguments or IDs in the first version.

## Related areas — where each one fits

Four areas came up in the conversation that I earlier (wrongly) listed as out of scope. All four are relevant; here is how each one relates to the plan in plain words.

### Filter controls (the dropdowns, toggles, search box, level buttons)

The *controls* you use to hide rows — the "Database off" toggle, the level buttons, the search box — are not touched by this plan. You click them the same way, they hide rows the same way.

What changes is the *visual result* in the log view. Today, when a filter hides a run of rows, you see a small ▼ glyph in the margin. Under this plan, the row immediately before the filter-hidden run gets the outlined-dot state instead — and clicking that row reveals the hidden rows temporarily. Same indicator (the outlined severity dot), whether the hiding comes from a filter, a dedup fold, a user collapse, or a Preview trim.

### The internal flags that mark rows as hidden

Inside the viewer, each row carries flags like `levelFiltered`, `compressDupHidden`, `userHidden`, `markerHidden`, and several others. These flags record *why* a row is hidden. You never see them directly.

They stay as they are. Multiple flags on one row continue to work (a row can be both filtered-out *and* a duplicate). The collapsed-row control renders wherever any of these flags cause a gap, and the tooltip can name every flag that applies. No flag is renamed, merged, or removed.

### Session grouping (nested sessions in the Logs panel sidebar)

Session grouping is about which *sessions* appear together in the Logs panel sidebar tree — parent / child session nesting with indent and a connector line. This is a different concept from hiding rows inside a single open log. It is not part of this plan.

If session grouping has its own UX problems worth rethinking, that's a separate plan. This one is only about what you see inside the log view itself.

### Capture-side deduplication (drops identical consecutive lines before the viewer sees them)

This runs inside the capture pipeline, *before* the log reaches the viewer. It drops identical consecutive lines and writes a count into the surviving line. The viewer never sees the dropped lines at all — they are gone from the recorded file.

This needs a real decision, not a quiet exclusion:

- **Option 1 — keep it as silent drop-at-source.** Duplicates vanish at capture time, the viewer never sees them, the file on disk is smaller. Today's behavior.
- **Option 2 — route capture-dedup'd runs into the collapsed-row control.** The viewer shows one collapsed row per run; clicking it reveals the full captured stream of duplicates. The file on disk keeps every line.

Option 1 is the current behavior and matches "the viewer should not have to re-handle what the capture already handled." Option 2 makes the rule "every hidden row is recoverable via a collapsed row" genuinely universal. Both are defensible; this plan does not force a choice.

## Decisions baked in already

Everything below is a default answer. If any of them read wrong, say which and it changes before any code moves.

1. **Body text for each of the four cases:** see the four worked examples above.
2. **Click target:** the whole row when the row is a collapsed row; regular rows keep their current click behavior.
3. **Overlap (a row hidden for more than one reason):** the body names the innermost cause; the tooltip lists all of them.
4. **Persistence of a user expansion:** survives scroll and incoming streamed rows; resets on filter change, session reload, or a toolbar "Collapse all."
5. **Streaming updates:** the collapsed row's count / label refreshes as new matching rows arrive, through the existing height-recalc path. A 250 ms debounce is acceptable if the live refresh turns out to be expensive.
6. **How "identical" is measured for dedup:** exact text match after the row's prefix (timestamp, PID, level, tag) is stripped. No normalization of numeric arguments or IDs in the first version.

## Status

- **Implemented** (session ending 2026-04-22):
  - Outlined severity-dot CSS vocabulary (`.bar-hidden-rows`, 0.9em ring with opaque center).
  - Filter-hidden runs wired: dot on the row after the gap; click-to-peek, click-again-to-unpeek.
  - Stack-header collapsed state wired: dot on the header; ▶ / ▼ / ▷ and `[+N frames]` / `[+N more]` removed.
  - Preview-mode stack trim wired: dot on the last visible frame (rule 3).
  - Marker `× N` badge retired; collapsed markers fold silently with a hover tooltip carrying the count.
  - Cross-type dedup: stack-frame rows participate in non-consecutive compression; fold survivor carries the dot and a tooltip.
  - Dedup folds are click-to-expand via `peekDedupFold()` + `compressDupHiddenIndices`.
  - `stackDefaultState` ships as Collapsed out of the box.
  - `user-select: none` removed from `.stack-header` — header text is selectable again.
  - Dead `.hidden-chevron` / `.peek-collapse` CSS and their now-unreachable class skips removed; tests updated.
- **Capture-side dedup: Option 2 implemented.** User chose "keep but collapse — this preserves line numbers." `LogSession.appendLine` now writes every raw line directly (bypasses `Deduplicator.process()`). Duplicate folding moves entirely to the viewer's unified outlined-dot collapse. Per-line timestamps and 1:1 line-number mapping to the app's actual output are preserved in the captured file. The `Deduplicator` class is retained but not invoked.
- **Code**: all edits in the working tree, nothing committed to git yet.
