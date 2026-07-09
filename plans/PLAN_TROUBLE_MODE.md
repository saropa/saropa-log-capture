# Plan — Trouble Mode Dashboard

## Status: Open

<!-- Status values: Open → In progress → Shipped / Deferred / Superseded. -->

Owner note carried over from the draft: include Crashlytics — its data must background-load
so opening Trouble Mode is never blocked on a network fetch.

Sibling owner note: [PLAN_BUILD a KILL SWITCH.md](PLAN_BUILD%20a%20KILL%20SWITCH.md)
(same drafting batch; no functional dependency).

## Goal

A dedicated triage view for the log viewer: strip away all nominal lines and show only what
is wrong. Three panes — a live severity chart, a zero-context issue feed (errors, warnings,
performance, signals, Crashlytics issues), and a detail/report pane for the selected issue
with a one-click **Copy Report** handoff (Markdown, sized for pasting into an LLM or a
ticket). The premise: observability surfaces drown faults in nominal context; Trouble Mode
inverts that.

## Current state — what already exists (verified 2026-07-09)

Most of Trouble Mode is assembly, not invention. Grep evidence per item:

- **Severity classification** is a keep-in-sync pair: `src/modules/analysis/level-classifier.ts`
  (host) and `src/ui/viewer-search-filter/viewer-level-classify.ts` (webview mirror — the
  contract is written into its header). Levels produced: `error`, `warning`, `performance`,
  `database`, `todo`, `debug`, `notice`, `info`. Any regex change lands in BOTH files, and
  never lead an unanchored `.test()` regex with an unbounded quantifier (the v7.17.3 ReDoS
  freeze, commit 6c873c65).
- **Every rendered line already carries `item.level`** in the webview. Filters read it;
  the level-badge bug (commit 27c46391) established the fence: any count or display next to
  a filter must tally the exact field the filter reads — never a parallel classification pass.
- **Viewer filters are composable** (`.claude/rules/global.md` "Webview Viewer Filters"):
  set a flag on the item, add the check to `calcItemHeight()` (the single source of truth
  for visibility), `recalcHeights()` + `renderViewport(true)`, set birth height in
  `addToData()`, never filter markers. Trouble Mode's feed is this pattern, not a new
  data provider.
- **The detail report is built**: `src/ui/signals/signal-report-panel.ts` posts the
  `Session Overview`, `Evidence`, and `Cross-Session History` sections
  (`signal-report-panel.ts:101,105,145`), and **Copy Report already shipped**
  (commit 19486dd9, `signal-report-markdown.ts` builds the Markdown).
- **Health score is structured, not a string**: `src/modules/misc/health-score.ts` returns
  a 0–100 score plus a `factors` breakdown ("3 errors: -30") ordered most-severe first.
  Render the factors directly — do NOT parse deductions out of display text.
- **ANR risk** is computed at session finalization (`src/modules/analysis/anr-risk-scorer.ts`,
  `session-metadata.ts:66` `anrRiskLevel: 'low' | 'medium' | 'high'`).
- **Crashlytics is live and fenced**: the working data source is Play Developer Reporting
  (`src/modules/crashlytics/crashlytics-api.ts`); `crashlytics-watcher.ts` already polls in
  the background on `saropaLogCapture.firebase.refreshInterval`. Two hard fences from
  bug_008 and the 2026-05-24 pivot: never wire against `firebasecrashlytics.googleapis.com`
  read endpoints, and never rebuild an editor-tab Crashlytics dashboard
  (`plans/054_plan-app-quality-insights.md:3-12`). Trouble Mode consumes the watcher's
  cached results as one feed source inside the viewer — it is not a Crashlytics dashboard.
- **Zero-dependency SVG precedent**: `src/modules/flow-map/flow-map-svg.ts`. No charting
  library; the dist-size gate (`verify:dist-size`) enforces this anyway.
- **Design tokens**: `src/ui/viewer-styles/viewer-styles-tokens.ts` is the single source.
  Correction to the draft: `--brand-2` is **orange** (`#ea580c`), not purple, and no purple
  token exists — the guide binds status colors to the host theme and forbids inventing new
  ones. Chart color mapping must come from this file (see Open questions).
- **Icon state**: `$(pulse)` is currently owned by the Signals commands
  (`package.json:211` `showSignals`, `:256` `openSignal`). `$(lightbulb)` is unused here
  but is VS Code's code-action icon.
- **Stack collapse is settled**: one level, the message row IS the toggle (commit 3e26a780;
  fence in `plans/history/2026.06/2026.06.09/stack-collapse-subgrouping_attempts.md`).
  The feed keeps this behavior for stack traces — no new grouping shapes.
