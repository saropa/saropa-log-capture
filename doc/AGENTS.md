# Agent and contributor notes (Saropa Log Capture)

Short orientation for humans and coding agents working in this repository. Full standards live in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Stack and outputs

- **VS Code extension** (TypeScript). Entry: `src/extension.ts`.
- **Production bundle:** `node esbuild.js` (or `npm run compile`) writes **`dist/extension.js`** (plus `dist/*.js` chunks as configured). **`vscode`** is external; never bundle the VS Code API.
- **Typecheck:** `npm run check-types` → `tsc --noEmit` (no files emitted).
- **Tests:** `npm run compile-tests` emits JavaScript under **`out/`** only (`tsc -p . --outDir out --noEmit false`; root `tsconfig` has **`noEmit: true`** so stray `tsc -p .` does not pollute `src/`). **`npm run test`** uses **vscode-test** (Extension Host). Single file: **`npm run test:file -- out/test/ui/Foo.test.js`**. Prefer **VS Code** (not Cursor) when pressing **F5**; see README.

## Runtime prerequisites

- **Node.js ≥ 22** (matches CI and `.nvmrc` / `.node-version`). Use `nvm install` / `fnm use` in the repo root if you use a version manager.
- Optional: open the repo in a **[Dev Container](https://code.visualstudio.com/docs/devcontainers/containers)** — see `.devcontainer/devcontainer.json`.

## Log Viewer webview messages

- Webview → extension messages are dispatched from **`src/ui/provider/viewer-message-handler.ts`** into `viewer-message-handler-*.ts` modules.
- **Incoming catalog:** [`doc/internal/webview-incoming-message-types.md`](internal/webview-incoming-message-types.md) — run **`npm run generate:webview-catalog`** when you change handler `case "…"` entries (or bool-toggle keys). **`npm run compile`** runs **`verify:webview-catalog`**.
- **Outbound catalog (host → webview):** [`doc/internal/webview-outbound-message-types.md`](internal/webview-outbound-message-types.md) — run **`npm run generate:host-outbound-catalog`** when you add `type` payloads from host code (see `scripts/modules/webview-host-outbound-catalog.mjs` for scan rules). **`verify:host-outbound-catalog`** runs on compile.
- **Proposed APIs (F5 / terminal capture):** [`doc/internal/proposed-api.md`](internal/proposed-api.md).

## Localization

- User-facing strings use the NLS pipeline (`package.nls*.json`). **`npm run verify-nls`** runs as part of **`npm run compile`**. If you add `%keys%` in `package.json`, update **all** locale files or CI fails.

## Bundle size

- **`npm run compile`** runs **`verify:dist-size`**, which asserts **`dist/extension.js`** stays below a generous ceiling (see `scripts/modules/verify-dist-extension-size.mjs`). Raise the limit only with deliberate review.
- For dependency / import debugging, run **`npm run analyze-bundle`** (writes `out/extension-bundle-meta.json` and prints an esbuild metafile breakdown). This is separate from the normal compile path.

## TypeScript emit hygiene

- Root **`tsconfig.json`** sets **`noEmit: true`**. Use **`npm run compile-tests`** (which passes **`--noEmit false --outDir out`**) for test JavaScript under `out/`.
- **`npm run doctor`** — quick check for Node version, `node_modules`, and `dist/extension.js`.
- **`npm run preflight`** — `doctor` + `check-types` + `verify-nls` (fast local gate before a full compile).
- **`npm run clean`** — removes `out/`; add **`--dist`** or **`--vscode-test`** to also drop `dist/` or `.vscode-test/`.
- **`npm run verify:node-toolchain`** — `.nvmrc`, `.node-version`, and `engines.node` stay aligned (runs on compile).
- **Command ID reference:** [`doc/internal/contributes-commands.md`](internal/contributes-commands.md) — run **`npm run generate:list-commands`** when you add `contributes.commands`; **`verify:list-commands`** runs on compile.
- **`npm run test:smoke`** — Extension Host run of **`out/test/extension-smoke.test.js`** only (after **`compile-tests`**).
- **`npm run verify:release-version`** — `package.json` version must have a matching `## [version]` heading in `CHANGELOG.md`. **`npm run verify:release-tag`** also requires git tag `v{version}` on `HEAD`.

## House rules (high level)

- Match existing patterns: `vscode.workspace.fs`, `vscode.Uri.joinPath`, register disposables on `context.subscriptions`.
- Respect CONTRIBUTING limits (file length, function length, etc.) when touching code.
- No editor or tool attribution in commits or user-facing strings (see `.cursor/rules` and CONTRIBUTING).
