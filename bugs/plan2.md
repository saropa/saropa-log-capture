# Log Viewer Layout Improvements Plan

## Overview
Enhancements to the log viewer visual layout for better readability and customization.

---

## 1. Solid Bar Mode for Same-Color Indicators

### Current State
- Each log line shows an emoji dot (🔴 🟠 🟣 🔵 🟢) based on severity level
- Rendered via `getLevelDot()` in [viewer-decorations.ts:30-36](../src/ui/viewer-decorations.ts#L30-L36)
- Consecutive same-level lines show repeated identical emoji dots

### Goal
Join consecutive same-color emoji into one solid vertical bar of the same color.

### Implementation
- Add "Bar Mode" toggle to decoration settings panel
- When enabled, apply colored left border instead of (or alongside) emoji dot
- CSS approach:
  ```css
  .level-bar-error { border-left: 3px solid var(--vscode-debugConsole-errorForeground); }
  .level-bar-warning { border-left: 3px solid var(--vscode-debugConsole-warningForeground); }
  .level-bar-performance { border-left: 3px solid var(--vscode-debugConsole-infoForeground); }
  .level-bar-framework { border-left: 3px solid #3794ff; }
  .level-bar-info { border-left: 3px solid var(--vscode-terminal-ansiGreen); }
  ```
- Consecutive same-level lines naturally form continuous bar
- Bar width configurable (2-4px)
- Toggleable via decoration settings

### Files to Modify
- `src/ui/viewer-decorations.ts` - Add bar mode logic
- `src/ui/viewer-deco-settings.ts` - Add toggle UI
- `src/ui/viewer-styles-overlays.ts` - Add bar CSS classes
- `src/ui/viewer-data.ts` - Apply bar classes in `renderItem()`

---

## 2. Visual Breathing Room (Heuristic Spacing)

### Current State
- Log lines render with consistent spacing
- `getSlowGapHtml()` already adds visual gaps for time delays ([viewer-data.ts:194](../src/ui/viewer-data.ts#L194))

### Goal
Add configurable visual padding (not newlines) before/after certain log types for better readability.

### Implementation
- Add "Visual Spacing" toggle to viewer options panel
- Detect transition points in `renderItem()`:
  - Before/after errors or stack traces
  - Level changes (info → error, warning → error)
  - Category changes
- Apply CSS margin (not actual newlines):
  ```css
  .line.spacing-before { margin-top: 8px; }
  .line.spacing-after { margin-bottom: 8px; }
  ```
- Heuristics for spacing triggers:
  - Before first error after info/warning lines
  - After last line of stack trace
  - Before/after markers
  - Before first line after a level change

### Files to Modify
- `src/ui/viewer-data.ts` - Add spacing detection logic in `renderItem()`
- `src/ui/viewer-options-panel.ts` - Add toggle UI
- `src/ui/viewer-styles-content.ts` - Add spacing CSS classes

---

## 3. Line Height Adjustment (All Lines)

### Current State
- Fixed line height: `ROW_HEIGHT = 20` ([viewer-script.ts:24](../src/ui/viewer-script.ts#L24))
- CSS line-height: `1.5` for `.line` ([viewer-styles.ts:110](../src/ui/viewer-styles.ts#L110))

### Goal
Allow user to adjust line height for all log lines.

### Implementation
- Add line height slider/input to viewer options panel
- Range: 1.0 - 2.5 (or 16px - 40px absolute)
- Store preference in viewer state (not persisted to settings initially)
- Update CSS dynamically:
  ```javascript
  document.documentElement.style.setProperty('--log-line-height', '1.8');
  ```
- Apply to `.line` class via CSS variable:
  ```css
  .line {
    line-height: var(--log-line-height, 1.5);
  }
  ```
- May need to recalculate `ROW_HEIGHT` constant or use dynamic height calculation
- Trigger `recalcHeights()` and `renderViewport(true)` on change

### Files to Modify
- `src/ui/viewer-options-panel.ts` - Add line height control
- `src/ui/viewer-styles.ts` - Use CSS variable for line-height
- `src/ui/viewer-script.ts` - Possibly adjust ROW_HEIGHT calculation

---

## 4. Font Size Adjustment (All Lines)

### Current State
- Font size inherits from VS Code editor: `var(--vscode-editor-font-size, 13px)` ([viewer-styles.ts:32](../src/ui/viewer-styles.ts#L32))

### Goal
Allow user to adjust font size independently of VS Code editor settings.

### Implementation
- Add font size slider/input to viewer options panel
- Range: 10px - 20px (or percentage: 80% - 150%)
- Store preference in viewer state
- Update CSS dynamically:
  ```javascript
  document.documentElement.style.setProperty('--log-font-size', '14px');
  ```
- Override body font-size:
  ```css
  body {
    font-size: var(--log-font-size, var(--vscode-editor-font-size, 13px));
  }
  ```
- Trigger `recalcHeights()` and `renderViewport(true)` on change

### Files to Modify
- `src/ui/viewer-options-panel.ts` - Add font size control
- `src/ui/viewer-styles.ts` - Use CSS variable for font-size

---

## Implementation Order

1. **Line Height & Font Size Adjustments** (Simplest, standalone)
   - Pure CSS changes with minimal logic
   - No complex detection or state management

2. **Solid Bar Mode** (Medium complexity)
   - Extends existing decoration system
   - Clear implementation path

3. **Visual Breathing Room** (Most complex)
   - Requires heuristic detection logic
   - Multiple triggers and edge cases to handle

---

## Settings Organization

All four features should be accessible via:
- **Options Panel** (`⚙` button in footer) for quick access
- Possible dedicated "Layout" section in options panel:
  - Font Size: [slider 10-20px]
  - Line Height: [slider 1.0-2.5]
  - Visual Spacing: [toggle ON/OFF]
  - Bar Mode: [toggle ON/OFF] (within Decorations section)

---

## Testing Checklist

- [ ] Test with different VS Code themes (light, dark, high-contrast)
- [ ] Test with very long lines (word wrap on/off)
- [ ] Test with large log files (50K+ lines, virtual scrolling performance)
- [ ] Test rapid level changes (info → error → info)
- [ ] Test with stack traces (collapsed/expanded states)
- [ ] Test all combinations of toggles (bar + spacing, etc.)
- [ ] Verify no layout shift when toggling features
- [ ] Verify settings persist across viewer reopens (if implemented)
