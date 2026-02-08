# UI Style Guide — Saropa Log Capture

Design patterns and conventions for the log viewer webview UI.

## Design Principles

1. **Match VS Code** — use `--vscode-*` CSS variables for all colors, backgrounds, and borders
2. **One pattern per purpose** — avoid multiple visual treatments for the same type of control
3. **Minimal footer** — only essential, frequently-used controls live in the footer; everything else goes in the Options panel
4. **Text over emoji** — footer buttons use text labels, not emoji (emoji reserved for level circles only)

## Font Sizes

| Context | Size | Notes |
|---------|------|-------|
| Log lines (body) | `var(--log-font-size, 13px)` | User-adjustable via Options |
| Footer bar | `11px` | Base size for all footer elements |
| Footer buttons | `11px` | Via `.footer-btn` class |
| Footer dropdowns | `11px` | `#preset-select`, `#filter-select` |
| Level circles | `11px` | Emoji + optional count |
| Header filename | `11px` | `#viewer-header` |
| Header version | `10px` | `#header-version`, dimmed |
| Source tag chips | `11px` | `.source-tag-chip` |
| Exclusion chips | `11px` | `.exclusion-chip` |
| Annotations | `11px` | `.annotation` |
| Small labels | `10px` | `.tag-count`, `.slow-gap`, decoration labels |

**Rule**: Never use more than 3 font sizes in a single UI region.

## Button Styles

### `.footer-btn` — Standard Footer Button

All interactive buttons in the footer use this shared class:

```css
.footer-btn {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
    white-space: nowrap;
}
```

Used by: `#wrap-toggle`, `#app-only-toggle`, `#exclusion-toggle`, `#export-btn`, `#search-panel-btn`, `#options-panel-btn`

### `.level-circle` — Level Filter Circles

Emoji-based toggle buttons that also display running counts:

```css
.level-circle {
    border: 1px solid transparent;
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 3px;
}
```

- Active: full opacity
- Inactive: `opacity: 0.25; filter: grayscale(0.8)`
- Hover: subtle background + visible border
- Content: emoji alone (`🔴`) or emoji + count (`🔴 4`)

### `.source-tag-chip` — Source Tag Pills

Pill-shaped toggles in the source tag strip:

```css
.source-tag-chip {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--vscode-descriptionForeground);
}
```

### `.exclusion-chip` — Exclusion Pattern Pills

Removable pills showing each configured exclusion pattern in the Noise Reduction section:

```css
.exclusion-chip {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 10px;
    border: 1px solid var(--vscode-descriptionForeground);
}
```

- Each chip has a `×` remove button (`.exclusion-chip-remove`) that persists removal to settings
- Text truncated at 180px with ellipsis (`.exclusion-chip-text`)
- Dimmed (`opacity: 0.4`) when exclusions toggle is off (`.exclusion-chips-disabled`)
- Add input field (`.exclusion-input-wrapper`) sits above chips for inline pattern entry

### `.exclusion-input-wrapper` — Inline Add Input

Compact text input + button for adding exclusion patterns directly in the Options panel:

```css
.exclusion-input-wrapper {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
}
.exclusion-input-wrapper:focus-within {
    border-color: var(--vscode-focusBorder);
}
```

- Input uses `flex: 1`, transparent background, theme foreground color
- Add button uses secondary button colors with a left border separator
- Enter key and button click both add the pattern and clear the input
- Follows the same `:focus-within` border pattern as the search input

### Options Panel Rows

Standard layout for settings rows inside the Options panel:

```css
.options-row {
    font-size: 12px;
    padding: 4px 0;
    gap: 8px;
}
```

### Options Panel Tooltips

Every interactive control in the Options panel must have a `title` attribute with a short description of what it does. Place the `title` on the `<label>` for checkbox rows, on the `<input>` for sliders, and on the container `<div>` for dropdown rows.

## Popup / Flyup Menus

Popup menus (level filter flyup, context menus, etc.) must follow these rules:

### Structure

1. **Title header** — every popup needs a short title (e.g. "Level Filters") so the user knows what they're looking at
2. **Bulk actions** — if the popup contains a list of toggles, provide All/None links below the title
3. **Toggle items** — left-aligned labels with right-aligned metadata (counts, badges)

### Active State for Bulk Actions

All/None links must highlight to reflect the current state:
- "All" gets `.active` when every item is enabled
- "None" gets `.active` when every item is disabled
- Neither is active in a partial state

```css
.flyup-header a.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
}
```

### Text Alignment

`<button>` elements default to `text-align: center` in most browsers. When using flex layout inside buttons, always add explicit overrides:

