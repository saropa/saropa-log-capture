# `[flowmap]` navigation tag — instrumenting a calling project

To make the **Session Flow Map** capture *every* screen, tab, dialog, and sheet (not just
surfaces that happen to print an ad-hoc breadcrumb), the calling app emits one explicit log line
per surface entered. That line carries the `[flowmap]` tag.

This is the reliable, source-anchored path. The Flow Map has fallback heuristics that try to infer
navigation from app-shaped breadcrumbs (`Screen Navigation: …`, `… Screen Reached`, etc.), but
those only catch surfaces that already log something and can never resolve a source `file:line`.
The `[flowmap]` tag wins over all of them because it declares the surface kind **and** its source.

## Format

```
[flowmap] enter <kind> "<Name>" [<lib/path/to/file.dart:line>]
```

- **`[flowmap]`** — the literal tag. It only needs to appear somewhere in the line; the usual
  `[clock] [channel]` log decorations in front of it are fine. The line must be timestamped
  (carry the leading `[HH:MM:SS.mmm]` stamp) like any captured log line.
- **`enter`** — the literal verb.
- **`<kind>`** — one of: `screen`, `tab`, `dialog`, `sheet`, `inline`
  (`sheet` is mapped to a dialog node; `inline` marks an in-screen sub-view leaf).
- **`"<Name>"`** — the human label, in **double quotes** (required).
- **`<file.dart:line>`** — optional but strongly recommended. It is what makes each Flow Map /
  Issue Report / Screen Visit Log row link straight to the source. A leading `./` is stripped.
  Without it the surface is still captured, just with no clickable source.

Matching is **case-insensitive** on both the tag and the kind.

## Examples

```
[12:04:01.210] [console] [log] [flowmap] enter screen "Contact View" lib/views/contact_view.dart:58
[12:04:09.880] [console] [log] [flowmap] enter tab "Home" lib/views/home_tab.dart:22
[12:05:33.014] [console] [log] [flowmap] enter dialog "Culture Picker" lib/components/pickers/culture_religion_picker_dialog.dart:101
[12:06:10.500] [console] [log] [flowmap] enter sheet "Share Options" lib/components/share/share_sheet.dart:40
[12:06:44.900] [console] [log] [flowmap] enter inline "Connection Suggestion" lib/components/suggestions/connection_suggestion.dart:77
```

## What each kind becomes in the report

| Tag kind  | Flow Map node | Use it for |
|-----------|---------------|------------|
| `screen`  | screen        | A full-page route / destination. |
| `tab`     | tab           | A tab within a tabbed screen. |
| `dialog`  | dialog        | A modal dialog / alert. |
| `sheet`   | dialog        | A bottom sheet (rendered as a dialog node). |
| `inline`  | inline (leaf) | An in-screen sub-view that is not a route of its own. |

## The `handoff` verb — off-app exits

`enter` records a surface *inside* the app. `handoff` records the moment the user (or the app) leaves
it — opening an external application or making an outbound API call. These are part of the journey,
so the Flow Map needs them, but they are **leaf side-exits**: the app is backgrounded and the return
is not reliably logged. A handoff therefore draws an edge *from* the active screen to an `external`
node but never becomes the current surface — the screen keeps its dwell, visits, and the edge to
wherever the user goes next.

```
[flowmap] handoff <api|app> "<Name>" [<lib/path/to/file.dart:line>]
```

- **`handoff`** — the literal verb (parallel to `enter`).
- **`<api|app>`** — `app` = launched an external application (maps, dialer, browser, share sheet);
  `api` = an outbound network request. Both become an `external` node; the type is preserved and
  shown so the two read distinctly (an `api` handoff's label is prefixed with `api:`).
- **`"<Name>"`** — the target, in **double quotes** (required): `"Google Maps"`, `"tel: dialer"`,
  `"wikipedia.search"`.
- **`<file.dart:line>`** — optional, handled exactly like `enter` (leading `./` stripped).

Matching is **case-insensitive**, like `enter`.

```
[12:07:18.120] [console] [log] [flowmap] handoff app "Google Maps" lib/utils/lat_lng_map_utils.dart:42
[12:07:55.700] [console] [log] [flowmap] handoff app "Share sheet" lib/utils/share_utils.dart:30
[12:08:31.004] [console] [log] [flowmap] handoff api "wikipedia.search"
```

| Tag kind     | Flow Map node    | Use it for |
|--------------|------------------|------------|
| `handoff app`| external (leaf)  | Opening an external app (maps, dialer, browser, share). |
| `handoff api`| external (leaf)  | A deliberate, user-triggered outbound API call. |

External nodes render with a distinct dashed purple style and an ↗️ glyph so an off-app exit never
looks like an in-app screen or a recovered (dotted) edge.

## Guidance for the calling project

- **Emit the tag at the moment the surface becomes visible** (e.g. in the route's `initState` /
  the dialog's `showDialog` call site), so the timestamp reflects entry order — the Flow Map walks
  surfaces in entry order and uses these timestamps for the Activity Timeline.
- **Always include the `file.dart:line`** where practical. The relative path is taken from the
  project root reported in the session banner; an absolute or `./`-prefixed path also works.
- **Re-entering the same surface** is fine — the builder increments that node's visit count rather
  than creating a duplicate node.
- The app may append its own correlation suffix (e.g. a trailing `[sar-…]`); the parser strips a
  trailing `[sar-…]` from labels, so it will not leak into the node name.

## Where this is parsed (for maintainers)

The tags are recognized in
[flow-map-breadcrumbs.ts](../../src/modules/flow-map/flow-map-breadcrumbs.ts) — see the
`FLOWMAP_TAG` / `FLOWMAP_HANDOFF` regexes and `parseFlowMapTag()` / `parseFlowMapHandoff()`. The
explicit tags are checked first in `classifyBreadcrumb()` and take precedence over the heuristic
matchers below them. The handoff's leaf semantics live in `applyHandoff()` in
[flow-map-builder.ts](../../src/modules/flow-map/flow-map-builder.ts).
