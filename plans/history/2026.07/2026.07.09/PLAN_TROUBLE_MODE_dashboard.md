# Plan — Trouble Mode Dashboard (remaining stages)

## Status: Shipped — Stages 3–6 (chart, detail pane, Crashlytics band, Copy Report). See Finish Report below.

<!-- Status values: Open → In progress → Shipped / Deferred / Superseded. -->

Stages 1+2 (the mode toggle and the zero-context feed filter) shipped in v9.1.1 and
were relocated into the viewer toolbar. That work — with its Finish Reports and the
full verified current-state survey — is the archived record at
[plans/history/2026.07/2026.07.09/PLAN_TROUBLE_MODE.md](history/2026.07/2026.07.09/PLAN_TROUBLE_MODE.md).
This file carries only the remaining forward work.

## Goal (remaining)

Build out the rest of the Trouble Mode dashboard on top of the shipped zero-context
feed: a live severity chart, a detail/report pane for the selected issue, Crashlytics
issues as feed rows (background-loaded), and a one-click **Copy Report** Markdown
handoff.

## What already exists (load-bearing for these stages)

- **The feed filter is shipped:** `troubleFiltered` flag on each line item, gated in
  `calcItemHeight` (`src/ui/viewer/viewer-data-helpers-core.ts`), born-hidden via
  `computeLineBirthHeight`, applied by `applyTroubleFilter` in
  `src/ui/viewer-search-filter/viewer-trouble-mode.ts`. Toggle button
  `#toolbar-trouble-btn`; `body.slc-trouble-active` dims hidden-level dots. Chart and
  detail pane read the SAME `item.level` the feed filters on (level-badge fence,
  commit 27c46391) — never a parallel classification pass.
- **Detail report builders exist:** `src/ui/signals/signal-report-panel.ts` posts
  `Session Overview`, `Evidence`, `Cross-Session History`; Copy Report Markdown is in
  `signal-report-markdown.ts` (commit 19486dd9).
- **Health score is structured:** `src/modules/misc/health-score.ts` returns a 0–100
  score + a `factors` breakdown — render `factors` directly, never parse display text.
  ANR risk: `session-metadata.ts` `anrRiskLevel: 'low'|'medium'|'high'`.
- **Crashlytics is live and fenced:** working source is Play Developer Reporting
  (`src/modules/crashlytics/crashlytics-api.ts`); `crashlytics-watcher.ts` already polls
  in the background. Fences: never wire `firebasecrashlytics.googleapis.com` read
  endpoints (bug_008); never rebuild an editor-tab Crashlytics dashboard (2026-05-24
  pivot, `plans/054_plan-app-quality-insights.md:3-12`).
- **Zero-dependency SVG precedent:** `src/modules/flow-map/flow-map-svg.ts` (dist-size
  gate forbids a charting library anyway).
- **Design tokens:** `src/ui/viewer-styles/viewer-styles-tokens.ts` is the single source
  (`--brand-2` is orange `#ea580c`, not purple; no purple token exists).
- **Session metadata that exists:** `appVersion`, `debugAdapterType`, `debugTarget`,
  per-level counts, `anrRiskLevel`. There is NO `os`/`deviceName`/`gitCommit` field.

## Design

Each stage is independently shippable.

### Stage 3 — Live severity chart (left pane)

- Raw SVG built in the webview, following `flow-map-svg.ts`. No dependency, no canvas.
- **Aggregate in the webview, not the host.** The webview already holds every line with its
  `item.level` and timestamp; bucketing there needs no new host→webview channel and no new
  host-side buffer. The bug 001 OOM fence applies to any buffering added between capture and
  the webview — the cheapest way to honor it is to add none. Cap the bucket array (rolling
  window) so an hours-long session cannot grow it unbounded.
- Tumbling windows of 1 s or 5 s via `saropaLogCapture.troubleMode.chartInterval`.
- Stacked bars per bucket, colored from `viewer-styles-tokens.ts` tokens only:
  errors `--accent-critical`, warnings `--accent-warning`, performance `--accent-info`,
  signals/ANR — token to be chosen (Open question 2; no purple token exists).
- Clicking a bar scrolls the center feed to that bucket's first visible row.
- Chart totals tally `item.level` — the same field the feed filters on (same fence as
  Stage 2), so the chart can never disagree with the feed.