```css
button.my-toggle {
    display: flex;
    justify-content: flex-start;
    text-align: left;
}
```

## Footer Layout

The footer is a single flex row with `gap: 4px`:

```
[status text] [watch chips] [level dots + label] [filter badge]
```

- Level dots are grouped in `.level-summary` with a dynamic text label
- Infrequent toggles (decorations, audio) live in the **Options panel**, not the footer

## Footer Status Text

| State | Display | Notes |
|-------|---------|-------|
| Waiting | `Waiting for debug session...` | Initial state |
| Recording | `● 24 lines` | Red dot (U+25CF) |
| Paused | `⏸ 24 lines` | Pause icon (U+23F8) |
| Historical | `24 lines` | No prefix |

## Color Conventions

All colors use VS Code theme variables with fallbacks:

| Purpose | Variable | Fallback |
|---------|----------|----------|
| Error text | `--vscode-debugConsole-errorForeground` | `#f48771` |
| Warning text | `--vscode-debugConsole-warningForeground` | `#cca700` |
| Performance text | `--vscode-debugConsole-infoForeground` | `#b695f8` |
| Info text | default foreground | — |
| Links | `--vscode-textLink-foreground` | `#3794ff` |
| Muted text | `--vscode-descriptionForeground` | — |
| Panel background | `--vscode-panel-background` | — |
| Hover background | `--vscode-list-hoverBackground` | — |
| Button hover | `--vscode-button-hoverBackground` | — |

## Spacing

| Element | Padding | Gap |
|---------|---------|-----|
| Footer | `4px 8px` | `4px` |
| Header | `4px 8px` | — |
| Log lines | `0 8px` | — |
| Source tag chips | `2px 8px` | `4px` |
| Exclusion chips | `2px 6px` | `4px` |
| Options panel rows | `4px 0` | `8px` |
| Modals | `12px 16px` | `8px` |

## Status Bar UX

The status bar uses two separate items, each with a single clear purpose:

| Item | Priority | Click action | Text |
|------|----------|-------------|------|
| **Pause control** | 51 (right) | Toggle pause/resume | `$(record)` or `$(debug-pause)` icon |
| **Status display** | 50 (left of pause) | Open log file in editor | Line count + watch counts |

### Design principles

| Principle | Rule |
|-----------|------|
| **One item, one action** | Each status bar item does exactly one thing on click |
| **Counts are promises** | If the status bar shows "error: 4", clicking must show those 4 errors |
| **Live state only** | Counts reflect real-time data; never require manual clearing or dismissal |
| **Tooltip describes action** | Tooltip says what clicking does, not just the current state |

**Why split into two items?** VS Code status bar items support only one command each. Combining a count display with a pause toggle violates Nielsen's Heuristic #4 (Consistency and Standards) — users expect clicking a count to reveal details, not change operational state.

## Dynamic Footer Labels

Footer trigger labels must reflect the current state, not just name the feature:

| State | Label | Example |
|-------|-------|---------|
| All items active | `All` | All 7 levels enabled |
| Partial | `N/total` | `3/7` levels enabled |
| None active | `None` | All levels disabled |

**Rule:** Never use a static label (e.g. "Levels") when the control has variable state. The label is the user's first signal that something is filtered.

## Flex Sizing

Flex children with explicit `width`/`height` (e.g. colored dots, icons) must use `flex-shrink: 0` to prevent collapsing to zero when the container is tight:

```css
.small-indicator {
    width: 9px;
    height: 9px;
    flex-shrink: 0;  /* prevent collapse */
}
```

## Interactive Affordances

Every element that looks clickable must be clickable, and vice versa:

| Element | Interactive? | Click action |
|---------|-------------|-------------|
| Watch chips (`.watch-chip`) | Yes | Opens search with keyword pre-filled |
| Level dots (`.level-dot`) | Yes | Opens level filter fly-up menu |
| Footer status text | Yes | Opens Project Logs session panel |
| Filter badge | Yes | Opens options panel (or level flyup if only level filter active) |

**Rules:**
- Interactive elements must have `cursor: pointer` and a hover effect
- Non-interactive elements must have `cursor: default` and no hover effect
- Badge-styled elements that look clickable must either be clickable or be visually distinct from interactive badges

## Watch Chip Styles

```css
.watch-chip {
    cursor: pointer;      /* signals interactivity */
    border-radius: 8px;   /* badge shape */
    font-size: 10px;
}
.watch-chip:hover {
    filter: brightness(1.3);  /* hover feedback */
}
```

