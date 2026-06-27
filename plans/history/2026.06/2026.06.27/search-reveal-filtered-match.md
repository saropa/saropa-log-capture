# Search reveal for filtered / collapsed matches

In-log search located matches by scanning every line's plain text, but navigating
to a match scrolled to its row without first making that row visible. A match on a
line hidden by a filter, or tucked inside a collapsed group, produced the count
badge "Showing 1 of 1" while nothing appeared on screen — `scrollToMatch` centered
the viewport on a zero-height row. This record covers the change that makes a
search match always visible and explains why it was hidden.

## Finish Report (2026-06-27)

### Defect

`scrollToMatch` (in `src/ui/viewer-search-filter/viewer-search.ts`) computed a
cumulative scroll offset from `prefixSums` and centered the viewport, after calling
only `expandContinuationForSearch`. That handled one of many hide paths
(continuation collapse). Every other path left the matched row at height 0:

- COLLAPSES: stack-frame group collapse, Flutter exception banner collapse,
  ASCII-art block collapse.
- FILTERS (`calcItemHeight` gates in `src/ui/viewer/viewer-data-helpers-core.ts`):
  `levelFiltered`, tier hide (`isTierHidden`), `excluded`, `sourceFiltered`,
  `classFiltered`, `sqlPatternFiltered`, `scopeFiltered`, `metadataFiltered`,
  `timeRangeFiltered`, `filteredOut`, `errorSuppressed`, `userHidden`, `autoHidden`.

The match counter also reported only position ("Showing X of N"), giving no signal
that results existed outside the visible set.

### Change

New module `src/ui/viewer-search-filter/viewer-search-reveal.ts`
(`getSearchRevealScript()`, concatenated into the search script in
`getSearchScript()`):

- `expandCollapsesForMatch(idx)` sets the relevant collapse flags directly
  (idempotent — sets to expanded rather than toggling) for continuation, stack,
  banner, and ASCII-art groups.
- `revealMatchForSearch(idx)` expands collapses, then — if a filter still hides the
  line — force-shows that one row by setting `peekOverride = true` plus a
  `searchPeek` marker. This reuses the established peek mechanism
  (`viewer-peek-chevron.ts`): non-destructive, leaving global filter state intact.
  No `peekAnchorKey` is set, so the divider affordance logic does not render a
  collapse chevron for the search reveal.
- Reveals are tracked in `searchRevealIndices` and undone by `clearSearchReveals()`
  on a new query, clear, or close. The cleanup drops `peekOverride` only when
  `peekAnchorKey == null`, so a gap/dedup peek the user opened on the same row is
  never clobbered.
- `searchFilterHider(item)` maps the responsible filter flag to a localized name
  and a global-disable function (`SEARCH_FILTER_HIDERS` table). The flag check is
  independent of `peekOverride`, so revisiting a force-shown match still reports its
  underlying filter.
- `countHiddenSearchMatches()` counts matches that are filter/collapse-hidden (a
  `searchPeek` row counts as hidden — it is only visible because search revealed it).

Wiring in `viewer-search.ts`:

- `scrollToMatch` calls `revealMatchForSearch(idx)` before reading `prefixSums`.
- `updateMatchDisplay` emits `vt('viewer.search.matchPosition', …)` ("Match N of M")
  and appends `vt('viewer.search.hiddenSuffix', …)` ("· K hidden by filters") when
  hidden matches exist; the no-match branch uses `vt('viewer.search.noMatches')`.
- `clearSearchState`, `closeSearch`, and the top of `updateSearch` drop prior
  reveals and hide the notice.

UI surface:

- `src/ui/viewer-toolbar/viewer-toolbar-search-html.ts` gains
  `#search-hidden-notice` (`#search-hidden-label` + `#search-hidden-disable`), a
  status region inside `#search-flyout` (so its clicks do not dismiss search).
- `src/ui/viewer-styles/viewer-styles-search.ts` styles the notice strip and the
  link-style Disable action with notification/editor-widget theme tokens.
- `src/l10n/strings-webview-b.ts` adds the `viewer.search.*` runtime keys, including
  one display name per filter.

When the Disable action is clicked, the responsible filter's global-disable
function runs, the now-redundant search peek is cleared, and the viewport
re-centers; if a second filter still hides the line, the notice re-raises for it.

### Verification

- `npm run check-types`, `npm run compile` (NLS parity, `verify:l10n-keys` — all
  referenced `vt()` keys resolve, webview catalogs, dist-size) — pass.
- `src/test/ui/viewer-search-reveal.test.ts` — 9 cases pass under
  `npx mocha --ui tdd`. One existing assertion in
  `src/test/ui/viewer-session-nav-search.test.ts` was repointed to the new counter
  format.
- ESLint clean on all touched files.
- The Extension-Host null-guard assertions (`logEl` in `scrollToMatch`,
  `matchCountEl` in `updateMatchDisplay`) were verified by measuring the generated
  script: guard offsets 559 (< 600) and 77 (< 300).

### Design note

The reveal peeks the matched line (non-destructive) and the notice offers — rather
than performs — a global filter disable. A search match is always made visible
immediately; turning the filter fully off is an explicit one-click follow-up.
