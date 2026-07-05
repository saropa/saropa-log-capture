# Icon-bar unread-delta badges

The webview icon-bar badges (Signal, SQL, Integrations, Crashlytics, Collections, Bookmarks, Trash) displayed each panel's absolute item total, so a badge never cleared on open and read as a permanent inventory count rather than a "new items" signal. They were converted to unread-delta counters: a badge now shows only how many items arrived since the panel was last opened, and opening the panel resets it to zero.

## Finish Report (2026-07-05)

### Scope
VS Code extension (TypeScript), webview UI only. No Flutter/Dart code touched.

### Problem
Every icon-bar badge was fed its panel's current item total through `updateIconBadge(badgeId, countId, total)`. The badge therefore showed the full count at all times and had no reset-on-view behavior. The main view's tab badge (`WebviewView.badge`, driven by `unreadWatchHits`) already implemented a true unread counter that resets on visibility change and on webview focus, but the in-webview icon-bar badges did not follow that model.

### Change
- New module `src/ui/viewer-nav/viewer-icon-bar-badges.ts` holds the delta logic as a JS-in-template IIFE, concatenated ahead of the main icon-bar script by `getIconBarScript()`. It defines `window.updateIconBadge` and `window.acknowledgeIconBadge`.
  - `updateIconBadge` keeps its existing caller contract (callers still pass an absolute total) and renders `max(0, total - baseline)`.
  - The per-badge baseline persists in webview state under `iconBadgeBaseline`, so unread survives a viewer reload. The latest reported total per badge (`badgeTotals`) is in-memory and repopulates when panels re-report after reload.
  - Three baseline branches: suppress-while-open (the active panel's badge is held at zero as items stream in, mirroring the tab badge's suppress-while-visible behavior), first-sighting/removal clamp (rebaseline down so the delta never goes negative), otherwise hold.
- `src/ui/viewer-nav/viewer-icon-bar.ts` sets `window.__activeIconPanel` in `setActivePanel`/`clearActivePanel` and calls `window.acknowledgeIconBadge(name)` when a panel opens. The delta machinery was extracted to the new module to keep this file under the 300-line limit.

### Defect found in review and fixed
`acknowledgeIconBadge` initially baselined to `badgeTotals[badgeId] || 0`. Because `badgeTotals` is not persisted, opening a badge panel immediately after a reload — before that panel re-reported its total — would have written a `0` baseline over a good persisted one, later resurfacing the whole count as spurious unread. Fixed by skipping the rebaseline when `badgeTotals[badgeId]` is undefined; the panel renders on open and reports its total via the active-panel suppress path, which acknowledges it correctly. A related state-thrash was removed: the suppress-while-open branch now persists only when the baseline value actually changes.

### First-load semantics
On first-ever use (no persisted baseline), a panel's pre-existing items are baselined as read (badge shows zero) rather than surfaced as a burst of unread. Items arriving after that point count normally.

### Tests
Added five content-assertion cases to `src/test/ui/viewer-icon-bar.test.ts` under an "unread-delta badges" suite: delta math present, baseline persisted under `iconBadgeBaseline`, acknowledge-on-open wired, the acknowledge-writes-0 regression guard, and the suppress-while-active read of `window.__activeIconPanel`. These match the existing icon-bar test style (assertions on generated script content), because the webview scripts are template strings executed only in the real webview and the Extension Host test environment has no DOM. Suite passes 15/15 via `npm run test:file -- out/test/ui/viewer-icon-bar.test.js`.

### Verification
- `npm run check-types` — clean.
- eslint on the two source files and the test file — clean (icon-bar file back under the 300-line limit after extraction).
- Icon-bar and panel-slot-mutex suites pass.