- Error/exception chips: red background (`.watch-error`)
- Warning chips: yellow background (`.watch-warn`)
- Flash animation on new hits (`.watch-chip.flash`)
- `title="Click to search"` for discoverability
- `data-keyword` attribute carries the search term

## Minimap Panel

The minimap is an always-on 60px wide interactive panel that **replaces** the native scrollbar. It sits as a flex sibling next to `#log-content`, not as an overlay on top of the scrollbar. There is no toggle — the minimap is always visible.

### Layout

```
#log-content-wrapper (display: flex)
  #log-content (flex: 1, native scrollbar always hidden)
  #scrollbar-minimap (width: 60px, flex-shrink: 0)
```

### Interaction

| Action | Behavior |
|--------|----------|
| Click | Centers the viewport on the clicked position |
| Drag | Continuous scroll while dragging |
| Mouse wheel | Forwarded to `#log-content.scrollTop` |
| Viewport indicator | Shows current visible region; follows scroll |

The minimap container has `cursor: pointer` and receives mouse events directly (no `pointer-events: none`). The viewport indicator has `pointer-events: none` so clicks pass through to the container's handler.

### Scrollbar Visibility

Native browser scrollbars are opaque compositor elements that render above page content. The minimap panel avoids this entirely by being a sibling element. The native scrollbar is always hidden:

```css
#log-content { scrollbar-width: none; }
#log-content::-webkit-scrollbar { display: none; }
```

### Marker Rules

| Rule | Rationale |
|------|-----------|
| Skip lines with `height === 0` | Hidden/filtered lines have no scroll position — markers appear at wrong locations |
| Skip `stack-frame` type lines | Every frame has `level: 'error'`, creating dense red blocks instead of one mark per error |
| Include error, warning, and performance levels | These are the actionable severity levels users need to spot |
| Use `--vscode-editorOverviewRuler-*` variables | Matches VS Code's own overview ruler colors for consistency |

### Minimap Colors

| Marker | Variable | Fallback |
|--------|----------|----------|
| Error | `--vscode-editorOverviewRuler-errorForeground` | `rgba(244, 68, 68, 0.8)` |
| Warning | `--vscode-editorOverviewRuler-warningForeground` | `rgba(204, 167, 0, 0.8)` |
| Performance | `--vscode-editorOverviewRuler-infoForeground` | `rgba(156, 39, 176, 0.8)` |
| Search match | `--vscode-editorOverviewRuler-findMatchForeground` | `rgba(234, 92, 0, 0.8)` |
| Viewport | `--vscode-scrollbarSlider-background` | `rgba(121, 121, 121, 0.4)` |

## Virtual Scrolling

The log viewer uses a virtual scrolling architecture with three DOM elements:

```
#spacer-top   — empty div, height = sum of all lines above the viewport
#viewport     — rendered HTML for visible lines only
#spacer-bottom — empty div, height = sum of all lines below the viewport
```

### Scroll Anchoring

When any operation changes line heights (filter toggle, stack collapse, font size change), the first visible line must stay at the same visual position. Raw height recalculation shifts the scroll position because `scrollTop` stays at the same pixel value while the content above changes height.

**Required pattern:** Always use `recalcAndRender()` instead of calling `recalcHeights()` and `renderViewport(true)` separately. `recalcAndRender()` saves the anchor line before recalculating, rebuilds prefix sums, renders, then restores the anchor position.

### `suppressScroll` Guard

Every programmatic `scrollTop` assignment must be wrapped in the suppress flag to prevent the scroll event handler from triggering a redundant render:

```javascript
suppressScroll = true;
logEl.scrollTop = logEl.scrollHeight;
suppressScroll = false;
```

The scroll handler checks `if (suppressScroll) return;` at the top.

### Prefix-Sum Array

`prefixSums[i]` holds the cumulative height of lines `0..i-1`. Used for:

- **O(log n) binary search** via `findIndexAtOffset(px)` — replaces O(n) linear scan for finding which line is at a given scroll position
- **O(1) scroll-to-line** — `logEl.scrollTop = prefixSums[idx]` instead of summing heights in a loop
- **O(1) bottom spacer** — `totalHeight - prefixSums[endIdx + 1]` instead of summing remaining heights

Rebuild with `buildPrefixSums()` after any height change: `recalcHeights()`, `addToData()`, `trimData()`.

### Group Header Map

`groupHeaderMap[groupId]` provides O(1) lookup of stack trace headers. Without it, `calcItemHeight()` must scan all lines to find the header for each stack frame — O(n) per frame, O(n²) total for a large trace.

**Maintenance rules:**
- Add entry when creating a stack header in `addToData()`
- Delete entry when removing lines in `trimData()`
- Reset to `{}` on `clear`

