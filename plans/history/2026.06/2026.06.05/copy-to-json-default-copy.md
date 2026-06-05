# Copy to JSON — default copy + top menu item

**Triggered by (user request, verbatim):** "i want the default copy (CTRL-C) and the top-most option to be 'Copy to JSON' and have structured output to json fields" — asked while looking at the Log Viewer's Copy & Export context submenu.

No pre-existing `bugs/*.md` or `plans/**` file described this work; this is the durable record.

## Finish Report (2026-06-05)

### 1. Critical note

This work will be reviewed by another AI.

### 2. Scope

**(B) VS Code extension (TypeScript)** only. No Flutter/Dart, no ARB/l10n. The strings added are
plain hardcoded UI labels in the webview, consistent with the rest of the viewer context menu
(which is not NLS-localized — only `package.json` contributes go through `package.nls*.json`).

### 3. Deep review

- **Logic & safety:** `lineToJsonObject` reads only optional fields and omits empties, so no
  null/undefined leaks into the JSON. Timestamp parse is wrapped in try/catch and the field is
  omitted on `NaN` (no `"Invalid Date"`). `copyAsJson` early-returns on empty line sets via
  `postLinesAsJson`. No recursion, no async, no shared mutable state.
- **Architecture & adherence:** Followed the existing module-split pattern — the JSON helpers
  live in their own `viewer-copy-json.ts` (concatenated into `getCopyScript()` so they share the
  webview script scope) rather than inflating `viewer-copy.ts` past the 300-line limit. The new
  keybinding action is registered in the existing `VIEWER_KEYBINDING_ACTION_IDS` /
  `DEFAULT_ACTION_TO_KEY` / `VIEWER_ACTION_LABELS` inventory (extended the inventory, did not spawn
  a parallel surface). The menu item uses the established `data-line-action` visibility convention
  and `linesToJson` reuses `lineToPlainText` so SQL-repeat expansion is consistent with every other
  copy path. Both shortcut-reference surfaces (`viewer-keyboard-shortcuts-html.ts` static table and
  `keyboard-shortcuts-panel.ts` dynamic rows) were updated so the displayed shortcuts match reality.
- **Linter-specific integrity:** SKIPPED [B-NOT-IN-SCOPE].
- **Performance & UI/UX:** Serialization is O(n) over the copied lines, only on an explicit copy
  gesture. The right-click item shows a toast via `formatCopyToastMessage`; the keyboard path shows
  a "Copied N lines as JSON" toast — no silent async. Raw sub-line drag-selection is preserved
  verbatim, so the change does not regress fragment copy.
- **Documentation:** Verbose file header on `viewer-copy-json.ts`; WHY-comments on the field set,
  the 1-based `line` choice, and the raw-drag-select fallback.
- **Refactoring:** None beyond the in-scope module extraction needed for the line limit.

### 4. Testing validation

**A. Audit of existing tests (MANDATORY).** Grepped `src/test` for `copyJson|copyAsJson|copy-json|`
`copyPlain|linesToJson|getCopyScript|getCopyJsonScript|ctrl+c`. Matches and disposition:
- `viewer-context-menu-html.test.ts` pinned `['copy-selection', 'Ctrl+C']` shortcut hint — updated
  to `['copy-json', 'Ctrl+C']` since the hint moved to the new top item. **Ran: pass (32 passing).**
- `viewer-copy-decorated.test.ts`, `viewer-copy-all-filtered.test.ts`,
  `viewer-sql-repeat-copy-expansion.test.ts`, `viewer-null-guards-interaction.test.ts` all consume
  `getCopyScript()`; the extraction keeps the JSON functions inside that output, so all still pass
  (decorated 9, sql-repeat 4, null-guards 20). **Ran: pass.**
- `viewer-keybindings.test.ts` — the `copyPlain: ''` empty default does not break the
  "all actions have a key" or "no collisions" assertions (verified). **Ran: pass (42 passing).**
- `viewer-script-keyboard-selection.test.ts` — unaffected by the one-line `copyJson` branch add.
  **Ran: pass (30 passing).**

**B. New behavior tests.** Added `src/test/ui/viewer-copy-json.test.ts` (7 tests) — evals the
generated helpers with a stubbed `lineToPlainText` and pins: full-field shape, omit-empty-fields,
1-based `line`, array-index fallback, tag precedence (sourceTag → logcatTag → parsedTag), NaN-timestamp
omission, pretty-printed parseable array, and the raw-drag-select fallback wiring. **Ran: pass (7).**

Commands run (Extension Host via `npm run test:file`): all suites above green. `npm run check-types`
clean; `eslint` on every changed file clean except the pre-existing 339-line `max-lines` warning on
`viewer-context-menu-html.test.ts` (untouched line count — one assertion edited). `npm run compile`
passed all verify gates (NLS, webview catalogs, list-commands, dist-size 4.39 MiB).

### 5. Localization

SKIPPED [B-NOT-IN-SCOPE] — extension webview labels, not the Flutter NLS/ARB pipeline.

### 6. Project maintenance

- CHANGELOG: updated (`### Added` in `[Unreleased]`).
- README verified — no updates needed (it does not document copy shortcuts / clipboard behavior).
- `package.json` / lock: not touched (no release/dep change).
- LAUNCH_TEST: SKIPPED — no `docs/LAUNCH_TEST.md` exists in this repo; manual steps restated inline
  in the chat `## What to test` block.
- guides reviewed — no copy/keyboard guide affected.
- Roadmap: not a roadmap item (direct user request); no roadmap entry to remove.
- **No bug archive — task did not close a `bugs/*.md` file.**

### 7. Persist finish report

`Finish report saved: plans/history/2026.06/2026.06.05/copy-to-json-default-copy.md` (this file).

### Files changed

- `src/ui/viewer/viewer-copy-json.ts` (new) — `lineToJsonObject`, `linesToJson`, `postLinesAsJson`, `copyAsJson`.
- `src/ui/viewer/viewer-copy.ts` — import + concatenate `getCopyJsonScript()`.
- `src/ui/viewer/viewer-script-keyboard.ts` — `copyJson` keydown branch.
- `src/ui/viewer/viewer-keybindings.ts` — register `copyJson` (ctrl+c), label, demote `copyPlain` to unbound default.
- `src/ui/viewer-context-menu/viewer-context-menu-html.ts` — top "Copy to JSON" item; moved Ctrl+C hint off plain "Copy".
- `src/ui/viewer-context-menu/viewer-context-menu-line-actions.ts` — `copy-json` case in `handleLineAction`.
- `src/ui/viewer-panels/viewer-keyboard-shortcuts-html.ts` — shortcuts table row updates.
- `src/ui/panels/keyboard-shortcuts-panel.ts` — dynamic shortcut rows updates.
- `src/test/ui/viewer-copy-json.test.ts` (new) — 7 behavioral tests.
- `src/test/ui/viewer-context-menu-html.test.ts` — shortcut-hint assertion repointed to `copy-json`.
- `CHANGELOG.md` — `### Added` entry.
- `plans/history/2026.06/2026.06.05/copy-to-json-default-copy.md` (new) — this report.

### Outstanding / not verified

- On-device manual verification of the actual clipboard contents and toast is pending (see chat
  `## What to test`). The JSON shape and wiring are unit-verified; the live webview copy gesture is not.
- Field set is the author's pick (`line, timestamp, level, category, tag, source, text`). If the user
  wants `seq`, `sourcePath`, `tier`, or `fw`, those are a one-line addition to `lineToJsonObject`.
