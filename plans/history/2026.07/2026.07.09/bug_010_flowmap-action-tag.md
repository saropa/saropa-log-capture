# bug_010 — `[flowmap] action` tag: explicit in-screen action breadcrumbs

**Status:** Fixed

## Problem

The Flow Map's per-node action counts (`FlowNode.actionCounts`, rendered as "Favorite: 6" style
badges) are fed ONLY by contacts-app-shaped heuristic matchers in
`src/modules/flow-map/flow-map-breadcrumbs.ts`:

- `Activity flag made/removed <Flag>: …`
- `Removed from <X> Contacts: …`

Any other project — or any contacts action that doesn't match those exact English shapes — gets
zero action data. `action` is the only `TimelineEvent` kind with no explicit `[flowmap]` tag path;
`enter` covers nav surfaces and `handoff` covers off-app exits.

## Fix

Add a third verb to the `[flowmap]` tag grammar, parallel to `enter` and `handoff`:

```
[flowmap] action "<Category>" [<lib/path/file.dart:line>]
```

- The quoted string is both the display label and the `actionCategory` used for per-node counts
  (matching how the heuristic matchers set `label` = `actionCategory`).
- Optional `file.dart:line` source anchor, handled identically to `enter`/`handoff` (leading `./`
  stripped). Carried on the event for grammar consistency even though `applyAction` only
  increments counters today.
- Case-insensitive, like the other verbs.

No builder change needed: `buildGraph` already routes `kind: 'action'` events through
`applyAction`, which attributes the count to whichever node is current.

## Scope

- `src/modules/flow-map/flow-map-breadcrumbs.ts` — `FLOWMAP_ACTION` regex + `parseFlowMapAction()`,
  checked after `enter`/`handoff` and before the heuristic matchers.
- `src/test/modules/flow-map/flow-map.test.ts` — parse test (with and without source anchor) +
  builder test proving the count lands on the current node.
- `plans/guides/flowmap-tag-navigation.md` — document the verb.
- `CHANGELOG.md` — entry.

## Verification

- Unit tests pass for the touched test file (`node --test` on the compiled output).
- `npm run check-types` clean.

## Finish Report (2026-07-09)

### Defect

The Session Flow Map's per-node action counts were populated only by heuristic regexes matching
one app's exact English breadcrumb text (`Activity flag made …`, `Removed from … Contacts`). Every
other project's Flow Map rendered with no action data, and `action` was the only `TimelineEvent`
kind lacking an explicit `[flowmap]` tag path.

### Change

- `src/modules/flow-map/flow-map-breadcrumbs.ts` — added `FLOWMAP_ACTION`
  (`[flowmap] action "<Category>" [<file.dart:line>]`, case-insensitive verb) and
  `parseFlowMapAction()`, checked after `enter`/`handoff` and before the heuristic matchers, so
  an explicit tag always wins over heuristic text on the same line. The quoted category is both
  the display label and the `actionCategory` counter key; the counter key itself is
  case-sensitive. The optional source anchor reuses `tagSource()` (leading `./` stripped).
- No builder or renderer changes: `buildGraph` already routes `kind: 'action'` events through
  `applyAction`, which folds the count onto the current node, and every rendering surface
  (report, HTML body, mermaid, SVG detail popup) reads `FlowNode.actionCounts`, not the events.
  Actions never create nodes or edges; an action before any surface is entered is dropped.
- `src/test/modules/flow-map/flow-map-tags.test.ts` (new) — the `handoff` (bug 009) and `action`
  (bug 010) tag-verb suites, extracted from `flow-map.test.ts` to keep both files under the
  300-code-line eslint `max-lines` gate. Adds two edge tests beyond the original three: tag
  precedence over a heuristic match on the same line, and a trailing `[sar-…]` correlation suffix
  neither leaking into the category nor mis-parsing as a source anchor.
- `plans/guides/flowmap-tag-navigation.md` — "The `action` verb" section documenting the format,
  the case-sensitive counter key, and the orphan-drop behavior.
- `CHANGELOG.md` — Unreleased → Added entry.

### Verification

- Extension Host runs: `npm run test:file -- out/test/modules/flow-map/flow-map.test.js`
  (27 passing) and `… flow-map-tags.test.js` (8 passing), exit 0.
- `npm run compile-tests` (full tsc typecheck + emit) clean.
- Scoped eslint over the three touched TypeScript files: zero warnings (the pre-fix state had a
  confirmed `max-lines` warning at 316/300 on `flow-map.test.ts`; resolved by the suite
  extraction, 27 tests / 8 tests split).
- ReDoS review of the new regex: no nested quantifiers; the only backtracking source
  (`\S+\.dart` in the optional anchor group) is linear per attempt — same shape as the shipped
  `enter`/`handoff` regexes.
