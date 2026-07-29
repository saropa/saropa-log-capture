# Plan 116 — Full-App Design Token Migration

**Status:** Complete
**Goal:** Migrate every UI surface to consume the design token system (`viewer-styles-tokens.ts`) so the app renders as one cohesive design, not 8+ independent visual dialects.

## Problem

The design token layer exists and is well-defined (surfaces, type scale, spacing, radius, elevation, motion, z-index). But only 1 of 8 editor-tab panels used it. The rest predated it and hardcoded raw pixel values and `--vscode-*` variables directly.

## Execution summary

### Phase 1: Mechanical find-and-replace — DONE

Commit `aada0f7c` — 62 files, 427 ins, 323 del.

- `border-radius: 3px` → `var(--radius-sm)` (~120 instances)
- `border-radius: 8px` → `var(--radius)` (~8 instances)
- `border-radius: 999px` → `var(--radius-pill)`
- `font-size: 11px` → `var(--text-caption)` (~130 instances)
- `font-size: 13px` → `var(--text-body)` (~20 instances)
- `font-size: 18px` → `var(--text-h2)` (~3 instances)

### Phase 2: Panel token layer wiring — DONE

Commit `89f9da81` — 5 files, 11 ins, 6 del.

Added `getTokenStyles()` import and prepend to:
- Session Comparison panel
- Collection panel
- Bug Report panel
- Keyboard Shortcuts panel

### Phase 3: Spacing token migration — DONE

Commit `12f61526` — 60 files, 433 ins, 477 del.

- Single-value padding/margin/gap (4/8/12/16/24/32/48px → `--space-1` through `--space-7`)
- Two-value compound patterns (e.g. `padding: 8px 12px` → `var(--space-2) var(--space-3)`)
- Three-value compound patterns
- Remaining px values involve off-scale sizes (2px, 3px, 6px, 10px) that need design decisions

### Phase 4+5: Semantic token migration — DONE

Commit `816ce2a1` — 69 files, 751 ins, 750 del.

Replaced ~750 raw `--vscode-*` CSS variable references with semantic tokens:
- Surfaces: `--vscode-editor-background` → `--surface-1`, `editorWidget-background` → `--surface-2`
- Text: `--vscode-foreground` → `--text`, `descriptionForeground` → `--muted`
- Links: `--vscode-textLink-foreground` → `--link`
- Borders: `--vscode-panel-border`/`widget-border` → `--border`
- Input: `--vscode-input-background` → `--inset`
- Status: `editorError/Warning/Info-foreground` → `--accent-critical/warning/info`
- Collapsed redundant fallback chains where both raw var and token coexisted

## Remaining (by design)

These are NOT violations — they are intentional or structural:

- **Off-scale spacing** (2px, 3px, 6px, 10px): need design decisions about bumping to nearest scale value or adding tokens
- **Severity pill hex** (`--sev-*`): fixed by design for WCAG AA contrast on filled chips
- **Syntax highlighting hex**: level-bar colors, ANSI colors — theme-specific, not tokenizable
- **CSS fallback hex** inside `var(--vscode-*, #hex)`: correct — only used if theme var undefined
- **Log-line console**: exempt from sans type scale per token docs
- **`--vscode-*` without semantic mapping**: `list-hoverBackground`, `button-*`, `badge-*`, `sideBar-*`, `focusBorder`, `font-family` — no token alias exists yet
