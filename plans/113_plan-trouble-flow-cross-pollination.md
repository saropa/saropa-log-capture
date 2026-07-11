# Plan 113 — Cross-pollinate Trouble Mode and the Flow Map

**Status:** Proposed (plan only — no code)
**Author request:** bring the two triage surfaces closer:
1. an *indicative* vertical screen-flow column inside Trouble Mode,
2. the Trouble severity bar chart inside the Flow Map panel,
3. a Signals section + a stats block inside the Flow Map panel.

> **Note on part 3b:** the original request "…and also should get stats for …" was cut off.
> The stat list below was proposed and **confirmed by the author (2026-07-11)**, so all four
> sub-parts are fully specified.

---

## Background — the two surfaces are separate runtimes

Understanding this is the whole plan; the three asks are all "move a thing across the gap."

| | **Trouble Mode** | **Flow Map** |
|---|---|---|
| Where it runs | Inside the **log viewer webview** | A **separate `WebviewPanel`** (`saropaFlowMap`) |
| How it's built | ~89 concatenated `/* javascript */` string modules sharing one page scope | HTML **string built host-side**, then handed to the panel |
| Data source | Reads the in-page `allLines` array directly (no host channel — honors the extension-host OOM fence, bug 001) | `parseLog(lines)` → `ParsedLog` → `buildGraph` → `renderSvg`, all **host-side** on a saved log |
| Chart tech | Inline SVG string builders in `viewer-trouble-chart-render.ts` (embedded JS) | Inline SVG string builders (`flow-map-svg.ts`, `flow-map-activity-chart.ts`) in real TS |

Consequence: a webview script **cannot** be imported by the host and vice-versa. Each
"move" is either a **reuse of already-present in-page data** (part 1) or a **host-side
re-render mirroring the other surface's look via shared constants** (parts 2, 3).

Key already-existing assets this plan leans on:
- `src/ui/viewer-flow-tags/viewer-flow-tags.ts` — client-side `classifyFlowTag()` already
  stamps `item.flowTag = { verb, kind, name, source }` on every line at birth. **Part 1's
  data already exists in `allLines`.**
- `src/ui/viewer-search-filter/viewer-trouble-signals.ts` — the existing Trouble "Signals
  band" is the exact pattern for a new in-viewer band/column (scan `allLines`, build a
  string, fill a `flex-shrink:0` container).
- `src/modules/flow-map/flow-map-activity-chart.ts` — the existing host-side SVG chart +
  `<details>` section is the exact pattern parts 2 & 3 follow.
- `src/modules/flow-map/flow-map-html.ts` `sessionInfoHtml()` — the existing host-side
  stats grid parts 3b extends.

---

## Part 1 — Indicative screen-flow column in Trouble Mode

**Goal:** while Trouble Mode is active, show a narrow vertical column listing the screens
entered, in order, with connecting lines between them. Indicative only — no splits, no
branches, no dwell, no back-edge curves. A linear breadcrumb rail.

**Data:** reuse `item.flowTag` (already on every line). Take items where
`flowTag.verb ∈ {enter, back}` and `flowTag.kind ∈ {screen, tab}` (dialogs/sheets/inline
are sub-surfaces — exclude to keep it "screens clicked"). Collapse consecutive duplicates.
Cap the list length (propose `TROUBLE_FLOW_MAX_STEPS = 60`) and, when over the cap, keep the
most recent and show a "+N earlier" head, mirroring how the chart caps at 180 buckets.

