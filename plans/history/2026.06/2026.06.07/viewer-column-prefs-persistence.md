# Log Viewer — persist Columns choices

**Triggered by:** user request — "columns choices for log viewer MUST be persisted for the user."

The log viewer's Columns submenu (line numbers, timestamp, session elapsed, tag) toggled webview globals that reset to their compiled-in defaults on every viewer reload / VS Code restart. The user's column layout never stuck. This task makes those four choices durable.

## Finish Report (2026-06-07)

This work will be reviewed by another AI.

### Scope

(B) VS Code extension (TypeScript / webview script). No Flutter/Dart, no docs-only.

### What changed

- **New [src/ui/viewer-decorations/viewer-deco-column-prefs.ts](../../../../src/ui/viewer-decorations/viewer-deco-column-prefs.ts)** — `getColumnPrefsScript()` emits `persistColumnPrefs()` / `restoreColumnPrefs()`. They store the four toggles (`decoShowCounter`, `decoShowTimestamp`, `decoShowSessionElapsed`, `decoShowParsedTag`) under `columnPrefs` in view-local webview state via `vscodeApi.getState()/setState()`. `restoreColumnPrefs()` is called at top-level init so the opening paint reflects the saved choice; only boolean values override, so a missing/partial `columnPrefs` leaves defaults intact.
- **[src/ui/viewer-decorations/viewer-deco-settings.ts](../../../../src/ui/viewer-decorations/viewer-deco-settings.ts)** — the four `toggle*()` functions now call `persistColumnPrefs()` after flipping their variable. The persist/restore definitions live in the new module (loaded immediately after), referenced by global name; a pointer comment documents this.
- **New [src/ui/viewer-decorations/viewer-deco-settings-sync.ts](../../../../src/ui/viewer-decorations/viewer-deco-settings-sync.ts)** — `getDecoSettingsSyncScript()` holds `syncDecoSettingsUi()` (state → controls) and `onDecoOptionChange()` (controls → state), moved verbatim out of `viewer-deco-settings.ts`. `onDecoOptionChange()` gained the `persistColumnPrefs()` call (the deco panel's counter / timestamp / session-elapsed checkboxes drive the same toggles as the context menu). This extraction was required: `viewer-deco-settings.ts` sat exactly at the 300-line `max-lines` cap, so the minimal persist calls overflowed it. Extraction is the project's documented remedy ("when a file grows, extract a cohesive section into its own module"); the sync pair is the natural cohesive unit and mirrors the existing `viewer-deco-settings-listeners.ts` split.
- **[src/ui/provider/viewer-content-scripts.ts](../../../../src/ui/provider/viewer-content-scripts.ts)** — concatenates `getColumnPrefsScript()` then `getDecoSettingsSyncScript()` immediately after `getDecoSettingsScript()`, so the toggle vars exist when restore runs and the sync/onChange defs exist before the listeners script wires them.
- **[CHANGELOG.md](../../../../CHANGELOG.md)** — `[Unreleased] → Fixed` entry.
- **New test [src/test/ui/viewer-column-prefs-persistence.test.ts](../../../../src/test/ui/viewer-column-prefs-persistence.test.ts)** — pins the wiring across both scripts.

### Design rationale

Persistence uses view-local webview `getState/setState` — the same mechanism already used for icon-bar labels, filter-tab labels, search history, SQL query history, and signals — rather than a `saropaLogCapture.*` workspace setting. A formal setting would add four config keys plus NLS across all 11 locale files for throwaway per-view UI state, a blast-radius move with no upside here. Consequence: each webview instance (sidebar viewer vs pop-out panel) tracks its column state separately — identical to every other view-local pref in this codebase.

### Deep review notes

- **Logic & safety:** restore guards `typeof vscodeApi !== 'undefined'` and `api.getState`, and only assigns when the stored value is a boolean — no crash if state is absent/corrupt, defaults survive. No races: restore is synchronous at script init, before any async render.
- **Load order:** verified `getViewerScript` (declares `var vscodeApi`) runs before the deco scripts; deco-settings (vars/toggles) → column-prefs (restore) → settings-sync (sync/onChange) → decorations → listeners. All cross-script references are global function/var names invoked only at runtime, the pattern already proven by listeners calling `onDecoOptionChange`.
- **Single source of truth:** `syncDecoSettingsUi`/`onDecoOptionChange` were moved verbatim (no logic change); no value duplicated.
- **Documentation:** both new modules carry verbose file-doc headers explaining the persistence choice and the load-order constraint.

### Testing

- **Audit (Section 4A):** grepped `src/test` for `viewer-deco-settings`, `getDecoSettingsScript`, `syncDecoSettingsUi`, `onDecoOptionChange`, `persistColumnPrefs`, `decoShowParsedTag`, `decoShowCounter`, `viewer-content-scripts`. My new test originally asserted `onDecoOptionChange` in `getDecoSettingsScript`; updated it to read the new sync module after the extraction.
- **Ran (all pass):**
  - `viewer-column-prefs-persistence.test.js` — 5 passing (new).
  - `viewer-decorations-master-switch.test.js` — 17 passing (main consumer of `getDecoSettingsScript`; `should call updateDecoButton from onDecoOptionChange` still green — `updateDecoButton` remains in the toggles).
  - `viewer-column-layout.test.js` (5), `viewer-context-menu-columns.test.js` (5), `viewer-webview-l10n.test.js` (4), `viewer-toolbar.test.js` (25), `viewer-data-add-embed.test.js` (12), `viewer-log-search-and-nav-contracts.test.js` (4) — all pass.
- **Gates:** `npm run check-types` clean; `eslint` clean on all touched/new files (the file is now well under the 300-line cap); `npm run compile` green end-to-end (verify-nls, verify:webview-catalog, verify:host-outbound-catalog, verify:list-commands, esbuild build, verify:dist-size 4.42 MiB).

### Project maintenance

- CHANGELOG updated.
- README verified — no updates needed (no column references; the feature already existed, only its persistence changed).
- package.json / lock — not touched (no release or dependency change).
- guides reviewed — no user-facing doc delta beyond the changelog.
- LAUNCH_TEST — SKIPPED: `docs/LAUNCH_TEST.md` does not exist in this project.
- No bug archive — task did not close a `bugs/*.md` file. (An unrelated `bugs/context-menu-submenu-offscreen_attempts.md` belongs to a separate in-progress workstream and is untouched.)

### Out of scope / untouched

The working tree contains a parallel context-menu workstream (`viewer-context-menu*.ts`, `viewer-context-menu-position.ts`, `repro-affordance.test.ts`, `bugs/context-menu-submenu-offscreen_attempts.md`). None of it is mine; it is excluded from this commit and its tests were not run or judged.
