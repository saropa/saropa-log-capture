# Panel tab badge would not clear

The unread-hit count on the "Saropa Log Capture" panel tab stayed on screen because it only cleared on a hide/show visibility transition or when a focusable element inside the viewer took focus. Scrolling the feed or clicking rows in the session-history panel — neither of which moves DOM focus — left the badge stuck with no user-reachable way to dismiss it.

## Finish Report (2026-07-16)

### Defect

The tab badge is driven by `unreadWatchHits`, accumulated by `LogViewerProvider.updateWatchCounts` while the view is not visible and reset by `acknowledgeWatchHits`. Two clearing paths existed: `onDidChangeVisibility` (fires only on show/hide transitions) and a webview `document.addEventListener('focus', …, true)` posting `viewerFocused`. The `focus` event only fires for focusable elements, so ordinary engagement — scrolling, wheel, clicking non-focusable rows — never posted the acknowledgment. Result: once lit, the badge could persist through normal use.

A second, latent defect: the badge total summed every `watchPatterns` hit regardless of each pattern's `alert`, so a pattern set to `alert: "flash"` or `"none"` still contributed to the count.

### Change

1. `src/ui/viewer/viewer-script.ts` — replaced the single `focus` listener with a throttled `ackViewerEngaged` handler wired to `focus`, `pointerdown`, `keydown`, and (passive) `wheel` in the capture phase. First event in a burst posts `viewerFocused` immediately; further posts are suppressed for 400ms. The host-side `acknowledgeWatchHits` is idempotent (early-returns at 0), so redundant posts no-op. This makes the badge clear on any real engagement with the viewer or the session-history panel.

2. `src/modules/features/keyword-watcher.ts` — added `getBadgeCount()`, summing hit counts only for patterns whose `alert === 'badge'`. Duplicate-keyword entries share one label-keyed count slot, so each label is counted at most once to avoid inflating the badge past the real hit total.

3. `src/ui/provider/log-viewer-provider.ts` — `updateWatchCounts` now takes an optional `badgeCount` used for the tab badge, while still posting the full per-pattern `counts` map to the webview. Falls back to the all-values sum when the caller omits `badgeCount`.

4. `src/ui/viewer/viewer-target.ts` / `src/ui/provider/viewer-broadcaster.ts` — widened the `updateWatchCounts` interface/forwarder with the optional `badgeCount`. `status-bar.ts` and `pop-out-panel.ts` implement the narrower signature and correctly ignore the extra argument (only the sidebar `WebviewView` has a `.badge`).

5. `src/activation-listeners.ts` — the per-line watch-count update now passes `watcher.getBadgeCount()` alongside `getCounts()`.

### Behavior

- Before: badge surfaced watch hits while the panel was away but could remain lit through scrolling/clicking; `alert: "none"`/`"flash"` patterns still fed it.
- After: badge surfaces new activity while the panel is away and clears the instant the user engages the viewer (pointer, keyboard, or scroll); only `alert: "badge"` patterns contribute; a repeated badge keyword is not double-counted.

### Tests

`src/test/modules/features/keyword-watcher.test.ts` — three added cases: badge sum excludes flash/none patterns; repeated badge keyword read once (2, not 4); zero when no badge-alert pattern exists. Full suite: 14 passing (`mocha --ui tdd out/test/modules/features/keyword-watcher.test.js`). `npm run check-types` clean.

### Follow-up: badge stuck while panel visible (resolve path)

A screenshot showed the badge reading 56 while the panel was the active, visible tab and displaying a loaded log file — a state the visible-suppression in `updateWatchCounts` (`some(v => v.visible) ? 0`) should make impossible. Root cause: `log-viewer-provider-setup.ts` acknowledged the badge only on a `onDidChangeVisibility` hide→show transition. When the view resolves already-visible — window restored with the panel showing, or opened straight to it — no transition fires, and the pending-file-load branch skipped the acknowledge entirely (the `else if (webviewView.visible)` only called `onBecameVisible()`). A count accrued before the view resolved therefore stayed pinned with no clearing path.

Fix: on resolve, if `webviewView.visible`, call `setVisibleView` + `acknowledgeWatchHits` regardless of the pending-load branch, and still fire `onBecameVisible()` only when not loading a pending file (preserving prior semantics).

### Test coverage

The resolve-when-visible decision (acknowledge iff visible; run auto-load iff visible and no pending file) is pinned in `src/test/ui/log-viewer-auto-load.test.ts` as a pure-logic mirror, matching that file's existing `shouldAutoLoad` convention — `setupLogViewerWebview` itself imports vscode/getConfig at module scope and is not directly importable in a pure test.

### Not covered

Host-side `LogViewerProvider.updateWatchCounts` badge logic and the `viewerFocused` → `acknowledgeWatchHits` path have no unit tests (pre-existing gap in webview/provider coverage); the 400ms throttle lives in a webview template literal with no unit harness. The resolve-branch test is a logic mirror, not a drive of the real `setupLogViewerWebview`. Verified otherwise by inspection and the delegated review.
