# Markdown render spacing / readability — attempt log

Status: In progress

The user opened a generated `.md` session report in the Log Viewer and reported it
"looks terrible / unreadable" — cramped, no vertical breathing room, headings overlapping
adjacent lines. Multiple fixes have been tried; this file records them so the next attempt
does not repeat a failed theory. Constraint that makes this hard: changes can only be
verified by the user reloading the Extension Host; the implementer cannot see the webview.

## Architecture constraints (verified)

- Log viewer rows are **fixed-height**, virtualized. `calcItemHeight(item)` returns the row
  height; `renderViewport` positions rows from prefix sums of those heights. If a row's real
  DOM height differs from `calcItemHeight`, rows drift / overlap.
- `.line` CSS height = `calc(1em * var(--log-line-height, 1.1))`. `ROW_HEIGHT` is **measured**
  from a `.line` probe (`measureRowHeight`), so it already reflects the user's line height.
- A larger font in a same-height row overflows: line box = fontEm × line-height. A heading at
  1.5em with inherited line-height 1.7 needs 2.55 base-em — far taller than a base row — so it
  overlaps the next line unless the row is allocated taller AND the DOM height is pinned to match.

## Attempts

1. **Per-line 1.6× height multiplier + `fmt-md-pad` line-height** (commit `6a705be2`). Body
   lines got `ROW_HEIGHT * 1.6` with matching CSS line-height. FAILED: compounded with the
   user's line-height control (comfortable 2.0 → 3.2×), a hidden second spacing knob.
2. **Drive the existing line-height control** (commit `6d1b966c`, `applyMarkdownTypography`):
   on markdown enable set line height to comfortable (1.7), restore default on exit; removed
   the multiplier; heading height = `ROW_HEIGHT × {2.2,2.0,1.7,1.4}` pinned inline. User reports
   "no change, in fact worse, lines overlap" — and the screenshot shows tables changed but
   spacing did NOT, i.e. the comfortable line height is not active in their view. Two
   possibilities: (a) Extension Host not reloaded after rebuild; (b) `applyMarkdownTypography`
   not firing. Overlap = heading pinned height computed from a `ROW_HEIGHT` that is NOT
   comfortable (because the line-height change didn't take), so the pinned multiple is too
   small for the 1.5em heading font → it overflows the row.

## Next attempt (why it differs)

Make heading row height **independent of whether the comfortable line height took effect**:
compute the heading row height from the heading's OWN font requirement
(`fontEm × headingLineHeight × base_px`, where `base_px = ROW_HEIGHT / logLineHeight`), pin it
inline, and give the heading text a tight fixed line-height. Then the heading row always fits
its own content — no overlap whether the document line height is 1.1 or 1.7. Body readability
still depends on `applyMarkdownTypography` setting the comfortable line height; verify that
path actually fires on the user's reload before tuning further.

3. **Independent heading row height + tight 1.35 line-height** (the "next attempt" above, shipped).
   FIXED the overlap, but introduced a NEW symptom (user screenshot): heading GLYPHS are clipped
   top and bottom — the caps and descenders of `Security Policy` / `Reporting a Vulnerability` are
   cut off. Cause: the row height was computed as an EXACT fit (content area == `fEm × 1.35` line
   box), the text used `align-items: flex-start` + `overflow: hidden`, and `line-height: 1.35` is
   too tight for the monospace glyph extent at heading sizes — so any sub-pixel rounding clips the
   line box that `overflow: hidden` then crops.

## Attempt 4 (why it differs from 3)

Stop fitting the row EXACTLY to the glyph and stop vertically clipping it:
- `.md-htext` line-height 1.35 → **1.5** (comfortably above glyph cap+descender).
- Heading row `align-items: flex-start` → **center**, so any slack is split top+bottom instead of
  all-bottom (flex-start clipped the descenders).
- Remove `overflow: hidden` from the heading ROW (keep it on `.md-htext` for horizontal ellipsis
  only) so vertical glyph extent is NEVER cropped — at worst a heading nudges its neighbor by a
  pixel, which is readable; cropping is not.
- `mdHeadingRowHeight`: factor 1.35 → **1.5** (match the CSS) plus more padding allowance
  (1.05 → 1.2 base-em) so the centered text has real slack. Row is now strictly taller than the
  glyph box, so centering + no-row-clip guarantees the glyphs are fully visible regardless of font
  metrics or sub-pixel rounding.
