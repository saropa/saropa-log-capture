# Bug 009 — Flow Map cannot show off-app handoffs (no `external` node kind)

## Status: Fix Ready (extension side) — contacts emit side pending user scope decision

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->
<!-- Type: feature extension of plan 056 Session Flow Map, filed as a bug per request. -->

## Problem

The Session Flow Map reconstructs the user's journey through screens, tabs, and
dialogs (via the `[flowmap] enter …` tag), but it has no way to show **off-app
handoffs** — the moments the user leaves the app for an external application
(Google Maps, dialer, browser, share sheet) or the app makes an outbound API
call. These exits are part of the journey and currently vanish from the map.

The contacts app is ready to emit them, but there is nowhere for them to land:
the model's `NodeKind` is `launch | screen | tab | dialog | inline | unknown` —
no `external`/handoff kind — and the `[flowmap]` grammar only has the verb
`enter <surface>`.

```
Want:
  [Contact View] --tap address--> (Google Maps)        ↗ external
  [Contact View] --share--------> (Share sheet)         ↗ external
  [Country View] --------------> (api: wikipedia.search) ↗ external

Today: handoffs are not representable — no external node, no handoff verb.
```

## Environment (if relevant)

- Extension: saropa-log-capture (Flow Map / plan 056)
- Emitting app: saropa contacts (`d:\src\contacts`)
- Decision (2026-06-09): extend the grammar + model so handoffs are real journey
  nodes — chosen over a contacts-only neutral `[handoff]` chip, because the user
  wants handoffs IN the journey, not merely filterable.

## Reproduction

1. Capture a contacts session where the user taps an address (opens Google Maps)
   or shares a contact (opens the share sheet).
2. Run **Export Session Flow Map**.
3. The handoff does not appear anywhere in the graph, timeline, or visit log —
   the journey looks like the user never left the screen.

**Frequency:** Always (capability is absent).

## Root Cause

No `external` node kind and no `handoff` verb. A handoff is also semantically a
**leaf side-exit** (the app is backgrounded and the return is not reliably
logged), so it must be modeled like the existing inline "viewed" branch
(`applyBranch`) — edge FROM the current screen, but the external node must NOT
become current, or it would steal the screen's dwell and the next transition's
edge (the exact bug `applyBranch` already guards against for
"Viewed Connection Suggestion").

## Proposed wire format

```
[flowmap] handoff <api|app> "<Name>" [<lib/path/file.dart:line>]
```

- `handoff` — new verb, parallel to `enter`.
- `<api|app>` — `app` = launched an external application; `api` = outbound
  network request. Both map to node kind `external`; the type is preserved so
  the renderer can distinguish.
- `"<Name>"` — target, double-quoted (required): `"Google Maps"`,
  `"wikipedia.search"`, `"tel: dialer"`.
- `<file:line>` — optional, same handling as `enter` (leading `./` stripped).
- Case-insensitive, like the existing tag.

## Changes Made

<!-- saropa-log-capture (this repo): DONE. contacts emit side: NOT started — needs the OPEN
     scope decision below + permission to edit another project. -->

### saropa-log-capture — parser + model

- `src/modules/flow-map/flow-map-model.ts:20` — `NodeKind` add `'external'`.
- `src/modules/flow-map/flow-map-model.ts:68` — `TimelineEvent.kind` add
  `'handoff'` (dedicated kind; cleaner than overloading `'viewed'`).
- `src/modules/flow-map/flow-map-breadcrumbs.ts:19` — add a `FLOWMAP_HANDOFF`
  regex matching `handoff (api|app) "Name" (file:line)?`; new
  `parseFlowMapHandoff()` → `{ kind:'handoff', nodeKind:'external',
  actionCategory:'api'|'app', label, source }`; check it in
  `classifyBreadcrumb()` alongside `parseFlowMapTag` (explicit tag wins).

### saropa-log-capture — builder

- `src/modules/flow-map/flow-map-builder.ts:115` — add `applyHandoff()`
  mirroring `applyBranch` but honoring `event.nodeKind` (`'external'`) instead of
  hardcoded `'inline'`; current node stays unchanged.
