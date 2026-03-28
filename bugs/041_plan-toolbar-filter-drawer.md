# Plan: Toolbar with Filter Drawer (viewer layout overhaul)

**Status:** IMPLEMENTED

**Feature:** Replace the header + footer + sidebar Filters panel with a single toolbar and integrated filter drawer. Eliminate the footer entirely.

---

## Problem

Filters are scattered across 3 separate surfaces with 3 different interaction patterns:

1. **Footer** — level dots with fly-up menu
2. **Header** — search input with filter mode toggle
3. **Sidebar slide-out** — 560px panel covering log content (8 filter sections)

The footer mixes status (filename, line count), filters (level dots, badge), commands (Actions menu), and metadata (version). The Filters slide-out panel obscures the log content while adjusting filters.

## Goals

- Consolidate all filters into one filter drawer triggered from the toolbar
- Remove the footer entirely
- Remove the Filters and SQL Filter entries from the sidebar icon bar
- Every transition beautifully animated

---

## Design

### Toolbar (always visible, single row)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◄ ► │ 🔍 🔽 ☰ │ ●🔴12 🟠4 🟢53 │ 3.2k/23.7k │ filename.log      │
│ nav   icons      level dots        line count    flex → ellipsis    │
└──────────────────────────────────────────────────────────────────────┘
  fixed  fixed      fixed             fixed         variable
```

**Left group (fixed width):**
- `◄ ►` session prev/next arrows
- `🔍` search icon → opens search flyout
- `🔽` filter icon → opens filter drawer (badge shows active count)
- `☰` actions icon → opens actions dropdown

**Middle group (fixed width):**
- Level summary dots with counts (clickable → opens filter drawer to Levels)
- Line count: `3.2k/23.7k` (visible/total, compact format)

**Right (flex: 1):**
- Filename with `text-overflow: ellipsis`, tooltip shows full path + session metadata (adapter, project, date)
- Click reveals file, hold copies path (same as current footer filename)

**Conditional elements (appear inline when relevant):**
- Paused indicator (replaces/prefixes filename)
- Selection info (`3 lines, 42 chars`)
- Performance chip
- Hidden lines peek counter

### Search Flyout (drops below toolbar)

Triggered by `🔍` icon or `Ctrl+F`.

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Search in log...              ] Cc AB .* │ ◄ 12/45 ► │ Mode: ▾    │
│ Recent: "SELECT *"  "connection"  "error"                    [Close]│
└──────────────────────────────────────────────────────────────────────┘
```

- Same controls as current header search (input, case/word/regex toggles, match nav, highlight/filter mode)
- Search history shown inline (no separate floating panel)
- Pushes content down when open

### Filter Drawer (drops below toolbar)

