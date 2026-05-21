# 053 — Plan: localize the log-viewer webview (full sweep)

## Status: In Progress — visible UI complete, long tail remaining

Make every user-facing string in the viewer **webview** localizable. The webview
was deliberately English-only — neither existing l10n pipeline reached it. This
sweep routes webview strings through the translation bundles so non-English VS
Code can translate them. **English source keys only** are added; the publish
pipeline machine-translates the bundles. Until then, every key falls back to
English — identical to today's behavior (no user-visible change yet).

---

## How it works (infrastructure — DONE)

Two methods, chosen by **where the string is built**:

1. **Host-built HTML** — `/* html */` returned by `getXxxHtml()` and assembled
   during `buildViewerHtml` (toolbar, panels, drawers). Runs in the extension
   host → call `t('key')` from `src/l10n.ts` directly. English source goes in
   `src/l10n/strings-viewer*.ts` (`strings-viewer.ts`, `-b`, `-c`).
2. **Client-built JS** — strings produced by the webview's own `/* javascript */`
   render code (tooltips with runtime counts, dynamic labels), where
   `vscode.l10n.t()` can't run → call `vt('key', …args)`. English source goes in
   `src/l10n/strings-webview.ts`; the bridge ships it into the iframe as `__VT`.

Bridge: `src/ui/provider/viewer-l10n-inject.ts` (`getWebviewL10nScript()` emits
`__VT` + `vt()`), injected first by `viewer-content-scripts.ts`.
`src/l10n.ts:getWebviewL10nMap()` resolves the webview keys host-side.

**Translation is automated.** `scripts/modules/publish/checks_build.py`
(`check_l10n_bundles`) syncs + `deep-translator` machine-translates all 10
locales at publish. Source discovery globs `src/l10n/strings-*.ts`
(`extract_all_source_strings()` in `l10n_bundle_audit.py`), so new keys are
picked up automatically. Do NOT hand-translate the bundles.

### Conventions / gotchas

- **Plurals**: pick a singular/plural key in JS and feed a `{0}` template
  (deep-translator has no ICU) — e.g. `viewer.find.matchWord.one/.many`.
- **Quoted attribute values**: wrap host `t()` in `escapeHtml()` when the English
  contains `"`/`&`/`<`/`>` (see `viewer-content-body.ts` log-content title).
- **Shared host+client keys** live in `strings-webview.ts` (the merged `strings`
  map serves host `t()`; `__VT` serves client `vt()`).
- **Runtime tests**: client render scripts eval'd in a VM sandbox need a `vt`
  global — use the shared `vtStub` from `src/test/ui/viewer-session-panel-test-helpers.ts`.
- **Symbolic / brand exclusions (left English by design)**: single-letter
  severity glyphs (E/W/I/…), emoji, numeric unit values (px, 0.5s, 1x), product
  names, taglines, and marketing blurbs (About panel), AI-explain narrative text.
- **`Loading…`** is preserved verbatim where it already exists; rewording to an
  action verb is a copy change out of scope for the l10n pass (flag separately).

---

## Done (committed, all green at 2834 tests)

- **Infra + automated-translation discovery + reusable `vtStub`.**
- **Top chrome**: toolbar, filter drawer, search flyout, in-log search bar,
  actions menu, icon bar, body banners/breadcrumb/log-content.
- **All side panels**: Find (host + client results), Logs/session (+ list
  rendering), Bookmark, Signals, Trash, Collections, Crashlytics, About (chrome),
  SQL history, Options.
- **Other**: replay bar, run navigation, stack/tree header tooltips, error-hover popup.
- **Already localized via their own bridges** (no work needed): root-cause hints
  (`rchStr`/`window.rchL10n` — see note below), signal-panel script
  (`SignalScriptStrings`).

---

## Remaining

Accurate scan: **24 files / 57 pure-literal `title`/`aria-label`/`placeholder`
attributes**, plus their associated visible-text and runtime strings (≈100–130
strings total). All follow the proven patterns above; this is mechanical volume,
not new design.

### A. Decoration / render tooltips (client → `vt()`, strings-webview.ts)
- [ ] `viewer-decorations/viewer-error-classification.ts` (6) — Critical/ANR/etc. badge tooltips
- [ ] `viewer/viewer-data-helpers-render.ts` (3) — ANR/pattern inline labels
- [ ] `viewer/viewer-data-helpers-render-run-separator-snip.ts` (4) — Errors/Warnings snip labels
- [ ] `viewer/viewer-data-add-db-detectors.ts` (3) — "Show only database-tagged lines", etc.
- [ ] `viewer/viewer-data-sql-drilldown-ui.ts` (1) — "SQL repeat samples"
- [ ] `viewer/viewer-data-add-db-marker-apply.ts` (1)
- [ ] `viewer/viewer-data-divider.ts` (1) — divider / "N hidden" pill
- [ ] `viewer/viewer-data-add-stack-ingest.ts` (1) — async-suspension glyph title
- [ ] `viewer/viewer-data-helpers-render-stack.ts` (1) — one leftover attr
- [ ] `viewer-decorations/viewer-decorations.ts` (host/client mix)
- [ ] `viewer-decorations/viewer-deco-settings.ts` (2)
- [ ] `viewer-decorations/viewer-highlight.ts` (1), `viewer-lint-badge.ts` (1), `viewer-quality-badge.ts` (1)
- [ ] `viewer/viewer-root-cause-hints-script.ts` (3) — leftover attrs NOT going through `rchStr`
- [ ] `viewer-stack-tags/viewer-source-tags-ui.ts` (1), `viewer-sql-pattern-tags.ts` (1)
- [ ] `viewer-search-filter/viewer-exclusions.ts` (1) — "Remove" chip

### B. Context menus / modals / popovers
- [ ] `viewer-context-menu/viewer-context-popover-integration-sections.ts` (4) — "Copy query", etc.
- [ ] `viewer-context-menu/viewer-context-popover-script.ts` (2), `viewer-context-popover-db-signal.ts` (2)
- [ ] `viewer-context-menu/viewer-edit-modal.ts` (3), `viewer-context-modal.ts` (1)
- [ ] `viewer-context-menu/viewer-quality-popover-script.ts` (1)
- [ ] `viewer/viewer-auto-hide-modal.ts` (2), `viewer/viewer-log-file-modal.ts` (2)
- [ ] `viewer/viewer-goto-line.ts` (1), `viewer/viewer-pin.ts` (1), `viewer-panels/viewer-trash-panel.ts` (1 leftover)

### C. Secondary panels / screens
- [ ] `session/session-comparison-html.ts` (4) — "Session Comparison", etc.
- [ ] `panels/viewer-performance-panel.ts` (3), `panels/viewer-performance-db-tab.ts` (2)
- [ ] `panels/viewer-recurring-panel.ts` (4)
- [ ] `analysis/analysis-panel-render.ts` (2) — "Line Analysis"
- [ ] `viewer-panels/viewer-sql-query-history-panel-render.ts` (3) — client-rendered rows

---

## Verification (per file / batch)

1. `npm run check-types` (0 errors)
2. `npm run lint` on touched files (no new warnings — watch `max-params`, `max-lines`)
3. `npm run compile-tests && npm run test` (full suite green; add `vt` to any new
   runtime sandbox via `vtStub`; update tests that pinned an old literal)
4. `npm run compile` periodically (NLS / catalog / dist-size gates)
5. Commit per area; do NOT machine-translate bundles (publish does it)
6. When the lists above are all checked: flip Status to **Fixed**, run the full
   `npm run compile` + `npm run test`, and note the final string count.
