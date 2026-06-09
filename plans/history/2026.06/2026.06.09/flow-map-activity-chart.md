# Flow Map — Activity line chart

User request (verbatim): "above 'screen dwell' section, add a section new with an activity line chart — it should be clickable and go to that part of the log. basic axis numbering (count vertical and time horizontal)".

This added a new **📈 Activity** section to the native Flow Map panel, directly above **Screen dwell**, plotting session event volume over time as a clickable SVG line chart.

## Finish Report (2026-06-09)

### 1. Critical note
This work will be reviewed by another AI.

### 2. Scope
**(B)** VS Code extension (TypeScript). No Flutter/Dart, no docs-only.

### 3. Deep review
- **Logic & safety:** `collectSamples` drops non-positive `tsMs` — the parser's "no timestamp" sentinel is `0`, and an untimed slow-query issue (observed `tsMs: 0`, `clock: ""`) would otherwise plant a false spike at `00:00:00` and squash real activity to the right edge. Binning guards a zero span (all samples same instant collapse to bin 0). `maxCount` is floored at 1 so `yOf` never divides by zero. Early return renders a note when `< 2` timed samples exist. No recursion, no async, no shared mutable state.
- **Architecture & adherence:** New module `flow-map-activity-chart.ts` is pure data → SVG string (no VS Code dependency), matching the existing `flow-map-svg.ts` / `flow-map-report.ts` pattern so it unit-tests without the Extension Host. The `clockOf` formatter is injected (same pattern as `enteredClock(node, clockOf)`) to avoid duplicating the ms-of-day → HH:MM:SS helper that `flow-map-html.ts` already owns — single source of truth preserved. Click handling reuses the existing `revealLogLine` host message (no new message type → webview catalogs unchanged; `verify:webview-catalog` passes). File is 184 lines (< 300 limit); functions ≤ 30 lines; ≤ 4 params each.
- **Performance & UI/UX:** Binning is O(samples). Chart scales to the detail column via `width:100%` + fixed viewBox. Theme-aware via `--vscode-charts-*` / `--vscode-panel-border` with hex fallbacks. Points are keyboard-reachable (`tabindex="0" role="link"`) with a `<title>` tooltip; only points with a real log line are links (empty bins are inert). Error boundary: a malformed/empty parse yields the note, never a broken chart.
- **Documentation quality:** Verbose module doc header explains the "activity = events + issues binned over time" model and why `clockOf` is injected. Inline WHY comments on the `tsMs > 0` filter (sentinel rationale) and the zero-span collapse.
- **Refactoring:** None beyond scope.

### 4. Testing validation
- **A. Audit existing tests (MANDATORY):** Grepped `src/test/` for every changed symbol — `activity-chart`, `activityChartHtml`, `ac-link`/`ac-line`/`ac-pt`/`ac-num`/`ac-clock`, `sec-activity`, `revealLogLine`. Only my own new references exist; no pre-existing test pinned any symbol I touched, so none required updating. The pre-existing `buildFlowMapBody` test that asserts exactly 2 `<table>` elements still holds (the chart is SVG, adds no table) — confirmed green.
- **B. New tests:** Added to `src/test/modules/flow-map/flow-map.test.ts`:
  1. `webview body has an activity chart above the dwell section, with clickable points` — asserts `sec-activity` precedes `sec-dwell`, the chart `<svg>`/`<polyline>` render, at least one `ac-pt ac-link` carries `data-line`, and both axes label (`ac-num`, `ac-clock`).
  2. `activityChart › renders a note when fewer than two timed samples exist` — header-only parse yields the `ac-empty` note and no `<svg>`.
- **Command run:** `npm run test:file -- out/test/modules/flow-map/flow-map.test.js` → **18 passing** (16 prior + 2 new). `npm run check-types` clean. `npm run lint` — my files clean (the 9 repo warnings are pre-existing in untouched files). `npm run compile` — full build + all verify steps (webview catalogs, list-commands, dist-size) pass.

### 5. Localization
SKIPPED [B-NOT-IN-SCOPE] — extension TypeScript change; no Flutter UI. The two user-visible strings ("Not enough timed activity to chart.", the legend) live in the flow-map panel HTML, which is not on the `package.nls*` pipeline (consistent with the existing flow-map legend/section strings).

### 6. Project maintenance
- **CHANGELOG:** Added an Unreleased → Added entry for the Activity chart.
- **README:** verified — no updates needed (no product-fact change beyond the changelog).
- **package.json / lock:** untouched (no release / dependency change).
- **guides reviewed** — no user-facing guide affected.
- **LAUNCH_TEST.md:** not present in this repo (`doc/`/`docs/` has no LAUNCH_TEST); the manual steps live in the "What to test" handoff below.
- **Roadmap:** SKIPPED — task was a direct user request, not a roadmap item.
- **Bug archival:** No bug archive — task did not close a `bugs/*.md` file. SKIPPED [NO-BUG-FIXED].

### 7. Persist finish report
Finish report saved: plans/history/2026.06/2026.06.09/flow-map-activity-chart.md (this file). Case B — no `bugs/*.md` and no active plan file described this work.

### 8. Files changed (this task only)
- `src/modules/flow-map/flow-map-activity-chart.ts` — NEW. The chart generator.
- `src/modules/flow-map/flow-map-html.ts` — import `activityChartHtml`, add `sec-activity` TOC entry + section between Session info and Screen dwell. (Entangled with the user's separate in-flight flow-map refactor in the same file — see Outstanding.)
- `src/ui/panels/flow-map-panel-script.ts` — `.ac-link` click/keyboard → `revealLogLine`.
- `src/ui/panels/flow-map-panel-styles.ts` — `.ac-*` chart styles. (Entangled — same file also carries the user's TOC restyle.)
- `src/test/modules/flow-map/flow-map.test.ts` — 2 new tests + import.
- `CHANGELOG.md` — Unreleased entry.

### 9. Outstanding / commit status
NOT committed. The working tree carries a large body of the user's pre-existing uncommitted work (pinning, loaded-files-history, controller tree, l10n, and an in-flight flow-map refactor that removed `statPillsHtml`, restructured `sessionInfoHtml`, and added `logPath` plumbing through `buildFlowMapBody`/`flow-map-panel.ts`). My activity-chart change is interwoven with that flow-map refactor inside `flow-map-html.ts` and `flow-map-panel-styles.ts`. A mine-only commit is impossible non-interactively: excluding `flow-map-panel.ts` would commit a broken state (it calls the new 3-arg `buildFlowMapBody` and the removed `statPillsHtml` import), and including it would commit the user's unverified refactor. Surfaced to the user for a commit decision.
