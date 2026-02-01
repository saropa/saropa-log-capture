# Enhancement Plan - Saropa Log Capture

Features and enhancements inspired by the Flutter debug system in `D:\src\contacts\lib\utils\_dev\`.

---

## New Features (Not Yet Implemented)

### 1. Smart Deduplication with Live Counters
**Current:** Batches duplicates at write time → `"Error: Connection Refused (x54)"`

**Flutter pattern:** Real-time repeat notifications with hash-based detection

**Implementation:**
- Show each repeat immediately: `"🔴 Repeated log #5 (Connection Refused...)"`
- Hash by `level::message::file::line` instead of just exact string match
- Show message preview (first 85 chars) in repeat notification
- Count resets when new unique message arrives

**Files to modify:**
- `src/modules/deduplication.ts` - Add hash-based detection
- `src/ui/viewer-script.ts` - Show repeat notifications in real-time

---

### 2. Multi-Frame Stack Trace Preview
**Current:** Full stack collapsed by default

**Flutter pattern:** Configurable depth with intelligent filtering

**Implementation:**
- Add "preview mode" showing 3-5 most relevant frames by default
- Filter out internal debug/framework frames automatically
- Setting: `stackFramePreviewCount` (default: 3, range: 1-10)
- Click to expand for full trace
- Exclude `/_dev/`, `node_modules`, internal VS Code frames from preview

**Files to modify:**
- `src/ui/viewer-script.ts` - Modify stack trace rendering
- `src/modules/config.ts` - Add `stackFramePreviewCount` setting
- `package.json` - Add setting definition

---

### 3. Sequential Counter Column
**Current:** No sequence tracking

**Flutter pattern:** `#34`, `#210` incremental counter for tracking async operation order

**Implementation:**
- Add optional sequence number column before timestamp
- Setting: `showSequenceCounter` (default: false)
- Useful for debugging race conditions and async flows

**Files to modify:**
- `src/modules/log-session.ts` - Track sequence counter
- `src/ui/viewer-script.ts` - Display counter column
- `src/ui/viewer-styles.ts` - Style counter column
- `package.json` - Add setting

---

### 4. Environment/Session Info Block
**Current:** Basic session metadata

**Flutter pattern:** Rich formatted startup diagnostics

**Implementation:**
- Show formatted header at session start:
  ```
  -======================================-
  # Session Start #

  VS Code:              1.95.0
  Node:                 20.11.0
  Platform:             win32
  Debug Adapter:        dart
  Workspace:            D:\src\myapp
  Screen:               1920x1080 (high DPI)
  -======================================-
  ```
- Include: VS Code version, Node version, OS, debug adapter type, workspace path
- Setting: `showEnvironmentInfo` (default: true)

**Files to modify:**
- `src/modules/log-session.ts` - Collect environment data
- `src/ui/viewer-script.ts` - Display formatted block
- `package.json` - Add setting

---

## Enhancements to Existing Features

### 5. Level Classification - Add More Levels
**Current:** `info`, `warning`, `error`, `performance` (4 levels)

**Flutter pattern:** 6 distinct levels with rich metadata

**Enhancements:**
- Add `todo` level: `/\b(TODO|FIXME|HACK|XXX)\b/i` → ⚪
- Add `debug/breadcrumb` level: `/\b(breadcrumb|trace|debug)\b/i` → 🟣
- Add `notice` level: `/\b(notice|note|important)\b/i` → 🔵
- Each level gets: emoji, color, optional audio, export rules
- Setting: `levelSaveRules` - which levels to include in exports

**Files to modify:**
- `src/ui/viewer-level-filter.ts` - Add new level patterns
- `src/ui/viewer-content.ts` - Add filter buttons for new levels
- `src/ui/viewer-decorations.ts` - Add emoji mappings
- `src/ui/viewer-audio.ts` - Add sounds for new levels (optional)
- `package.json` - Add `levelSaveRules` setting

