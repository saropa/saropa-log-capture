# Plan: Context Popover (Cross-Source Context on Click)

**Status:** ✅ IMPLEMENTED

**Implemented:** 2026-03-12

---

## Summary

When users right-click a log line and select "Show Integration Context", a floating popover appears showing integration data (performance, HTTP, terminal, Docker) from ±5 seconds around that line's timestamp.

## Implementation Details

### New Files
- `src/modules/timeline/line-timestamp.ts` - Timestamp extraction utilities (prepared for future Timeline/Investigation features)
- `src/modules/context/context-loader.ts` - Loads and filters sidecar files by time window
- `src/ui/viewer-context-menu/viewer-context-popover.ts` - Popover UI script and CSS

### Modified Files
- `src/ui/shared/viewer-panel-handlers.ts` - Updated to return popover data instead of opening document
- `src/ui/provider/viewer-message-handler.ts` - Added `openFullIntegrationContext` message handler
- `src/ui/provider/viewer-content.ts` - Included popover script
- `src/ui/viewer-styles/viewer-styles.ts` - Added popover styles
- `src/ui/viewer-styles/viewer-styles-ui.ts` - Re-exported popover styles
- `package.json` - Added `contextWindowSeconds` setting
- `src/l10n.ts` - Added localization string

### Configuration
- `saropaLogCapture.contextWindowSeconds` (default: 5, range: 1-60) - Time window for filtering context data

### Features Delivered
- Time-filtered context loading from sidecar files
- Floating popover with sections for Performance, HTTP, Terminal, Docker, Events
- XSS-safe HTML escaping
- Error feedback via toast notification
- "View Full Context" button opens legacy document view
- "Copy" button copies popover content
- Dismissible via click outside or Escape key
- Smooth reveal animation

---

## Original Plan

(See original content below for reference)

---

**Feature:** Click on any log line → popover shows integration data from that time window (±5s).

**Problems Solved:**
- Integration adapters are islands: clicking an error doesn't show correlated HTTP/perf/terminal data
- Lightweight alternative to full timeline view for quick context

**Builds on:** Quick win "Show Integration Context" menu item (already implemented, shows session-level integration summary)
