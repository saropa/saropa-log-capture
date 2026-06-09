# PLAN 055: Viewer row grid/column rewrite (Item E Path 2)

Status: **ACTIVE** — reactivated 2026-06-09. Was `plans/deferred/055_plan-viewer-row-dom-grid-rewrite.md`.

## Reactivation note (2026-06-09)

Reactivated on the design-fragility criterion, not on a Path-1 alignment
failure. The triggering incident (a user screenshot of overlapping
timestamp + missing tag) turned out to be `structuredLineParsing` toggled
off at runtime, **not** a column-width miss — see the diagnosis below. But the
investigation re-confirmed that the current layout treats decoration↔message
overlap as **accepted behavior**, not a bug:

> [viewer-styles-decoration.ts:84-88](../src/ui/viewer-styles/viewer-styles-decoration.ts#L84-L88):
> "an inline-block flows subsequent content after its BOX edge even if content
> visually spills, so the rare wide PID/tag case can overlap slightly but never
> shifts the column."

The model guarantees "column never shifts" by allowing "decoration may visually
overlap the message," held safe only by the em width estimates in
`applyDecorationLayoutWidth` being *generous enough*. That is a latent overlap
generator. This plan replaces the faked columns with a real per-row CSS grid in
which overlap is **structurally impossible**, not merely improbable.

(The original "Why deferred" rationale and the deferred-spec are retained at the
bottom as history.)

## Goal

Each viewer row renders as a real grid: fixed decoration columns on the left, a
flexible **message cell** on the right. The message cell has `min-width: 0` and
clips its column boundary, so no decoration content can ever paint over message
text. Fixed-content columns (line number, timestamp, elapsed, level) get
**exact** widths from known character counts (`ch` units) instead of generous em
estimates; only the variable-width tag column clips with an ellipsis (as it
already does).

## Non-goals

- **Not** changing virtualization: `calcItemHeight` still returns one
  `ROW_HEIGHT` per line; rows stay fixed-height and absolutely positioned by
  `prefixSums`. No `display: table` (a table needs every row in the DOM to size
  columns; the viewport only holds visible rows).
- **Not** introducing CSS subgrid in the first cut (auto-sizing columns to the
  widest *visible* row causes horizontal jitter on scroll under virtualization).
  Recorded as a possible later refinement.
- **Not** fixing wrapped-message row-height accounting (a long `pre-wrap` line,
  or a multi-line live event with embedded `\n`, renders taller than its one
  `ROW_HEIGHT` allocation and overlaps the row below). That is a *separate*
  pre-existing virtualization bug, unchanged by this rewrite. Flagged in Risks;
  out of scope here.
- **Not** touching the structured-parsing toggle behavior (separate follow-up:
  Tag/PID/Level columns should imply `structuredLineParsing` on — track outside
  this plan).

## Chosen approach

### Per-row `display: grid`, exact `ch` columns, clipping message cell

```
/* Shared, reusable column PRIMITIVE — overlap-proof by construction.
   Used by the log gutter AND (later) CSV / markdown tables. */
.cols { display: grid; align-items: baseline; }
.cols > * { min-width: 0; overflow: hidden; }   /* every cell clips its own box — no neighbor overlap */
.cols > .ellipsis { text-overflow: ellipsis; white-space: nowrap; }

/* Consumers share the primitive and differ ONLY in their template var,
   because the COLUMNS MEAN DIFFERENT THINGS — they are not the same axis. */
.log-cols { grid-template-columns: var(--grid-cols); }      /* bar / line# / time / … / tag / 1fr msg */
.csv-cols { grid-template-columns: var(--csv-cols); }       /* future: one track per CSV field */
.md-table { grid-template-columns: var(--md-table-cols); }  /* future: real markdown table */
```

A log row is `class="line cols log-cols"`. The **primitive** (`.cols`: grid +
clipping cells) is reusable everywhere; the **template** (`--grid-cols` vs
`--csv-cols` vs `--md-table-cols`) is per-consumer and never shared, since the
log gutter axis and a CSV data axis are different column systems. The grid is
still opt-in (a bare `.line` is not `.cols`) — see "Special / structured-file
renderers."

`--grid-cols` is emitted by the rewritten `applyDecorationLayoutWidth` from the
**enabled × data-present** flags it already computes (`decoSeen`), e.g.:

```
grid-template-columns: 1.25em <numCh>ch <timeCh>ch 7em 1fr;
                       ^bar    ^line#    ^time     ^tag ^message
```

Disabled / not-seen columns contribute **no track** (omitted from the template),
so the gap shrinks to exactly what renders — same intent as today's
`decoSeen`-gated width, but now expressed as grid tracks.

### Why `ch` units kill the estimate problem

Fixed-content parts have **known** character counts, and the decoration font is
monospace (verify: `.line` font-family — dependency D1 below). So:

- line number = `getCounterDigitsForLayout()` digits + padding → `<n>ch`, exact.
- timestamp = `"T10:56:00"` = 9ch, or `"T10:56:00.962"` = 13ch with milliseconds — exact.
- session elapsed / level prefix — bounded char counts, exact.
- tag = the only variable-width column → fixed cap (`7em`) + `text-overflow: ellipsis`.

No `/ 0.85` font-context divisor, no negative `text-indent`, no "generous"
fudge. If the decoration renders at the line's own font size instead of
`0.85em`, `ch` maps 1:1 and the math is trivial; decision D2 below.

### Why this beats the current model

| Current (inline-block + hanging indent) | Grid |
|---|---|
| Message overlap is *accepted* if a part exceeds its estimate | Message is a separate cell; overlap impossible |
| Negative `text-indent` hack for wrapped-line alignment | Wrapped message aligns under its cell automatically |
| `/0.85` divisor, em estimates per part | `ch` exact for fixed parts |
| `:has(.line-decoration)` selector dependency | none |

## DOM contract change — every part is its own cell, from the start

A two-column `decoration-blob | message` grid is explicitly **rejected**: it only
protects the message and leaves every decoration part (counter, timestamp, tag, …)
merged in one shared cell, where a wide timestamp can still spill over the tag.
That is the exact anti-pattern the overlap bug exposed. The invariant is **no two
distinct data ever share a box** — so each part gets its own track immediately.

**Before** (`renderItem` tail, [viewer-data-helpers-render.ts:311](../src/ui/viewer/viewer-data-helpers-render.ts#L311)):

```
'<div class="line …">' + stackGutter + deco + contBadge + elapsed + badge + catBadge + html + '</div>'
```

**After** — `.line` is the grid; each decoration part is a `.deco-cell` grid
item; the message is `.line-msg`. The existing `.line-decoration` wrapper becomes
`display: contents` so its per-part children participate directly in the parent
grid (keeps the wrapper for JS hooks/measurement without adding a nesting level):

```
<div class="line log-cols …">                        <!-- log rows opt in; format rows do not -->
  <span class="deco-bar"></span>                      <!-- severity track, 1.25em -->
  <span class="line-decoration" style="display:contents">
    <span class="deco-cell deco-cell-num">  1115</span>
    <span class="deco-cell deco-cell-time">T10:56:00</span>
    <span class="deco-cell deco-cell-tag" title="gralloc4">gralloc4</span>
  </span>
  <span class="line-msg">…elapsed/badges/text/×N…</span>
</div>
```

`grid-template-columns` lists a track per **present** part only (driven by the
existing enabled×`decoSeen` flags). Each `.deco-cell` is `overflow: hidden`; the
tag cell adds `text-overflow: ellipsis`. `.line-msg { min-width: 0 }`. No part
can paint over another, and none can paint over the message — structurally.

Fixed-content cells take **exact `ch` widths** from known char counts in this same
pass (counter digits, `"T10:56:00"`=9ch / `+13ch` with ms, elapsed, level); only
the variable tag cell is capped (`7em`) and clips. So fixed parts never even clip.

## Phasing (full column model from day one; risk managed by rollout, not by merging)

**Phase 1 — the grid column model, rolled out path-by-path.**
- Add `viewer-styles-columns.ts`: `.line.log-cols { display:grid; grid-template-columns: var(--grid-cols) }`, `.deco-cell { overflow:hidden }`, tag-cell ellipsis, `.line-msg { min-width:0 }`, `.line-decoration { display:contents }`. The grid is **gated on `.log-cols`** so format/marker/chip rows are unaffected.
- `renderItem` adds `log-cols` to the class list **only on the log-row branches** (regular, AI, stack); the `fileMode !== 'log'` format branch and marker/chip rows never get it.
- Rewrite `applyDecorationLayoutWidth` to emit `--grid-cols` (a full `grid-template-columns` string) — a track per enabled+seen part, `ch`-exact for fixed parts, `7em` for the tag, `1fr` for the message.
- Rewrite `getDecorationPrefix` to emit per-part `.deco-cell` spans instead of one `&nbsp;`-joined blob.
- Migrate render paths **one at a time** (regular line → AI line → chips → stack header/frame → banner/art-block → structured-file), keeping the suite green between each. This is where the blast radius is contained: incremental rollout, not a weaker design.
- Remove the hanging-indent rules (`padding-left` + negative `text-indent` + `:has()` + inline-block width + `/0.85`) from `viewer-styles-decoration.ts` as each path moves over.

**Phase 2 — cleanup + tests.**
- Delete dead CSS vars (`--deco-content-indent-em`, `--deco-prefix-width-em`, the `/0.85` rule) once no path references them.
- Rewrite [viewer-column-layout.test.ts](../src/test/ui/viewer-column-layout.test.ts) to pin the grid model: `.line{display:grid}`, one `.deco-cell` per part, `.line-msg{min-width:0}`, exact `ch` time/number tracks, tag-cell ellipsis.
- Update `doc/internal` if any column contract is documented.

## Render paths to migrate (all share or mirror the `.line` contract)

Each must wrap its message body in `.line-msg` (Phase 1) and stay grid-aligned:

- `renderItem` regular line — [viewer-data-helpers-render.ts](../src/ui/viewer/viewer-data-helpers-render.ts)
- `renderItem` AI line branch (`.ai-line`) — same file, ~line 199
- `renderItem` repeat-notification / n-plus-one chip — same file, ~line 137 (`line-deco-spacer-only` becomes an empty grid cell)
- `renderStackHeader`, `renderStackFrame` — [viewer-data-helpers-render-stack.ts](../src/ui/viewer/viewer-data-helpers-render-stack.ts)
- marker rows (`.marker`) — no decoration cell; confirm they sit outside the grid or use a 1-col grid
- run-separator rows
- art-block continuation rows (`art-block-start/-middle/-end`)
- banner-group rows (`banner-group-start/-mid/-end`)
- structured-file mode rows (`fmt-markdown/-json/-csv`) — **excluded** from the grid (see next section); the migration must ensure they do NOT receive `.log-cols`
- `viewer-data.ts` copy/strip path (~line 177) that mirrors `renderItem`'s prefix strip — keep in sync

## Special / structured-file renderers (markdown / json / csv / future)

These are a **different row archetype**: they stay outside the log *gutter*
template (`--grid-cols`), but they MAY reuse the shared `.cols` primitive with
their own template var (see CSV/md below). A format row is a single
formatter-owned content area, not a gutter+message log row. Routed by the
`fileMode !== 'log' && formatEnabled` branch at the top of
[renderItem](../src/ui/viewer/viewer-data-helpers-render.ts#L44-L56), it returns
`<div class="line fmt-…">fmtHtml</div>` with **no decoration cells** (format files
have no timestamps/tags/PIDs).

Contract:
- **Format rows never get `.log-cols`** (the gutter template). They are block by
  default, or `.cols` + their own template var if columnar (CSV/md-table). Because
  the gutter grid is opt-in (not on bare `.line`), a new renderer is block
  automatically and cannot be silently broken by the gutter columns.
- **A columnar format REUSES the `.cols` primitive with its OWN template var —
  never the log gutter template.** This is the answer to "can CSV/md use the
  grid?": yes, the same overlap-proof mechanism, a different `grid-template-columns`:
  - CSV is inherently tabular and is the prime consumer. A CSV row becomes
    `class="line cols csv-cols"` with `--csv-cols` = one `<n>ch` track per field
    (widths computed once from the parsed data, set on the container so columns
    align down the file — same shared-template alignment trick the log gutter
    uses). This is an **upgrade**: today `formatCsvLine` emits a raw string; with
    `.cols` the fields become real aligned, clipping columns. `--csv-cols` is NOT
    `--grid-cols` — different axis, different file, different widths.
  - Markdown tables likewise: `md-table-row` (today a raw `| col | col |` string)
    can become `class="cols md-table"` with `--md-table-cols`. Headings, bullets,
    blockquotes stay block (not columnar).
  - JSON is a tree, not columns — stays block.
- **Future renderers** (HTML, logfmt, key-value, …): block by default; if their
  content is columnar they adopt `.cols` + their own template var, never the
  gutter template.
- Format rows currently carry **no line-number gutter**; the grid change must not
  add or remove that. (If per-format gutters are wanted later, that is a separate
  per-renderer decision.)

So the factoring is: **one reusable primitive (`.cols` = grid + clipping cells),
many templates.** The overlap-proof discipline is shared everywhere; the column
*axes* (log gutter vs CSV fields vs md-table columns) stay separate, each its own
`--*-cols` var on its own row class. Conflating two axes into one template is the
one thing forbidden.

## Constraints to preserve (regression gate)

From the original spec, all still required:
- Virtualized one-`ROW_HEIGHT` rows; blank-line quarter-height.
- Stack-frame indentation = one column past the decoration.
- Search highlight / current-match / context-line / recent-error tint classes.
- Continuation badge injected inside the decoration prefix.
- Dedup-fold `×N` badge anchored at end of message.
- Severity bar (`level-bar-*`) as the leftmost reserved track (1.25em).
- Decoration toggles (line#/time/elapsed/pid/level/tag) recompute the template live.
- `nowrap` mode (`#log-content.nowrap`) still respected by `.line-msg`.

## Open decisions (resolve during Phase 1)

- **D1.** Confirm `.line` font is monospace (required for `ch` exactness). Check `viewer-styles-lines.ts` / content. If not strictly monospace, fixed columns need a measured char-width var instead of `ch`.
- **D2.** Render decoration at the line's 1em (drop `0.85em`) so `ch` maps 1:1, or keep `0.85em` and scale tracks by `calc(... * 0.85)`. Recommend dropping to 1em for simplicity unless the smaller deco size is a deliberate visual.
- **D3 (resolved).** Marker / chip / format rows: the grid is **opt-in via `.log-cols`**, so these simply don't receive it and stay block — no opt-out class, no empty-track math. Chips that visually align to the message column keep doing so via a left-padding var (today's `line-deco-spacer-only`), not a grid track.

## Files

- New: `src/ui/viewer-styles/viewer-styles-columns.ts`
- [src/ui/viewer/viewer-data-helpers-render.ts](../src/ui/viewer/viewer-data-helpers-render.ts) — `renderItem`, DOM contract owner (near 300-LOC cap → expect a split)
- [src/ui/viewer/viewer-data-helpers-render-stack.ts](../src/ui/viewer/viewer-data-helpers-render-stack.ts) — stack header/frame
- [src/ui/viewer-decorations/viewer-decorations.ts](../src/ui/viewer-decorations/viewer-decorations.ts) — `applyDecorationLayoutWidth`, `getDecorationPrefix`
- [src/ui/viewer-styles/viewer-styles-decoration.ts](../src/ui/viewer-styles/viewer-styles-decoration.ts) — remove hanging-indent rules
- `src/ui/viewer-styles/viewer-styles-lines.ts`, `viewer-styles-content.ts`, `viewer-styles-decoration-bars.ts`
- [src/test/ui/viewer-column-layout.test.ts](../src/test/ui/viewer-column-layout.test.ts) — rewrite

## Risks

- **High blast radius.** `.line` is the shared contract for ~10 render paths; a grid rule on `.line` hits all of them at once. Mitigation: land the CSS + `getDecorationPrefix`/`applyDecorationLayoutWidth` cell emitter first, then convert render paths **one at a time** with the suite green between each — risk is contained by rollout order, not by a weaker (merged-cell) intermediate design.
- **`renderItem` LOC cap.** Already near 300; the per-cell emitter likely forces a module split (extract the cell builder).
- **Wrapped/multi-line height (pre-existing, out of scope).** Grid does not fix the `calcItemHeight` one-row assumption for `pre-wrap` content or embedded-`\n` live events. Do not let the rewrite *worsen* it; track separately.
- **Baseline alignment.** `align-items: baseline` across cells of different font sizes (if D2 keeps 0.85em) can drift; 1em decoration sidesteps it.

## Verification gate

- `npm run check-types`, `npm run lint`, `npm run compile` clean.
- Rewritten `viewer-column-layout.test.ts` pins: `.line{display:grid}`, `.line-msg{min-width:0}`, exact `ch` time/number tracks, tag cell ellipsis.
- Manual (Extension Dev Host, F5): logcat-heavy file with long tags
  (`GraphicBufferAllocator`, `MediaSessionCompat`) + timestamp + tag columns on
  → tag clips with ellipsis, **never** paints over the message; toggling each
  column adds/removes its track with columns staying aligned top-to-bottom.
- Manual regression: open a `.md` and a `.csv` with format mode ON → format rows
  render in their own layout (headings, bullets, md tables, CSV) and are **not**
  pulled into the log gutter grid (no `.log-cols`, no stray empty columns).

---

## History — original deferred rationale (pre-2026-06-09)

### Why it was deferred

- **Path 1 closed the visible complaint.** Columns aligned top-to-bottom;
  toggling line number / timestamp / PID / TID / tag recomputed width via
  `applyDecorationLayoutWidth`; long logcat tags clipped to the reserved column.
- **High blast radius** across all the flat-`<div class="line">` render paths.
- **File-size headroom** — `renderItem` near the 300-LOC cap.
- **No live user pain point** at the time.

### Original Path-2 spec

Restructure each `.line` into fixed-position columns, all optional except text:
Col A severity glyph/bar · Col B line number · Col C timestamp · Col D… existing
optional decorations (elapsed, quality badge, source tag, PID/TID, parsed-level
prefix, parsed tag) · Col N message text (flex, wraps). Use CSS grid or flex with
fixed-width children. Background / full Item E history: archived plan
[plans/history/2026.05/2026.05.15/054_plan-viewer-stack-noise-filter-layout.md](history/2026.05/2026.05.15/054_plan-viewer-stack-noise-filter-layout.md).
