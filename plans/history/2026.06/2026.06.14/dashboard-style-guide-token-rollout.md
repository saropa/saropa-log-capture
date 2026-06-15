# Dashboard Style Guide token rollout — completion

The viewer's dashboard-class panels and the standalone HTML log exports each
carried their own raw hex colors and magic-pixel spacing, so severity reds,
warning ambers, surfaces, and borders drifted between surfaces and ignored the
active VS Code theme in several panels. A shared `:root` token layer existed
(`viewer-styles-tokens.ts`) and the SQL Query History dashboard had been migrated
onto it, but every other analytical / report panel was still hand-painted, and the
saved HTML exports shipped a fixed dark palette that resolved to neither the host
theme nor the canonical Saropa brand colors. This change set finishes the
Saropa Dashboard Style Guide §10 migration: every dashboard-class panel now binds
to the shared tokens, and the standalone exports bake in the §3.6 fallback palette.

## Finish Report (2026-06-14)

### Scope

(B) VS Code extension (TypeScript), plus (C) docs — CHANGELOG and the regenerated
webview message catalogs. No Flutter/Dart (A) code is involved.

### What changed

**Dashboard-class panels migrated onto the shared tokens.** Every analytical /
report surface other than the already-migrated SQL dashboard now references the
named tokens instead of raw hex and off-scale pixels:

- Crashlytics issues / detail / setup + diagnostics
  (`viewer-styles-crashlytics.ts`, `viewer-styles-crashlytics-setup.ts`)
- Performance, DB-timeline tab, error-rate tab
  (`viewer-styles-performance.ts`, `viewer-styles-performance-db.ts`,
  `viewer-styles-error-rate.ts`)
- Signal slide-out: hero, list, sections, layout, N+1 callout
  (`viewer-styles-signal-*.ts`, `viewer-styles-n-plus-one-signal.ts`)
- Project State, Recurring, Root-cause hints, AI panel, code-quality badges
  (`viewer-styles-project-state.ts`, `viewer-styles-recurring.ts`,
  `viewer-styles-root-cause-hints.ts`, `viewer-styles-ai.ts`,
  `viewer-styles-quality.ts`)
- Analysis panel (`analysis-panel-styles.ts`, `analysis-error-styles.ts`)
- Vitals, Flow-map, Timeline chart panels (`vitals-panel.ts`,
  `flow-map-panel-styles.ts`, `timeline-panel-styles.ts`)

Colors map by role to the host theme: severity → `--accent-critical/-high/-warning/-info`,
pass/fail → `--status-good/-bad`, surfaces/text/borders → the shared tokens. Alpha
washes became `color-mix(in srgb, var(--token) N%, transparent)` so they survive
high-contrast mode rather than baking a fixed alpha. Spacing, radius, and dashboard
type sizes that landed on the scale moved to `--space-*` / `--radius-*` / `--text-*`.

**Token injection for separate webviews.** Five panels render in their own webview
rather than inside the main log viewer, so their `<style>` block did not include the
token `:root` — binding them to `var(--surface-1)` would have rendered them
colorless. Each now prepends `getTokenStyles()` into its own style block (guide §10,
"inject the token `:root` at the webview choke point"): `analysis-panel-render.ts`,
`signal-report-render.ts`, `vitals-panel.ts`, `flow-map-panel-styles.ts`, and
`timeline-panel.ts` (all four of its state documents — loading, error, empty, main).

**Close/dismiss-hover unified.** The destructive close / dismiss hover color was
tokenized to `--status-bad` consistently across Crashlytics, Project State,
Recurring, and Root-cause hints, replacing a mix of `var(--vscode-errorForeground,
#f44)` fallbacks.

