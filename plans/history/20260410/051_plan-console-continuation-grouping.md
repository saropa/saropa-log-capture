# 051: Console continuation grouping without logcat tags

## Problem

The continuation system (`viewer-data-add-continuation.ts`) groups consecutive
lines with the same timestamp into collapsible blocks. However, it requires
a matching **logcat tag** — lines without logcat tags (like `dart:developer`
`log()` output, which arrives as DAP category `console`) are never grouped.

When a single `log()` call produces multi-line output, the Dart DA splits it
into separate DAP events. These arrive with the same timestamp and category
`console` but no logcat tag, so they remain ungrouped individual lines.

## Proposal

Extend continuation matching to allow grouping when:
1. Both lines have the **same timestamp** (existing requirement)
2. Both lines have the **same category** (new: replaces logcat tag requirement)
3. Neither line is a **marker**, **separator**, **stack-frame**, or **stack-header**
4. The child line has **no source tag** (a `[tag]` prefix signals a new log entry)

The logcat tag requirement remains for logcat lines (they already work). The
new path only activates for lines that have no logcat tag.

## Why source tag check matters

Without it, consecutive `[log] message1` and `[log] message2` from separate
`log()` calls would falsely group because they share a timestamp and category.
The source tag `[log]` on the second line indicates it's a new entry, not a
continuation. Only lines **without** a leading source tag should be treated as
continuations.

## Files affected

- `src/ui/viewer/viewer-data-add-continuation.ts` — `matchesContinuation()`
- Tests in `src/test/ui/viewer-continuation-behavior.test.ts`

## Risk

Medium. False grouping is possible if two independent `console` log calls
happen at the same millisecond and the second lacks a source tag. The source
tag check mitigates this. Auto-collapse threshold (>5 children) provides a
safety net — small false groups are harmless.
