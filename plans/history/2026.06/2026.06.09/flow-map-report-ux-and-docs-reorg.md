# Flow Map report UX changes + docs consolidation into plans/

**Trigger (user requests, verbatim intent):** (1) On the Flow Map page: add a resize bar between
the diagram and the detail column; auto-collapse the whole detail column when all its sections are
collapsed; rename "Activity"→"Activity Timeline", "Screen dwell"→"Screen Visit Log",
"Performance · warnings · errors"→"Issue Report", "Narrative"→"Executive Summary" (with two extra
sentences and a hover copy icon); make the Issue Report table headers sortable with a hover chevron.
(2) Write a markdown guide for the `[flowmap]` navigation tag into `plans/guides`. (3) Move as many
files as possible from `docs/`, `doc/`, `doc/internal/` into `plans/`. (4) Run `/finish`.

## Finish Report (2026-06-09)

This work will be reviewed by another AI.

### Scope
- **(B)** VS Code extension (TypeScript) — the Flow Map webview panel.
- **(C)** docs/scripts — new `[flowmap]` guide + consolidation of loose docs into `plans/`.
- No **(A)** Dart/Flutter code.

### What changed — Flow Map panel (B)
- **Resize bar** between the diagram column and the detail column. A `.col-resize` divider drives a
  `--diagram-w` CSS var via pointer-capture drag; the chosen width persists in webview state and the
  divider folds away when the layout wraps to one column (`@media max-width: 720px`).
- **Column auto-collapse** — when every `<details.sec>` in a column is closed, the column gets
  `col-collapsed` and shrinks to its headers so the open side claims the freed width. Symmetric for
  the single-section diagram (Flow) column and the multi-section detail column. Wired off the
  `toggle` event; idempotent.
- **Section renames** (webview TOC + section titles AND the exported markdown report headings):
  Narrative→**Executive Summary**, Activity→**Activity Timeline**, Screen dwell→**Screen Visit Log**,
  Performance · warnings · errors→**Issue Report**.
- **Executive Summary**: `buildNarrative()` gained two always-present sentences (severity breakdown:
  errors/warnings/perf flags; an overall-health verdict). Shared by the webview and the markdown
  report. A hover-revealed copy button sends the rendered paragraph's `textContent` to the host,
  which writes it to the clipboard (`copyText` message → `flowMap.summaryCopied` status).
- **Sortable Issue Report** — the issue table is now `<table class="sortable">`; clicking a header
  sorts rows (chevron fades in on hover, `aria-sort` shows the active direction). Time sorts
  numerically by parsed `HH:MM:SS`; other columns sort as lowercased text.

### What changed — docs (C)
- New guide: `plans/guides/flowmap-tag-navigation.md` documents the `[flowmap] enter <kind> "<Name>"
  [file.dart:line]` tag (kinds: screen/tab/dialog/sheet/inline) that calling projects emit so the
  Flow Map captures every surface with a source anchor.
- Moved loose docs into `plans/` via `git mv` (history preserved): `CONFIGURATION.md`,
  `SOURCE_LOGGER_BEST_PRACTICES.md`, `correlation-tags.md`, `STYLE_GUIDE.md`,
  `guides/TERMINOLOGY.md` → `plans/guides/`; `SCREENSHOTS_PLAN.md` → `plans/`;
  `doc/internal/proposed-api.md` → `plans/guides/`; `docs/walkthrough/*` (6 files) →
  `plans/walkthrough/`. Repointed every live reference: `README.md`, `CLAUDE.md`, `AGENTS.md`,
  `.claude/rules/global.md`.

### Files NOT moved (and why)
- `doc/internal/contributes-commands.md`, `webview-incoming-message-types.md`,
  `webview-outbound-message-types.md` — **build-load-bearing**: generated and verified by
  `scripts/modules/generate/*.mjs`, asserted by tests, and gated on `npm run compile`
  (`verify:list-commands`, `verify:webview-catalog`, `verify:host-outbound-catalog`). Moving them
  would require editing the generator output paths + tests + `package.json` + `CLAUDE.md`.
- `docs/integrations/README.md` — a `plans/integrations/README.md` already exists; moving would
  collide. Left in place to avoid overwriting a different file.

### Testing
- Audited `src/test/modules/flow-map/flow-map.test.ts` (only suite referencing changed symbols).
  Updated two assertions broken by intentional changes: the markdown-headings list (renames) and the
  `<table>` count regex (`<table>` → `<table[ >]` for the new `sortable` class).
- Ran `npm run test:file -- out/test/modules/flow-map/flow-map.test.js` → **18 passing**.
- `npm run check-types` clean. `npm run compile` passes all verify gates (NLS, webview catalogs,
  list-commands, dist-size). Lint: 0 errors; the 9 warnings are all pre-existing in files this task
  did not touch.

### Commit boundary note (entanglement)
The branch `feat/reports-bucket-and-newer-alert` carried substantial in-progress work at session
start. `CHANGELOG.md` and `README.md` were already modified by that workstream; my flow-map
changelog bullet and doc-link repoints are interleaved. Per the project commit rule, docs bundle
freely but another workstream's **feature code** must not be committed — so my commits include the
two entangled docs (CHANGELOG/README) but exclude all of that workstream's `.ts` feature files
(`session-pin.ts`, `viewer-session-panel-*.ts`, `strings-a.ts`, `strings-viewer-b.ts`,
`session-metadata.ts`, etc.), `.vscode/settings.json`, the pre-modified
`doc/internal/contributes-commands.md`, and the 3 untracked `plans/history/.../*.md` from that
workstream. Those remain in the working tree for the branch owner.

### Outstanding
- None for this task. The excluded files belong to the branch's separate in-progress feature.
