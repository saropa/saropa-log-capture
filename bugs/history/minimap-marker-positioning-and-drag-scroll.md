# Minimap Bugs — Investigation & Fixes

## Bug 1: Markers Cluster at Top Instead of Distributing Through File

### Symptom
The scrollbar minimap shows severity markers (error, warning, etc.) bunched at the top of the panel instead of spread proportionally through the full height, regardless of where the issues appear in the log.

### Root Cause Analysis

The marker positioning math (`cumH[i] / running * mmH`) is correct in isolation, but several timing and layout issues can cause `mmH` (the minimap's rendered pixel height) to be wrong at render time:

1. **CSS `height: 100%` in a flex child** — The minimap's parent (`#log-content-wrapper`) has no explicit height; its size is determined by flex layout. In this scenario `height: 100%` can resolve to 0 or a tiny value during the initial layout pass, especially when the webview panel is animating into view.

2. **Throttle-style debounce dropped rebuild calls** — `scheduleMinimap()` used a "leading-edge throttle" pattern: the first call set a 120 ms timer, and all subsequent calls were silently dropped until the timer fired. If the minimap rendered with a wrong `mmH` during the first call, and a resize or data event arrived while the timer was pending, the correction call was dropped.

3. **No rebuild on visibility change** — When the webview tab is hidden and later shown, the minimap had no trigger to rebuild with the correct (now-visible) dimensions.

4. **No minimum-height guard** — If `mmH` was a small value like 10 px (mid-animation), all markers rendered into a 10 px band at the top, and even after the panel finished expanding, the stale render persisted.

### Fixes Applied

| Change | File | Detail |
|--------|------|--------|
| CSS height strategy | `viewer-styles-ui.ts` | Replaced `height: 100%` with `align-self: stretch` on `.scrollbar-minimap` — lets the flex container control height naturally |
| Trailing-edge debounce | `viewer-scrollbar-minimap.ts` | Changed `scheduleMinimap()` to restart the timer on each call (`clearTimeout` + `setTimeout`), ensuring the minimap always rebuilds with the **latest** layout dimensions |
| Minimum-height guard | `viewer-scrollbar-minimap.ts` | `updateMinimap()` now treats `mmH < 50` as "not ready" and retries after 250 ms, preventing renders into a tiny panel |
| Visibility listener | `viewer-scrollbar-minimap.ts` | Added `document.visibilitychange` handler — rebuilds the minimap when the webview becomes visible |
| Double-RAF init | `viewer-scrollbar-minimap.ts` | First render uses `requestAnimationFrame` x2 to ensure layout is fully settled before measuring `clientHeight` |

---

## Bug 2: Scrolling Goes Crazy After Minimap Click/Drag

### Symptom
After clicking or dragging on the minimap, subsequent mouse movement causes the log to scroll erratically. The scroll position jumps around and becomes uncontrollable. The problem persists until the webview is reloaded.

### Root Cause

The minimap used standard `mousedown`/`mousemove`/`mouseup` events with listeners attached to `document`. When the user pressed the mouse button on the minimap and moved the pointer **outside the VS Code webview boundary** (into VS Code chrome, another panel, or outside the window), the webview never received the `mouseup` event.

Consequences of the missed `mouseup`:
- The `onMove` listener remained permanently attached to `document` — every future mouse movement called `scrollToMinimapY()`, scrolling the log
- `suppressScroll` stayed `true`, breaking the auto-scroll-to-bottom behavior
- `mmDragging` stayed `true`, keeping the dragging CSS class active
- Each subsequent click on the minimap **stacked additional listener pairs** without cleaning up the old ones, compounding the problem

### Fix Applied

Replaced mouse events with **Pointer Capture API** in `viewer-scrollbar-minimap.ts`:

| Change | Detail |
|--------|--------|
| `pointerdown`/`pointermove`/`pointerup` | Replaced `mousedown`/`mousemove`/`mouseup` |
| `setPointerCapture(e.pointerId)` | Called on `pointerdown` — guarantees `pointerup` fires even if the pointer leaves the webview or the browser window entirely |
| Listeners on `minimapEl` | Moved from `document` to the minimap element itself (pointer capture redirects all events to the capturing element) |
| `pointercancel` + `lostpointercapture` | Added as safety cleanup handlers for edge cases (e.g., browser decides to cancel the gesture) |
| `pointerId` tracking | Each drag session tracks its pointer ID and ignores events from other pointers |
| `window.blur` safety | Added a blur listener that cleans up drag state if the webview loses focus |
| `mmCleanupDrag()` helper | Extracted cleanup logic into a reusable function called by all termination paths |

---

## Unrelated: Minimap Right-Click Shows Irrelevant Cut/Copy/Paste Actions

### Summary
Right-clicking on the VS Code editor minimap (not our scrollbar minimap) displays the standard editor context menu (Cut, Copy, Paste, etc.), which has no meaningful function in the minimap context.

### Limitations

- **No VS Code setting exists** to customize or disable the minimap context menu independently of the editor context menu.
- **Extensions cannot override** the minimap's right-click behavior. The VS Code extension API does not expose the minimap context menu as a contribution point.
- **The minimap shares the editor's context menu** by design. There is no separation between the two in VS Code's architecture.
- **Disabling the minimap entirely** (`editor.minimap.enabled: false`) is the only way to remove the menu, but this loses the minimap itself.
- **No upstream fix is planned.** As of VS Code 1.98, this remains the default behavior with no open proposal to change it.

### Impact
Low — cosmetic UX issue only. The actions appear but do nothing harmful.

---

**Files Modified:** `src/ui/viewer-scrollbar-minimap.ts`, `src/ui/viewer-styles-ui.ts`
**Date:** 2026-02-07
