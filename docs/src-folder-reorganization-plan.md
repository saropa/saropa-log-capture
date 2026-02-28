# Plan: Group src/modules, src/ui & src/test into Subfolders

**Goal:** Reduce flat file lists in `modules/`, `ui/`, and `test/` by grouping files into logical subfolders.  
**Scope:** ~97 files in `modules`, ~130 in `ui`, ~48 in `test`.  
**Build:** Single entry `src/extension.ts`; esbuild resolves imports. No path mappings today—only import path updates required when moving files.

---

## 1. `src/modules/` → subfolders by domain

| Subfolder | Purpose | Example files (move here) |
|-----------|---------|---------------------------|
| **capture** | DAP capture, formatting, dedup | `tracker.ts`, `log-session.ts`, `log-session-split.ts`, `log-session-helpers.ts`, `deduplication.ts`, `dap-formatter.ts`, `ansi.ts`, `flood-guard.ts` |
| **session** | Session lifecycle, metadata, runs | `session-manager.ts`, `session-event-bus.ts`, `session-metadata.ts`, `session-lifecycle.ts`, `session-summary.ts`, `session-templates.ts`, `run-boundaries.ts`, `run-summaries.ts`, `metadata-loader.ts` |
| **config** | Settings and workspace config | `config.ts`, `config-file-utils.ts`, `file-retention.ts`, `gitignore-checker.ts` |
| **crashlytics** | Firebase Crashlytics & Play Vitals | `firebase-crashlytics.ts`, `crashlytics-*.ts`, `google-play-vitals.ts`, `google-play-vitals-types.ts`, `crashlytics-diagnostics.ts` |
| **bug-report** | Bug report assembly and formatting | `bug-report-formatter.ts`, `bug-report-sections.ts`, `bug-report-collector.ts`, `bug-report-lint-section.ts`, `bug-report-thread-format.ts` |
| **ai** | AI/LLM-related parsing and formatting | `ai-jsonl-parser.ts`, `ai-jsonl-types.ts`, `ai-line-formatter.ts`, `ai-session-resolver.ts`, `ai-watcher.ts` |
| **export** | HTML/JSON export | `html-export.ts`, `html-export-*.ts`, `export-formats.ts` |
| **search** | Log search and index | `log-search.ts`, `log-search-ui.ts`, `search-index.ts` |
| **source** | Source links, tags, resolution | `source-linker.ts`, `source-resolver.ts`, `source-tag-parser.ts`, `link-helpers.ts`, `symbol-resolver.ts`, `import-extractor.ts` |
| **analysis** | Stack/level/error analysis | `stack-parser.ts`, `level-classifier.ts`, `line-analyzer.ts`, `analysis-relevance.ts`, `error-fingerprint.ts`, `anr-risk-scorer.ts`, `duration-extractor.ts`, `correlation-scanner.ts`, `related-lines-scanner.ts` |
| **git** | Git integration | `git-blame.ts`, `git-diff.ts`, `github-context.ts` |
| **storage** | Bookmarks, presets, scope | `bookmark-store.ts`, `filter-presets.ts`, `scope-context.ts`, `highlight-rules.ts`, `highlight-rules-types.ts` |
| **features** | Watchers, exclusions, alerts, etc. | `keyword-watcher.ts`, `exclusion-matcher.ts`, `error-rate-alert.ts`, `deep-links.ts`, `delete-command.ts` |
| **misc** | Remaining single-purpose modules | `json-detector.ts`, `file-splitter.ts`, `device-detector.ts`, `app-identity.ts`, `app-version.ts`, `error-status-store.ts`, `docs-scanner.ts`, `workspace-analyzer.ts`, `environment-collector.ts`, `diff-engine.ts`, `auto-tagger.ts`, `session-templates-ui.ts`, `folder-organizer.ts`, `perf-fingerprint.ts`, `perf-aggregator.ts`, `cross-session-aggregator.ts` |

**Refinement:** Merge **misc** into **features** or split **analysis** (e.g. `analysis/stack`, `analysis/errors`) only if a folder would still have &gt;8–10 files. Prefer fewer, coarser folders to avoid deep nesting.

---

## 2. `src/ui/` → subfolders by responsibility

