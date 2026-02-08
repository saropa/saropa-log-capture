# Better Log Colors

Status: **Implemented** (Parts 1-6)

## Issue 1: Empty lines at end of file

Empty lines (empty or whitespace-only) should not get decoration chevrons or timestamps.

**Status:** Not yet addressed (separate issue).

## Issue 2: Level-based text coloring lost

Line text was all default foreground color despite severity dots working correctly. The `!hasDeco` guard in `renderItem()` suppressed text colors whenever decorations were enabled (the default).

**Fix:** Decoupled text colors from the decoration toggle. Added `lineColorsEnabled` webview-local variable (default: ON) with a "Level text colors" checkbox in the decoration settings panel.

**Color mapping (logcat prefix -> severity -> color):**

| Prefix | Level | Color |
|--------|-------|-------|
| V/ | debug | yellow (#dcdcaa, 0.8 opacity) |
| D/ | debug | yellow (#dcdcaa, 0.8 opacity) |
| I/ | info | blue (#3794ff) |
| W/ | warning | gold (#cca700) |
| E/F/A | error | red (#f48771) |
| (perf patterns) | performance | purple (#b695f8) |

V/ was reclassified from info to debug. Info lines now render in blue.

## Issue 3: Keyword-scope highlighting

Package names like `[Awesome Notifications]` should be colored individually (not the whole line), overlaying line-level coloring.

**Fix:** Added `scope` property to highlight rules: `"line"` (default) or `"keyword"`. Keyword-scope rules wrap only matched text in colored spans. CSS cascade naturally layers keyword colors over line-level colors.

Example config:
```json
{
  "pattern": "[Awesome Notifications]",
  "scope": "keyword",
  "color": "var(--vscode-terminal-ansiGreen, #89d185)",
  "label": "Awesome Notifications"
}
```

## Issue 4: Clickable inline tag links

Source tags (logcat tags, bracket tags) should be interactive directly in log lines — auto-colored, hover-underlined, click-to-filter.

**Fix:** Tags are now rendered as `<span class="tag-link">` elements with:
- Deterministic auto-coloring from an 8-color palette (hash-based)
- Hover underline + tooltip ("Click to filter: TagName")
- Click to solo-filter (show only that tag's lines; click again to clear)
- Options panel tag chips stay in sync with inline tag clicks

## Issue 5: Sub-tag detection for generic logcat tags

Lines like `I/flutter: HERO-DEBUG ContactAvatar: ...` were all tagged "flutter". The meaningful identifier (`HERO-DEBUG`) was invisible to the tag system.

**Fix:** Extended `parseSourceTag()` to detect sub-tags in the message body when the logcat tag is generic (`flutter`, `android`, `system.err`). Two patterns detected:
- Bracket sub-tags: `[Awesome Notifications]` -> tag = "awesome notifications"
- ALL-CAPS prefixes: `HERO-DEBUG ` -> tag = "hero-debug"

Lines without sub-tags keep the original logcat tag (e.g., "flutter").

## Issue 6: Tag link color not visible + logcat prefix tags not interactive

Tag link inline `style="color:..."` was overridden by ANSI color spans and level CSS classes. Logcat prefix tags like `I/flutter` and `D/Android` disappeared from the tag system when sub-tag detection extracted a more specific tag.

**Fix:** Tag colors now use CSS custom properties (`--tag-clr`) with `!important` to guarantee visibility over any parent color. Replaced `#dcdcaa` in the tag palette (conflicted with debug-level yellow). Added `parseLogcatTag()` to return the raw logcat prefix tag. Both the sub-tag and the parent logcat tag are now registered in the tag system, rendered as colored links, and independently filterable. A line is hidden only when ALL its associated tags are hidden.
