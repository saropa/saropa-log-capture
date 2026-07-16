# Integrations screen cleanup — unified list + one-line descriptions

The Integrations screen inside the Options slide-out rendered the Saropa companion
extensions as a heading + prose block of "View in Marketplace" links above the real
adapter toggles, and each adapter description clamped to four lines — together pushing the
actual integration checkboxes off-screen. This change folds the companion extensions into
the same alphabetical adapter list as checkbox-less rows and collapses every description to
a single line with an inline "more" toggle.

## Finish Report (2026-07-16)

### Scope
VS Code extension (TypeScript). No Flutter/Dart code touched.

### Defect
The dedicated Integrations view (`getIntegrationsPanelHtml`) placed a
`renderCompanionExtensionsHtml()` block — a "Companion extensions" heading, an intro
paragraph, one prose row per companion extension, and an "Install all with the Saropa
Suite" link — above the search box and the adapter list. On a typical viewport this block
consumed the visible area so the real, toggleable integration adapters (adb Logcat,
Application / File Logs, Browser / DevTools, …) were below the fold. Separately, collapsed
adapter descriptions used a four-line `-webkit-line-clamp`, so each row was tall and few
integrations fit on screen at once.

### Change
- **One alphabetical list.** `getIntegrationsPanelHtml` now builds a single
  `IntegrationListEntry[]` from both `INTEGRATION_ADAPTERS` (via `renderIntegrationRow`)
  and `COMPANION_EXTENSIONS` (via the new `renderCompanionRow`), sorts by
  `label.localeCompare`, and joins. Companion rows are `<div class="integrations-row
  integrations-companion-item">` with no checkbox (an uninstalled extension cannot be
  "enabled" here) and an inline `View in Marketplace` link where the enable control would
  otherwise sit.
- **Suite link demoted to a footer.** The "Install all with the Saropa Suite" link moved
  from the top prose block to `renderSuiteInstallFooter()` — a quiet bordered footer below
  the list, so it no longer pushes rows down.
- **One-line descriptions.** A shared `renderDescBlock(text, expandedExtraHtml, expandable)`
  serves both adapter and companion rows. Collapsed state is a single line: the preview
  truncates with an ellipsis and the "more" toggle is inline at the end of that line. CSS
  switched from `-webkit-line-clamp: 4` to a flex row — the preview is
  `white-space: nowrap; text-overflow: ellipsis` (`flex: 1 1 auto; min-width: 0`) and the
  toggle is `flex: 0 0 auto`. The expanded block is `display: none` while collapsed (so it
  does not steal the line) and `flex: 1 1 100%` when shown, which forces the same shared
  toggle (now "less") onto its own line below the full text. DOM order is preview →
  expanded block → toggle, which yields both placements from one button with the existing
  toggle JS unchanged.
- **Expandable threshold** lowered from 130 to 55 characters to match the one-line collapse,
  so anything wider than roughly one line earns a "more".
- **Link handlers.** The old handler bound to `.integrations-companion-section` (removed) was
  replaced: companion-row Marketplace links are handled inside the existing
  `integrations-section` click delegate (early return before the toggle branch); the suite
  footer link has its own delegate since it lives outside the list section.

### Verification
- `npm run check-types` — clean.
- `npm run compile-tests` + `npm run test:file -- out/test/ui/viewer-options-panel.test.js`
  — 31 passing, including two new tests pinning companion-as-rows, absence of the old
  companion prose block/heading, and suite-footer placement.
- `npx eslint` on the three touched source files — clean.
- Not browser-rendered: the collapsed single-line flex + inline-toggle layout was verified
  by logic and CSS inspection, not by loading the webview in the Extension Development Host.

### Known follow-ups (not done)
- Source l10n keys `viewer.integrations.companionHeading` and
  `viewer.integrations.companionIntro` are now unused. Left in place (and in the 12 locale
  bundles) to avoid a cross-locale churn; safe to delete in a later dedicated cleanup.
