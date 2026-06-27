# Log banner: "Open in Editor" no-op, kebab z-order, and title-case labels

The click-opened log banner's file actions did nothing in a popped-out panel, its overflow (kebab) menu painted behind the log content, and its primary buttons used sentence case. All three are fixed: file actions now target the URI the banner displays, the banner is promoted above the log content's stacking, and the two named buttons read in title case.

## Finish Report (2026-06-27)

### Scope
VS Code extension (TypeScript) plus CHANGELOG. No Flutter/Dart code touched.

### Defect 1 — "Open in Editor" (and all banner file actions) silently no-op'd in the pop-out panel

The unified log banner (plan 109) renders in CLICK mode from the footer filename / staleness chip and offers Open in Editor, Copy path, and a kebab of further file actions for the OPEN log. The banner displays the open log via `logContextInfo.currentUri` (computed host-side from the provider's `getCurrentFileUri()`), but its action buttons posted a bare message (`{ type }`) with no URI. The host handler `handleLogFileAction` then resolved the target against the *receiving target's* own `currentFileUri`.

That host-side field diverges from what the banner displays:
- `LogViewerProvider.loadFromFile` sets `this.currentFileUri` directly when a report is opened, and does not broadcast it.
- `broadcaster.setCurrentFile` is only called for the live tail session (`extension-lifecycle.ts`).

So in a popped-out panel (a separate `ViewerTarget`), `currentFileUri` was unset or stale while the banner still showed the correct file. A bare message resolved to no URI → the action did nothing visible.

Fix: `postCurrentFileAction` in `viewer-log-banner.ts` now attaches `ctx.currentUri` (the displayed URI, from `logContextInfo`) as `uriString` when present. `handleLogFileAction` already prefers `uriString` over `currentFileUri` (the same mechanism plan 109/057 added for acting on the open or newest controller log). Every banner file action — Open in Editor, Copy path, and all kebab items — now targets the file the user is looking at, independent of per-target host state. Falls back to the bare message when `currentUri` is empty.

### Defect 2 — kebab overflow menu painted behind the log content

The CLICK-mode kebab menu is `position: absolute; top: 100%` and drops below the banner over the log content. `#log-content-wrapper`, `.log-content-clip`, and `#log-content` are each `position: relative` with no `z-index`, so none establishes a stacking context; the content's own positioned descendants (severity bars at z-index 1–3, the floating copy icon `#copy-float` at z-index 10) bubble up to compete in the `#log-area-with-footer` stacking context. The banner sat at `z-index: auto`, so its kebab child (z-index 5) painted *under* those bars.

Fix: added `.viewer-newer-banner { z-index: 20 }` in `viewer-styles-session-newer.ts`, promoting the whole banner (and its overflow menu) above the persistent log content (max z-index 10 in the drop zone) while staying below the toolbar (50), its dropdowns (100), and modal overlays (200+). Scoped to `.viewer-newer-banner` so the session panel's sticky newer banner is unaffected. The transient high-z surfaces (decoration popover 180, copy toast 300, context menu 200/201, modals 400) are `position: fixed` overlays and correctly remain above the banner.

### Defect 3 — sentence-case button labels

`viewer.logFile.openEditor` ("Open in editor") and `viewer.logFile.copyFullPath` ("Copy full path") were title-cased to "Open in Editor" and "Copy Full Path". The merged English `strings` map spreads `stringsWebview` last, so `strings-webview.ts` is the value that resolves at runtime (host `t()` and webview `vt()` alike); the `strings-viewer-d.ts` copies were shadowed duplicates and were updated to match. The same modal (`viewer-log-file-modal.ts`) shares these keys and now shows the title-case labels too. Non-English bundles fall back to English until re-translated on the operator-run MT cadence.

### Tests
- New `src/test/ui/viewer-log-banner.test.ts` (3 cases): asserts the banner script attaches `ctx.currentUri` as `uriString`, routes open-editor/copy-path through the URI-carrying helper, and that the two English labels are title case. All pass.
- `src/test/ui/viewer-log-file-modal.test.ts` (7 cases) re-run to confirm no regression from the shared label change; it asserts element IDs and message types, not label text. All pass.
- `npm run check-types` clean.

### Files
- `src/ui/viewer/viewer-log-banner.ts` — `postCurrentFileAction` attaches the displayed URI.
- `src/ui/viewer-styles/viewer-styles-session-newer.ts` — `.viewer-newer-banner { z-index: 20 }`.
- `src/l10n/strings-webview.ts`, `src/l10n/strings-viewer-d.ts` — title-case labels.
- `src/test/ui/viewer-log-banner.test.ts` — new test.
- `CHANGELOG.md` — entries under `[9.0.10]`.