### Dynamic Row Height

`ROW_HEIGHT` and `MARKER_HEIGHT` must reflect actual CSS-rendered heights, not hardcoded constants. After any font size or line height change, call `measureRowHeight()` which creates a hidden probe element, reads its rendered height, and updates the globals before `recalcAndRender()`.

### Script Injection Order

All webview JS uses global `var` declarations (no modules). Functions must be declared before their callers. The injection order in `viewer-content.ts` is:

```
layout → data-helpers → data → script → scroll-anchor → filters → ...
```

`scroll-anchor` comes after `data` and `script` because it references `recalcHeights`, `renderViewport`, `allLines`, `autoScroll`, and `logEl`. Filter scripts come after `scroll-anchor` because they call `recalcAndRender()`.

### Monkey-Patch Safety

Some scripts wrap existing functions to add behavior (e.g., `viewer-filter-badge.ts` wraps `recalcHeights`, `viewer-scrollbar-minimap.ts` wraps `renderViewport`). These monkey-patches remain safe because `recalcAndRender()` calls the wrapped versions — it does not bypass them.

**Rule:** When adding a new wrapper around `recalcHeights` or `renderViewport`, ensure it runs *after* `scroll-anchor` in the script injection order so it wraps the original, not a stale reference.

## Anti-Patterns

1. **No emoji in footer buttons** — use text labels instead (emoji only for level circles)
2. **No duplicate CSS** — each element gets styled once, in one file
3. **No per-button overrides** — use shared classes (`.footer-btn`, `.level-circle`)
4. **No transparent borders** — buttons either have a visible border or no border at all
5. **No mixed font sizes** — all elements in a region use the same base size
6. **No feature toggles in footer** — infrequent settings belong in the Options panel
7. **No options without tooltips** — every Options panel control needs a `title` attribute
8. **No dead clicks** — if an element looks interactive (badge shape, colored background), it must have a click handler
9. **No mode toggles on count displays** — status bar counts reveal content, they don't change operational state. If the status bar shows "42 lines", clicking must open the file containing those 42 lines — not just focus a panel
10. **No manual count clearing** — diagnostic counts reflect live state and update automatically
11. **No static labels on dynamic controls** — if a trigger has variable state (e.g. level filters), the label must reflect the current state ("All", "3/7", "None"), not a fixed name
12. **No stateless bulk actions** — All/None links must visually indicate when their state is active; otherwise the user cannot tell at a glance
13. **No popups without titles** — every flyup/popup menu needs a title header so the user knows what they opened
14. **No implicit flex alignment in buttons** — `<button>` defaults to `text-align: center`; always set explicit `text-align: left` and `justify-content: flex-start` when using flex layout inside buttons
15. **No overlays on native scrollbars** — native browser scrollbars are opaque compositor elements; DOM overlays (`z-index`, `position: absolute`) are invisible behind them. Use a flex-sibling panel that hides the native scrollbar instead of trying to overlay it
16. **No minimap markers for hidden lines** — lines with `height === 0` (filtered, collapsed, excluded) have no meaningful scroll position; showing markers for them creates phantom indicators at incorrect locations
17. **No "Configure in Settings" links** — if a feature is managed in the Options panel, its full CRUD (add, remove, toggle) must happen in the panel. Never send the user to VS Code's JSON settings for something they can see and interact with in the UI
18. **No raw `recalcHeights(); renderViewport(true);`** — always use `recalcAndRender()` which handles scroll anchoring, prefix-sum rebuilds, and suppress-scroll wrapping. Calling them separately loses the user's scroll position
19. **No bare `scrollTop` assignments** — every programmatic `logEl.scrollTop = ...` must be wrapped in `suppressScroll = true/false` to prevent the scroll handler from firing a redundant render cycle (feedback loop)
20. **No O(n) scans in hot paths** — `renderViewport` runs on every scroll frame. Use `findIndexAtOffset()` (O(log n) binary search on prefix sums) instead of linear scans. Use `groupHeaderMap[id]` (O(1)) instead of scanning `allLines` to find stack headers
21. **No hardcoded pixel heights** — `ROW_HEIGHT` and `MARKER_HEIGHT` must be measured from a DOM probe element, not assumed. Font size and line height are user-configurable; hardcoded values cause spacer miscalculation and scroll jumps
22. **No height manipulation outside `recalcHeights()`** — filters set boolean flags (`filteredOut`, `levelFiltered`, `sourceFiltered`, etc.) on line items, then call `recalcAndRender()`. Only `calcItemHeight()` (called by `recalcHeights()`) reads those flags and assigns heights. This single source of truth prevents height drift between filters
