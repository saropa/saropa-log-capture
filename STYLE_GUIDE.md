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

### Options Panel Rows

Standard layout for settings rows inside the Options panel:

```css
.options-row {
    font-size: 12px;
    padding: 4px 0;
    gap: 8px;
}
```

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
| Options panel rows | `4px 0` | `8px` |
| Modals | `12px 16px` | `8px` |

## Anti-Patterns

1. **No emoji in footer buttons** — use text labels instead (emoji only for level circles)
2. **No duplicate CSS** — each element gets styled once, in one file
3. **No per-button overrides** — use shared classes (`.footer-btn`, `.level-circle`)
4. **No transparent borders** — buttons either have a visible border or no border at all
5. **No mixed font sizes** — all elements in a region use the same base size
6. **No feature toggles in footer** — infrequent settings belong in the Options panel
