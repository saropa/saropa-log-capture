# Handover — flow map review fixes and empty-state onboarding
2026-08-06 22:16 EDT · saropa-log-capture / main · VS Code extension (TypeScript)

## Unfinished tasks

1. [pending] **F5 manual verification of all flow-map work** — every quality gate except gate 5
   (manual test in the Extension Development Host) has passed. Nothing in this session was
   confirmed against a live webview. Highest-value checks, in order: the empty-state note on a
   breadcrumb-less log, the ▶ Replay walkthrough with screenshot previews, and the "Add rule"
   button's config write + auto-refresh. Press F5 in **VS Code, not Cursor** (Cursor's Extension
   Development Host does not load the extension reliably; `.vscode/launch.json:1`).

2. [pending] **Confirm the original blank-diagram report is actually fixed** — the diagnosis was
   made by reproducing an invalid negative-height SVG from the user's own logs, never by observing
   the user's panel. If the explanatory note does NOT appear where blankness was seen, the root
   cause is something else and the investigation must reopen. See "Gotchas".

3. [pending] **Plan 118 — rule outcome preview** (`plans/118_plan-breadcrumb-rule-preview.md`,
   status Proposed, not started). Show how many nodes a suggested breadcrumb rule WOULD create,
   and its first labels, before writing it to settings. Design decision already recorded: compute
   through the real `parseLog` pipeline, never a parallel matcher.

4. [pending] **Consider `flowMap.customBreadcrumbs` / `customIssues` for README** — currently
   documented only in `plans/guides/configuration.md` (a new "Flow Map Settings" section).
   README:244 points at that guide, so this may be sufficient; no action taken deliberately.

## Completed tasks

1. **Legend → tooltip** — the flow map's legend paragraph became an `ℹ` circle with a CSS
   hover/focus tooltip (`.fm-legend-tip`). Verified by test assertions in both the report body and
   the pop-out diagram body.

2. **Located the screenshot toggle** (user question, no code change) — the camera icon
   (`codicon-device-camera`, `#screenshot-toggle`) lives in the **log viewer footer bar**, left of
   the filename; `viewer-toolbar-html.ts:113-114`. It is always rendered and dims to 35% opacity
   when `saropaLogCapture.integrations.screenshots.enabled` is false — it never hides, which is why
   it was hard to find.

3. **Plan 117 — 13-item flow-map review, all phases shipped.** Archived to
   `plans/history/2026.07/2026.07.30/117_plan-flow-map-review-fixes.md` with a Finish Report.
   Commits: A `c0630bbf`, B `ef829145`, C `6a253bc8`, D `b7b95ce6`, E `a937fb8f`, plus post-review
   hardening `9e288f41`.
   - **Phase A (parser/builder correctness):** worst slow query keeps its real timestamp (was
     `tsMs: 0`, which the issue overlay skips, so it never badged a node and sorted above the
     timeline); `FlowEdge.dwellMs` accumulates per-transition dwell (edge labels had shown the
     node's TOTAL dwell across all visits); `detectCrashes` finds every exception banner (was
     first-only) with `ParsedLog.crashes[]`; nav-stack return-pop uses `lastIndexOf` (was
     `indexOf`, over-popping when a key sat on the stack twice); warnings keep a repeat count
     (`×N`); mid-session `App Startup` resets the walk to the launch node and shows a Restarts row.
   - **Phase B (rendering):** the SVG's baked dark-only hex palette moved to CSS classes styled
     with semantic tokens, so light themes work; visit badge only on revisits; back-edge bulges
     stagger; per-role label clipping.
   - **Phase C (l10n):** 43 new `flowMap.*` keys; `strings-flow-map.ts` split out of `strings-b.ts`
     at the 300-line budget. The saved markdown report stays English (portable artifact).
   - **Phase D (extensibility):** `saropaLogCapture.flowMap.customBreadcrumbs` and `.customIssues`
     settings + pure `flow-map-custom-patterns.ts`; NLS keys across all 11 locale files.
   - **Phase E (screenshots):** `.screenshots.json` sidecar joined to the map; data-URI thumbnails
     capped at 12; clickable to reveal the log line.

4. **Replay walkthrough** (`67c7d2de`, `b6c2ae14`) — ▶ button steps through walked screens in
   visit order at 900ms, centering each; screens with a screenshot show a floating preview cloned
   from the gallery's data URI (no re-fetch).

5. **Blank-diagram defect fixed** (`a82325df`, hardened in `05b39e49`) — see narrative. Finish
   report at `plans/history/2026.08/2026.08.05/flow-map-blank-diagram-empty-graph.md`.

6. **Empty-state onboarding** (`3fe2e42f`, fixed `9206b808`, hardened `2a5e9ff7`) — suggests custom
   breadcrumb rules mined from the log's own repeated line shapes, one click to accept.

