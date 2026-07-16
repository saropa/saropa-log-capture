# Toolbar toggle icon color + number formatting polish

Enabled toolbar toggle icons (trouble mode, signals, decorations, format, expanded panels) were visually indistinguishable from inactive icons — both rendered in the same dim `--vscode-descriptionForeground` grey. Large numbers in several toolbar counters (hidden-lines count, selection line/char counts) displayed as raw digits without grouping separators, making them hard to scan. The truncated-file indicator prepended a `·` middle-dot before "Showing first N of M lines" that was redundant once the line-count display became a styled pill with its own background.

## Changes

### Active toggle icon color
- `.toolbar-icon-btn-active` (`viewer-styles-format.ts`): added `color: var(--vscode-textLink-foreground, #3794ff)` so enabled toggles render in VS Code link-blue.
- `.toolbar-icon-btn[aria-expanded="true"]` (`viewer-styles-toolbar.ts`): same blue applied to expanded-panel buttons (filter drawer, flow map, actions) for consistent "this is on" signaling.

### Number comma grouping
- `viewer-hidden-lines.ts:updateHiddenDisplay()`: display text and tooltip both now call `formatNumber(count)` instead of bare `String(count)` / `count`.
- `viewer-script-footer.ts:updateFooterSelection()`: line count and character count both wrapped in `formatNumber()`.

### Leading dot removal
- `viewer-script-footer.ts:updateFooterText()`: removed `·` prefix from the truncated-file "Showing first N of M lines" text. The pill's badge-colored background already separates the count from the filename.

## Finish Report (2026-07-16)

All changes are CSS-only or string-formatting additions to existing webview JS functions. No new branching logic, no new dependencies, no shared-primitive changes. The `formatNumber` function (regex-based thousand-separator) was already in scope for the webview concatenated JS; three call sites that bypassed it now use it. The `--vscode-textLink-foreground` CSS variable is VS Code's standard link color, present in all built-in themes including high-contrast variants. No tests broken — existing tests verify element structure and aria attributes, not formatted output values or CSS colors.
