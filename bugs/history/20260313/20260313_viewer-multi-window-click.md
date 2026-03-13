# Viewer: cannot click sessions when tab opened in new window (2026-03-13)

## Summary
User opened the Saropa Log Capture tab into a new window; the session list (Project Logs) was visible but clicking a session did not show log content in that window.

## Cause
The sidebar log viewer is provided by a single `WebviewViewProvider`. VS Code calls `resolveWebviewView` once per window when the panel is shown in that window. The extension stored only one `view` reference, so the last-resolved view (often the original window) received all `loadFromFile` and `postMessage` updates. Clicks in the new window triggered the command there but content was sent to the wrong view.

## Fix
- **Multi-view tracking:** Replaced single `view` with a `Set<WebviewView>` and a `visibleView` (most recently visible). `resolveWebviewView` adds to the set; `removeView(webviewView)` on dispose removes from the set and clears `visibleView` when needed.
- **Broadcast:** `postMessage` and `loadFromFile` now target all views (reveal + load so every window’s viewer gets the same content). Badge updates iterate over all views.
- **Batch timer:** Stop the shared batch timer only when the last view is removed (in `removeView` when `views.size === 0`), not when any view is disposed.
- **Safety:** Snapshot `[...this.views]` when iterating for postMessage/badge to avoid mutation-during-iteration. `dispose()` clears the set and `visibleView`.

## Files changed
- `src/ui/provider/log-viewer-provider.ts` — multi-view set, removeView, setVisibleView, postMessage/loadFromFile/badge/dispose
- `src/ui/provider/log-viewer-provider-setup.ts` — onDidDispose calls removeView only; onDidChangeVisibility sets visibleView and updates badge for that view

## Testing
Manual: open Saropa Log Capture in a second window, click a session; log content appears in that window’s viewer. No new unit tests (provider not currently under test).
