# Render All Bracket Tags as Visual Chips (2026-07-10)

**Defect:** Log lines with bracket tags like `[frame-stall]`, `[db]`, `[perf]`, `[retry]` displayed those tags as plain text mixed into the message body, despite the tag vocabulary being recognized. Tags were only partially stripped (severity-only), so descriptive tags like `[frame-stall]` remained visible as text.

**Solution:** Implemented a generic bracket-tag chip rendering system that:
1. Parses ALL bracket tags at line birth via `parseHeadTags()` (based on TAG_LEVEL_MAP)
2. Strips all bracket tags from displayed text (both structured and non-structured lines)
3. Renders parsed tags as semantic chips before the message body with level-based coloring (error=red, perf=purple, database=green, etc.)

## Changes

### New Module
- `src/ui/viewer-bracket-head-tags/viewer-bracket-head-tags.ts` — Parser and chip rendering (parseHeadTags, renderHeadTagChips)

### Modified Files
- `src/ui/viewer/viewer-data-add.ts` — Added parseHeadTags() call at line birth; stored result in item.headTags
- `src/ui/viewer/viewer-data-helpers-render.ts` — Updated bracket stripping to remove ALL bracket tags; added headTagsChips rendering before message body
- `src/ui/viewer-styles/viewer-styles-tags.ts` — Added .tag-chip CSS classes with level-specific colors matching level dots
- `src/test/ui/viewer-bracket-prefix-strip.test.ts` — Updated test assertions to verify all-bracket-stripping behavior (10/10 passing)
- `CHANGELOG.md` — Documented user-facing feature

## Behavior Changes

**Before:**
```
I/flutter ( 1234): [perf] [frame-stall] total=566ms build=155ms
```
Message displayed as: `[perf] [frame-stall] total=566ms build=155ms` (text mixed with tags)

**After:**
```
[perf] [frame-stall] total=566ms build=155ms
```
Rendered as: Two colored chip badges ([perf] purple, [frame-stall] purple) followed by clean message `total=566ms build=155ms`

## Tags Handled
All tags from TAG_LEVEL_MAP now render as chips:
- Database: `[db]`, `[database]`, `[query]`, `[drift]`, etc. → green
- Error: `[error]`, `[err]`, `[fatal]`, `[panic]` → red
- Warning: `[warn]`, `[warning]`, `[retry]`, `[fallback]` → orange
- Performance: `[perf]`, `[frame-stall]`, `[jank]`, `[fps]` → purple
- Todo: `[todo]`, `[fixme]`, `[hack]`, `[xxx]` → gray
- Notice: `[notice]`, `[milestone]`, `[lifecycle]` → cyan
- Debug: `[debug]`, `[trace]`, `[breadcrumb]` → brown
- Info/unrecognized: → light gray

## Testing
- Compile: ✓ (no errors)
- Modified test suite: 10/10 passing
- Regression suite (level classification parity): 27/27 passing
- Manual test file created: `test-bracket-tags.log`

## Architecture Notes
- Parser reuses TAG_LEVEL_MAP (single source of truth) for tag recognition
- Chip rendering integrated into existing renderItem pipeline (after flowChipSwap)
- CSS styling follows existing level-color palette (viewer-styles-level.ts)
- No new dependencies or shared-primitive additions
- Backward compatible: guards on `stripSourceTagPrefix` check for headTags existence