7. **CHANGELOG carve-out after a mid-session publish** — v9.3.4 shipped while work was in flight
   and a later commit edited bullets INSIDE the published section. Restored `## [9.3.4]`
   byte-for-byte from the release commit and moved post-release entries to a fresh heading.

## Session narrative

### User requests

In order:

1. "find the flow workflow web page" / put the legend into a tooltip / "where is the toggle to turn
   on/off screenshots?"
2. "1. fix the legend. 2. i said I cant find the screenshot icon" — the user wanted the icon's
   LOCATION, not the setting name. Corrected accordingly.
3. "do a review of the flow screen and the cpatures thatare used to build it. how can it be
   improved?" — produced a 13-item review.
4. "write a plan and then implement them all."
5. **"stop, you should be farming out work to cheaper, junior models!"** — the pivotal correction.
   Phases A/B had been done inline on Opus. Everything after was delegated to Sonnet subagents.
6. "1. harden the items raised in the handoff reflection 2. implement the unrequested feature
   3. update changelog and git commit" (twice, at two different /finish gates).
7. "9.3.4 is already deployed" then "and the intro message" — the changelog carve-out.
8. "flow charts stop displaying - just a blank space now" — the blank-diagram bug report.
9. Final round: harden reflections, **write a plan** for the unrequested feature (not implement it),
   changelog + commit.

### Investigation & analysis

**The blank-diagram bug (most important investigation).** The user reported flow charts rendering
as blank space. Approach: reproduce statically rather than guess. Rendered SVGs from fixtures
through the compiled modules in `out/`, checking for `NaN`/`undefined`/zero output. A zero-node
graph emitted `viewBox="0 0 288 -2"` and `height="-2"`.

Root cause: `layout()` in `flow-map-svg.ts` computed `height = y - ROW_GAP + MARGIN`. With no rows
placed, `y` never advanced past `MARGIN`, giving `26 - 54 + 26 = -2`. **A negative height is
invalid SVG; browsers render nothing and report no error** — the failure had no console signal.

Confirmed against the user's real logs at `D:\src\contacts\reports\20260805\` — both
`20260805_074229_contacts.log` and `20260805_000851_contacts.log` parse to **0 events, 0 nodes**.
They are logcat-only captures with no navigation breadcrumbs. Ruled out: CSS/token failure (brace-
balanced the generated stylesheet, probed for palette rules — all present); translation-bundle
quote corruption (checked, the quotes found were normal toast messages); screenshot data-URI weight
(no `.screenshots` sidecars exist at all in that reports tree).

**Critical framing:** the defect was latent since the feature shipped. It is triggered by log
SHAPE, not by any recent code change. The user's logs changed character (logcat-only / tooling
runs) and started hitting it.

**Dead heuristic found by testing against real data.** After building the suggestion feature, ran
it against the real logs. Two defects that its own green test suite had certified as working:
- `stripPrefix` peeled only ONE leading `[bracket]` group, but capture lines stack them:
  `[08:00:01.000] [console] [log] Route pushed: Home`. Every real line stayed `[`-leading and
  matched no prefix shape — **the feature would have suggested nothing for the exact format it
  targets.** The test helper emitted a single-bracket line, which is precisely why it passed.
- Logcat tag prefixes (`W/ViewRootImpl(15450)`) ranked top by volume. They are platform plumbing,
  and the embedded PID changes every run, so an accepted rule would create junk nodes then go stale.

**Broken round-trip found the same way.** The arrow-separator support generated
`^Navigated-> (.+)$` from `Navigated -> HomePage` — a rule matching nothing it came from, because
the pattern was rebuilt from a trimmed prefix + separator, dropping the spacing.

**Concurrency incident.** Early in the session, `flow-map-builder.ts` was corrupted to binary
(NUL bytes) by interleaved edits while another workstream wrote to the repo. Recovery: the NULs
were pre-existing in HEAD (edge-id separators written as literal control characters); replaced with
visible `\0` escapes via a scratchpad Python script. The same artifact recurred once in
`flow-map-empty-diagnostic.ts` and was fixed identically.

### Changes made

**`src/modules/flow-map/flow-map-svg.ts`** — palette functions return CSS class names instead of
hex (`paletteOf` → `{cls, dashed}`); `visitBadge` requires `visits >= 2`; back edges take a
`backIndex` and stagger by `BACK_STAGGER`; `clip(line, isTitle)` per-role budgets; `edgeLabel` uses
`edge.dwellMs`; `layout()` returns dimensions through new `safeDimension()` (floors both axes,
rejects non-finite).

