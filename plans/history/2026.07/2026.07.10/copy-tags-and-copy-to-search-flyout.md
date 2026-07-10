# Copy Tags context-menu action; Copy to Search did not reliably open the search bar

The log viewer's right-click menu had no way to copy a line's tags, and the existing "Copy to Search" action populated the search field without guaranteeing the search bar was visible.

## Finish Report (2026-07-10)

### Copy Tags (new)

Added a "Copy Tags" item to the right-click context menu's Copy & Export submenu, next to "Copy Timestamp". It copies the clicked line's unified tag set (`item.tags` — the merged bracket/structured/logcat/source tag list built once in `addToData()`, see `src/ui/viewer/viewer-data-add.ts`) as a comma-separated list of tag names to the clipboard, with a toast confirmation ("Copied N tags"). The item hides itself (`data-tags-action`) when the clicked line carries no tags, mirroring the existing `data-timestamp-action` pattern for "Copy Timestamp".

Files:
- `src/l10n/strings-viewer-g.ts` — added `viewer.ctx.copyTags.label` / `.title`.
- `src/ui/viewer-context-menu/viewer-context-menu-html.ts` — new menu item HTML.
- `src/ui/viewer-context-menu/viewer-context-menu.ts` — `hasTags` visibility gate.
- `src/ui/viewer-context-menu/viewer-context-menu-line-actions.ts` — `case 'copy-tags'` handler; extended `formatCopyToastMessage` with a `'tags'` kind.

Known gap (pre-existing, out of scope): SQL-repeat-collapse notification rows (`type: 'repeat-notification'`, built in `src/ui/viewer/viewer-data-add-repeat-collapse.ts`) never populate `item.tags` — only normal `line` items do. Copy Tags (and the sidebar tag filter, which shares the same field) is unavailable on those rows even though they usually carry a database source tag. This predates this change; fixing it means extending the repeat-collapse item shape in a file this task did not otherwise touch.

### Copy to Search fix

"Copy to Search" calls the shared `openSearch()` function (`src/ui/viewer-search-filter/viewer-search.ts`), which only flips internal search state (focuses the input, updates match state). Making the `#search-flyout` bar itself visible was previously handled entirely by a runtime monkey-patch in `src/ui/viewer-toolbar/viewer-toolbar-script.ts`, which wraps the global `openSearch` to also call `openSearchFlyout()`. The context-menu action never called `openSearchFlyout()` itself, so it depended entirely on that cross-file wrapper having been applied.

The `copy-to-search` handler in `src/ui/viewer-context-menu/viewer-context-menu-line-actions.ts` now calls `openSearchFlyout()` directly, guarded on `document.getElementById('search-flyout').classList.contains('u-hidden')` — the same guard the toolbar wrapper itself uses. The guard matters: `openSearchFlyout()` unconditionally (re)adds the `anim-flyout-open` CSS class, so calling it while the bar is already open would restart the slide-in animation as a visible flash. The initial version of this fix (see review below) omitted that guard.

### Review

A deep-review subagent read the diff and flagged the animation-restart issue above (confirmed and fixed) and the pre-existing repeat-notification tag gap (confirmed, left as a documented gap — out of scope, different file, systemic to the existing tag refactor rather than introduced by this change).

### Verification

- `npx eslint` on all touched files — clean, no warnings.
- `tsc --noEmit` — clean.
- `npm run verify-nls` — 514 keys aligned across 11 locale files.
- `npm run test:file -- out/test/ui/viewer-context-menu.test.js out/test/ui/viewer-context-menu-html.test.js` — 34/34 passing, including new tests for `copy-tags` (join behavior, empty-tags guard, toast) and `copy-to-search` (direct `openSearchFlyout()` call, `u-hidden` guard).
