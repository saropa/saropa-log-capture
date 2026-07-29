# Plan 116 — Full-App Design Token Migration

**Status:** In Progress
**Goal:** Migrate every UI surface to consume the design token system (`viewer-styles-tokens.ts`) so the app renders as one cohesive design, not 8+ independent visual dialects.

## Problem

The design token layer exists and is well-defined (surfaces, type scale, spacing, radius, elevation, motion, z-index). But only 1 of 8 editor-tab panels uses it. The rest predate it and hardcode raw pixel values and `--vscode-*` variables directly.

### Audit results (2026-07-29)

| Dimension | Count |
|-----------|-------|
| Hardcoded hex/rgba colors | 53 violations |
| Hardcoded spacing/sizing/radius | ~750+ across ~60 files |
| `border-radius: 3px` → `--radius-sm` | ~120 instances |
| `font-size: 11px` → `--text-caption` | ~130 instances |
| `padding: 8px 12px` → `--space-2 --space-3` | ~30 instances |
| Editor-tab panels not loading tokens | 4 of 8 |
| Editor-tab panels partially compliant | 2 of 8 |
| Editor-tab panels fully compliant | 1 of 8 (Signal Report) |

### Hotspot files (most violations)

1. `viewer-styles-crashlytics.ts` (~78)
2. `analysis-panel-styles.ts` (~77)
3. `viewer-styles-crashlytics-setup.ts` (~54)
4. `collection-panel-styles.ts` (~50)
5. `viewer-styles-options.ts` (~30)
6. `viewer-styles-options-extra.ts` (~30)
7. `viewer-styles-performance.ts` (~27)

## Scope

### In scope

- Replace hardcoded px values with spacing tokens (`--space-1` through `--space-8`)
- Replace hardcoded font sizes with type scale tokens (`--text-caption`, `--text-body`, etc.)
- Replace hardcoded border-radius with radius tokens (`--radius-sm`, `--radius`, etc.)
- Replace hardcoded hex/rgba colors with semantic tokens or `--vscode-*` variables
- Add `getTokenStyles()` import to panels that don't load the token layer
- Replace raw `--vscode-*` references with semantic aliases where tokens exist

### Out of scope (exempt per token file docs)

- Log-line console (monospace rows, minimap, decoration bars) — exempt from the sans type scale
- Severity pill fixed hex colors (`--sev-*`) — intentionally fixed
- `rgba(0,0,0,...)` in shadow definitions
- Fallback values inside `var()` expressions

### Not features

This is a refactor. No new UI, no behavior changes, no new tokens needed. Every replacement maps a hardcoded value to an existing token that resolves to the same computed value.

## Execution plan

Batched by area to keep commits within the ≤10 files / ≤400 lines threshold. Each batch is one commit.

### Phase 1: Mechanical find-and-replace (highest volume, lowest risk)

These are 1:1 replacements where the token resolves to the exact same value:

| Pattern | Token | Count |
|---------|-------|-------|
| `border-radius: 3px` | `var(--radius-sm)` | ~120 |
| `border-radius: 8px` | `var(--radius)` | ~8 |
| `border-radius: 12px` | `var(--radius-lg)` | few |
| `font-size: 11px` | `var(--text-caption)` | ~130 |
| `font-size: 13px` | `var(--text-body)` | ~20 |
| `font-size: 18px` | `var(--text-h2)` | ~3 |
| `font-size: 22px` | `var(--text-h1)` | few |
| `gap: 4px` | `var(--space-1)` | many |
| `gap: 8px` | `var(--space-2)` | many |

### Phase 2: Panel token layer wiring

Add `getTokenStyles()` to panels that don't load it:
- Session Comparison
- Collection Panel
- Bug Report Panel
- Keyboard Shortcuts Panel

### Phase 3: Spacing token migration

Replace hardcoded padding/margin/gap with spacing tokens, file by file, prioritized by violation count.

### Phase 4: Color token migration

Replace hardcoded hex/rgba with semantic tokens. Requires case-by-case judgment:
- Error hover styles (14 violations) — needs `--accent-critical`/`--accent-warning` derived colors
- Run separator (9 violations) — needs `--sev-*` token references
- Lint badge (4 violations) — straightforward `color-mix()` replacements
- Decoration bars (4 violations) — `color-mix()` with theme variables

### Phase 5: Raw `--vscode-*` → semantic alias migration

Replace direct `--vscode-*` usage with semantic tokens where the mapping exists:
- `--vscode-editor-background` → `var(--surface-1)`
- `--vscode-foreground` → `var(--text)`
- `--vscode-descriptionForeground` → `var(--muted)`
- `--vscode-panel-border` → `var(--border)`
- `--vscode-textLink-foreground` → `var(--link)`