**`src/modules/flow-map/flow-map-log-parser.ts`** — `crashAt()` + `detectCrashes()` replace
`detectCrash()`; `CRASH_BANNER_RE` loosened to `/Exception caught by\s+\w/i` (the old
`[\w ]+library` missed Flutter **gesture** exceptions); the per-crash widget scan bounds at the
next banner (a widget-less crash was stealing the next crash's anchor); `ScanState.warnings` is a
count map flushed by `flushWarnings()`; `worstSlow` keeps `tsMs`/`clock`; `parseLog` takes optional
`CustomPatterns`.

**`src/modules/flow-map/flow-map-builder.ts`** — `recordEdge`/`recordTransition` take and
accumulate `dwellMs`; `lastIndexOf` for return-pop; `applyRestart()`; `applyCrash(state, crash)`
per crash; **`BuildState.segments`** (closed `{key,start,end}` occupancy records) with
`crashFromKey()` reading them — node dwell windows span ALL visits including gaps, so a crash in a
revisit gap anchored to the wrong screen.

**`src/modules/flow-map/flow-map-html.ts`** — localized throughout; `legendAndDiagram()` is the
single decision point for legend visibility; `flowDiagramHtml(graph, withPopout, emptyDetail,
suggestions)` renders the empty state; `emptyDetailFor(parsed)` picks the provenance line;
screenshot figures carry `data-screen-key`.

**New:** `flow-map-custom-patterns.ts`, `flow-map-screenshots.ts`, `flow-map-empty-diagnostic.ts`,
`flow-map-panel-replay-script.ts`, and five test files.

**`src/ui/panels/flow-map-panel.ts`** — `addFlowMapPattern` message handler; `ruleTarget()` falls
back to Global scope when no workspace folder; `hasPattern` compares trimmed; main-report CSP
gained `img-src data:` (pop-out unchanged — it renders no gallery).

### Decisions & trade-offs

- **Delegate to Sonnet subagents, sequentially not concurrently.** After the corruption incident,
  agents were given disjoint file sets and run one at a time when they shared a file. Phases C and
  D ran in parallel (disjoint); E waited for D because both touch `commands-flow-map.ts`.
- **Review every agent diff before committing; the parent commits.** Agents were instructed never
  to commit. This caught: a silent no-op on duplicate "Add rule" clicks (violates the project's
  "no silent async" rule), the legend rendering over an empty diagram, and both dead-heuristic bugs.
- **Empty-state provenance over a generic note.** `parsed.lastClock` distinguishes "scanned the log,
  matched nothing" from "recognized nothing at all", because a future parser regression would
  otherwise wear the "instrument your app" note and mislead maintainers.
- **Compute rule previews through `parseLog`, not a parallel matcher** (plan 118) — a preview that
  can disagree with reality is worse than none.
- **Markdown report stays English** — it is a portable artifact that leaves VS Code.
- **The 500-char custom-pattern scan limit SKIPS over-length lines rather than truncating** —
  truncation would let `$`-anchored patterns match at the cut point and fabricate hits.

### Rejected / dismissed / deferred

- **Committing the l10n bundle sync** — an agent's `bundle.l10n.json` sync swept in a `Reverse` key
  belonging to the user's concurrent session-display work. Excluded; the user's l10n workstream
  syncs all English keys together. Do not commit that file from a flow-map change.
- **Editing suggested rules inline before accepting** — out of scope in plan 118 (settings-editor
  concern).
- **Extracting `NODE_CREATING_KINDS`** to a shared constant — duplicated between the builder and
  the screenshot join, but the project rule is "wait for 3+ uses"; only 2 today. Recorded as a
  known follow-up in the plan-117 finish report.
- **Per-visit dwell intervals for node windows** — the general fix for window conflation. Deferred;
  `segments` solves the crash-anchoring case specifically. Recorded as a follow-up.
- **README settings documentation** — see unfinished task 4.

### User feedback & corrections

- **"stop, you should be farming out work to cheaper, junior models!"** — the standing instruction
  for the rest of the session. Default to Sonnet subagents for bounded, well-specified work; the
  parent reviews and commits.
- **"i said I cant find the screenshot icon"** — a location question had been answered with a
  setting path. Answer what was actually asked.
- **"9.3.4 is already deployed"** — surfaced that a commit had edited an already-published
  changelog section. The repo has a documented incident (9.0.6/9.0.7) and a `verify:release-version`
  gate for exactly this. Always write under `[Unreleased]`.
- **"write a plan to implement the unrequested feature"** (final round) — the previous two rounds
  had built the brainstormed feature; this time the user wanted the plan only. Honor the verb.

## Key files & paths

- `src/modules/flow-map/flow-map-svg.ts` — hand-rolled SVG layout + render; the negative-height bug
  lived in `layout()`.
- `src/modules/flow-map/flow-map-log-parser.ts` — log → `ParsedLog`; crash detection, issue
  classification, custom-pattern hooks.
- `src/modules/flow-map/flow-map-builder.ts` — `ParsedLog` → `FlowGraph`; nav stack, dwell,
  occupancy segments, crash anchoring.
- `src/modules/flow-map/flow-map-html.ts` — report body; empty state, sections, tables, gallery.
- `src/modules/flow-map/flow-map-empty-diagnostic.ts` — breadcrumb suggestion heuristic (pure).
- `src/modules/flow-map/flow-map-custom-patterns.ts` — compiles the two custom-pattern settings.
- `src/modules/flow-map/flow-map-screenshots.ts` — sidecar → node join (pure); `screenKeyOf` MUST
  mirror the builder's `normalizeKey`.
- `src/ui/panels/flow-map-panel.ts` — webview host; CSP, message dispatch, config writes.
- `src/ui/panels/flow-map-panel-replay-script.ts` — replay client script.
- `src/ui/panels/flow-map-panel-styles.ts` — all diagram colors (semantic tokens).
- `src/l10n/strings-flow-map.ts` — all `flowMap.*` English source keys.
- `plans/history/2026.07/2026.07.30/117_plan-flow-map-review-fixes.md` — plan 117 + finish report.
- `plans/history/2026.08/2026.08.05/flow-map-blank-diagram-empty-graph.md` — blank-diagram finish
  report.
- `plans/118_plan-breadcrumb-rule-preview.md` — proposed, not started.
- `plans/guides/configuration.md` — new "Flow Map Settings" section.

## How to verify

```
npm run check-types
npm run compile                      # full 12-gate chain; expect 0 errors, 14 pre-existing warnings
npm run compile-tests
npm run test:file -- out/test/modules/flow-map/flow-map.test.js                  # 27
npm run test:file -- out/test/modules/flow-map/flow-map-review.test.js           # 19
npm run test:file -- out/test/modules/flow-map/flow-map-tags.test.js             # 15
npm run test:file -- out/test/modules/flow-map/flow-map-custom-patterns.test.js  # 13
npm run test:file -- out/test/modules/flow-map/flow-map-empty-diagnostic.test.js # 13
npm run test:file -- out/test/modules/flow-map/flow-map-screenshots.test.js      # 10
npm run test:file -- out/test/modules/flow-map/flow-map-replay.test.js           # 4
```

Reproduce the original defect's fix directly:

```
node -e "const fs=require('fs');const{parseLog}=require('./out/modules/flow-map/flow-map-log-parser');const{buildGraph}=require('./out/modules/flow-map/flow-map-builder');const{renderSvg}=require('./out/modules/flow-map/flow-map-svg');const l=fs.readFileSync('D:/src/contacts/reports/20260805/20260805_074229_contacts.log','utf-8').split(/\r?\n/);console.log(renderSvg(buildGraph(parseLog(l))).match(/viewBox=\"[^\"]+\"/)[0]);"
```
Expect a positive height (`0 0 288 52`), never `-2`.

Manual (F5, **VS Code not Cursor**): open a logcat-only log → Export Flow Map → expect the
explanatory note + a "Scanned timestamped lines through HH:MM:SS" line, no toolbar, no legend, no
suggestion block. Open an instrumented log → diagram, legend, toolbar, ▶ Replay all present.

## Gotchas & traps

- **The blank-diagram diagnosis was never confirmed against the user's screen.** It was inferred
  from their logs parsing to zero events. If the note doesn't appear where blankness was seen,
  reopen — do not assume it's fixed.
- **A negative or NaN SVG dimension renders as nothing with NO console error.** This class of bug
  is invisible; `safeDimension()` guards it now.
- **Test fixtures must emit the REAL decorated line shape** (`[clock] [channel] [log] payload`). A
  helper emitting one bracket group certified a matcher that never fired in production. This is the
  single most transferable lesson of the session.
- **Another workstream edits this repo concurrently** (screenshots, l10n, troubleMode, session
  panel). Always `git status` before staging; stage explicit paths, never `git add -A`. Interleaved
  writes corrupted a file to binary once this session.
- **Literal NUL bytes can end up in template literals** written by the editing tools (seen twice).
  Detect with Python (`b'\x00' in data`) — `grep $'\x00'` is useless in bash, it matches every line.
  Fix by replacing with the visible `\0` escape.
- **`npm run package` SKIPS `verify-nls`, `verify:nls-coverage`, and `verify:l10n-keys`.** Always
  run `npm run compile` before packaging.
- **Never edit a published `## [x.y.z]` changelog section.** Write under `[Unreleased]`.
- **Never run the machine-translation pipeline.** Adding English source keys and the English sync is
  fine; the MT step is operator-run only.
- **`screenKeyOf` (screenshots) must mirror `normalizeKey` (builder)** — the replay preview pairs
  gallery figures to diagram nodes by exact key equality; divergence silently breaks previews.
- The handover folder holds 5 files — no pruning needed yet.