- `src/modules/flow-map/flow-map-builder.ts:216` — in `buildGraph`, route
  `event.kind === 'handoff'` → `applyHandoff`. Do **not** add it to
  `transitionEvents` (must not become current / seed launch).

### saropa-log-capture — renderers + tables (each must learn `external`)

- `flow-map-format.ts:25` KIND label map → add `external: 'external'`.
- `flow-map-format.ts:64` `kindEmoji` → `case 'external': return '↗️';`.
- `flow-map-html.ts:31` `KIND_LABEL` → add `external`.
- `flow-map-report.ts:25` type-column label map → add `external`.
- `flow-map-mermaid.ts`, `flow-map-svg.ts` → audit `node.kind` switches; give
  `external` a distinct leaf style (dashed border / different fill).

### contacts (`d:\src\contacts`) — emit side

- `lib/utils/_dev/debug.dart` — add `FlowMapHandoff { api, app }` + a
  `breadcrumbHandoff(kind, name, {source})` helper mirroring the landed
  `breadcrumbFlowMap` (same gating + `flowMapSource` auto-capture).
- **Wiring — no central choke point exists (the hard part):**
  - External app opens (~12 sites): `platform_utils.dart` `launchUrl`,
    `share_utils.dart`, `lat_lng_map_utils.dart` (maps), native dialer/text,
    whatsapp/telegram/zoom/facebook utils, `native_contact_utils.dart`
    `openExternalView/Edit/Insert`, `calendar_actions_dialog.dart`.
    **Recommendation:** add ONE `PlatformUtils.launchExternalUrl(...)` wrapper
    that emits the handoff + launches, and route the scattered sites through it —
    turns ~12 edits into one choke point (matches the screens/dialogs/tabs pattern).
  - Outbound API calls (~20 service files, no central http client): mostly
    background enrichment fetches, NOT user handoffs — instrumenting all would
    flood the graph.

## OPEN — scope decision before wiring API calls (needs user)

- (a) **External app opens only** — user-visible handoffs. Recommended first pass.
- (b) **+ all outbound API calls** — noisy; background fetches dominate.
- (c) **Curated API subset** — only deliberate, user-triggered network actions.

Recommendation: ship (a) via a `launchExternalUrl` wrapper; defer (b)/(c) until
the external-node rendering is proven.

## Tests Added

<!-- PLANNED -->

- `src/test/modules/flow-map/flow-map.test.ts` — parse `[flowmap] handoff app
  "Google Maps" lib/x.dart:1`; build asserts an `external` node + edge from
  current, current unchanged; `api` variant; missing `file:line`; case-insensitivity.

## Documentation

<!-- PLANNED -->

- `plans/guides/flowmap-tag-navigation.md` — document the `handoff` verb,
  `api`/`app` types, and the leaf semantics.
- README **Flow Map** / **Log Tag Vocabulary** — mention the handoff verb.
- `CHANGELOG.md` — `### Added` under `[Unreleased]`.

## Already landed (context — NOT part of this bug)

The `[flowmap] enter` side is implemented in contacts and analyze-clean:
`breadcrumbFlowMap` + `FlowMapSurface` + `flowMapSource` in `debug.dart`, wired
into `ScreenInfoMixin.logNavigation` (screens), `showDialogCommon` (dialogs),
and `CommonTabBar` (tabs). Bottom sheets intentionally skipped
(`showBottomSheetCommon` has no name param). See contacts `CHANGELOG_TOOLING.md`
2026-06-09.

## Acceptance

- A log line `[flowmap] handoff app "Google Maps" lib/x.dart:10` renders an
  `external` leaf node off the screen active at that timestamp, with a source
  link, and the screen keeps its dwell / visit / edges.
- `api` handoffs render distinctly from `app` (or share the external style with
  the type visible in the label).
- All node-kind switches handle `external` (no fall-through to `unknown`).
- `npm run check-types` / `lint` / `compile` / tests green.

