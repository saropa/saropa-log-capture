# Visual harness (Playwright)

Renders the **real** log-viewer webview HTML/CSS/JS in headless Chromium so dashboard surfaces
can be screenshotted and reviewed outside the VS Code Extension Host — under both Dark and Light
`--vscode-*` theme variables, at narrow and wide widths.

## Why

The webview UI is generated as template literals in `src/ui/**`. Inside VS Code it runs in an
iframe that inherits ~137 `--vscode-*` theme variables and a `vscodeApi` message channel. This
harness reproduces that environment so we can *see* the surfaces (hierarchy, density, theme
adaptation, overflow) instead of reading CSS and guessing.

## Run

```
node test/visual/gen-html.mjs     # esbuild-bundle buildViewerHtml (vscode aliased to a stub) -> .gen/viewer.html
node test/visual/render.mjs       # render every surface x {dark,light} x {narrow,wide} -> .shots/*.png
node test/visual/render.mjs --diagnose   # dump panel-open hooks / icon ids / panels -> .shots/diagnostics.json
```

Output PNGs land in `test/visual/.shots/` (gitignored). Console/page errors, if any, go to
`.shots/errors.log`.

## How it works

- **`gen-html.mjs`** bundles `build-entry.ts` (which calls the production `buildViewerHtml`) with
  `vscode` aliased to `vscode-stub.mjs`, then strips the CSP meta and wires local codicons so the
  document renders standalone.
- **`themes.mjs`** holds authentic-enough Dark / Light `--vscode-*` palettes. Injected at `:root`
  before page scripts so the CSS resolves real theme colors (not just its dark-assuming fallbacks).
- **`render.mjs`** stubs `acquireVsCodeApi`, disables animations (so stills capture the settled
  state), opens each surface on a fresh page, feeds mock messages, and clips the screenshot.
- **`surfaces.mjs`** + **`mock`** payloads mirror the real `post({...})` shapes from
  `src/ui/shared/handlers/*`.

## Known fidelity gaps

- Slide-out panels rely on VS Code's flex "panel-slot" geometry; standalone they can mis-place or
  overlap (the Crashlytics list especially). The **Signals** panel renders faithfully; treat the
  **narrow** width as the realistic panel width.
- Some `vt()` (client-side l10n) keys render raw because the webview `__VT` map isn't injected here.
- Mock data field names are best-effort; some counts (e.g. hot-file "sessions") may read 0.
