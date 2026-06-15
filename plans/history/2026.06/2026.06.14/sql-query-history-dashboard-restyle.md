# SQL Query History dashboard — Saropa style adoption

The SQL Query History panel's stat strip — four headline numbers, a top-queries bar chart, and
the Drift Advisor / Saropa Lints findings list — painted itself from raw `--vscode-*` literals and
magic pixel values, with no brand identity and no shared vocabulary with the other dashboard
surfaces. It read as an anonymous host panel rather than a Saropa dashboard. The shared design-token
layer existed (viewer-styles-tokens.ts) but no surface consumed it, so the token system was
unproven groundwork.

This change makes the SQL Query History dashboard the first surface to adopt the tokens and the
Saropa Dashboard Style Guide, turning the token layer into a visible result.

## Finish Report (2026-06-14)

### Scope
- **(B)** VS Code extension (TypeScript) — one CSS-in-TS style module.
- **(C)** docs — CHANGELOG.
- Not **(A)** — no Flutter/Dart.

### What changed
- **`src/ui/viewer-styles/viewer-styles-sql-query-history-dashboard.ts`.** Rewritten onto the
  shared design tokens with the guide's signature treatment:
  - A 3px brand gradient strip (`::before`) marks the top of the dashboard — the one fixed-color
    accent on an otherwise theme-bound surface.
  - The four KPI stats become raised cards (`--surface-2`, `1px --border`, `--radius-lg`,
    `--shadow`) with `--text-h2` tabular figures over uppercase muted `--text-eyebrow` labels.
  - Top-queries bars are recolored to a brand gradient on a pill `--surface-3` track.
  - Findings rows carry severity through the host diagnostic tokens (`--accent-info`,
    `--accent-warning`, `--accent-critical`); source-attribution chips use `--brand-glow` +
    `--brand-2`; the enable-pack call-to-action becomes the single brand-filled primary action.
  - All spacing, radius, and type values resolve from the token scale; the only remaining literal
    is the `#ffffff` label on the brand-filled button, the guide's prescribed contrast pair for the
    fixed brand fill.
- **`src/test/ui/viewer-sql-dashboard-tokens.test.ts` (new).** Guards the adoption: the brand
  strip, carded stats, brand-anchored chart, severity-token borders, and the absence of the old
  raw `--vscode-panel-border` / `--vscode-editorWidget-background` call-site literals.

### Why it is safe
The change is CSS-only. Every class name and the panel markup are unchanged, so the render
contract the panel HTML and script tests assert is untouched. Colors resolve from the active host
theme, so light, dark, and high-contrast all track automatically; only the brand accent is fixed.

### Verification
- `npm run check-types` — clean.
- `npm run compile` — full gate (node-toolchain, check-types, lint, NLS parity + coverage,
  webview/outbound/command catalogs, l10n keys, esbuild, dist-size) passed.
- Existing render tests audited and run through the vscode-test Extension Host:
  `viewer-sql-query-history-panel-html` and `viewer-sql-query-history-panel-script` — pass. No
  test pinned this file's CSS values; the only `charts-blue` assertions belong to the log-line
  level colors in unrelated files and are unaffected.
- New `viewer-sql-dashboard-tokens` suite — 5 tests, pass.

### Behavioral impact
Visible. The SQL Query History panel's stat strip now shows the brand strip, carded KPI numbers,
brand-colored chart bars, and severity-bordered findings. No data, layout structure, or
interaction changes — only the visual styling.

### Outstanding
The other dashboard-class surfaces (Crashlytics, Performance, Signal report, error-rate,
recurring, project-state) still paint from raw literals and are candidates for the same migration.
