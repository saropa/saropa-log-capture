# Plan: Consolidate Footer & Filter UX

**Status (2026-03): Closed — substantially complete.** The footer no longer holds Excl, App Only, Preset, Categories, No Wrap, or Export. Current UX:

- **Footer:** Stats (filename/line count), error breakpoint toggle, level-dot summary (click opens level flyup), filter badge, version/About link. No duplicate filter controls.
- **Icon bar:** Project Logs, Search, Find, Bookmarks, **Filters**, Session Info, Trash, **Options**, Crashlytics, Recurring, Performance, About. Search and Options are in the icon bar rather than the footer.
- **Filters panel** (icon bar): Quick Filters (presets + reset), Output Channels (category checkboxes), Log Tags, Noise Reduction (exclusions + app-only). Single source of truth for preset, categories, exclusions, app-only.
- **Options panel** (icon bar): Display (font size, line height, **word wrap**, decorations), **Integrations** (button opens dedicated Integrations screen with descriptions and performance notes), Layout, Audio, Actions (reset to default, reset extension settings). Export is available via context menu "Export current view…" and optionally from Options/Actions in future.
- **Level filters:** Footer shows compact level dots; clicking opens the level flyup. Options panel does not duplicate level checkboxes.

The plan’s “Proposed” moves are done: Excl/App Only/Preset/Categories live in the Filters panel; No Wrap in Options > Display; Export in context menu. Remaining optional polish (e.g. Export button in Options Actions, or renaming “Presets” → “Quick Filters” in UI copy) can be done ad hoc. This plan is closed.

## Problem (historical)

The viewer footer has 15+ controls spanning 7 independent filter systems. Users encounter:

- **"Sources"** — collapsible chip strip above content (parsed logcat/bracket tags)
- **"Categories"** — hidden `<select multiple>` in footer (DAP output channels)
- **Level circles** — 7 colored toggle buttons in footer
- **"Excl: ON"** — toggle button in footer
- **"App Only: OFF"** — toggle button in footer
- **"Preset: None"** — dropdown in footer
- **Search (filter mode)** — separate slide-out panel with its own filter toggle

Plus `No Wrap`, `Export`, `Search`, `☰ Options` buttons.

The Options panel then **duplicates** level filters (as checkboxes) and exclusion/app-only toggles, creating two places to control the same things.

Users can't tell what's active, controls fight for space, and terminology overlaps.

## Current Footer Layout

```
[stats] [err-brk] [watch-counts] [excl-count] [Excl:ON] [App Only:OFF]
[🟢][🟠][🔴][🟣][⚪][🟤][🟦] [Preset▾] [Categories▾] [No Wrap] [Export] [Search] [☰]
```

## Proposed Footer Layout

```
[stats] [🟢🟠🔴🟣⚪🟤🟦] [filter-badge] [Search] [☰ Options]
```

**Kept in footer:**

| Element | Reason |
|---------|--------|
| Stats text | Always visible, non-interactive |
| Level circles | Highest-frequency filter, one-click, visual |
| Filter badge | "3 filters" indicator — click opens Options |
| Search button | Primary action, Ctrl+F shortcut |
| ☰ Options | Gateway to everything else |

**Moved to Options panel:**

| Element | Current Location | Destination |
|---------|-----------------|-------------|
| Excl: ON/OFF | Footer button | Options > Noise Reduction |
| App Only: OFF/ON | Footer button | Options > Noise Reduction |
| Preset dropdown | Footer select | Options > Quick Filters (top) |
| Category filter | Footer hidden multiselect | Options > Output Channels (checkboxes) |
| No Wrap | Footer button | Options > Display (already has checkbox) |
| Export | Footer button | Options > Actions section at bottom |
| Error breakpoint | Footer button | Options > Actions or remove |
| Watch counts | Footer label | Options header or session info |

**Removed from Options panel (to eliminate duplication):**

| Element | Reason |
|---------|--------|
| Level filter checkboxes | Footer circles are the single source of truth |

## Proposed Options Panel Layout

```
┌─────────────────────────────┐
│ Options                   ✕ │
├─────────────────────────────┤
│ ▸ Quick Filters             │  ← was "Presets", renamed
│   [Errors Only ▾]           │
│   [Reset all filters]       │  ← NEW: clears everything
│                             │
│ ▸ Output Channels           │  ← was hidden <select multiple>
│   ☑ stdout                  │
│   ☑ stderr                  │
│   ☑ console                 │  ← checkboxes, not multiselect
│                             │
│ ▸ Log Tags                  │  ← was "Sources" chip strip
│   12 tags (3 hidden)        │
│   [All] [None]              │
│   [flutter ×42] [jni ×18]  │  ← same chips, new home
│                             │
│ ▸ Noise Reduction           │  ← groups Excl + App-Only
│   ☑ Enable exclusions       │
│   ☑ App only (hide fwk)     │
│                             │
│ ▸ Display                   │
│   ☑ Word wrap               │
│   Font size: 13px [slider]  │
│   Line height: 1.5 [slider] │
│   ☑ Line prefix decorations │
│   ... (decoration sub-opts) │
│                             │
│ ▸ Layout                    │
│   ☑ Visual spacing          │
│                             │
│ ▸ Audio                     │
│   ☑ Play sounds             │
│   ... (volume, rate limit)  │
│                             │
│ ▸ Actions                   │  ← NEW section
│   [Export] [Session Info]   │
└─────────────────────────────┘
```

