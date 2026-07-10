# bug_010 — `[flowmap] action` tag: explicit in-screen action breadcrumbs

**Status:** Approved (owner said yes, 2026-07-09) — in progress

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