Triggered by `🔽` icon, level dot click, or filter badge click. **Mutual exclusion with Signals** — Signals auto-collapses when drawer opens, restores when drawer closes.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Levels: ●err(12) ●warn(4) ●info(53) ●perf(29) ●todo ●dbg ●notice  │
│         Context: [===3===] lines           App only ☐               │
│─────────────────────────────────────────────────────────────────────│
│ ▸ Source Tags (3 hidden · 1,204 lines · 32%)                        │
│ ▸ Code Tags (0 hidden)                                              │
│ ▸ SQL Patterns (4 shown · 89 lines)                                 │
│ ▸ Exclusions (2 rules · 312 lines · 8%)                             │
│ ▸ Scope: All                        ▸ Channels: All                 │
│ ▸ Log Streams: All                                                  │
│─────────────────────────────────────────────────────────────────────│
│ Presets ▾ │ Reset all │                           3 filters · 42%    │
└──────────────────────────────────────────────────────────────────────┘
```

**Row 1 (always visible):** Level toggles + context slider + app-only checkbox. These are the most-used filters.

**Row 2 (expandable sections):** Each section shows a one-line summary with impact counts. Click `▸` to expand inline and show chips/rules/radios. Only one section expanded at a time (accordion) to control height.

**Row 3 (always visible):** Presets dropdown, reset all, total active filter count + percentage hidden.

**Expanded section example (Source Tags):**
```
│ ▾ Source Tags  3 hidden · 1,204 lines (32%)                         │
│   [FlutterJNI ×] [database ×] [SurfaceSync ×] [MediaCodec]         │
│   [InputMethodManager] [Choreographer] [+6 more]                    │
```

**Count feedback:** Every section shows `N hidden · X lines (Y%)` so the user sees filter impact without needing to see through to the log content.

### Actions Dropdown (positioned below ☰ icon)

```
┌─────────────────────┐
│ ▶ Replay            │
│ 📄 Quality Report   │
│ 📤 Export            │
└─────────────────────┘
```

Small dropdown menu, not a flyout. Same 3 items currently in footer Actions.

---

## What Moves Where

| Element | From | To |
|---------|------|----|
| `◄► Log N of M` | Header | Toolbar nav arrows; label dropped (tooltip on filename) |
| Breadcrumb | Header | Toolbar filename tooltip |
| Search input | Header | Search flyout |
| Level dots + fly-up | Footer | Toolbar inline (dots) + filter drawer (full controls) |
| Line count | Footer | Toolbar inline |
| Filter badge | Footer | Filter icon badge on toolbar |
| Filename | Footer | Toolbar right side (flex) |
| Actions menu | Footer | Toolbar ☰ dropdown |
| Version | Footer | Sidebar "About v4.2.0" label |
| Filters panel (all 8 sections) | Sidebar 560px slide-out | Filter drawer (full-width, compact) |
| SQL Filter toggle | Sidebar icon bar | Filter drawer SQL Patterns section |
| Paused indicator | Footer | Toolbar (inline, conditional) |
| Selection info | Footer | Toolbar (inline, conditional) |
| Hidden lines counter | Footer | Toolbar (inline, conditional) |
| Truncation warning | Footer | Toolbar (inline, conditional) |
| Performance chip | Header | Toolbar (inline, conditional) |

## What Is Removed

| Element | Reason |
|---------|--------|
| Footer bar | All contents relocated to toolbar |
| Sidebar "Filters" icon + panel | Replaced by filter drawer |
| Sidebar "SQL Filter" icon | Merged into filter drawer |
| Smart-sticky header hide-on-scroll | Toolbar is always visible (thin enough) |
| Level fly-up menu | Replaced by filter drawer row 1 |
| Search floating history panel | Inline in search flyout |

## Sidebar Icon Bar After Cleanup

```
├─ Project Logs     (unchanged)
├─ Find             (unchanged — cross-file search)
├─ Bookmarks        (unchanged)
├─ SQL History      (unchanged — data view, not filter)
├─ Trash            (unchanged)
├─ Options          (unchanged — display/layout settings)
├─ Crashlytics      (unchanged — conditional)
├─ Insights         (unchanged)
└─ About v4.2.0     (absorbs version from footer)
```

10 → 8 entries.

---

## Animation Spec

| Transition | Animation | Duration |
|-----------|-----------|----------|
| Search flyout open | Slide down from toolbar + fade in | `ease-out 0.25s` |
| Search flyout close | Slide up + fade out | `ease-in 0.2s` |
| Filter drawer open | Slide down from toolbar, content pushes down | `ease-out 0.25s` |
| Filter drawer close | Slide up, content rises | `ease-in 0.2s` |
| Signals collapse (on drawer open) | Height to 0, simultaneous with drawer | `ease-out 0.25s` |
| Signals restore (on drawer close) | Height from 0, simultaneous with drawer | `ease-out 0.25s` |
| Section expand (accordion) | Height + opacity | `ease-in-out 0.2s` |
| Section collapse | Height + opacity | `ease-in-out 0.15s` |
| Count number update | Fade-through or counter roll | `0.15s` |
| Chip appear/disappear | Scale + opacity, staggered per chip | `0.05s` stagger |
| Actions dropdown | Scale-Y from top + opacity | `ease-out 0.15s` |

All animations use `prefers-reduced-motion: reduce` to disable for accessibility.

---

## Mutual Exclusion Rules

- Search flyout and filter drawer: **can coexist** (search is narrow, filter is below it)
- Filter drawer and Signals: **mutual exclusion** (drawer collapses Signals; closing restores)
- Actions dropdown: **closes on outside click** (standard menu behaviour)
- Sidebar panels: **unchanged** (mutual exclusion among themselves, independent of toolbar flyouts)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/ui/viewer-toolbar/viewer-toolbar-html.ts` | Toolbar HTML template |
| `src/ui/viewer-toolbar/viewer-toolbar-script.ts` | Toolbar interaction logic |
| `src/ui/viewer-toolbar/viewer-toolbar-search.ts` | Search flyout HTML + script |
| `src/ui/viewer-toolbar/viewer-toolbar-filter-drawer.ts` | Filter drawer HTML |
| `src/ui/viewer-toolbar/viewer-toolbar-filter-drawer-script.ts` | Filter drawer interaction |
| `src/ui/viewer-toolbar/viewer-toolbar-actions.ts` | Actions dropdown |
| `src/ui/viewer-styles/viewer-styles-toolbar.ts` | Toolbar + flyout + drawer CSS |
| `src/ui/viewer-styles/viewer-styles-toolbar-filter.ts` | Filter drawer section CSS |

