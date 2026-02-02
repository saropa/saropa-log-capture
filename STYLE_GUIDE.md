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
- Container shows "No patterns configured. Configure in Settings" when empty

### `.options-link` — In-Panel Links

Clickable text links inside the Options panel (e.g. "Configure in Settings"):

```css
.options-link {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: none;
}
```

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

## Footer Layout

The footer is a single flex row with `gap: 4px`:

```
[status text] [watch chips] [exclusion] [app-only] [level circles] [preset] [wrap | export | search | ≡]
```

- `#wrap-toggle` uses `margin-left: auto` to push right-aligned buttons to the edge
- Level circles are grouped in `.level-filter-group`
- Infrequent toggles (decorations, audio, minimap) live in the **Options panel**, not the footer

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
| **Status display** | 50 (left of pause) | Focus sidebar viewer | Line count + watch counts |

### Design principles

| Principle | Rule |
|-----------|------|
| **One item, one action** | Each status bar item does exactly one thing on click |
| **Counts are promises** | If the status bar shows "error: 4", clicking must show those 4 errors |
| **Live state only** | Counts reflect real-time data; never require manual clearing or dismissal |
| **Tooltip describes action** | Tooltip says what clicking does, not just the current state |

**Why split into two items?** VS Code status bar items support only one command each. Combining a count display with a pause toggle violates Nielsen's Heuristic #4 (Consistency and Standards) — users expect clicking a count to reveal details, not change operational state.

## Interactive Affordances

Every element that looks clickable must be clickable, and vice versa:

| Element | Interactive? | Click action |
|---------|-------------|-------------|
| Watch chips (`.watch-chip`) | Yes | Opens search with keyword pre-filled |
| Level dots (`.level-dot`) | Yes | Opens level filter fly-up menu |
| Footer status text | No | Styled as plain text (no pointer, no hover) |
| Filter badge | Yes | Opens options panel |

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

## Anti-Patterns

1. **No emoji in footer buttons** — use text labels instead (emoji only for level circles)
2. **No duplicate CSS** — each element gets styled once, in one file
3. **No per-button overrides** — use shared classes (`.footer-btn`, `.level-circle`)
4. **No transparent borders** — buttons either have a visible border or no border at all
5. **No mixed font sizes** — all elements in a region use the same base size
6. **No feature toggles in footer** — infrequent settings belong in the Options panel
7. **No options without tooltips** — every Options panel control needs a `title` attribute
8. **No dead clicks** — if an element looks interactive (badge shape, colored background), it must have a click handler
9. **No mode toggles on count displays** — status bar counts reveal content, they don't change operational state
10. **No manual count clearing** — diagnostic counts reflect live state and update automatically