**Standalone HTML exports ship the §3.6 fallback palette.** A saved or shared
`.html` export has no VS Code host theme, so `--vscode-*`-bound tokens cannot resolve
in a browser. A new module `html-export-fallback-palette.ts` exports
`getStandaloneFallbackPalette()`, which emits the canonical token names with concrete
values — dark as the `:root` default (matching the export's original look) and a
`.light-theme` override for the interactive export's theme toggle. The interactive
stylesheet (`html-export-styles.ts`) replaced its ad-hoc `--bg/--fg/--error/--warn/
--accent/--header-bg` palette with a thin alias layer onto the canonical tokens; the
simple export document builder (`html-export.ts`) replaced its inline hardcoded hex
with the canonical tokens. The annotation note color was unified on `--muted`.

### Preserved as intentional

- Monospace log/code/evidence rows keep their editor font sizing — the high-density
  console is exempt from the §3.10 type scale and §4 density per the guide carve-out;
  it shares only the §3.1–3.5 color/border/semantic tokens.
- ANSI terminal-color classes in the export stay literal: they are the terminal
  palette data, not chrome (analogous to the host `--vscode-terminal-ansi*` tokens).
- Per-source chart series hues and the AI per-category rail hues stay categorical;
  no semantic token represents an N-color categorical palette, so collapsing them
  would lose the per-source / per-category distinction. They remain host-token-first
  with a literal fallback.
- White text on saturated brand/status fills (brand buttons, success/error toasts)
  stays literal — a theme-bound text token could fail AA contrast on those grounds.

### Review notes

- Logic & safety: changes are CSS-string content plus five small render-file
  injections; no control flow, async, or recursion touched.
- Architecture: extends the existing single token vocabulary rather than forking a
  second palette per panel (guide anti-pattern #1). The export palette is a single
  shared module consumed by both export variants — no duplication.
- `color-mix()` is used for theme-adaptive tints; it is supported in the Chromium
  webview and in all current browsers that open a shared report (2023+), and is the
  guide-sanctioned recipe (§3.5, §5.8). Baked alpha hexes would not adapt across the
  export's dark/light toggle.
- Documentation: `html-export-fallback-palette.ts` carries a verbose header
  explaining the host-less rationale, the colors-only scope, and the dark-default
  theme model.

### Testing

- Existing-test audit: grepped the test tree for every changed symbol. Only
  `viewer-token-layer.test.ts` references the dashboard token layer (it pins
  `getTokenStyles()` / `getViewerStyles()`, both unchanged) — it passes (5 cases).
  No test pinned the migrated panels' hex values. For the export work, the only
  test referencing the export modules is `blank-line-text.test.ts`
  (covers `isPlainTextBlankAfterAnsi`, not styles); `export-formats.test.ts` covers
  CSV escaping only. Neither pinned export colors.
- New coverage: `html-export-fallback-palette.test.ts` pins the §3.6 contract — the
  palette bakes the canonical token names, dark is the default with `.light-theme`
  overriding, the palette never binds to `--vscode-*` (host-less), the interactive
  stylesheet ships the palette and aliases onto canonical tokens (old ad-hoc hex
  gone), and the simple export annotation uses `--muted` not the literal green.
  Runs green (5 cases, vscode-test).
- Gates: `npm run check-types` clean; `npm run compile` passes every verify step
  (NLS parity + coverage, webview incoming/outbound catalogs, command list, l10n
  keys, node-toolchain, dist size 4.90 MiB within the 12 MiB ceiling); esbuild
  bundle builds clean.

### Maintenance

- CHANGELOG updated under `[Unreleased] → Changed` for the panel migration, the
  Signal Report panel, and the standalone-export palette.
- README verified — no updates needed (no product facts changed).
- Webview incoming/outbound message catalogs regenerated to match current handler
  sources (drift originated from a concurrent handler change in the tree).
- No bug archive — task did not close a `bugs/*.md` file.
- No active plan closed — `plans/reference/SAROPA_DASHBOARD_STYLE_GUIDE`-style work
  is tracked as reference, not an active plan file; this is recorded as a new history
  entry.

### Outstanding

- Translated bundle entries (`l10n/bundle.l10n.<locale>.json`) for the three
  `viewer.integrations.suggest*` keys (English source added by the concurrent
  suite-connection workstream, captured here) are filled by the operator-run
  machine-translation pipeline on its own cadence; not triggered here.
- The non-token chapters of the guide (§5 component contracts, §5.11 full states
  matrix, §7 accessibility gate audit, §8 copy) were honored where the migration
  touched, but not separately audited per the §11 ship checklist across every panel.