| Subfolder | Purpose | Example files (move here) |
|-----------|---------|---------------------------|
| **provider** | Webview provider and wiring | `log-viewer-provider.ts`, `viewer-provider-helpers.ts`, `viewer-handler-wiring.ts`, `viewer-message-handler.ts`, `viewer-broadcaster.ts`, `viewer-content.ts`, `viewer-layout.ts` |
| **viewer** | Core viewer script, data, behavior | `viewer-script.ts`, `viewer-script-keyboard.ts`, `viewer-data.ts`, `viewer-data-helpers.ts`, `viewer-data-viewport.ts`, `viewer-file-loader.ts`, `viewer-target.ts`, `viewer-visibility.ts`, `viewer-scroll-anchor.ts`, `viewer-scrollbar-minimap.ts`, `viewer-copy.ts`, `viewer-pin.ts`, `viewer-timing.ts`, `viewer-goto-line.ts`, `viewer-annotations.ts`, `viewer-json.ts`, `viewer-stats.ts`, `viewer-audio.ts` |
| **viewer-styles** | All `viewer-styles*.ts` | `viewer-styles.ts` + `viewer-styles-*.ts` (content, session, level, search, tags, modal, etc.) |
| **viewer-panels** | Session/options/bookmark/trash/export panels | `viewer-session-panel.ts`, `viewer-session-panel-html.ts`, `viewer-options-panel.ts`, `viewer-options-panel-html.ts`, `viewer-options-panel-script.ts`, `viewer-options-events.ts`, `viewer-bookmark-panel.ts`, `viewer-trash-panel.ts`, `viewer-export.ts`, `viewer-export-html.ts`, `viewer-export-script.ts`, `viewer-export-init.ts`, `viewer-find-panel.ts`, `viewer-about-panel.ts`, `about-content-loader.ts`, `pop-out-panel.ts` |
| **viewer-nav** | Session/run/split navigation | `viewer-session-nav.ts`, `viewer-session-header.ts`, `viewer-run-nav.ts`, `viewer-split-nav.ts`, `viewer-icon-bar.ts` |
| **viewer-search-filter** | Search, filter, level, exclusions | `viewer-search.ts`, `viewer-search-toggles.ts`, `viewer-search-history.ts`, `viewer-filter.ts`, `viewer-level-filter.ts`, `viewer-level-events.ts`, `viewer-level-classify.ts`, `viewer-exclusions.ts`, `viewer-filters-panel.ts`, `viewer-filters-panel-html.ts`, `viewer-filters-panel-script.ts`, `viewer-filter-badge.ts`, `viewer-scope-filter.ts`, `viewer-presets.ts` |
| **viewer-context-menu** | Context menu and modals | `viewer-context-menu.ts`, `viewer-context-menu-html.ts`, `viewer-session-context-menu.ts`, `viewer-context-modal.ts`, `viewer-edit-modal.ts` |
| **viewer-decorations** | Highlights, decorations, errors | `viewer-decorations.ts`, `viewer-deco-settings.ts`, `viewer-highlight.ts`, `viewer-highlight-serializer.ts`, `viewer-error-breakpoint.ts`, `viewer-error-classification.ts`, `viewer-error-handler.ts`, `inline-decorations.ts` |
| **viewer-stack-tags** | Stack trace and source tags UI | `viewer-stack-filter.ts`, `viewer-stack-dedup.ts`, `viewer-source-tags.ts`, `viewer-source-tags-ui.ts`, `viewer-class-tags.ts` |
| **session** | Session list and history | `session-history-provider.ts`, `session-history-helpers.ts`, `session-history-grouping.ts`, `session-severity-counts.ts`, `session-display.ts`, `session-comparison.ts`, `session-comparison-styles.ts` |
| **analysis** | Analysis panel and frames | `analysis-panel.ts`, `analysis-panel-render.ts`, `analysis-panel-script.ts`, `analysis-panel-styles.ts`, `analysis-panel-summary.ts`, `analysis-panel-helpers.ts`, `analysis-panel-streams.ts`, `analysis-frame-handler.ts`, `analysis-frame-render.ts`, `analysis-related-render.ts`, `analysis-trend-render.ts`, `analysis-crash-detail.ts` |
| **insights** | Insights and drill-down | `insights-panel.ts`, `insights-panel-script.ts`, `insights-panel-styles.ts`, `insights-panel-environment.ts`, `insights-drill-down.ts`, `insights-drill-down-styles.ts`, `insights-crashlytics-bridge.ts` |
| **panels** | Timeline, bug report, performance, vitals | `timeline-panel.ts`, `timeline-panel-styles.ts`, `bug-report-panel.ts`, `bug-report-panel-styles.ts`, `viewer-performance-panel.ts`, `viewer-performance-current.ts`, `viewer-recurring-panel.ts`, `viewer-crashlytics-panel.ts`, `vitals-panel.ts` |
| **shared** | Status bar and panel handlers | `status-bar.ts`, `viewer-panel-handlers.ts`, `crashlytics-codelens.ts` |

