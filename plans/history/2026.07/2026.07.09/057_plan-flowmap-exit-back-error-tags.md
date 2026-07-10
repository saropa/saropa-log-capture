# Plan — three new `[flowmap]` verbs: `exit`, `back`, `error`

Status: **proposed** (emitters already shipping from Saropa Contacts; the parser does not yet
recognize these lines and silently ignores them).

Extends [flowmap-tag-navigation.md](guides/flowmap-tag-navigation.md), which today defines
`enter`, `handoff`, and `action`. Parser: `src/modules/flow-map/flow-map-breadcrumbs.ts`
(`FLOWMAP_TAG` / `FLOWMAP_HANDOFF` / `FLOWMAP_ACTION`, `classifyBreadcrumb()`); builder:
`src/modules/flow-map/flow-map-builder.ts`.

## Why

Each verb closes a specific hole in the current Session Flow Map.

| Verb | Hole it closes |
|---|---|
| `exit` | Dwell is wrong. A dialog stays the current surface until the NEXT `enter`, so all the time the user spends back on the screen underneath is charged to a dialog that is no longer on screen. |
| `back` | Every path is drawn as forward navigation. A back press re-enters a surface and draws an edge identical to a forward one, so the map overstates how many distinct paths through the app exist. |
| `error` | The map cannot say WHERE the app breaks. Failures are invisible; a screen that quietly eats forty timeouts looks exactly like a healthy one. |

## Grammar

Matching is case-insensitive on the verb and the kind, exactly as for `enter`. The `file.dart:line`
suffix is optional in all three and handled identically (leading `./` stripped).

```
[flowmap] exit  <screen|tab|dialog|sheet|inline> "<Name>" [<lib/path/to/file.dart:line>]
[flowmap] back  <screen|tab|dialog|sheet|inline> "<Name>" [<lib/path/to/file.dart:line>]
[flowmap] error "<Category>"                              [<lib/path/to/file.dart:line>]
```

```
[12:05:41.900] [console] [log] [flowmap] exit dialog "Culture Picker" lib/components/pickers/culture_religion_picker_dialog.dart:101
[12:06:02.410] [console] [log] [flowmap] back tab "Home" lib/views/main_material_app.dart:875
[12:06:44.900] [console] [log] [flowmap] error "TimeoutException" lib/service/web_service/web_service_utils.dart:64
```

## Semantics

### `exit` — the named surface closed

- Ends that surface's dwell at this timestamp and makes the PREVIOUS surface current again.
- Creates no node and no edge. The surface keeps its visit count.
- An `exit` for a surface that never `enter`ed, or that is not the current surface, is dropped
  silently (same posture as an `action` before any surface).
- Re-entry after an exit is an ordinary `enter` (or `back`) and increments the visit count.

### `back` — a return, not a forward step

- Identical to `enter` in every respect (the named surface becomes current, its visit count
  increments, a node is created if new) with ONE difference: the edge drawn from the previous
  surface to it is a RETURN edge and must render distinctly from a forward edge.
- Emitters emit `back` **instead of** `enter`, never both, so visit counts stay honest.
- Suggested rendering: reuse the existing dotted/recovered edge treatment's *shape* but a distinct
  color, so a return can never be mistaken for an inferred (heuristic) edge.

### `error` — a failure badge on the current surface

- Creates no node and no edge. Increments a per-`<Category>` failure counter on whichever surface is
  current, rendered as an error badge beside that node — the same mechanic as `action`, styled as a
  failure.
- `<Category>` is the aggregation key: the exception's runtime TYPE (`TimeoutException`,
  `StateError`), never its message. A message carries per-instance detail (a URL, an id) that would
  make every failure its own badge.
- An `error` emitted before any surface has been entered is dropped silently.
- Not every `error` line is a bug — the calling app emits one for expected-transient failures too
  (a 404 favicon), because "which screen produces failures, and how many" is the question the badge
  answers. Severity classification stays the app's job, in the log level of the accompanying error
  line.

## What the calling project already emits (Saropa Contacts)

Wired at chokepoints; no per-call-site tagging.

| Verb | Emitter | Call site |
|---|---|---|
| `exit dialog` | `breadcrumbExit` | `showDialogCommon`, after `showGeneralDialog`'s future completes — paired with the existing `enter dialog`, same name, same source anchor. |
| `exit screen` | `breadcrumbExit` | A debug-only `FlowMapNavigatorObserver` on `MaterialApp.navigatorObservers`, on `didPop`. |
| `back screen` | `breadcrumbBack` | The same observer, on `didPop`, for the revealed route — a popped route's revealed screen never rebuilds, so only the Navigator knows the user went back. |
| `back tab` | `breadcrumbBack` | The app shell's `PopScope` handler, on the branch where a back press switches tabs. |
| `error` | `breadcrumbError` | `debugException` — the single funnel every reported exception passes through. Anchored to the exception's OWN stack (where it was thrown), not the caller's, because a rethrown error surfaces far from its origin. |

All are `kDebugMode`-only and skipped in demo mode, like `enter` / `handoff` / `action`.

The observer names routes by correlation, which matters to the parser only in that the names are
guaranteed identical on both ends: routes carry no human title (`screenPush` builds a bare
`MaterialPageRoute`), so `didPush` records the route and the screen's `initState` — the next thing to
run for that route, before any other push can interleave — binds the same string it passed to
`enter`. A screen that never announces itself leaves its route unnamed and emits neither `exit` nor
`back`, rather than corrupting a neighbour's name. Dialog and popup routes are `PopupRoute`s and are
skipped by the observer entirely; they carry their own `enter` / `exit dialog` pair.

Still not emitted, so the parser must not assume it:

- `exit sheet` — `showBottomSheetCommon` takes only a builder, so sheets have no name to enter OR
  exit with. Unchanged from the `enter` situation.
- `exit` on `pushAndRemoveUntil` (the stack clear after sign-in) — the removed routes are dropped
  silently rather than emitting `back` navigations the user never performed.

## Implementation notes for this repo

1. Three regexes beside the existing ones, e.g.
   `/\[flowmap\]\s+exit\s+(screen|tab|dialog|sheet|inline)\s+"([^"]+)"(?:\s+(\S+\.dart):(\d+))?/i`,
   the same for `back`, and an `action`-shaped one for `error`.
2. `classifyBreadcrumb()` checks all explicit tags before the heuristic matchers, as it does today.
   `back` must be checked before `enter` only if a shared regex is used; separate regexes make the
   order irrelevant.
3. `exit` needs a surface stack in the builder (currently only "current surface" is tracked) so the
   previous surface can be restored. `handoff`'s `applyHandoff()` already models a non-current leaf;
   `exit` is the inverse and should live next to it.
4. `error` reuses the `action` counter plumbing with a separate map, so a category named "Share" as
   an action and "Share" as an error cannot collide.
5. Tests mirror `flow-map` tag-verb suites added with the `action` tag (commit `0f3e5d9c`): one suite
   per verb, plus an edge test that `exit` before `enter`, and `error` before any surface, are both
   dropped rather than throwing.

## Open question

Should `exit` also close every surface entered ABOVE the named one (a stack unwind), or only match
the current surface and drop otherwise? Recommendation: **drop otherwise**. A silent unwind hides
missing `exit` emitters in the calling app, and the strict form makes an instrumentation gap visible
as wrong dwell rather than as plausible-looking data.