## Files to Modify

| File | Change |
|------|--------|
| `src/ui/provider/viewer-content-body.ts` | Replace header + footer HTML with toolbar; remove footer element |
| `src/ui/viewer-styles/viewer-styles-footer.ts` | Delete (footer removed) |
| `src/ui/viewer-nav/viewer-icon-bar.ts` | Remove Filters and SQL Filter entries; add version suffix to About |
| `src/ui/viewer-styles/viewer-styles-icon-bar.ts` | Update for 8 entries |
| `src/ui/viewer-search-filter/viewer-search.ts` | Migrate search logic to toolbar search flyout |
| `src/ui/viewer-search-filter/viewer-search-popovers.ts` | Remove floating panel logic (inline in flyout) |
| `src/ui/viewer-search-filter/viewer-level-classify.ts` | Adapt level dots for toolbar inline + drawer |
| `src/ui/viewer-search-filter/viewer-filter-badge.ts` | Move badge to toolbar filter icon |
| `src/ui/viewer-search-filter/viewer-filters-panel-html.ts` | Refactor sections for drawer layout |
| `src/ui/viewer/viewer-root-cause-hints-script.ts` | Add collapse/restore hooks for drawer mutual exclusion |
| `src/ui/viewer-nav/viewer-session-header.ts` | Remove smart-sticky logic; remove header |
| `src/ui/viewer-styles/viewer-styles-level.ts` | Adapt fly-up styles for drawer row 1 |
| `src/ui/viewer/viewer-script-keyboard.ts` | Update Ctrl+F to target toolbar search flyout |
| `src/modules/viewer/log-count-short-format.ts` | Compact format for toolbar (`3.2k/23.7k`) |

## Files to Delete

| File | Reason |
|------|--------|
| `src/ui/viewer-styles/viewer-styles-footer.ts` | Footer removed |

---

## Considerations

- **Toolbar height budget:** ~36px (same as current header). Thin enough to stay visible without stealing space.
- **Filter drawer height:** ~160px collapsed (levels + summary rows + presets). Grows ~60px per expanded section. Max ~280px with one section open.
- **Net vertical cost when filtering:** Toolbar (36) + drawer (160) = 196px. Current cost: header (36) + Signals (~150) = 186px. Nearly identical — no usability regression.
- **Filename truncation:** Variable-width filename is rightmost with `flex: 1` + `text-overflow: ellipsis`. All fixed elements are left of it. Nothing jitters on session change.
- **Line count format:** Use `log-count-short-format.ts` for compact display (`3.2k/23.7k`). Full numbers in tooltip.
- **Accessibility:** All flyouts/drawers must be keyboard-navigable, have ARIA roles, respect `prefers-reduced-motion`.

## Risks

- Large surface area change — touches header, footer, search, filters, icon bar, Signals, keyboard shortcuts
- Filter drawer accordion UX needs careful testing — expanding a section must not cause layout thrash
- Search flyout + filter drawer coexistence needs vertical stacking tested at small viewport heights

## Effort

Large — 2+ weeks. Consider phasing:
1. **Phase 1:** Toolbar + search flyout (replace header + move search)
2. **Phase 2:** Filter drawer (replace sidebar Filters panel + footer level dots)
3. **Phase 3:** Remove footer (relocate remaining elements to toolbar)
