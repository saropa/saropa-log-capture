# Plan — render `[flowmap]` tag lines as chips in the Log Viewer

Status: **proposed**

Depends on the `[flowmap]` tag grammar defined in
[flowmap-tag-navigation.md](guides/flowmap-tag-navigation.md) (verbs `enter`, `back`, `exit`,
`handoff`, `action`, `error`). This plan is about how those lines *look in the Log Viewer*, not how
the Flow Map consumes them.

## Why

An instrumented app emits one `[flowmap] …` line per surface entered, action taken, and failure. In
the raw Log Viewer those lines are long, repetitive, and visually indistinguishable from ordinary
output:

```
[12:04:01.210] [console] [log] [flowmap] enter screen "Contact View" lib/views/contact_view.dart:58
[12:04:09.880] [console] [log] [flowmap] enter tab "Home" lib/views/home_tab.dart:22
[12:05:33.014] [console] [log] [flowmap] enter dialog "Culture Picker" lib/.../culture_religion_picker_dialog.dart:101
```

They are noise to read past, yet they mark exactly the moments a reader scanning a session cares
about (where navigation, actions, and failures happened). The goal: **strip the raw tag text from
the rendered line and replace it with a compact, color-coded chip at the same position**, so the
flow moments stand out instead of drowning the log — while the full tag stays reachable.

## Design

### One chip per `[flowmap]` line, in place

Each `[flowmap] …` line is its *own* log line (not an inline fragment of other content), so the chip
replaces that line's body at its existing timestamp. No separate lane, no reordering — position and
`[HH:MM:SS.mmm]` gutter are preserved, because *when* a flow moment happened is the useful signal.

Chip content: a verb glyph + the quoted name, e.g. `→ Contact View`, `↩ Home`, `✕ Culture Picker`,
`＋ Favorite`, `💥 Payment declined`, `↗ Google Maps`. Color-coded by verb, reusing the Flow Map
palette so the two surfaces read consistently:

| Verb | Chip color intent | Glyph |
|---|---|---|
| `enter` | forward / primary (blue) | → |
| `back` | return (purple) | ↩ |
| `exit` | dismissed / muted (gray) | ✕ |
| `action` | activity (green) | ＋ |
| `error` | failure (red) | 💥 |
| `handoff` | off-app (amber) | ↗ |

Colors come from the theme's existing severity/flow variables, never hardcoded hex (per the style
guide). Glyphs are text, not images.

### Tooltip carries the full detail

Hovering the chip shows the **original raw tag line** plus a one-line plain-language meaning
(`enter — reached this surface`; `back — returned to a surface already visited`). This is the
"flow icon with tooltip" idea, made per-line so timing context is never lost. The source
`file.dart:line`, when present, stays a clickable anchor on the chip exactly as it is on a normal
line today.

### A toolbar toggle governs visibility

Add a **"Flow tags"** control to the viewer filter/toolbar row, consistent with the existing
category / level / app-only / source-tag filters. Three states:

1. **Chips** (default) — tag lines render as chips.
2. **Raw** — tag lines render as ordinary text (today's behavior), for debugging the instrumentation.
3. **Hidden** — tag lines are filtered out entirely.

The Hidden state is a genuine height filter and must follow the project's filter contract (classify
at birth in `addToData`, set a filter flag, honor it in `calcItemHeight`, never touch line heights
directly, never filter markers). Chips-vs-Raw is a *rendering* switch, not a height change.

## Implementation notes for this repo

Touchpoints to confirm during implementation (files located, exact lines TBD):

1. **Detect the tag at line birth.** A single classifier — reuse the parser shape from
   [flow-map-breadcrumbs.ts](../src/modules/flow-map/flow-map-breadcrumbs.ts) rather than duplicate
   the regexes; extract a small shared `matchFlowmapTag(text) → { verb, kind, name, source } | null`
   both sides call. Store the result on the line item in
   [viewer-data-add-line-birth.ts](../src/ui/viewer/viewer-data-add-line-birth.ts) (e.g.
   `item.flow = { verb, name, source }`), the same way other classifications are stamped at birth.
2. **Render the chip** in the line-to-HTML path
   ([viewer-data-helpers-render.ts](../src/ui/viewer/viewer-data-helpers-render.ts) /
   [viewer-data-helpers.ts](../src/ui/viewer/viewer-data-helpers.ts)). The existing
   continuation-badge render ([viewer-data-add-continuation.ts](../src/ui/viewer/viewer-data-add-continuation.ts))
   is the precedent for a per-line inline badge — follow its markup + style module split.
3. **Chip styles** go in a `viewer-styles-*.ts` module (the established split-by-concern pattern),
   keyed to theme color variables. No raw hex, no magic px — pull from the palette the Flow Map
   already uses.
4. **Toolbar control** in [viewer-toolbar-html.ts](../src/ui/viewer-toolbar/viewer-toolbar-html.ts)
   + [viewer-toolbar-script.ts](../src/ui/viewer-toolbar/viewer-toolbar-script.ts); the setting rides
   the same message plumbing as the other viewer toggles (host → webview `postMessage`).
5. **Hidden state** wires through `calcItemHeight` exactly like the level/category filters; new lines
   arriving while Hidden is active must be born filtered (set the height correctly in `addToData`).
6. **Tests** (`src/test/ui/`): a chip renders for each verb with the right class/glyph; the raw text
   is stripped from the visible line; Raw mode restores the text; Hidden mode zeroes the height;
   markers are never affected; a non-tag line is untouched.

## Open questions

1. **Default state — Chips or Raw?** Recommendation: **Chips**. The whole point is readability; a
   user debugging the instrumentation itself can flip to Raw. (This is the one real product choice;
   everything else follows from it.)
2. **Should the chip show the `kind`** (screen/tab/dialog) as a second micro-label, or only the name?
   Recommendation: **name only** on the chip, kind in the tooltip — the glyph already carries verb,
   and kind rarely disambiguates at a glance.
3. **Multiple flow lines with identical rendering in a burst** (e.g. rapid `action` repeats) — leave
   as separate chips, or collapse like the existing repeat-collapse? Recommendation: **separate** for
   v1; repeat-collapse already exists and can fold them later if it proves noisy.
