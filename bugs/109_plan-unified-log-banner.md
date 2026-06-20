# 109 — Unified log banner (filename actions + newer-log alert), drop the X-of-Y navigator

## Status: Implemented (pending manual F5 verification)

## Summary

Collapse three scattered toolbar/chrome elements — the "Log N of M" session
navigator, the filename display + actions modal, and the separate "new logs"
banner — into one inline banner surface. The filename in the toolbar becomes the
trigger; the same surface also auto-surfaces when the open log is not the latest
**main project** (controller) log. This removes redundancy and structurally
dissolves two standing defects (see "Defects this fixes").

This supersedes the original placement fix in
[plans/history/2026.06/2026.06.19/BUG_new_log_banner.md](../plans/history/2026.06/2026.06.19/BUG_new_log_banner.md).

## Locked decisions

1. **Staleness indicator, no navigator.** Remove the prev/next session-stepping
   feature entirely (toolbar arrows + label). Users navigate logs via the Logs
   (session history) panel. In its place, the toolbar shows *how out of date the
   open log is*, next to the filename:
   - When the open log **is** the latest controller (main project) log → no
     warning.
   - When it is **not** → a warning glyph (e.g. ⚠) plus the count of newer
     controller logs (e.g. `⚠ 3 newer`). This is the always-visible passive cue;
     the auto-banner (decisions 4–5) is the active surfacing of the same state.
   Clicking the filename/indicator opens the banner in click mode.

   The **click-mode banner** also shows the session's lifespan:
   `Started 10 min ago · ran 7m 45s`. Derived from existing record fields —
   start = `mtime − durationMs`, "ran" = `formatDuration(durationMs)`
   (reuse the helper in [viewer-run-nav.ts](../src/ui/viewer-nav/viewer-run-nav.ts#L80)).
   Omit the "ran" clause when `durationMs` is 0/unknown.
2. **Inline, non-modal banner.** The banner is an inline surface (where
   `#viewer-newer-banner` already lives, between toolbar and list). It must
   auto-surface without stealing focus or blocking input — a modal/popover would
   break what the user is doing when a new log is detected. Clicking the filename
   opens this same inline surface.
3. **Default buttons + kebab overflow.** Visible: **Open in editor** (primary),
   **Copy path** (secondary). Kebab overflow: copy filename, copy relative path,
   open beside, reveal in folder, reveal in Explorer, open in terminal. Mirror
   the existing toolbar kebab dropdown pattern (`toolbar-actions-btn` /
   `getActionsDropdownHtml`).
4. **Auto-show when current ≠ latest important log.** "Important" = a log whose
   role classifies as `controller` (the workspace's own main project session;
   peripherals — drift-advisor, lint reports, bundles — are auxiliary and nest
   under it). Logic already exists: `classifySessionRole` in
   [src/modules/session/session-kind-classifier.ts](../src/modules/session/session-kind-classifier.ts);
   each record already carries `role` (and `kind`) from
   [src/ui/provider/viewer-provider-actions.ts](../src/ui/provider/viewer-provider-actions.ts).
5. **Dismiss by tapping the banner body or the × icon.** The whole banner
   background is a dismiss tap target; action buttons `stopPropagation`. An
   explicit `×` icon and Escape also dismiss. Clicking the log content (outside
   the banner) is NOT a dismiss — that stays normal log interaction. Keep the
   `role="status" aria-live="polite"` announcement.

## Two content modes, one surface

The banner targets different files depending on how it appeared, so the two modes
must be visually distinct to prevent copy/open acting on the wrong file:

- **Auto mode** (open log is not the latest controller log): shows the newer
  log — e.g. `Newer · Crash.log · 2m ago` — with **Open** (loads that newer log)
  / **Dismiss**. Target = the newer file.
- **Click mode** (user clicked the filename): shows the current log — e.g.
  `Contacts.log · Started 10 min ago · ran 7m 45s` — with **Open in editor** ·
  **Copy path** · kebab. Target = the current file.

## Defects this fixes (structurally)

1. **Banner can point at the file already on screen.** `unreadSinceFocus`
   ([viewer-provider-actions.ts:159-160](../src/ui/provider/viewer-provider-actions.ts#L159))
   never excludes the open file. Auto mode here is keyed to "current ≠ latest
   controller log", so it can never offer to open what is already displayed.
2. **No copy-path on the new-log alert.** Click mode inherits Copy path from the
   former modal's actions; the banner already carries the target `uriString`.

## Dismiss / re-nag model

Keep the existing dismiss cursor
([getOrSeedDismissedAt](../src/ui/provider/viewer-provider-actions.ts#L58)):
dismissing auto mode advances the cursor so the same "latest controller log"
does not re-nag when the user deliberately stays on an older log. Auto mode
re-appears only when a *newer* controller log than the dismissed one arrives.

## Affected code (implementation map)

- **Remove navigator:** toolbar arrows + label
  [src/ui/viewer-toolbar/viewer-toolbar-html.ts:32-38](../src/ui/viewer-toolbar/viewer-toolbar-html.ts#L32),
  script [src/ui/viewer-nav/viewer-session-nav.ts](../src/ui/viewer-nav/viewer-session-nav.ts),
  host wiring that posts `sessionNavInfo` / handles `navigateSession`. Keep the
  `navigateSession` capability only if the session-history panel still needs it;
  otherwise retire it. Audit `kbd.row.prevSession` / `nextSession` shortcuts.
- **Staleness indicator:** render the warning glyph + newer-controller count next
  to `#footer-text` ([viewer-script-footer.ts](../src/ui/viewer/viewer-script-footer.ts)).
  The count = controller-role logs with `mtime` greater than the open log's; the
  webview already holds the sorted session list, or the host can supply
  "latest controller uri + newer count" alongside the auto-show trigger. The
  existing accumulated-files `(n)` stays as-is (different meaning).
- **Session lifespan line:** click mode reads `mtime` + `durationMs` from the
  record; start = `mtime − durationMs`; reuse `formatDuration`.
- **Banner surface:** reuse `#viewer-newer-banner`
  ([viewer-content-body.ts:90-94](../src/ui/provider/viewer-content-body.ts#L90)),
  render in [viewer-session-panel-reports-bucket.ts](../src/ui/viewer-panels/viewer-session-panel-reports-bucket.ts),
  click/dismiss in [viewer-session-panel-events-newer.ts](../src/ui/viewer-panels/viewer-session-panel-events-newer.ts),
  styles [viewer-styles-session-newer.ts](../src/ui/viewer-styles/viewer-styles-session-newer.ts).
- **Filename → banner:** re-target the filename click in
  [viewer-log-file-modal.ts:121-131](../src/ui/viewer/viewer-log-file-modal.ts#L121)
  to open the banner in click mode; retire/repurpose the modal HTML + its action
  dispatch table once all actions live in the banner + kebab.
- **Copy path for a target file:** extend the log-file action handler
  ([viewer-log-file-actions.ts](../src/ui/provider/viewer-log-file-actions.ts) +
  the `copyCurrentFile*` case in
  [viewer-message-handler-session-ui.ts:236-243](../src/ui/provider/viewer-message-handler-session-ui.ts#L236))
  to accept a `uriString` target, so the banner copies the right file.
- **Auto-show trigger:** the proactive refresh
  ([extension-activation.ts:121-145](../src/extension-activation.ts#L121)) and the
  panel refresh ([viewer-handler-wiring.ts makePayloadOptions](../src/ui/provider/viewer-handler-wiring.ts#L176))
  compute "latest controller log" and compare to `getCurrentFileUri()`.
- **Strings:** new l10n keys in
  [src/l10n/strings-webview.ts](../src/l10n/strings-webview.ts) (banner labels)
  and host strings for any new toast.

## Open sub-questions (call out during build, do not guess)

- Does the session-history panel still need `navigateSession`, or is it fully
  retired with the toolbar navigator? (Decision 1 removes the toolbar feature;
  the underlying message may still be used elsewhere — audit before deleting.)
- Staleness count: count newer **controller** logs only, or all newer logs?
  (Lean controller-only, to match the "important" definition; confirm at build.)
- Warning glyph: emoji (⚠) vs a themed codicon (`codicon-warning`). Codicon
  matches the toolbar's existing icon language and respects theme color; lean
  codicon unless an emoji is specifically wanted.

## Quality gates

`check-types`, `lint`, `compile` (NLS parity/coverage + webview catalogs +
command list + dist size), targeted tests for the touched viewer files, F5 manual
check of both auto and click modes.
