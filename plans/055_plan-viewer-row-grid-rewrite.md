# 055 — Viewer row-grid rewrite (remaining)

## Status: Open — 2 cleanup items

Phases 1–2 shipped. The full design (per-row `display: grid`, exact `ch`
columns, the DOM cell contract, phasing and risk analysis) plus all three finish
reports are archived at
`plans/history/2026.06/2026.06.10/055_plan-viewer-row-grid-rewrite_phases-1-2.md`.

The grid is **opt-in via `.log-cols`**. Marker / chip / format rows deliberately
do not receive it and stay block-layout; chips that visually align to the
message column do so via a left-padding var, not a grid track.

## Remaining

### 1. Remove the legacy `:not(.cols)` CSS

The opt-in rollout left `:not(.cols)` guards behind. **15 occurrences** today
(lead-findings said 24 — that count is stale; verified 2026-09-03):

| File | Count |
|------|-------|
| `src/ui/viewer-styles/viewer-styles-decoration.ts` | 6 |
| `src/ui/viewer-styles/viewer-styles-ai.ts` | 2 |
| `src/test/ui/viewer-column-layout.test.ts` | 3 |
| `src/test/ui/viewer-severity-bar-connector.test.ts` | 3 |

Once every render path is on the grid these guards are dead weight and make the
stylesheet harder to reason about. Remove the source rules, then update the two
test files that assert on them.

**Do not remove them before confirming every render path actually opts in** —
the guards are what keep non-grid rows rendering correctly today.

**Effort:** 2h.

### 2. CSV / markdown `.cols` adoption

`src/modules/export/export-formats.ts` produces the CSV and markdown exports.
The column model has **zero consumers there** — the exporters still derive their
own layout rather than reading the grid's column definitions.

Adopting `.cols` would make an exported table match what the viewer shows, and
gives a single source of truth for column order and width. This is the last
piece that would justify the column model existing outside the DOM.

**Effort:** 4h. **Optional** — the exports are correct today, just independently
derived. Skip if the duplication is not causing drift.

## Closed decisions

- **D3 — chips and marker rows.** Resolved during Phase 1: the grid is opt-in,
  so these rows simply never receive it. No opt-out class and no empty-track
  math. Recorded here because lead-findings listed D3 as still open; it is not.