### Stage 4 — Detail report (right pane)

- Hidden until a row is selected; slides in.
- Reuse the signal-report section builders (`signal-report-overview.ts`,
  `signal-report-render.ts` evidence groups, `signal-report-history.ts`) rather than
  duplicating HTML. If the builders need extraction to be consumable from the viewer
  webview, that refactor is part of this stage — not a copy-paste.
- Health score: render `health-score.ts`'s structured `factors` array (label + delta),
  not string parsing of "score 50" text. ANR risk comes from `anrRiskLevel` metadata.
- Evidence section keeps its existing shape (target lines + context + stack extension) —
  the "zero context" rule governs the FEED, not the selected issue's evidence.

### Stage 5 — Crashlytics rows (background-loaded)

- Feed rows sourced from the existing `crashlytics-watcher.ts` cache; Trouble Mode never
  issues its own fetch and never blocks rendering on the network. If the cache is cold,
  show the feed without Crashlytics rows and let the watcher's next poll fill them in.
- Data source stays Play Developer Reporting via `crashlytics-api.ts`. Fences: no
  `firebasecrashlytics.googleapis.com` endpoints; no editor-tab Crashlytics dashboard —
  this is one row source inside the viewer, and detail rendering reuses the existing
  in-viewer Crashlytics detail overlay (plan 054 Stage 5 design).

### Stage 6 — Copy Report

- Reuse the shipped signal-report Markdown builder (`signal-report-markdown.ts`, completed
  in commit 19486dd9) as the payload engine; extend it to accept a non-signal issue row
  (plain error/warning/performance line or Crashlytics issue).
- Payload contents, in order: event type + severity; environment metadata **limited to
  fields that exist** (`appVersion`, `debugAdapterType`, `debugTarget`); the exact fault
  lines (message + collapsed stack frames / `Drift SLOW …` line). No surrounding nominal
  lines — the zero-context boundary is the point of the payload.
- If OS/device/commit metadata is wanted in the payload, capturing it is a separate,
  explicitly-scoped addition to session metadata — not an assumption in the formatter.
- Surfaces: a Copy Report button in the right-pane header; a context-menu item on feed rows.
- Export hygiene from the v9.0.0 audit applies: escape Markdown fences in copied log content
  (commit 585d966b).

## Catalog and verification checklist (per change, not at the end)

1. `npm run generate:webview-catalog` / `generate:host-outbound-catalog` after handler or
   payload changes — `npm run compile` verifies both.
2. `npm run generate:list-commands` after any `contributes.commands` addition.
3. NLS: `%key%` + all `package.nls*.json` locale files (verify-nls gates compile).
   Runtime strings: `src/l10n/strings-*.ts` keys + English bundle sync only.
4. Quality gates: `check-types`, `lint`, `compile`, targeted tests, F5 manual pass in both
   the sidebar view and the pop-out panel.
5. CHANGELOG.md `[Unreleased]` entry with each shipped stage.

## Out of scope

- Any new charting/graphing dependency (dist-size gate; flow-map precedent).
- Rebuilding an editor-tab Crashlytics dashboard (fenced, 2026-05-24 pivot).
- New Crashlytics fetch paths or endpoints (bug_008 fence).
- Running the machine-translation pipeline for the new strings (operator-run only).
- Changing the severity classifier regexes. If a classification gap surfaces during this
  work, it is a separate change landing in BOTH classifier files.

## Open questions

1. **Chart/feature icon.** Trouble Mode's toggle shipped on `$(warning)` in the toolbar.
   If the chart needs its own affordance, pick a distinct icon (e.g. `$(graph)`) rather
   than reusing `$(pulse)` (owned by Signals).
2. **Signals/ANR chart color.** No purple token exists and the token guide forbids inventing
   colors. Recommendation: `--accent-high` (the red-amber blend, `viewer-styles-tokens.ts:70`)
   for signal/ANR bars; `--brand-2` orange is too close to `--accent-warning` amber in most
   themes.
3. **Default trouble set.** `database` (Drift SQL) and `todo` are currently excluded from
   the feed. Keep them out by default (Drift SQL volume would drown the feed), with a
   possible per-level toggle row above the feed.
