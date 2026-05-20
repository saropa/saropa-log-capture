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
- [x] `viewer-toolbar/viewer-toolbar-html.ts`
- [x] `viewer-toolbar/viewer-toolbar-filter-drawer-html.ts`
- [x] `viewer-toolbar/viewer-toolbar-search-html.ts` (toolbar search flyout)
- [x] `viewer-toolbar/viewer-toolbar-actions-html.ts`
- [x] `viewer-nav/viewer-icon-bar-html.ts`
- [x] `provider/viewer-content-body.ts`
- [x] `viewer-panels/viewer-find-panel.ts` (host HTML + client results)
- [x] `viewer-panels/viewer-session-panel-html.ts` (Logs panel)
- [x] `viewer-panels/viewer-bookmark-panel.ts`
- [x] `panels/viewer-signal-panel.ts`
- [ ] `viewer-search-filter/viewer-search-html.ts` (17 — the in-log search bar, distinct from the toolbar flyout)
- [ ] `viewer-panels/viewer-trash-panel.ts`, `viewer-collections-panel.ts`,
      `panels/viewer-crashlytics-panel.ts`, `viewer-panels/viewer-about-panel.ts`,
      `viewer-panels/viewer-sql-query-history-panel-html.ts`, `viewer-panels/viewer-options-panel*`
- [ ] remaining ~25 smaller files (context menu, modals, decorations,
      replay, run-nav, session-comparison, analysis-panel, etc.) — enumerate per batch.

Client-built JS (method 2 — `vt()`):
- [x] stack/tree header tooltips (`viewer-data-helpers-render-stack.ts`)
- [x] find-panel runtime result strings (`viewer-find-panel.ts`)
- [ ] peek-chevron / dedup-fold affordances
- [ ] divider / "N hidden" pills
- [ ] render-time labels in `viewer-data-helpers-render*.ts`, `viewer-replay.ts`,
      `viewer-error-classification.ts`, `viewer-root-cause-hints-script.ts`,
      `viewer-data-add-db-detectors.ts`, `viewer-data-sql-drilldown-ui.ts`, etc.

### Progress (this pass)

Infra + automated translation + 11 files done & committed (top chrome: toolbar,
filter drawer, search flyout, actions, icon bar, body, find panel; the Logs,
bookmark, and signals side panels (commit `0be058b5`); plus the stack/tree
tooltips). ~30 files remain — the rest of the side panels and the client-side
render/decoration scripts. Every pattern needed is established and proven green;
the remainder is mechanical continuation in the same shape.

## Translation is automated (no hand-translation, no per-string toil)

The publish pipeline already machine-translates at release: `check_l10n_bundles()`
in `scripts/modules/publish/checks_build.py` runs sync + `deep-translator` (with
brand-name shielding) across all 10 locales. The audit/translator previously
scanned only `strings-a.ts` + `strings-b.ts`; it now **globs `src/l10n/strings-*.ts`**
(`extract_all_source_strings()` in `l10n_bundle_audit.py`), so every new key in
`strings-viewer.ts` / `strings-webview.ts` — and any future split — is synced to
the English bundle and translated at publish automatically.

Consequence for this sweep: each area's job is only to **expose** strings through
`t()`/`vt()` with English keys. Translations need no manual work — publish fills
`bundle.l10n.*.json` for the new keys. Until a publish runs, missing keys fall
back to English (unchanged behavior).

## Verification per area

`npm run check-types` · `npm run lint` (no new warnings) · `npm run compile`
(verify steps) · targeted tests · spot-check `t()`/`vt()` keys resolve. Do NOT
machine-translate the bundles.
