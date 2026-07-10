# Log status bar made persistent

The blue bar under the log viewer's toolbar was a transient pop-up: it appeared when the filename
was clicked and hid itself again on the next click anywhere inside it, including on its own
**Open in Editor** and **Copy Full Path** buttons. It also rendered **Copy Full Path** as
transparent text beside a filled primary button, which reads as a disabled control.

## Finish Report (2026-07-10)

### Defects addressed

1. **Self-dismissing bar.** `handleAction()` called `hideBanner()` after both file actions, and a
   click on the banner body called `dismiss()`. Copying a path closed the bar; a stray click or a
   text selection inside the bar closed it. The bar carried the open log's identity, so the
   information was only visible while nothing was being done with it.
2. **Session context stranded in the toolbar.** The adapter / project / launch-configuration /
   device line (`#session-details-inline`) sat in `toolbar-right`, competing with the icon cluster
   and the file path, while the bar that owned the log's identity showed only the filename.
3. **Copy Full Path read as disabled.** `.session-newer-banner-action` was `background: transparent`
   with a transparent border and `color: inherit`. Against the bar's blue fill, and beside the
   `.primary` filled button, the control looked greyed out. It was always live.
4. **No icons on the action buttons.** The bar is dense and mixed-purpose; the two actions were
   distinguishable only by reading their labels.

### Changes

- `src/ui/viewer/viewer-log-banner.ts` — rewritten around two modes, STATUS (the resting state,
  shown for as long as a log is open) and AUTO (a newer controller log was detected; dismissing it
  returns to STATUS rather than blanking the bar). Chrome (icon, name, details span, action slot,
  kebab menu) is built once at load and mutated in place. Only the `×` collapses the bar, which sets
  a `collapsed` flag so subsequent host refreshes do not re-open it; an AUTO alert still overrides
  it, and the toolbar filename / staleness chip re-open it.
- `src/ui/viewer-toolbar/viewer-toolbar-html.ts` — `#session-details-inline` removed. The bar now
  creates it, keeping the id because `viewer-session-header.ts:applySessionInfo()` reaches it by
  `getElementById`. The `(i)` details-modal trigger stays in the toolbar.
- `src/ui/viewer-styles/viewer-styles-session-newer.ts` — labeled non-primary buttons take the VS
  Code *secondary* button treatment; the `⋮` and `×` explicitly opt back out to plain chrome so the
  bar does not read as five competing buttons. Action buttons became `inline-flex` to carry a
  leading codicon (`go-to-file`, `copy`, `arrow-right`).
- `src/l10n/strings-webview.ts` / `src/l10n/strings-viewer.ts` — the details line moved from
  host-rendered HTML to client-rendered DOM, so its label and tooltip moved from the host `t()`
  catalog to the webview `__VT` map as `viewer.logBanner.details.label` / `.title`. The now-unused
  `viewer.toolbar.sessionDetails.*` keys were removed.

### Defects introduced by the rewrite and corrected before commit

- **aria-live spam and dropped clicks.** The bar carries `role="status" aria-live="polite"`. The
  host re-posts `logContextInfo` on every session-tree change, which during a live capture is
  continuous. An unconditional `renderStatus()` reset `textContent` and rebuilt the whole button row
  each time, so a screen reader re-announced the bar on every tick and a button could be destroyed
  under the cursor mid-click. `renderStatus()` is now idempotent: it rebuilds only on a mode change
  and writes the text only when it differs.
- **Pop-out panel with no `currentUri`.** `ctx.currentUri` is computed from the sidebar provider and
  broadcast unchanged to every target, so a pop-out showing a file the sidebar never tracked
  receives `''` and the persistent bar would never auto-appear there. The guard now also consults
  the per-target footer filename.
- **Orphaned kebab menu.** The overflow menu previously disappeared along with the pop-up banner.
  With the bar permanent, an open menu had no outside-click close and hung over the log. A
  document-level click handler closes it.

### Verification

- `npm run check-types` — clean.
- `npx eslint` on every touched file — clean.
- `npm run test:file -- out/test/ui/viewer-log-banner.test.js` — 7 passing (3 pre-existing, 4 added
  to pin: actions do not hide the bar, status renders are idempotent, the bar owns the details span
  and its id, the pop-out fallback).
- `npm run test:file -- out/test/ui/viewer-element-wiring.test.js` — 2 passing.
  `session-details-inline` was added to that test's `dynamicIds` allowlist: the id is still reached
  by `getElementById` from script but is no longer present in static HTML.

### Not covered by automated checks

Layout of the bar at narrow sidebar widths, where the filename, lifespan, session context, and four
controls share one row, is verified only by running the Extension Development Host.