---

### 6. Audio Alerts - Add Volume Control
**Current:** Simple on/off toggle, 2 sounds (error/warning)

**Flutter pattern:** Volume control, graceful degradation

**Enhancements:**
- Add volume slider (0-100%, default 30%)
- Rate limiting: max 1 sound per N seconds per level
- Setting: `audioRateLimit` (default: 2000ms)
- Different sounds per level (not just error/warning)
- Mute button (separate from disable) - keeps showing visual alerts
- Audio preview in settings

**Files to modify:**
- `src/ui/viewer-audio.ts` - Add volume control, rate limiting
- `src/ui/viewer-content.ts` - Add volume slider UI
- `src/ui/viewer-options-panel.ts` - Add audio settings panel
- `package.json` - Add `audioVolume`, `audioRateLimit` settings

---

### 7. Timestamps - Add Milliseconds & Elapsed Time
**Current:** Basic timestamp display

**Flutter pattern:** Milliseconds toggle + elapsed time between logs

**Enhancements:**
- Setting: `showMilliseconds` (default: false)
- Show gap indicators: dim lines with >1s gap from previous
- Elapsed time column (optional): `+0.05s`, `+2.13s` from previous line
- Slow gap highlighting: yellow background for gaps >1s (configurable threshold)

**Files to modify:**
- `src/ui/viewer-script.ts` - Calculate and display elapsed time
- `src/ui/viewer-styles.ts` - Style gap indicators
- `package.json` - Add `showMilliseconds`, `showElapsedTime`, `slowGapThreshold` settings

**Note:** `slowGapThreshold` already exists in package.json (default: 1000ms)

---

### 8. Tag/Category Filtering - Parse Inline Tags
**Current:** Dropdown filters by DAP output category (`stdout`, `stderr`, etc.)

**Flutter pattern:** 70+ debug types dynamically enabled/disabled

**Enhancements:**
- Parse inline tags: `[Network]`, `[Database]`, `[Auth]` from log messages
- Auto-generate filter chips for discovered tags
- Click tag to toggle visibility (like level circles)
- Setting: `tagPatterns` - regex to extract tags (default: `\[(\w+)\]`)
- Persistent tag enable/disable state per session

**Files to modify:**
- `src/ui/viewer-filter.ts` - Parse tags from messages
- `src/ui/viewer-content.ts` - Add tag filter chips UI
- `src/ui/viewer-script.ts` - Tag filtering logic
- `package.json` - Add `tagPatterns` setting

---

### 9. Error Handling - Smart Error Classification
**Current:** Show everything equally

**Flutter pattern:** Skip expected transient errors, highlight critical ones

**Enhancements:**
- Setting: `suppressTransientErrors` (default: false)
  - Suppresses: `TimeoutException`, `SocketException`, `ECONNREFUSED`
- Setting: `breakOnCritical` (default: false)
  - Triggers notification for: `NullPointerException`, `AssertionError`, `FATAL`
- Classification badges: `🔥 CRITICAL`, `⚡ TRANSIENT`, `🐛 BUG`
- Auto-collapse transient errors (expandable section)

**Files to modify:**
- `src/ui/viewer-level-filter.ts` - Add error classification logic
- `src/ui/viewer-decorations.ts` - Add classification badges
- `src/ui/viewer-script.ts` - Auto-collapse logic
- `package.json` - Add `suppressTransientErrors`, `breakOnCritical` settings

---

### 10. Context Display - Add Caller Metadata
**Current:** Shows N lines before filtered match

**Flutter pattern:** Shows caller function, widget type, parent element

**Enhancements:**
- Extract function name from stack trace → show in parentheses after timestamp
- Show file path in breadcrumb: `src/utils/auth.ts » login()`
- Hover on line shows full context: file, function, line number, git blame
- Setting: `showInlineContext` (default: false)

