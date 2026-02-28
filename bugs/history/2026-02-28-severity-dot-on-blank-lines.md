# Severity dot shown on blank/empty log lines

**Fixed:** 2026-02-28

## Summary

With decorations on, the colored severity bar (green dot for info, etc.) appeared on lines that had no visible text—only the decoration prefix (counter, timestamp, chevron). Users asked to hide the dot for such blank lines.

## Fix

- **Shared blank check** — Added `isLineContentBlank(item)` in viewer data helpers (true when `stripTags(item.html).trim() === ''`). Used in two places: `calcItemHeight` (for hideBlankLines) and severity bar in `renderItem`.
- **Bar only when content present** — Severity bar class (`level-bar-*`) is now applied only when `!isLineContentBlank(item)`, so blank lines keep the decoration prefix but not the colored dot.

## Files changed

- `src/ui/viewer-data-helpers.ts` — `isLineContentBlank()`; barCls gated by it; calcItemHeight uses it for hideBlankLines.
