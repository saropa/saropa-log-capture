# Viewer dashboard UI/UX refresh

The log-viewer's dashboard surfaces (SQL Query History, Crashlytics, Performance, Signals,
the error-rate panel, and the quality coverage badges) had drifted stylistically. The
Crashlytics panel alone rendered text across roughly sixteen distinct font sizes, mixing
`px` and `em` units so the same `0.9em` resolved to different absolute sizes depending on
nesting depth and nothing aligned. Coverage badges and a row heatmap used hardcoded `rgba()`
colors that assumed a dark editor and faded out on light and high-contrast themes. The SQL
dashboard fired two Drift enrichment requests (database index suggestions, static-code lint
findings) with no loading or error feedback — an in-flight request showed nothing and a
failed one was indistinguishable from "no findings." The Drift server status line broke
ordinary words mid-character at narrow widths, and the Crashlytics empty state used dated
italic styling.

## Finish Report (2026-06-13)

### Scope
(B) VS Code extension (TypeScript) — webview CSS authored as template literals under
`src/ui/viewer-styles/`, the SQL dashboard render module, one host message handler, the
webview string catalog, and a new visual-render harness under `scripts/ui-preview/`. No
Flutter/Dart code involved.

### Changes

**Theme-correct colors (style-guide hard constraint: every color from a `--vscode-*` token).**
`viewer-styles-quality.ts` replaced raw `rgba()` coverage-badge backgrounds/borders and the
`.line-quality-*` row heatmap with theme-derived `color-mix(in srgb, var(--vscode-…) N%,
transparent)` tints — the project's established idiom (see `viewer-styles-decoration-bars.ts`).
Each badge's tint derives from its own foreground token (`debugConsole-sourceForeground`,
`debugConsole-warningForeground`, `errorForeground`), so it tracks the active theme. Tint
strength was set to 22% fill / 55% border after on-screen verification showed the original
faint values did not register as a badge in any theme.

**Type scale.** The Crashlytics, Performance, and Signal panels were collapsed onto one
three-tier text scale — 12px heading, 11px body, 10px caption — eliminating all `em` font
sizes (which compounded unpredictably) and stray `px` values (12.5, 13, 10.5, 9). Non-text
glyph sizes are retained deliberately: 14px action icons, 15px stat numbers, 16px close. The
Signal panel close button was brought from 18px to 16px to match its siblings. The SQL
History stat cards gained a 1px border + 6px radius so a "stat card" reads as one pattern
across dashboards instead of two treatments.

**No-silent-async feedback (SQL dashboard).** `viewer-sql-query-history-dashboard.ts` now
shows a loading line while each Drift enrichment request is in flight and an error line (with
the failure reason) when it fails, via a shared `setSqlHistoryAsyncState` helper and the new
`.sql-qh-async` / `-loading` / `-error` styles. The index-suggestions handler now honors the
`ok === false` reply it previously ignored; the lint path gained a host-side `.catch` in
`viewer-message-handler-panels.ts` that posts `{ error }` so a thrown scan surfaces instead
of leaving the loading line spinning. Four source strings were added to
`strings-webview-b.ts` (`viewer.sqlHistory.{issues,lint}.{loading,error}`); the machine
translation pipeline was NOT run.

**Defect fixes surfaced by rendering the surfaces.** The Drift server status line changed
from `word-break: break-all` (which split "reachable" into "reac"/"hable") to
`overflow-wrap: anywhere`, so only the long server URL breaks when it must. The Crashlytics
empty state dropped italic for upright muted theme-foreground text with roomier padding,
matching VS Code's own "no results" surfaces.

**Visual-render harness (`scripts/ui-preview/`).** A reusable Playwright harness bundles the
shipped CSS (`getViewerStyles()` plus the separately-injected `getQualityBadgeStyles()`),
applies real VS Code Dark/Light/High-Contrast theme variables to representative per-surface
markup, and screenshots each surface at narrow (320px) and wide (480px) widths. It exists
because the panels render their content via client-side JS, so reading CSS source cannot
reveal how a surface actually looks. The harness immediately earned its place by exposing a
harness defect — the quality-badge CSS is injected by `viewer-content.ts`, not
`getViewerStyles()`, so an early run rendered the badges unstyled and made a non-defect look
like an "invisible badge" bug; concatenating both CSS sources fixed it. Run with
`node scripts/ui-preview/render-surfaces.mjs --all-themes`. Screenshots write to `d:/tmp`
(throwaway); `playwright` was added as a dev dependency.

### Verification
- `tsc --noEmit`: zero errors in source.
- Node unit suite (`scripts/modules/test/run-node-tests.mjs`): exit 0, zero failures,
  including two new tests in `viewer-sql-query-history-dashboard.test.ts` pinning the issues
  and lint loading/error wiring.
- `eslint` clean on every touched source and test file.
- Webview + host-outbound message catalogs, `verify-nls`, and `verify:nls-coverage`: all OK
  after the four new string keys.
- `node esbuild.js`: clean; new code confirmed present in `dist/extension.js`.
- Rendered and inspected 42 screenshots (7 surfaces × 3 themes × 2 widths): hierarchy,
  badge legibility, empty state, alignment, and contrast verified across light, dark, and
  high-contrast; no overflow at 320px.

### Not verified
On-device rendering inside a live Extension Development Host was not performed; verification
was via the standalone render harness, which mirrors the shipped CSS but not the full
webview runtime.
