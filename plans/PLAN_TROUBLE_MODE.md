# Plan — Trouble Mode Dashboard

## Status: In progress — Stage 1+2 shipped (zero-context feed filter); chart/detail/Crashlytics/Copy Report remain

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

## Finish Report (2026-07-09) — Stage 1+2: zero-context feed filter

**Scope:** the mode toggle (command + view-title button + footer chip) and the
zero-context issue feed (the `troubleFiltered` filter flag through the full
filter/height pipeline). Deliberately NOT in this stage: the live severity chart
(Stage 3), the detail/report pane (Stage 4), Crashlytics feed rows (Stage 5),
and Copy Report (Stage 6) — each is independently shippable and follows.

### What shipped

Trouble Mode is now an orthogonal viewer filter: an own `troubleFiltered` flag
that hides every line whose `item.level` is not error/warning/performance, layered
on top of (never replacing) the user's existing level selection, giving true
zero-context (no ±N context window). Markers are never filtered. Toggled by
`saropaLogCapture.troubleMode.toggle` (view title bar warning icon + command
palette) or by clicking the footer chip; the active state persists per-webview via
`setState`. A warning-colored footer chip + `slc-trouble-active` body class make
the mode visible so hiding most of the log never reads as a broken viewer.

`calcTroubleFiltered(level)` is the single classifier, called both in the apply
pass (`applyTroubleFilter` over `allLines`) and at line birth
(`computeLineBirthHeight`), so a line arriving while the mode is active is born at
height 0 instead of flashing full-height until the next recalc — the same
birth-height contract every other filter honors.

### Files changed

- `src/ui/viewer-search-filter/viewer-trouble-mode.ts` — NEW. State, classifier,
  apply pass, toggle, persistence, indicator; guarded for DOM-less test contexts.
- `src/ui/viewer/viewer-data-helpers-core.ts` — `troubleFiltered` added to the
  `calcItemHeight` filter gate.
- `src/ui/viewer/viewer-data-add-line-birth.ts` — `calcTroubleFiltered(lvl)` folded
  into `computeLineBirthHeight`.
- `src/ui/viewer/viewer-data-add.ts` — `troubleFiltered` stamped on each new lineItem.
- `src/ui/provider/viewer-content-scripts.ts` — script registered after the level filter.
- `src/ui/viewer/viewer-script-messages.ts` — `triggerToggleTroubleMode` case.
- `src/commands-tools.ts` — command registration (posts the trigger message).
- `src/ui/viewer-toolbar/viewer-toolbar-html.ts` — footer chip markup.
- `src/ui/viewer-styles/viewer-styles-session-newer.ts` — chip CSS (next to `.log-staleness`).
- `package.json` — command def (`$(warning)` icon) + view/title menu entry.
- `package.nls*.json` (×11) — `command.troubleModeToggle.title` (English value across locales; MT is operator-run).
- `src/l10n/strings-webview-c.ts` — chip label + tooltip runtime keys.
- `plans/reference/{webview-outbound-message-types,contributes-commands}.md`,
  `src/l10n/nls-coverage-data.ts` — regenerated catalogs.
- `CHANGELOG.md` — Unreleased › Added entry.
- Tests: `src/test/ui/viewer-trouble-mode.test.ts` (NEW) — classifier, apply-pass
  marker exemption, and birth-height integration through real `addToData`/`calcItemHeight`.

### Testing

- `npm run check-types` — clean.
- `npm run compile-tests` — clean.
- `npm run test:file -- out/test/ui/viewer-trouble-mode.test.js` — 3 passing.
- `viewer-blank-row-affordance.test.js` (same `addToData`/`calcItemHeight` path) — 2 passing, no regression.
- Lint on all touched files — clean. (Two pre-existing max-lines warnings in
  `viewer-data-helpers-core.ts` and `viewer-script-messages.ts` are unchanged by
  this work — line counts vs HEAD are identical; not introduced here.)
- `verify-nls`, `verify:nls-coverage`, `verify:l10n-keys`,
  `verify:host-outbound-catalog`, `verify:list-commands` — all OK.
- **Not executed here:** F5 Extension Development Host manual pass (toggle in both
  the sidebar view and the pop-out; confirm the chip, the body class, persistence
  across reload, and that toggling off restores the prior level selection).

### Open / follow-up

- Stages 3–6 (chart, detail pane, Crashlytics rows, Copy Report) remain, each
  building on this feed. Open questions 1–5 above (icon, chart color, default
  trouble set, sidebar three-pane layout, plan numbering) still stand for those stages.
- Manual F5 verification of the toggle/persistence/indicator is the only unrun check.

## Finish Report (2026-07-09) — UX relocation: toolbar button + level-dot state

**Scope:** moved the Stage 1 controls off the editor view-title bar into the log
viewer's own toolbar, per owner feedback. No change to the filter engine.

### What shipped

- **Trouble Mode toggle is now a toolbar button** (`#toolbar-trouble-btn`, warning
  triangle) placed next to the filter icon — it is a filter, so it lives with the
  filters. `toolbar-icon-btn-active` + `aria-pressed` show on/off. The separate
  footer chip was removed; the button and the dimmed dots carry the state.
- **Level dots reflect what is hidden:** while Trouble Mode is active, the dots for
  the suppressed levels (info, notice, debug, database, todo) dim via a
  `body.slc-trouble-active` CSS rule keyed on `data-level`, without mutating the real
  `enabledLevels` filter state.
- **Collapse all / expand all moved into the toolbar** (`#toolbar-collapse-btn`) as a
  single button that swaps its icon (`codicon-collapse-all` ↔ `codicon-expand-all`)
  and title to reflect state. The palette commands still work and keep the icon in
  sync via `window.__setAllSectionsCollapsed`.
- The `view/title` menu entries for Trouble Mode and collapse/expand were removed; the
  commands themselves remain registered (command palette).

### Files changed (this iteration)

- `src/ui/viewer-toolbar/viewer-toolbar-html.ts` — trouble + collapse/expand buttons; removed footer chip.
- `src/ui/viewer-toolbar/viewer-toolbar-script.ts` — collapse/expand wiring, state, icon/title swap.
- `src/ui/viewer-search-filter/viewer-trouble-mode.ts` — indicator repointed to the toolbar button.
- `src/ui/viewer/viewer-script-messages.ts` — palette collapse/expand cases sync the toolbar icon.
- `src/ui/viewer-styles/viewer-styles-level.ts` — dim non-trouble dots under `slc-trouble-active`.
- `src/ui/viewer-styles/viewer-styles-session-newer.ts` — reverted the (now-unused) footer-chip CSS.
- `src/l10n/strings-viewer.ts` — toolbar button titles/labels; `strings-webview-c.ts` — removed chip keys.
- `package.json` — removed the two view/title menu entries (trouble + collapse/expand).
- `CHANGELOG.md` — Unreleased › Changed entries.

### Testing

- `check-types` clean; `compile-tests` clean; `verify:l10n-keys`, `verify:list-commands` OK.
- `viewer-trouble-mode.test.js` — 3 passing (indicator now guards the DOM, logic unchanged).
- Emitted `getToolbarScript()` / `getTroubleModeScript()` parse-checked via `new Function`.
- Lint clean on touched files (the one remaining `viewer-script-messages.ts` max-lines
  warning is pre-existing; my edits there were in-place, no net line added).
- **Not executed here:** F5 manual pass — button placement/active style, dot dimming,
  collapse/expand icon swap and palette sync, in both sidebar and pop-out.