**Files to modify:**
- `src/ui/viewer-script.ts` - Parse and display context metadata
- `src/ui/viewer-decorations.ts` - Format context display
- `src/ui/viewer-styles.ts` - Hover tooltip styles
- `package.json` - Add `showInlineContext` setting

---

### 11. Log Formatting - Improve Visual Structure
**Current:** Basic line-by-line display

**Flutter pattern:** Aligned columns, non-breaking spaces, visual separators

**Enhancements:**
- Align timestamps in fixed-width column (no wrapping)
- Use `»` separator between timestamp and message (like Flutter)
- Add subtle vertical line connecting stack trace frames
- Setting: `columnAlignment` (default: true)
- Setting: `compactMode` - tighter spacing for more lines on screen

**Files to modify:**
- `src/ui/viewer-styles.ts` - Column alignment, separators
- `src/ui/viewer-script.ts` - Format timestamps with separators
- `package.json` - Add `columnAlignment`, `compactMode` settings

---

### 12. Settings Integration - Per-Level Rules
**Current:** Global settings for all logs

**Flutter pattern:** Per-level save rules, conditional exports

**Enhancements:**
- Setting: `exportLevels` - which levels to include in exports (default: all)
- Setting: `saveLevels` - which levels to persist to disk (default: all)
- Setting: `notificationLevels` - which levels trigger alerts (default: error only)
- Per-level audio settings: `audioLevels: { error: true, warning: true, info: false }`
- Export templates: "Errors Only", "Full Debug", "Production Ready"

**Files to modify:**
- `src/modules/config.ts` - Add per-level settings
- Export modules - Respect level filters
- `src/ui/viewer-audio.ts` - Per-level audio toggle
- `package.json` - Add settings

---

## Priority Categorization

### 🚀 Quick Wins (Easiest High-Impact)
1. **#7 - Milliseconds in timestamps** - Simple UI toggle
2. **#8 - Tag extraction from `[TagName]` patterns** - Small regex + filter chips
3. **#6 - Volume control for audio** - Range input + localStorage
4. **#2 - Stack trace preview mode (3 frames)** - Already have collapsing, just change default
5. **#9 - Suppress transient errors setting** - Filter known patterns

### 💎 High-Impact Enhancements
1. **#1 - Real-time deduplication with counters** - Better UX than batch
2. **#12 - Per-level export/save rules** - Professional workflow improvement
3. **#10 - Inline context metadata** - Faster debugging
4. **#5 - Multi-level classification** (add TODO, breadcrumb, notice) - Better organization

### 📊 Medium-Impact Enhancements
1. **#3 - Sequential counter** - Useful for async debugging
2. **#4 - Environment info block** - Professional session headers
3. **#8 - Inline tag parsing** - Dynamic subsystem filtering

### 🎨 Polish (Nice-to-Have)
1. **#11 - Column alignment & visual separators** - Aesthetic improvements
2. **#6 - Audio preview & mute button** - Advanced audio controls

---

## Implementation Notes

### Removed Suggestions (Already Implemented or Confusing)
- ❌ **Severity badges (🔴 HIGH)** - Redundant with existing error highlighting
- ❌ **Search within results** - Already have `searchFilterMode`
- ❌ **Regex toggle in search** - Already implemented in `viewer-search.ts`
- ❌ **Visual indicators with pulsing animations** - Too distracting, removed

### Design Principles to Maintain
1. **Zero Friction** - Features should work on install, no config needed
2. **One Problem, Perfectly** - Capture debug output, nothing else
3. **Never Lose Data** - Immediate-append writes, crash-safe
4. **Respect the Host** - Native VS Code patterns, --vscode-* CSS vars
5. **Performance is a Feature** - Virtual scrolling, batched updates, streaming writes

---

## Next Steps

1. Review and prioritize enhancements
2. Start with Quick Wins for immediate value
3. Implement High-Impact features for maximum UX improvement
4. Consider Medium-Impact based on user feedback
5. Polish items can be added in future iterations
