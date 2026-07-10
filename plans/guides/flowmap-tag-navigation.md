# `[flowmap]` navigation tag — instrumenting a calling project

To make the **Session Flow Map** capture *every* screen, tab, dialog, and sheet (not just
surfaces that happen to print an ad-hoc breadcrumb), the calling app emits one explicit log line
per surface entered. That line carries the `[flowmap]` tag.

This is the reliable, source-anchored path. The Flow Map has fallback heuristics that try to infer
navigation from app-shaped breadcrumbs (`Screen Navigation: …`, `… Screen Reached`, etc.), but
those only catch surfaces that already log something and can never resolve a source `file:line`.
The `[flowmap]` tag wins over all of them because it declares the surface kind **and** its source.

The tag has six verbs: **`enter`** (reach a surface), **`back`** (return to one), **`exit`** (leave
one), **`handoff`** (go off-app), **`action`** (do something on a surface), and **`error`** (a failure
on a surface). `enter` is documented first; the rest follow below.

## Format

```
[flowmap] enter <kind> "<Name>" [back] [<lib/path/to/file.dart:line>]
```

- **`[flowmap]`** — the literal tag. It only needs to appear somewhere in the line; the usual
  `[clock] [channel]` log decorations in front of it are fine. The line must be timestamped
  (carry the leading `[HH:MM:SS.mmm]` stamp) like any captured log line.
- **`enter`** — the literal verb.
- **`<kind>`** — one of: `screen`, `tab`, `dialog`, `sheet`, `inline`
  (`sheet` is mapped to a dialog node; `inline` marks an in-screen sub-view leaf).
- **`"<Name>"`** — the human label, in **double quotes** (required).
- **`back`** — optional keyword (after the name, before the anchor). Marks this entry as a *back*
  navigation, so the transition draws a return arrow instead of a forward edge — see
  [The `back` flag](#the-back-flag-return-navigation) below.
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

## The `action` verb — in-screen actions

`enter` records reaching a surface; `action` records something the user *did* on the surface they
are already on (toggling a flag, sharing, deleting). Actions never create nodes or edges — they
increment a per-category counter on whichever screen is current, shown as action badges in the
report. Without the tag, action counts only come from app-shaped heuristics (the
`Activity flag made …` matchers), which other projects' logs never match.

```
[flowmap] action "<Category>" [<lib/path/to/file.dart:line>]
```

- **`action`** — the literal verb (parallel to `enter` / `handoff`).
- **`"<Category>"`** — the counter key, in **double quotes** (required): `"Favorite"`, `"Share"`,
  `"Delete"`. Repeats of the same category on the same screen increment its count. Keep it a short
  noun — it is both the badge label and the aggregation key. The key is **case-sensitive**
  (only the tag/verb matching is case-insensitive): `"favorite"` and `"Favorite"` count as two
  separate badges, so keep the category's casing consistent across call sites.
- **`<file.dart:line>`** — optional, handled exactly like `enter` (leading `./` stripped).

Matching is **case-insensitive**, like the other verbs.

```
[12:06:02.410] [console] [log] [flowmap] action "Favorite" lib/components/activity/activity_flag_button.dart:88
[12:06:40.120] [console] [log] [flowmap] action "Share"
```

An `action` emitted before any surface has been entered has no screen to attribute to and is
dropped silently.

## The `exit` verb — surface dismissed

`enter` opens a surface and it stays the *current* surface — accruing dwell time — until the next
`enter`. That is wrong for a dialog or sheet you dismiss and then keep sitting on the screen behind:
without an `exit`, the dialog is charged all the idle time until you navigate somewhere new. Emit
`exit` at the surface's dismissal point (e.g. a dialog helper's return) and its dwell stops there;
the surface it revealed resumes accruing.

```
[flowmap] exit <kind> "<Name>"
```

- **`exit`** — the literal verb.
- **`<kind>`** — same kind vocabulary as `enter` (informational; the match is by name).
- **`"<Name>"`** — the surface being closed, in **double quotes** (required). It must be the surface
  currently open — an `exit` naming anything else is ignored, so a stray tag can never rewind the
  timeline onto the wrong screen. No source anchor (the `enter` already carried it).