**Refinement:** If **viewer-styles** is too large, split by area (e.g. `viewer-styles/content`, `viewer-styles/panels`) only if needed. Keep **provider** and **viewer** as the main entry points for the webview.

---

## 3. `src/test/` → mirror source structure

**Option A (recommended):** Mirror `modules` and `ui` with the same subfolder names.

- `src/test/modules/capture/` — tests for `modules/capture/*`
- `src/test/modules/session/` — tests for `modules/session/*`
- … same names as in §1
- `src/test/ui/viewer/`, `src/test/ui/viewer-styles/`, … (only where tests exist)

**Option B:** Simpler two-level mirror.

- `src/test/modules/` — one subfolder per module subfolder (capture, session, config, …)
- `src/test/ui/` — one subfolder per ui subfolder (provider, viewer, panels, …)

**Test file naming:** Keep `*.test.ts` next to the domain (e.g. `src/test/modules/capture/deduplication.test.ts`). Update test imports to use new module paths (e.g. from that file `from '../../../modules/capture/deduplication'` or use path aliases—see §4).

---

## 4. Implementation notes

1. **Imports:** Every move requires updating all `from './modules/foo'` / `from '../modules/foo'` to the new path (e.g. `from './modules/capture/foo'`). Prefer doing one subfolder at a time and running `npm run check-types` and `npm run test` after each batch.
2. **Path aliases (optional):** To avoid deep relative imports, add in `tsconfig.json`:
   - `"paths": { "#modules/*": ["./src/modules/*"], "#ui/*": ["./src/ui/*"] }`
   - Then use `from '#modules/capture/deduplication'`. Ensure esbuild (and test runner) resolve these; esbuild has no built-in tsconfig paths, so you’d need `esbuild-plugin-tsconfig-paths` or equivalent if you introduce aliases.
3. **Order of work:**
   - Create subfolders and move **modules** first (fewer dependents), then fix imports and run typecheck + tests.
   - Then **ui** (same process).
   - Then **test**: create subfolders, move tests, fix imports (they’ll point to new module/ui paths).
4. **CLAUDE.md:** After reorganization, update the “Key Files & Structure” table to show the new paths (e.g. `src/modules/capture/tracker.ts`).
5. **Barrel files:** Avoid adding `index.ts` barrels per subfolder unless the team agrees; they can obscure dependencies and add indirection. Prefer explicit imports from the moved file.

---

## 5. Suggested execution order

| Step | Action |
|------|--------|
| 1 | Create all `src/modules/<subfolder>` dirs and move files (per §1). Update imports; run `npm run check-types` and `npm run test`. |
| 2 | Create all `src/ui/<subfolder>` dirs and move files (per §2). Update imports; run check-types and test. |
| 3 | Create `src/test/modules/<...>` and `src/test/ui/<...>` and move test files. Update test imports; run test. |
| 4 | Update CLAUDE.md and any scripts/docs that reference old paths. |
| 5 | Single pass of lint and full test suite; commit in logical chunks (e.g. “modules reorganization”, “ui reorganization”, “test reorganization”, “docs”). |

---

## 6. Quick reference: current → proposed (sample)

| Current | Proposed |
|---------|----------|
| `src/modules/tracker.ts` | `src/modules/capture/tracker.ts` |
| `src/modules/session-manager.ts` | `src/modules/session/session-manager.ts` |
| `src/modules/crashlytics-api.ts` | `src/modules/crashlytics/crashlytics-api.ts` |
| `src/ui/log-viewer-provider.ts` | `src/ui/provider/log-viewer-provider.ts` |
| `src/ui/viewer-styles.ts` | `src/ui/viewer-styles/viewer-styles.ts` |
| `src/ui/viewer-session-nav.ts` | `src/ui/viewer-nav/viewer-session-nav.ts` |
| `src/test/deduplication.test.ts` | `src/test/modules/capture/deduplication.test.ts` |

This plan keeps grouping by domain, limits nesting depth, and avoids barrels so that the codebase stays navigable and build/tests stay straightforward.