- **Session metadata fields that exist** (`src/modules/session/session-metadata.ts`):
  `appVersion`, `debugAdapterType`, `debugTarget`, per-level counts, `anrRiskLevel`.
  There is **no** `os`, `deviceName`, or `gitCommit` field — the draft's payload example
  referenced fields that do not exist.

## Design

Each stage is independently shippable.

### Stage 1 — Mode toggle, command, and state

- Command `saropaLogCapture.troubleMode.toggle` in `package.json` with an NLS `%key%` title
  (update `package.nls.json` AND every `package.nls.<locale>.json`, or `verify-nls` fails
  the compile). Settings live under `saropaLogCapture.troubleMode.*` (matches the existing
  `learning.*` / `correlation.*` / `ai.*` / `firebase.*` sub-namespaces).
- Trouble Mode is a mode of the existing log viewer webview (sidebar and pop-out), not a new
  editor tab. Persist `troubleModeActive` in the webview state via the existing
  `vscodeApi.setState()` pattern so the mode survives webview restore.
- Webview → host activation message routed through a `viewer-message-handler-*.ts` module;
  host → webview data uses a `troubleModeRenderData` payload. Both catalogs
  (`plans/reference/webview-incoming-message-types.md`, `webview-outbound-message-types.md`)
  are AUTO-GENERATED — run `npm run generate:webview-catalog` /
  `generate:host-outbound-catalog`; never hand-edit.
- All new UI strings go through the runtime l10n system: symbolic keys in
  `src/l10n/strings-*.ts`, looked up via `t()` (host) / `vt()` (webview). Adding English
  source keys is part of this change; the machine-translation pipeline
  (`scripts/translate_l10n.py`) stays operator-run only — never triggered by this work.
- Terminology gate: "Trouble Mode" is not in `plans/guides/terminology.md` yet — confirm the
  name against the dictionary before the first user-facing string lands, and remember
  "session" is banned in new user copy (use "log" / "log file").

### Stage 2 — Zero-context issue feed (center pane)

The feed is the existing virtualized viewer under an additional filter flag — it inherits
selection, stack collapse, markers, and scrolling for free.

- Add `item.troubleFiltered` in an apply function: hide every line whose `item.level` is not
  in the trouble set. Default trouble set: `error`, `warning`, `performance`, plus
  signal/Crashlytics rows (Stage 4/5). `database` and `todo` are excluded by default
  (see Open questions).
- Wire the flag into `calcItemHeight()`; call `recalcHeights()` + `renderViewport(true)` on
  toggle; set birth height in `addToData()` so live lines arriving during Trouble Mode
  respect it; never filter `item.type === 'marker'` rows.
- Read `item.level` — the same field the level filters read. No re-classification pass
  (level-badge fence, commit 27c46391).
- Selection: inset-shadow highlight (no layout nudge); selecting a row renders the right pane.
- Stack traces keep the shipped one-level collapse: the promoted message row is the toggle;
  its frames fold under it.

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
2. `npm run generate:list-commands` after the `contributes.commands` addition.
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

1. **Icon.** The draft reassigns `$(pulse)` from Signals to Trouble Mode and moves Signals
   to `$(lightbulb)`. Recommendation: give Trouble Mode a new icon (e.g. `$(dashboard)` or
   `$(graph)`) and leave Signals on `$(pulse)` — reassignment churns two shipped command
   icons and `$(lightbulb)` collides with VS Code's code-action affordance.
2. **Signals/ANR chart color.** No purple token exists and the token guide forbids inventing
   colors. Recommendation: `--accent-high` (the red-amber blend, `viewer-styles-tokens.ts:70`)
   for signal/ANR bars; `--brand-2` orange is too close to `--accent-warning` amber in most
   themes.
3. **Default trouble set.** Are `database` (Drift SQL) and `todo` levels in or out of the
   feed by default? Recommendation: out, with a small per-level toggle row above the feed —
   Drift SQL volume would drown the feed the mode exists to clean.
4. **Three panes in the sidebar.** The viewer renders in the sidebar (narrow) and the
   pop-out panel (wide). Three columns cannot fit the sidebar. Recommendation: sidebar shows
   chart-above-feed stacked, detail pane as an overlay; the full three-column grid is
   pop-out/wide-viewport only.
5. **Plan numbering.** This is an owner note; when picked up, assign the next free
   `NNN_plan-` number (check `plans/` and `plans/history/`) per repo convention.
