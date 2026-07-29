# Handover — Design Token Migration

2026-07-29 01:45 UTC · saropa-log-capture / main · session cdaf5116-54f6-4f2f-afd5-d1a6c23fdc8c

## Unfinished tasks

None — plan 116 is complete. The remaining items are documented as intentional non-violations in the plan file.

## Completed tasks

1. **Plan 116 written** — full-app design token migration plan with audit results, phases, and execution strategy. File: `plans/116_plan-design-token-migration.md`.
2. **Phase 1: Radius + font-size migration** — replaced ~120 `border-radius: 3px` → `var(--radius-sm)`, ~8 `border-radius: 8px` → `var(--radius)`, `border-radius: 999px` → `var(--radius-pill)`, ~130 `font-size: 11px` → `var(--text-caption)`, ~20 `font-size: 13px` → `var(--text-body)`, ~3 `font-size: 18px` → `var(--text-h2)` across 45+ files. Verified with `npm run check-types`. Commit `aada0f7c`.
3. **Phase 2: Token layer wiring** — added `getTokenStyles()` import and style prepend to session comparison, collection, bug report, and keyboard shortcuts panels. Commit `89f9da81`.
4. **Phase 3: Spacing token migration** — replaced single-value, two-value, and three-value `padding`, `margin`, and `gap` declarations mapping to the 4px scale (`--space-1` through `--space-7`) across 59 files. Commit `12f61526`.
5. **Phase 4+5: Semantic token migration** — replaced ~750 raw `--vscode-*` CSS variable references with semantic tokens (`--surface-1/2/3`, `--inset`, `--text`, `--muted`, `--link`, `--border`, `--accent-critical/warning/info`) across 68 files. Collapsed redundant fallback chains. Verified with `npm run check-types`. Commit `816ce2a1`.
6. **Plan 116 marked complete** — updated plan file with execution summary and remaining-by-design section. Commit `3991d475`.

## Session narrative

### User requests

This session continued from a compacted context. The original request (from the prior session) was a full-app UX improvement pass — NOT limited to the signal report panel. The user explicitly corrected scope narrowing multiple times:
- "I NEVER EVER SAID THAT WAS THE SCOPE!!!"
- "no!!!! dont ask me. this is so bad. you should have a design system for the app to use"

The user confirmed "y" to a full UX pass auditing and migrating all surfaces against the existing design token system. The design system (`viewer-styles-tokens.ts`) and style guide (`plans/guides/style-guide.md`) are the standard — no screenshots or user input needed.

This session resumed Phase 3 (spacing migration) from where the prior session left off and continued through Phase 5.

### Investigation & analysis

- **Remaining spacing audit**: After completing on-scale single/compound padding/margin/gap replacements, 276 occurrences remained. Inspection showed these are multi-value declarations with off-scale values (2px, 3px, 6px, 10px) mixed with on-scale values — cannot be mechanically tokenized without design decisions.
- **Hex color audit**: 101 distinct hex colors found across `src/ui/`. Categorized as: (a) severity pill colors — intentionally fixed for WCAG AA, (b) syntax highlighting colors — theme-specific, (c) CSS fallback hex inside `var()` — correct, (d) standalone hex for white text on colored badges — intentional. No actionable violations found.
- **Raw `--vscode-*` audit**: 849 references across 67 files for variables that have semantic token mappings. After migration, remaining `--vscode-*` usage is for variables WITHOUT semantic mappings: `list-hoverBackground`, `button-*`, `badge-*`, `sideBar-*`, `focusBorder`, `font-family`, `charts-*`, `toolbar-hoverBackground`, etc.

### Changes made

All changes are mechanical find-and-replace refactors — no behavioral changes.

**Commit `12f61526` (Phase 3 — spacing):**
- 60 files across `src/ui/` — replaced `padding`, `margin`, `gap` px values with `var(--space-N)` tokens
- Single-value: `padding: 8px` → `var(--space-2)`, etc.
- Two-value: `padding: 8px 12px` → `var(--space-2) var(--space-3)`, etc.
- Three-value: `margin: 4px 12px 8px` → `var(--space-1) var(--space-3) var(--space-2)`, etc.
- CHANGELOG updated

**Commit `816ce2a1` (Phase 4+5 — semantic tokens):**
- 69 files across `src/ui/` — replaced raw `--vscode-*` with semantic tokens
- `var(--vscode-descriptionForeground)` → `var(--muted)` (274 hits)
- `var(--vscode-foreground)` → `var(--text)` (123 hits)
- `var(--vscode-panel-border)` → `var(--border)` (185 hits)
- `var(--vscode-textLink-foreground)` → `var(--link)` (78 hits)
- `var(--vscode-editor-background)` → `var(--surface-1)` (53 hits)
- `var(--vscode-editorWidget-background)` → `var(--surface-2)` (24 hits)
- `var(--vscode-input-background)` → `var(--inset)` (27 hits)
- `var(--vscode-editorError-foreground)` → `var(--accent-critical)` (12 hits)
- `var(--vscode-editorWarning-foreground)` → `var(--accent-warning)` (32 hits)
- Collapsed redundant fallback chains like `var(--vscode-editorWarning-foreground, var(--accent-warning))` → `var(--accent-warning)`
- CHANGELOG updated

