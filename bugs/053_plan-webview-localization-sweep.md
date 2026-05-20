# 053 — Plan: localize the log-viewer webview (full sweep)

## Status: In Progress

## Goal

Make every user-facing string in the viewer **webview** localizable. The webview
was deliberately English-only — neither existing l10n pipeline (`package.nls*`
for package.json, `vscode.l10n.t()` for extension-host UI) reached it. This sweep
routes webview strings through the translation bundles so non-English VS Code
can translate them. **English source keys only** are added here; actual
translations flow through whatever process fills `l10n/bundle.l10n.*.json`. Until
translated, strings fall back to English — identical to today's behavior.

## Two methods (pick by where the string is built)

1. **Host-built HTML** — `/* html */` returned by `getXxxHtml()` and assembled
   during `buildViewerHtml` (toolbar, drawers, search, panel shells). Runs in the
   extension host → use `t('key')` from `src/l10n.ts` **directly**. No new infra.
   Add the English source to `strings-a.ts`/`strings-b.ts` (host string files).
2. **Client-built JS** — strings produced by the webview's own `/* javascript */`
   render code (tooltips with runtime counts, dynamic labels). `vscode.l10n.t()`
   can't run there → use `vt('key', ...args)`. Add the English source to
   `strings-webview.ts`; it ships into the page via the `__VT` map.

## Infrastructure (Phase A — DONE)

- `src/l10n/strings-webview.ts` — webview string registry (English + `{n}` templates).
- `src/l10n.ts` — merges `stringsWebview`; adds `getWebviewL10nMap()`.
- `src/ui/provider/viewer-l10n-inject.ts` — `getWebviewL10nScript()` emits `__VT` + `vt()`.
- `src/ui/provider/viewer-content-scripts.ts` — injects the bridge first (after error handler).
- First consumer migrated: `viewer-data-helpers-render-stack.ts` (stack/tree header tooltips).
- Tests: `viewer-webview-l10n.test.ts`, updated `viewer-tree-group.test.ts`.

## Remaining areas (one commit per area; compile + tests between)

Surface measured: 47 files carry `title=`/`aria-label`/`placeholder` attrs (357
total) plus visible text and client-side JS strings.

Host-built HTML (method 1 — `t()`):
- [ ] `viewer-toolbar/viewer-toolbar-html.ts` (49)
- [ ] `viewer-toolbar/viewer-toolbar-filter-drawer-html.ts` (49)
- [ ] `viewer-toolbar/viewer-toolbar-search-html.ts` (21)
- [ ] `viewer-toolbar/viewer-toolbar-actions-html.ts` (7)
- [ ] `viewer-panels/viewer-session-panel-html.ts` (23)
- [ ] `viewer-nav/viewer-icon-bar-html.ts` (22)
- [ ] `viewer-search-filter/viewer-search-html.ts` (17)
- [ ] `provider/viewer-content-body.ts` (16)
- [ ] `viewer-panels/viewer-find-panel.ts` (14)
- [ ] `viewer-panels/viewer-bookmark-panel.ts` (12)
- [ ] `panels/viewer-signal-panel.ts` (9)
- [ ] remaining ~35 files with smaller counts (context menu, options panel,
      keyboard-shortcuts, replay, collections, etc.) — enumerate per batch.

Client-built JS (method 2 — `vt()`):
- [x] stack/tree header tooltips (`viewer-data-helpers-render-stack.ts`)
- [ ] peek-chevron / dedup-fold affordances
- [ ] divider / "N hidden" pills
- [ ] any other render-time labels surfaced during the host-side passes

## Verification per area

`npm run check-types` · `npm run lint` (no new warnings) · `npm run compile`
(verify steps) · targeted tests · spot-check `t()`/`vt()` keys resolve. Do NOT
machine-translate the bundles.
