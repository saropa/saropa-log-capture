# Agent and contributor notes (Saropa Log Capture)

Short orientation for humans and coding agents working in this repository. Full standards live in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Stack and outputs

- **VS Code extension** (TypeScript). Entry: `src/extension.ts`.
- **Production bundle:** `node esbuild.js` (or `npm run compile`) writes **`dist/extension.js`** (plus `dist/*.js` chunks as configured). **`vscode`** is external; never bundle the VS Code API.
- **Typecheck:** `npm run check-types` → `tsc --noEmit` (no files emitted).
- **Tests:** `npm run compile-tests` emits JavaScript under **`out/`** only (`tsc -p . --outDir out`). **`npm run test`** uses **vscode-test** (Extension Host). Prefer **VS Code** (not Cursor) when pressing **F5** to debug the extension; see README.

## Runtime prerequisites

- **Node.js ≥ 22** (matches CI and `.nvmrc` / `.node-version`). Use `nvm install` / `fnm use` in the repo root if you use a version manager.
- Optional: open the repo in a **[Dev Container](https://code.visualstudio.com/docs/devcontainers/containers)** — see `.devcontainer/devcontainer.json`.

## Log Viewer webview messages

- Webview → extension messages are dispatched from **`src/ui/provider/viewer-message-handler.ts`** into `viewer-message-handler-*.ts` modules.
- **Catalog:** [`doc/internal/webview-incoming-message-types.md`](internal/webview-incoming-message-types.md) lists known `postMessage` `type` strings (auto-generated). After adding or renaming handler `case "…"` entries (or bool-toggle keys in `viewer-workspace-bool-message-map.ts`), run **`npm run generate:webview-catalog`** and commit the updated markdown. **`npm run compile`** runs **`verify:webview-catalog`** and fails if the doc is stale.

## Localization

- User-facing strings use the NLS pipeline (`package.nls*.json`). **`npm run verify-nls`** runs as part of **`npm run compile`**. If you add `%keys%` in `package.json`, update **all** locale files or CI fails.

## Bundle size

- **`npm run compile`** runs **`verify:dist-size`**, which asserts **`dist/extension.js`** stays below a generous ceiling (see `scripts/modules/verify-dist-extension-size.mjs`). Raise the limit only with deliberate review.
- For dependency / import debugging, run **`npm run analyze-bundle`** (writes `out/extension-bundle-meta.json` and prints an esbuild metafile breakdown). This is separate from the normal compile path.

## TypeScript emit hygiene

- **Do not** run plain `tsc -p .` without **`--outDir out`** intending to compile tests — without an outDir, the project `tsconfig` can emit `.js` next to `.ts` under `src/`, which is easy to confuse with source (many legacy `src/**/*.js` paths may still be tracked). Use **`npm run compile-tests`** for test output to `out/`.

## House rules (high level)

- Match existing patterns: `vscode.workspace.fs`, `vscode.Uri.joinPath`, register disposables on `context.subscriptions`.
- Respect CONTRIBUTING limits (file length, function length, etc.) when touching code.
- No editor or tool attribution in commits or user-facing strings (see `.cursor/rules` and CONTRIBUTING).
