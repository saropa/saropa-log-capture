# BUG: new-log banner placement and dismissal

Status: Fixed

## Original report

1. new log banner should dismiss when "open" is clicked
2. should not need to open the log list (session history panel)  - show the banner in the log viewer instead

(See `BUG_new_log_banner.png` for the in-panel banner the report refers to.)

## Finish Report (2026-06-19)

### Defect

The "newer-log" alert ("New logs · <name> · <time>") rendered only inside the Logs
(session history) panel. A user who never opened that panel never saw that a newer
capture existed (report item 2). Separately, clicking the banner's **Open** button
opened the newest unread log but left the banner visible (report item 1): opening a
single log does not advance the panel's dismiss cursor, and any other unread rows kept
the banner up.

### Root cause

- **Placement:** the banner element (`#session-newer-banner`) lived inside
  `#panel-slot`, which is `display:none` whenever the Logs panel is closed, so the
  banner was only visible with the panel open.
- **Dismissal:** the Open handler posted `openSessionFromPanel` only. It deliberately
  omitted the acknowledgement, on the assumption the opened row would clear itself —
  but the banner's visibility is driven by `unreadSinceFocus` across *all* rendered
  rows, and opening one log advances neither the dismiss cursor nor the other rows.
- **Data path:** the only payload path that computed `unreadSinceFocus` was the
  panel-triggered refresh (it alone passed `getDismissedAt`). The proactive
  tree-change refresh in extension-activation — the one that fires the instant a new
  log is written — omitted `getDismissedAt`, so even a relocated banner would have had
  no unread data without the panel being opened first.

### Change

- **Log-viewer surface:** added `#viewer-newer-banner` at the top of the log area
  (`viewer-content-body.ts`, alongside the compress/resume banners), reusing the
  existing `.session-newer-banner` styles. The in-panel `#session-newer-banner`
  element was removed; the alert now renders only on the viewer surface, so it is
  visible without opening the Logs panel and never appears in two places at once.
- **Render + wiring:** `renderNewerLogBanner` / `applyNewerBanner` and the Open/Dismiss
  click handler target the single viewer surface. `renderSessionList` already runs on
  every `sessionList` message regardless of panel state, so the viewer banner updates
  whenever the host pushes a list.
- **Open dismisses:** Open now opens the newest unread log AND posts
  `acknowledgeUnreadLogs` (advancing the dismiss cursor host-side), hiding the banner
  immediately; the re-sent list (nothing unread) keeps it hidden. Dismiss is unchanged
  (acknowledge only).
- **Unread data for the viewer surface:** the proactive tree-change refresh now passes
  `getDismissedAt`, so `unreadSinceFocus` is computed the moment a new log lands. The
  seed-on-first-read logic was extracted into a shared `getOrSeedDismissedAt(context)`
  used by both the panel refresh and the proactive refresh, so both observe one
  baseline (no carpet-bombing of pre-existing logs on first run).

### Files

- `src/ui/provider/viewer-content-body.ts` — new `#viewer-newer-banner` element.
- `src/ui/viewer-panels/viewer-session-panel-html.ts` — removed `#session-newer-banner`.
- `src/ui/viewer-panels/viewer-session-panel-reports-bucket.ts` — `applyNewerBanner`
  targets only the viewer surface.
- `src/ui/viewer-panels/viewer-session-panel-events-newer.ts` — Open acknowledges +
  hides; single-surface wiring.
- `src/ui/provider/viewer-provider-actions.ts` — `getOrSeedDismissedAt` helper.
- `src/ui/provider/viewer-provider-helpers.ts` — re-export the helper.
- `src/ui/provider/viewer-handler-wiring.ts` — `makePayloadOptions` uses the helper.
- `src/extension-activation.ts` — proactive refresh passes `getDismissedAt`.
- `src/test/ui/dismiss-cursor-seed.test.ts` — new test pinning the seed + idempotency.
- `CHANGELOG.md` — user-facing notes.

### Verification

- `npm run check-types` — clean.
- `npm run compile` — all verifiers pass (NLS parity/coverage, webview catalogs,
  command list, l10n keys, dist size).
- `npm run lint` on touched files — clean.
- Tests: `dismiss-cursor-seed` (3), `viewer-provider-record-fields` (11),
  `viewer-element-wiring` (2), `viewer-script-syntax` (17) — all passing.