**Commit `3991d475` (plan update):**
- `plans/116_plan-design-token-migration.md` — status changed to Complete, execution summary written, remaining-by-design items documented

### Decisions & trade-offs

1. **Off-scale spacing left alone**: Values like 2px, 3px, 6px, 10px don't map to the 4px spacing scale. Could bump to nearest (e.g. 6px → `--space-2` at 8px) but that changes the visual. Decided to leave for a future design decision.
2. **Hex colors left alone**: After audit, all remaining hex values are either intentionally fixed (severity pills, WCAG contrast), syntax highlighting, or CSS fallbacks. No violations to fix.
3. **`--vscode-*` without semantic mapping left alone**: Variables like `--vscode-button-background`, `--vscode-badge-background`, `--vscode-sideBar-background` have no semantic token alias in the design system. Adding new tokens is out of scope for this refactor.
4. **`var(--vscode-editorWidget-border, var(--border))` kept as-is**: `--vscode-editorWidget-border` is NOT the same as `--vscode-widget-border` — it's a more specific border variable. The fallback to `var(--border)` is correct.
5. **Excluded `viewer-styles-tokens.ts` from all replacements**: That file DEFINES the tokens; replacing its resolution definitions would create circular references.

### Rejected / dismissed / deferred

- **Adding new design tokens for off-scale spacing**: Would require design decisions (is 6px → 8px acceptable?). Deferred.
- **Adding semantic tokens for all remaining `--vscode-*` variables**: Would bloat the token layer with aliases for every VS Code theme variable. Not warranted — the token layer covers surfaces, text, borders, and status. Contextual variables (button, badge, list hover) are fine as raw references.
- **Migrating log-line console to sans type scale**: Explicitly exempt per token file docs. The monospace rows, minimap, and decoration bars must NOT use the dashboard type scale.

### User feedback & corrections

From the prior session (carried forward as critical context):
- Scope was repeatedly narrowed without authorization — user corrected forcefully
- User rejected being asked for screenshots or input — the design system IS the standard
- User rejected narrowing to signal report only

No new corrections this session — work was mechanical migration against the established token system.

## Key files & paths

- `src/ui/viewer-styles/viewer-styles-tokens.ts` — single source of truth for all design tokens (surfaces, text, borders, spacing, radius, elevation, type scale, motion, z-index)
- `plans/guides/style-guide.md` — viewer UI conventions and 22 documented anti-patterns
- `plans/116_plan-design-token-migration.md` — plan file with execution summary and remaining items
- `CHANGELOG.md` — entries under `[Unreleased] ### Changed`
- `src/ui/viewer-styles/*.ts` — ~45 style modules (heaviest edit targets)
- `src/ui/panels/*.ts` — editor-tab panel styles
- `src/ui/analysis/*.ts` — analysis panel styles
- `src/ui/collection/*.ts` — collection panel styles
- `src/ui/session/*.ts` — session comparison styles

## How to verify

1. `npm run check-types` — zero errors (verified after each commit)
2. `npm run compile` — full 12-step gate chain passes
3. F5 in VS Code (not Cursor) — open the log viewer, verify:
   - All panels render correctly (viewer, session comparison, collection, bug report, keyboard shortcuts)
   - Light and dark themes both look right
   - No visual regressions in spacing, borders, colors
   - Signal report still renders with severity-colored borders

## Gotchas & traps

1. **`sed` on Windows with `&&` chains**: If any `grep -rl` in a chained command finds no files, `xargs` gets no input and errors. Use `if [ -n "$files" ]` guards or `xargs --no-run-if-empty`.
2. **`.ts` vs `.js` in `src/ui/`**: Untracked `.js` build artifacts exist under `src/ui/`. Always scope replacements to `--include="*.ts"` to avoid editing generated files.
3. **`--vscode-editor-background` substring match**: Must replace `--vscode-editorWidget-background` BEFORE `--vscode-editor-background` to avoid partial matching (`editorWidget` contains `editor`).
4. **Fallback chain semantics**: `var(--vscode-editorWidget-border, var(--border))` is NOT redundant — `--vscode-editorWidget-border` is a different variable from `--vscode-widget-border`. The former is more specific and may not exist in all themes.
5. **Pre-existing compile blocker**: `integration-adapter-constants.test.ts` has a type error (4th param `screenshotsEnabled`) from the screenshots feature (plan 114) — NOT from this work. May block `npm run compile` if not fixed separately.
6. **Token layer must be prepended**: `getTokenStyles()` output goes BEFORE panel-specific styles in the `<style>` tag. Order matters — downstream rules reference tokens defined in the layer.