## Key Changes

### 1. Rename confusing terms

| Before | After | Why |
|--------|-------|-----|
| Sources | Log Tags | "Sources" implies origin; these are parsed tag labels |
| Categories | Output Channels | Clearer what stdout/stderr/console actually are |
| Presets | Quick Filters | More intuitive; "preset" is abstract |
| Excl: ON | Enable exclusions | No abbreviation needed in panel |

### 2. Replace `<select multiple>` with checkboxes

The category filter becomes a checkbox group in the Options panel. Each DAP category gets a labeled checkbox. Appears only when categories have been received (same as current behavior).

**Files:** `viewer-filter.ts`, `viewer-options-panel-html.ts`, `viewer-content.ts`

### 3. Move Source Tag strip into Options panel

Remove the collapsible strip above log content. The chip UI moves into an "Log Tags" section in the Options panel with the same All/None buttons and toggleable chips.

**Files:** `viewer-source-tags.ts`, `viewer-options-panel-html.ts`, `viewer-content.ts`

### 4. Add active-filter badge to footer

A small indicator next to the Options button showing how many filters are active:

- Count increments for: any level disabled, any category unchecked, any source tag hidden, exclusions enabled, app-only on, search in filter mode
- Click the badge opens Options panel
- Hidden when count is 0 (no active filters)

**Files:** `viewer-content.ts`, new `viewer-filter-badge.ts`, `viewer-styles-ui.ts`

### 5. Add "Reset all filters" button

One button in the Quick Filters section that:

- Enables all level circles
- Checks all output channels
- Shows all log tags
- Disables exclusions
- Disables app-only
- Clears search
- Sets preset to None

**Files:** `viewer-presets.ts` or new `viewer-filter-reset.ts`

### 6. Remove duplicate controls

- Delete level filter checkboxes from Options panel (footer circles are canonical)
- Delete exclusion checkbox from Options panel (moved to Noise Reduction with more context)
- Delete app-only checkbox from Options panel (moved to Noise Reduction)

Wait — this contradicts moving Excl/App-Only to the Options panel. The resolution: these checkboxes **stay** in the Options panel but are **removed** from the footer. Single source of truth in Options.

### 7. Make "Preset: None" clear filters

Currently selecting "None" in the preset dropdown just deselects the preset name without changing any filter state. Change this so "None" resets all filters (same as "Reset all").

**Files:** `viewer-presets.ts`

## Execution Order

Each step is a standalone commit that leaves the extension working:

1. **Rename terms** — Update labels/titles only (no logic changes)
2. **Add "Output Channels" checkbox section** to Options panel, wire to category filter logic
3. **Remove `<select multiple>`** from footer, remove old filter dropdown code
4. **Move Log Tags** from strip above content to Options panel section
5. **Move Excl + App-Only** into Options panel "Noise Reduction" section
6. **Move Preset dropdown** into Options panel "Quick Filters" section
7. **Move Export + No Wrap** into Options panel, remove from footer
8. **Add filter badge** to footer
9. **Add "Reset all"** button
10. **Remove duplicate controls** (old level checkboxes from Options)
11. **Fix Preset:None** to reset all filters

## Files Affected

| File | Changes |
|------|---------|
| `src/ui/viewer-content.ts` | Strip footer down to stats + levels + badge + search + options |
| `src/ui/viewer-options-panel-html.ts` | Add Output Channels, Log Tags, Noise Reduction, Quick Filters, Actions sections |
| `src/ui/viewer-options-panel-script.ts` | Wire new sections to existing filter logic |
| `src/ui/viewer-filter.ts` | Refactor to use checkboxes instead of `<select multiple>` |
| `src/ui/viewer-source-tags.ts` | Move chip rendering into Options panel container |
| `src/ui/viewer-presets.ts` | Move dropdown into Options, add reset-all, fix None behavior |
| `src/ui/viewer-exclusions.ts` | Remove footer button references, wire to Options checkbox |
| `src/ui/viewer-stack-filter.ts` | Remove footer button references, wire to Options checkbox |
| `src/ui/viewer-styles-ui.ts` | Footer simplification styles, filter badge styles |
| `src/ui/viewer-styles-content.ts` | Remove source-tag-strip styles from content area |
| NEW `src/ui/viewer-filter-badge.ts` | Active filter count logic + badge rendering |

## Risks

- **Power users lose one-click Excl/App-Only** — mitigated by keeping level circles in footer (highest frequency) and the filter badge showing something is active
- **Options panel gets longer** — mitigated by collapsible sections (already the pattern)
- **Source tag chips in Options panel may be harder to discover** — mitigated by filter badge showing hidden count
