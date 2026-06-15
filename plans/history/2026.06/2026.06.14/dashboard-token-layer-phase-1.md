# Dashboard design-token layer — phase 1

The log viewer webview painted every dashboard-class panel (SQL query history, Crashlytics,
Performance, Signal report, and similar) from raw hex literals and magic pixel values — roughly
300 such literals spread across more than fifty style modules, with no shared vocabulary. There
was no token layer at all: each surface bound `--vscode-*` directly or hardcoded a color, so the
same concept (a raised surface, a critical-severity accent, a card gap) was re-expressed
differently per panel and could not be themed or migrated centrally. The canonical cross-project
Saropa Dashboard & Webview Style Guide defines a named token set (§3) for exactly this, but none
of it existed in the viewer.

Phase 1 introduces that token layer as groundwork, without repainting any surface.

## Finish Report (2026-06-14)

### Scope
- **(B)** VS Code extension (TypeScript) — a new CSS-in-TS token module and its wiring.
- **(C)** docs — the canonical style guide and two changelogs (the guide lives in the separate
  saropa_lints repository and is committed there).
- Not **(A)** — no Flutter/Dart code.

### What changed
- **`src/ui/viewer-styles/viewer-styles-tokens.ts` (new).** Exports `getTokenStyles()`, a single
  `:root` block resolving the style guide's §3 token names to the active VS Code theme: brand
  accent, surfaces, text, borders, semantic/severity colors, spacing (4px base), radius,
  elevation, the dashboard type scale, motion, and z-index. Layout constants (§3.13) and the
  page-shell are intentionally excluded from phase 1.
- **`src/ui/viewer-styles/viewer-styles.ts`.** `getTokenStyles()` is prepended ahead of every
  other style module in `getViewerStyles()` so all downstream rules can reference the tokens.
- **`src/test/ui/viewer-token-layer.test.ts` (new).** Pins the token values and the wiring.

### Reconciliation with the canonical reference implementation
The token values mirror `chromeTokens()` in saropa_lints `dashboardChromeStyles.ts`, which is the
live source of truth for the tokens in VS Code. Three host-specific reconciliations are encoded:
- **Type scale anchors at 13px**, the VS Code host density, not the 14px standalone-export base
  (`--text-body: 13px`, `--text-h1: 22px`, `--text-kpi: 28px`, …).
- **`--surface-0` is omitted.** In a webview the page background and cards both resolve to
  `--surface-1` (`--vscode-editor-background`), separated by `--border`; the four-step surface
  ramp only materializes in standalone HTML exports and Flutter.
- **`--brand-glow` is `rgba(249, 115, 22, 0.20)`** and the shadow values match the chrome.

The style guide body was updated in the same effort to remove three internal contradictions the
reference-implementation note had introduced: the §3.1 surface caveat now states `--surface-0` is
standalone-only (it previously claimed it resolves to the editor background in a webview), §3.10
now records the 13px VS Code anchor alongside the 14px standalone base, and the §3.6 standalone
palette `--brand-glow` was aligned to 0.20 to match §3.4.

### Console exemption
The monospace log-line console (virtualized rows, minimap, decoration bars) is explicitly exempt
from the type scale and density and keeps its own `--log-font-size`. The style guide's Scope
section was extended to name this exemption so the console is not "migrated" onto the sans scale.

### Verification
- `npm run check-types` — clean.
- `npm run compile` — full gate (node-toolchain, check-types, lint, NLS parity + coverage,
  webview/outbound/command catalogs, l10n keys, esbuild, dist-size) passed.
- Lint: the new module and test produce zero warnings; the nine warnings reported are
  pre-existing in untouched files.
- Existing style tests that consume `getViewerStyles()` were audited and run through the
  vscode-test Extension Host harness — `viewer-jump-anchor-styles`, `viewer-level-line-colors`,
  `viewer-resize-layout`, `viewer-severity-bar-connector`, `viewer-peek-chevron`,
  `viewer-compress-and-search-styles` — 14 tests, all passing. None pinned the token values; the
  prepended `:root` block does not alter any existing rule.
- New `viewer-token-layer` suite — 5 tests, all passing.

### Behavioral impact
None. No surface consumes the tokens yet, so the rendered viewer is byte-for-byte unchanged.
Per-panel migration off raw hex onto the token names is deferred to later phases.
