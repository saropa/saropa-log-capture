# Integrations companion rows — live install-state feed

The Integrations screen's companion rows (Saropa Lints, Saropa Drift Advisor) seeded their
install-state checkbox only at webview-build time, so installing or removing a companion while
the viewer was open left the checkbox stale until a reload. This change adds a host feed that
re-pushes install state on every extension change, mirroring the `setDriftAdvisorAvailable`
pattern but extended with a live `vscode.extensions.onDidChange` subscription.

## Finish Report (2026-07-16)

### Scope
VS Code extension (TypeScript). No Flutter/Dart code.

### Defect
`getIntegrationsPanelHtml` renders each companion row's checkbox from a build-time snapshot
(`vscode.extensions.getExtension`). The Options/Integrations webview HTML is generated once, so
the checkbox and the "View in Marketplace" link never reflected an install/uninstall that
happened after the viewer opened — the row was correct only for the state at build time.

### Change
- **Host feed** (`src/ui/provider/companion-install-state.ts`): `buildCompanionInstalledStates()`
  snapshots `{ [extensionId]: installed }` for `COMPANION_EXTENSION_IDS`;
  `wireCompanionInstallState(emit)` emits the snapshot immediately and re-emits on
  `vscode.extensions.onDidChange`, returning the subscription for disposal.
- **Single source of truth**: `COMPANION_EXTENSION_IDS` is exported from the Integrations panel
  module (derived from `COMPANION_EXTENSIONS`), so the host watcher and the renderer agree on
  which extensions are companions.
- **Setup wiring** (`log-viewer-provider-setup.ts`): calls `wireCompanionInstallState`, posting
  `{ type: 'setCompanionInstalled', states }` — the envelope is kept inline at the `postMessage`
  call site so the outbound-message catalog generator (which scans for `type:` literals adjacent
  to `postMessage`) indexes the new type. The subscription is disposed on `webviewView.onDidDispose`.
- **Webview** (`viewer-script-messages.ts` → `viewer-options-integrations-helper.ts`): the new
  `setCompanionInstalled` case routes to `applyCompanionInstalled(states)`, which finds each row by
  `data-companion-id`, toggles the `is-installed` class (CSS hides the Marketplace link when
  installed), sets the checkbox `checked` property, and refreshes the checkbox `title`/`aria-label`
  from the `data-installed-title` / `data-not-installed-title` / `data-label` attributes carried on
  the row — no re-render and no l10n round-trip into the webview.
- **Row rendering** (`viewer-integrations-panel-html.ts`): companion rows now render BOTH states —
  the Marketplace link is always in the DOM and hidden via CSS while installed — plus the `data-*`
  attributes above, so live toggling needs only a class flip.

### Verification
- `npm run check-types` — clean.
- `npm run compile-tests` + `npm run test:file -- out/test/ui/viewer-options-panel.test.js` —
  33 passing, including new coverage for the row `data-*` attributes and `applyCompanionInstalled`.
- `npm run generate:host-outbound-catalog` + `verify:host-outbound-catalog` — `setCompanionInstalled`
  is indexed; catalog matches sources.
- `eslint` clean on all files changed by this task. (`viewer-script-messages.ts` reports a
  pre-existing `max-lines` warning — it was already 388 lines from unrelated work before this
  change added a two-line dispatch case.)
- Not device-verified: the live class flip on an actual install/uninstall while the viewer is open
  was reasoned from the message flow and unit-tested at the HTML/script level, not exercised by
  installing an extension in a running Extension Development Host.

### Design note
Install state is now genuinely live. `onDidChange` fires for any extension add/remove (not just the
two companions); the handler re-snapshots and re-posts unconditionally because filtering two IDs is
cheaper than tracking deltas. The initial emit is synchronous within webview setup; VS Code buffers
`postMessage` until the webview's message listener attaches, so the first state is delivered.