## Commits

<!-- Add commit hashes as fixes land. -->

## Finish Report (2026-06-09)

**Scope completed: saropa-log-capture extension side (this repo) — full handoff support.** The
contacts emit side was NOT touched: it is a separate project (`d:\src\contacts`) requiring explicit
permission, and the API-call scope (a/b/c) below is still an open user decision.

### What landed (extension)

- **Model** ([flow-map-model.ts](../src/modules/flow-map/flow-map-model.ts)): `NodeKind` gained
  `'external'`; `TimelineEvent.kind` gained `'handoff'`; documented that `actionCategory` carries the
  `api`/`app` type for handoffs.
- **Parser** ([flow-map-breadcrumbs.ts](../src/modules/flow-map/flow-map-breadcrumbs.ts)): added
  `FLOWMAP_HANDOFF` regex (`handoff (api|app) "Name" (file:line)?`, case-insensitive) and
  `parseFlowMapHandoff()`; checked in `classifyBreadcrumb()` right after the `enter` tag. Factored the
  shared `./`-stripping anchor parse into `tagSource()`.
- **Builder** ([flow-map-builder.ts](../src/modules/flow-map/flow-map-builder.ts)): extracted the
  leaf-branch logic into `applyLeaf()` (now shared by `applyBranch` and the new `applyHandoff`);
  `applyHandoff` prefixes `api:` onto the label and uses `event.nodeKind` (`external`). `buildGraph`
  routes `kind === 'handoff'` to `applyHandoff` and deliberately keeps it OUT of `transitionEvents`
  so a handoff never becomes current or seeds launch — it stays a leaf side-exit (same guard inline
  views already rely on).
- **Renderers**: `kindIcon` → `↗️` for external ([flow-map-format.ts](../src/modules/flow-map/flow-map-format.ts));
  `KIND_LABEL` external entry in [flow-map-html.ts](../src/modules/flow-map/flow-map-html.ts) and
  [flow-map-report.ts](../src/modules/flow-map/flow-map-report.ts) (compiler-enforced exhaustive
  records); Mermaid gained a dashed-purple `external` classDef + parallelogram shape
  ([flow-map-mermaid.ts](../src/modules/flow-map/flow-map-mermaid.ts)); SVG gained a distinct
  dashed-purple external palette ([flow-map-svg.ts](../src/modules/flow-map/flow-map-svg.ts)).
  Both diagram legends note `↗️ = off-app handoff` so it isn't confused with the dotted
  recovered-edge style.
- **Tests** ([flow-map.test.ts](../src/test/modules/flow-map/flow-map.test.ts)): a `handoff` suite —
  parses app + api (case-insensitive, source optional), builds external leaf nodes with edges from
  the active screen (screen stays current, external is a leaf, api node is `api:`-prefixed), and
  asserts the distinct render style across mermaid/svg/report with no fall-through to `unknown`.
- **Docs**: `handoff` verb documented in
  [flowmap-tag-navigation.md](../plans/guides/flowmap-tag-navigation.md); README Flow Map bullet;
  `### Added` CHANGELOG entry under `[Unreleased]`.

### Verification

- `npm run check-types` — clean (0 errors).
- `npm run lint` — 0 errors; the 9 warnings are all pre-existing in files this change did not touch
  (none in any `flow-map-*` file).
- `npm run test:file -- out/test/modules/flow-map/flow-map.test.js` — 21 passing (3 new).
- `npm run compile` — succeeds; all verify scripts (NLS, webview catalogs, command list, dist-size)
  pass.

### Not done — needs the user

The acceptance criteria are met for the extension: a log line
`[flowmap] handoff app "Google Maps" lib/x.dart:10` now renders an `external` leaf node off the
active screen with a source link, the screen keeps its dwell/visits/edges, and `api`/`app` read
distinctly. But no contacts session emits the tag yet — that requires editing `d:\src\contacts`
(separate project, needs permission) AND resolving the OPEN scope decision (a) external app opens
only / (b) + all outbound API calls / (c) curated API subset.