```
[12:05:33.014] [console] [log] [flowmap] enter dialog "Culture Picker" lib/.../culture_religion_picker_dialog.dart:101
[12:05:41.660] [console] [log] [flowmap] exit dialog "Culture Picker"
```

## The `error` verb — a failure on the surface

`error` puts a failure badge on the surface that was active when it fired — so the Flow Map shows
*where* the app broke, not just that it did. It becomes a row in the Issue Report table (time-ordered)
and a 💥 badge on the node. Emit it from the app's own exception chokepoint. Unlike the heuristic
warning patterns, an explicit `error` also badges a dialog / sheet surface.

```
[flowmap] error "<Category>" [<lib/path/to/file.dart:line>]
```

- **`error`** — the literal verb.
- **`"<Category>"`** — the failure label, in **double quotes** (required): `"Payment declined"`,
  `"Sync failed"`. Each occurrence is recorded (explicit errors are not deduped, unlike heuristic
  warnings), so emit deliberately.
- **`<file.dart:line>`** — optional, handled exactly like `enter` (leading `./` stripped).

```
[12:07:01.900] [console] [log] [flowmap] error "Payment declined" lib/api/payments_client.dart:212
```

## The `back` verb — return navigation

The Flow Map infers back-navigation from the open-surface stack: returning to a screen still open
below the current one draws a return arrow, not a forward edge. But a re-entry the stack can't see as
a return (the target was already closed) reads as forward. When the app's own back handler knows a
step is a *back*, declare it and the transition is forced to a return edge regardless of the stack.

There are two spellings; both force a return edge:

**Preferred — the `back` verb** (what Saropa Contacts emits from its `PopScope` handler):

```
[flowmap] back <screen|tab|dialog|sheet|inline> "<Name>" [<lib/path/to/file.dart:line>]
```

```
[flowmap] back tab "Home" lib/views/main_material_app.dart:875
```

It is identical to `enter` in every respect — the named surface becomes current, its visit count
increments, a node is created if new — except the drawn edge is a *return* edge. Emit `back`
**instead of** `enter`, never both, so visit counts stay honest.

**Alternate — a `back` keyword on `enter`:**

```
[flowmap] enter screen "Home" back
[flowmap] enter screen "Home" back lib/views/home.dart:22
```

The keyword goes **after the name and before any `file.dart:line`**. Use `back` (either form) only for
genuine back steps — a forward navigation must not carry it, or the diagram's direction becomes wrong.

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

The `enter` / `back` / `exit` / `handoff` / `action` verbs are recognized in
[flow-map-breadcrumbs.ts](../../src/modules/flow-map/flow-map-breadcrumbs.ts) — see the
`FLOWMAP_TAG` / `FLOWMAP_BACK` / `FLOWMAP_EXIT` / `FLOWMAP_HANDOFF` / `FLOWMAP_ACTION` regexes and their
`parseFlowMap…()` functions. `FLOWMAP_BACK` produces the same `nav` event as `enter` with `back: true`;
the `enter … back` keyword is an alternate spelling handled by `FLOWMAP_TAG` group 3. These explicit tags are checked first in `classifyBreadcrumb()` and take
precedence over the heuristic matchers below them. The `error` verb is on the issue side —
`FLOWMAP_ERROR` / `parseFlowMapError()` in
[flow-map-issues.ts](../../src/modules/flow-map/flow-map-issues.ts), pushed to the issue overlay from
`scanLine()` in [flow-map-log-parser.ts](../../src/modules/flow-map/flow-map-log-parser.ts). The
builder-side semantics live in [flow-map-builder.ts](../../src/modules/flow-map/flow-map-builder.ts):
`applyHandoff()` (leaf), `applyExit()` (dwell close + stack pop), the `forceBack` path in
`recordTransition()`, and the `explicit` relaxation in `attachIssues()`.
