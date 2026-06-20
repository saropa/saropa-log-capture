# Slide-out panel closes when its resize divider is dragged

Dragging the shared slide-out resize divider closed the open panel on release instead of resizing it; reported against the Crashlytics list ("resize the window to see more content, the sidebar closes"). The defect affected every slide-out panel that has a click-away dismiss handler, not Crashlytics alone.

## Finish Report (2026-06-20)

### Defect

All slide-out panels (Sessions, Find, Bookmarks, SQL History, Trash, Options, Collections, Crashlytics, Project State, Signals, About) render into a single shared `#panel-slot` and are resized by one drag handle, `#panel-slot-resize`, anchored to the slot's edge. The handle is a sibling of the panel elements, not a descendant of any one of them.

Most of those panels register a bubble-phase `document` `click` listener that dismisses the panel when the click lands outside the panel, its detail, and its icon-bar button (for example `viewer-crashlytics-panel.ts` close-on-outside-click).

A mouse drag terminates with a synthetic `click` event dispatched on the common ancestor of the press and release targets — for a slot-edge drag this is the resize handle or a container outside the panel. That trailing click satisfied the "outside" condition, so finishing a resize drag immediately fired the dismiss handler and closed the panel being resized. In practice this made every dismiss-on-outside-click panel non-resizable: any attempt to drag the divider closed it.

### Fix

`initPanelSlotResize` in `src/ui/viewer/viewer-session-transforms.ts` now distinguishes a real drag from a plain press and swallows the drag's trailing click before any dismiss handler runs:

- A `moved` flag starts false on `mousedown` and is set true on the first `mousemove` while dragging, so a press without movement (an ordinary click) is never affected.
- A `click` listener registered in the **capture phase** consumes the post-drag click (`stopPropagation()` + `preventDefault()`) only when `moved` is true. Capture runs before the bubble-phase dismiss handlers, so stopping propagation there prevents the event from ever reaching them.
- `mouseup` schedules a next-tick reset of `moved` so a drag that ends without a trailing click (rare browser cases) cannot leave a stale flag that swallows a later genuine click; the real post-drag click fires before that timeout, so the capture handler still consumes it.

Because the handle, the binder, and the swallow are all shared at the slot level, the single change covers every slide-out panel. Sessions and About have no outside-click dismiss and were already resizable.

This mirrors the existing precedent in `src/ui/viewer/viewer-copy-drag-select.ts`, which already remembers a real drag so its trailing click is skipped.

### Scope

VS Code extension (TypeScript), webview-generated script only. No host behavior, settings, manifest, or l10n strings changed.

### Tests

`src/test/ui/panel-slot-resize.test.ts` gained a case pinning the new contract: the generated transform script must track pointer movement (`moved`), mark movement on `mousemove`, register the trailing-click swallow in the capture phase (`addEventListener('click', …, true)`), and both stop and prevent that click. Existing assertions (shared handle id, binder name, single startup invocation, no per-panel handle) are unchanged.

Verification:
- `npm run check-types` — clean.
- `npm run compile-tests` — clean.
- `npm run test:file -- out/test/ui/panel-slot-resize.test.js` — 4 passing.

### Files

- `src/ui/viewer/viewer-session-transforms.ts` — drag-movement tracking + capture-phase trailing-click swallow.
- `src/test/ui/panel-slot-resize.test.ts` — new regression test.
- `CHANGELOG.md` — Unreleased "Fixed" entry.
