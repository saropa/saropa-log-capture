# Signal-panel style module split + webview catalog regeneration

`viewer-styles-signal-sections.ts` grew past the 300-line `max-lines` limit after dashboard CSS was
added, producing an ESLint `max-lines` warning, and the generated reference catalog
`plans/reference/webview-incoming-message-types.md` had drifted from the current webview
message-handler `case` entries, so `verify:webview-catalog` failed and `npm run compile` exited
non-zero. Both are build-hygiene defects with no user-facing behavior.

## Finish Report (2026-06-13)

### Scope

(B) VS Code extension (TypeScript). A pure CSS relocation plus a generated-catalog refresh. No
runtime behavior changes.

### Change

The list-row interactivity and the controls that surround the signal lists — severity stripes, trend
arrows, jump/detail affordances, time-window and sort chips, the inline evidence preview, the
scroll-lock pulse keyframes, and the filter-suggestion rows — were extracted from
`viewer-styles-signal-sections.ts` into a new `viewer-styles-signal-list.ts` exporting
`getSignalListStyles()`. `getSignalPanelStyles()` in `viewer-styles-signal.ts` concatenates the new
module immediately after `getSignalSectionsStyles()`, so the emitted stylesheet is byte-identical and
cascade order is preserved. Both files now sit under the 300-line limit, leaving headroom for further
edits.

`plans/reference/webview-incoming-message-types.md` was regenerated via
`scripts/modules/generate/webview-message-catalog.mjs` so it matches the current handler sources;
the catalog is a generated developer reference, not shipped to end users.

### Why a module split (not a comment trim)

The line limit excludes blank lines and comments, so the file held ~350 lines of actual CSS. Trimming
comments to fit is disallowed (readability first); the project convention is to extract a cohesive
section into its own `viewer-styles-*.ts` module, matching the existing
`viewer-styles-signal-{layout,sections,hero}.ts` arrangement.

### Verification

- `npx eslint` on `viewer-styles-signal-sections.ts`, `viewer-styles-signal-list.ts`, and
  `viewer-styles-signal.ts` — 0 problems.
- `npm run compile` — exit 0 end to end (`check-types`, `lint`, `verify-nls`, `verify:nls-coverage`,
  `verify:webview-catalog`, `verify:host-outbound-catalog`, `verify:list-commands`, `esbuild`,
  `verify:dist-size` at 4.70 MiB of a 12 MiB ceiling).
- No CSS class names changed, so the Signal panel renders identically; the visual harness under
  `test/visual` was used during the broader dashboard work to confirm Signal-panel rendering.

### Files changed

- `src/ui/viewer-styles/viewer-styles-signal-list.ts` — new module with the extracted styles.
- `src/ui/viewer-styles/viewer-styles-signal-sections.ts` — extracted block removed.
- `src/ui/viewer-styles/viewer-styles-signal.ts` — import + concatenation of the new module.
- `plans/reference/webview-incoming-message-types.md` — regenerated to match handler sources.

### Outstanding

None for this change. Unrelated ESLint `max-lines` warnings remain in other files
(e.g. `viewer-script-messages.ts`) outside this change's scope; they are warnings, not errors, and do
not affect the build gate.