**Rendering:** a hand-rolled vertical strip — one pill per screen, a thin connector line
between pills, newest at the bottom (matches the feed's newest-at-bottom flow). Back steps
get the ↩ glyph and a muted connector so a return reads distinctly without drawing a curve.
Reuse the `FLOW_CHIP_META` glyph/verb vocabulary from `viewer-flow-tags.ts` for visual
consistency with the existing flow chips.

**Layout:** add `#trouble-flow` as a **static flex column** inside `#log-content-wrapper`
(the same wrapper that already holds `.log-content-clip` and `#trouble-detail`). Place it
**before** the feed (`flex: 0 0 clamp(120px, 16%, 200px)`), gated on a body class so it only
occupies space when Trouble Mode is on and the viewport is wide enough.

**Responsive guard (load-bearing):** the sidebar can be very narrow, and Trouble Mode may
already show the detail rail as a second column. Three columns will not fit a narrow sidebar.
Extend the existing `ResizeObserver` in `viewer-trouble-detail.ts` (`syncTroubleRailWidth`,
keyed at `TROUBLE_RAIL_MIN_WIDTH = 700`) so the flow column is dropped first when width is
tight — priority order feed > detail rail > flow column. This is the single riskiest piece;
it must be tested at narrow/medium/wide widths and with the detail rail open and closed.

**Files (new):**
- `src/ui/viewer-search-filter/viewer-trouble-flow.ts` — scan `allLines`, build steps,
  render the strip, `scheduleTroubleFlowUpdate()` (200 ms debounce, mirrors
  `scheduleTroubleChartUpdate`).
- `src/ui/viewer-styles/viewer-styles-trouble-flow.ts` — column + pill + connector CSS.

**Files (edit):**
- `src/ui/provider/viewer-content-body.ts` — add the `#trouble-flow` container markup.
- `src/ui/provider/viewer-content-scripts.ts` — import + concat the new script.
- `src/ui/viewer-search-filter/viewer-trouble-mode.ts` — call `scheduleTroubleFlowUpdate()`
  on toggle-on alongside the chart/signals updates; clear on toggle-off.
- `src/ui/viewer-search-filter/viewer-trouble-detail.ts` — extend the width observer to gate
  `#trouble-flow` visibility (add/remove a body class, e.g. `slc-trouble-flow-visible`).
- `src/l10n/strings-*.ts` — new keys: column header ("Screens"), empty state
  ("No screen navigation in this log"), "+N earlier" label. Externalized, wired via `vt()`.

**Non-goals / fences:**
- Do **not** vertically align pills to the exact feed line where the nav happened. The feed
  is virtually scrolled (prefix-sum heights); syncing a parallel column to scroll position is
  a separate, much larger change. The indicative static list is what was asked for. (Note this
  as a possible future enhancement, gated on its own plan.)
- Do **not** open a new host→webview channel or buffer — scan `allLines` in-page, same as the
  chart and signals band (OOM fence).
- Markers are never filtered/counted (architecture contract).

---

## Part 2 — Trouble severity bar chart in the Flow Map panel

**Goal:** add the Trouble Mode stacked severity-over-time bar chart (error / warning /
performance) to the Flow Map panel as a new collapsible section.

**Why a re-render, not reuse:** the trouble chart's SVG builders live in embedded webview JS;
the Flow Map is host-built HTML. The host cannot call the webview builders. So build a new
**host-side pure module** that produces the same stacked-bar SVG from `ParsedLog`, and share
the *appearance constants* so the two never drift (same technique as `nodeDisplayLines` being
shared between `flow-map-svg.ts` and `flow-map-mermaid.ts`).

**Shared constants (new tiny module):** extract the chart's geometry + palette into
`src/modules/flow-map/severity-chart-constants.ts` (or a neutral shared location):
`viewBox` dims, per-level min-bar heights, and the three colors (`--tc-error #f44336`,
`--tc-warning #ff9800`, `--tc-performance #9c27b0`). The webview chart embeds the same literal
values today (`viewer-styles-trouble-chart.ts:37-40`); reference this module from the webview
CSS builder too, or leave a cross-reference comment so a color change touches one place.

**Data (host-side, from `ParsedLog`):** bucket `IssueEvent[]` (already parsed) by a time
interval into per-window `{error, warning, performance}` counts:
- `IssueEvent` warning → warning band,
- `IssueEvent` error / `[flowmap] error` → error band,
- slow-query issue → performance band,
- crash → error band.
Bucket interval: reuse the same default the viewer uses (5 s) and cap window count (180) —
mirror `buildTroubleChartBuckets`. No app-start trimming needed here (the saved log is already
scoped), but honor the same "drop leading device backlog" only if the parsed header exposes a
launch boundary; otherwise plot the full span.

**Rendering + placement:** a new `flow-map-severity-chart.ts` (`severityChartHtml(parsed)`)
returning the SVG string, wrapped in a `<details>` section titled e.g. `📊 Severity over time`,
inserted in `flow-map-html.ts` next to the existing `📈 Activity Timeline` section. Empty state
when there are zero issues.

**Files (new):**
- `src/modules/flow-map/flow-map-severity-chart.ts` — bucket + SVG builder.
- `src/modules/flow-map/severity-chart-constants.ts` — shared geometry/palette constants.

**Files (edit):**
- `src/modules/flow-map/flow-map-html.ts` — add the section + TOC entry.
- `src/ui/viewer-styles/viewer-styles-trouble-chart.ts` **or** the flow-map styles — reference
  the shared color constants (keep single source of truth).
- Flow map l10n strings — section title + empty state, via the flow-map panel's `t()` path.

**Non-goals:** no click-to-scroll interactivity in the flow panel version (the panel has no
`allLines`/`scrollToLineNumber`); it is a read-only overview chart like the activity chart.

---

## Part 3 — Signals section + stats block in the Flow Map panel

### Part 3a — Signals section

**Goal:** a dedicated `📡 Signals` collapsible section in the Flow Map panel's detail column.

**Data:** the signal engine is host-side (`src/modules/signals/`, `cross-session-aggregator`,
`recurring-signal-builder`, `regression-detector`). The Flow Map operates on **one** log, so
"signals" here means: recurring errors from the cross-session store that also appear in this
log, plus any regression hint for this session. Reuse the existing builders; when no aggregate
store is available, degrade to a quiet empty state.

**Passive contract (must honor):** Signals stays passive by design — when there is nothing
actionable, show a calm empty state ("No recurring signals for this session"), never an
alarming placeholder. This mirrors `session-signal-surfacing.ts` "silence is golden."

**Files (new):** `src/modules/flow-map/flow-map-signals-section.ts` — build the section HTML
from the reused signal builders.
**Files (edit):** `flow-map-html.ts` (add section + TOC), flow-map l10n strings.

### Part 3b — Flow Map stats block

The Flow Map **already** has a stats grid (`sessionInfoHtml`: Screens, Duration, Slow queries,
Repeat batches, Crashes, + Project / Branch / Commit / Device / Version / Captured). The stats
below are the *additional* ones to add — a row that pairs with the new severity chart and
Signals section so the three land as one coherent triage block (**confirmed 2026-07-11**):
1. Error count / Warning count / Performance-issue count (the three severity bands, totals).
2. Error rate (errors ÷ session duration, or errors ÷ screens visited).
3. First screen an error occurred on (ties the chart to the flow).
4. Busiest screen (most actions) and longest-dwell screen.
5. Recurring-signal count for this session (ties to Part 3a).

Placement: either extend `sessionInfoHtml` with a new labeled sub-group, or a dedicated
`📊 Session stats` section — recommend **extending `sessionInfoHtml`** to avoid a fourth
near-identical stats surface (single-source-of-truth for "session facts").

**Files (edit, once confirmed):** `flow-map-html.ts` (`sessionInfoHtml` + Markdown twin
`facts()` in `flow-map-report.ts` so the saved `.md` matches), flow-map l10n strings.

---

## Sequencing

1. **Part 2** first (host-side, self-contained, lowest risk, establishes the shared
   severity-chart constants module parts 1 and 3 can align to).
2. **Part 3a** (Signals section) — host-side, reuses existing engines.
3. **Part 1** (Trouble flow column) — highest UI risk (three-column responsive layout);
   do it after the host-side wins are banked.
4. **Part 3b** (stats) — last; extends `sessionInfoHtml` with the confirmed stat set.

Each part ships and stabilizes before the next (feature-discipline rule).

## Cross-cutting requirements

- **l10n:** every new user-facing string (section titles, headers, empty states, stat labels)
  is added to the catalog and referenced by key at write time — never hardcoded. Do **not**
  run the machine-translation pipeline; adding English source keys is the whole obligation.
- **File limits:** 300-line cap per file; each new section/chart is its own module.
- **No new dependencies, no new settings** in the first pass (on-by-default within the
  surfaces). A toggle setting for the Trouble flow column is a possible follow-up, not part 1.
- **Changelog:** update `CHANGELOG.md` with each part.
- **Blast-radius note:** the shared `severity-chart-constants.ts` module is new shared
  infrastructure two runtimes read — deliberate, to prevent color/geometry drift; called out
  here rather than added silently.

## Verification per part

- Part 1: F5 host; capture/open an SDA log with `[flowmap] enter` lines; confirm the column
  lists screens in order, collapses repeats, drops first under narrow width, and never
  overlaps the feed or detail rail. Unit-test the step-builder (DOM-less) like the flow-tag
  classifier tests.
- Part 2: unit-test the bucketing (issues → bands → windows) against a fixture `ParsedLog`;
  visually confirm the chart matches the Trouble Mode chart's look.
- Part 3a: fixture with and without an aggregate store → section renders / shows quiet empty
  state.
- Part 3b: confirmed stat list computes correctly and the saved `.md` twin matches the panel.