4. **Three panes in the sidebar.** The viewer renders in the sidebar (narrow) and the
   pop-out panel (wide). Three columns cannot fit the sidebar. Recommendation: sidebar shows
   chart-above-feed stacked, detail pane as an overlay; the full three-column grid is
   pop-out/wide-viewport only.
5. **Plan numbering.** When picked up, assign the next free `NNN_plan-` number (check
   `plans/` and `plans/history/`) per repo convention.

## Finish Report (2026-07-09)

Stages 3–6 built and verified through all 12 compile gates (`npm run compile`) plus new
unit tests. The only unverified surface is the F5 Extension-Host visual render.

### What shipped

- **Stage 3 — severity chart** (`viewer-trouble-chart.ts`, `viewer-styles-trouble-chart.ts`).
  Zero-dependency SVG stacked bars above the feed while Trouble Mode is active; buckets
  `item.level`+`item.timestamp` into tumbling windows sized by the new setting
  `saropaLogCapture.troubleMode.chartInterval` (1–60s, default 5). Bars colored from tokens
  (`--accent-critical`/`--accent-warning`/`--accent-info`). Click-a-bar → `scrollToLineNumber`.
  Aggregates in the webview; window bounded to the most-recent 180 buckets (OOM fence). Setting
  threaded through the full 8-step pipeline + NLS keys in all 11 locale files. Test:
  `viewer-trouble-chart.test.ts`.
- **Stage 4 — detail pane** (`viewer-trouble-detail.ts`, `trouble-detail-handler.ts`,
  `viewer-styles-trouble-detail.ts`). Feed-row click posts `openTroubleDetail`; host builds the
  detail reusing the signal-report builders (`renderEvidenceSection`,
  `describeTimelinePosition`, `findPrecedingAction`, `resolveSourcePaths`) and posts
  `troubleDetailReady` into an overlay over the feed (chart/toolbar stay visible). Shows fault
  line, severity, elevated ANR risk (`scanAnrRisk`), and surrounding context. Line located
  defensively (`locateLine`: `sourceLineNo` hint + text verification). Test:
  `viewer-trouble-detail-locate.test.ts`.
- **Stage 5 — Crashlytics band** (`viewer-trouble-crashlytics.ts`, `trouble-crashlytics-rows.ts`,
  `viewer-styles-trouble-crashlytics.ts`). Band of the top cached crash issues above the feed,
  read from `readCachedIssues()` — **no network fetch**; cold cache → no band. Row click reuses
  the existing in-viewer Crashlytics detail overlay (`fetchCrashlyticsDetail`). Test:
  `trouble-crashlytics-rows.test.ts`.
- **Stage 6 — Copy Report** (`buildTroubleReportMarkdown` in `signal-report-markdown.ts`,
  `handleCopyTroubleReport`). "Copy report" button in the detail-pane header + "Copy issue
  report" context-menu item on every line. Payload: severity + existing environment fields
  (`appVersion`/`debugAdapterType`/`debugTarget`) + fault line and its stack, zero surrounding
  lines; fence sized to outrun any backtick run in the content (export hygiene). Test:
  `trouble-report-markdown.test.ts`.

### Deviations from this plan (deliberate, with reasons)

- **Stage 4 signal-report cross-link deferred.** The plan wanted the full signal report inline
  when a row is a detected signal. Cached hypotheses key evidence by the *webview* line-index
  space; the detail pane works in *file* line-index space. A correct match needs an index
  mapping that was not built — deferred rather than shipped subtly wrong. Full report remains
  reachable from the Signals panel.
- **Stage 5 is a pinned band, not interleaved feed rows.** The plan said "Crashlytics issues as
  feed rows." Interleaving fights the append-only prefix sums (known weak point — top-of-feed
  insertion forces O(n) rebuilds) and issues are session/cross-session aggregates with no
  per-line timestamp, so there is no correct interleave position. A band above the feed is the
  correct model. Owner-approved during build.
- **Health-score `factors` (Open question, Stage 4 design) not used.** `health-score.ts` returns
  `{ score, weightedViolations }` from lint violations, not a session-severity `factors` array,
  so the pane uses ANR risk + context instead. The plan's premise here was stale.
