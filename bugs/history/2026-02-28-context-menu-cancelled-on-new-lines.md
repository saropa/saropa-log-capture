# Context menu cancelled when new log lines added

**Fixed:** 2026-02-28

## Summary

Right-clicking the log and opening the context menu caused the menu to close as soon as new lines were appended to the log (e.g. during live debug). Auto-scroll to bottom fired a scroll event, and the context menu closed on any scroll.

## Fix

1. **Programmatic vs user scroll** — Scroll-anchor script sets a short-lived `__programmaticScroll` flag before programmatic scrolls (80ms). The context menu’s scroll listener skips closing when this flag is set, so only user-initiated scroll (wheel, etc.) closes the menu.

2. **No programmatic scroll while menu open** — Context menu sets `window.isContextMenuOpen` on show/hide. All programmatic scroll sites (appendLines, jumpToBottom, scrollToLine, loadComplete, ResizeObserver, recalcAndRender, trimData, pin, search, goto-line, Home key) check this and skip scrolling when the menu is open.

## Files changed

- `src/ui/viewer-context-menu.ts` — `isContextMenuOpen` flag; scroll listener checks `__programmaticScroll`
- `src/ui/viewer-scroll-anchor.ts` — `__programmaticScroll` and `setProgrammaticScroll()`; skip scroll when `isContextMenuOpen`
- `src/ui/viewer-script.ts` — Guards on appendLines, loadComplete, ResizeObserver, scrollToLine, jumpToBottom
- `src/ui/viewer-script-keyboard.ts` — Home key skips scroll when menu open
- `src/ui/viewer-data.ts` — trimData scroll adjust guarded
- `src/ui/viewer-pin.ts` — scroll-to-pin guarded
- `src/ui/viewer-search.ts` — scrollToMatch guarded
- `src/ui/viewer-goto-line.ts` — revert and scrollToLineNumber guarded
